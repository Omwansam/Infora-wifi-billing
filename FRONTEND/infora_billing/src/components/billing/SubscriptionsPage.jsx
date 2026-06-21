import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  Repeat,
  DollarSign,
  Users,
  Wifi,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api';
import { getAccessToken } from '../../utils/authToken';
import PaymentStatusBadge from './PaymentStatusBadge';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
];

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({ active_subscriptions: 0, monthly_recurring_revenue: 0, total_subscriptions: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const params = new URLSearchParams({ per_page: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      const response = await fetch(`${API_ENDPOINTS.BILLING_SUBSCRIPTIONS}?${params}`, {
        headers: getAuthHeaders(token),
      });
      const data = await response.json();
      if (response.ok) {
        setSubscriptions(data.subscriptions || []);
        setStats(data.stats || {});
      } else {
        toast.error(data.message || 'Failed to load subscriptions');
      }
    } catch {
      toast.error('Failed to load subscriptions');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(loadSubscriptions, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadSubscriptions, searchTerm]);

  const filtered = useMemo(() => subscriptions, [subscriptions]);

  const statsCards = [
    {
      title: 'Active Subscriptions',
      value: stats.active_subscriptions ?? 0,
      subtitle: 'Currently billing customers',
      icon: Users,
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Monthly Recurring Revenue',
      value: formatCurrency(stats.monthly_recurring_revenue ?? 0),
      subtitle: 'From active plans',
      icon: DollarSign,
      accent: 'from-indigo-500 to-violet-600',
    },
    {
      title: 'Total Subscriptions',
      value: stats.total_subscriptions ?? subscriptions.length,
      subtitle: 'Customers on service plans',
      icon: Repeat,
      accent: 'from-blue-500 to-cyan-600',
    },
    {
      title: 'Avg Plan Value',
      value: stats.active_subscriptions
        ? formatCurrency((stats.monthly_recurring_revenue || 0) / stats.active_subscriptions)
        : formatCurrency(0),
      subtitle: 'Per active subscriber',
      icon: Wifi,
      accent: 'from-slate-600 to-slate-800',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">Billing</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Subscriptions</h1>
              <p className="text-slate-600 mt-1">Recurring plans, MRR, and subscriber lifecycle</p>
            </div>
            <button
              onClick={loadSubscriptions}
              disabled={loading}
              className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer or plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    statusFilter === tab.value
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Customer', 'Plan', 'Speed', 'Monthly', 'Status', 'Since', 'Usage', ''].map((h) => (
                    <th key={h || 'a'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-violet-500" />
                      Loading subscriptions…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <Repeat className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-semibold text-slate-900">No subscriptions found</p>
                      <p className="text-sm text-slate-500 mt-1">Assign service plans to customers to create subscriptions.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-violet-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelected(sub)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                            {customerInitials(sub.customerName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{sub.customerName}</p>
                            <p className="text-xs text-slate-500">{sub.customerEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">{sub.planName}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{sub.planSpeed || '—'}</td>
                      <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(sub.monthlyAmount)}</td>
                      <td className="px-5 py-4"><PaymentStatusBadge status={sub.status} /></td>
                      <td className="px-5 py-4 text-sm text-slate-600">{sub.startDate ? formatDate(sub.startDate) : '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-[80px]">
                            <div
                              className="h-2 bg-violet-500 rounded-full"
                              style={{ width: `${Math.min(sub.usagePercentage || 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{sub.usagePercentage || 0}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelected(sub)}
                          className="p-2 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 text-sm text-slate-600">
              Showing {filtered.length} subscriptions
            </div>
          )}
        </motion.div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-violet-200 text-xs uppercase tracking-wider">Subscription</p>
                  <p className="font-bold text-lg mt-1">{selected.customerName}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-2xl font-bold mt-2">{selected.planName}</p>
              <p className="text-violet-200 text-sm">{selected.planSpeed}</p>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Monthly amount</span><span className="font-bold text-violet-700">{formatCurrency(selected.monthlyAmount)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><PaymentStatusBadge status={selected.status} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Started</span><span>{selected.startDate ? formatDate(selected.startDate) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Last payment</span><span>{selected.lastPaymentDate ? formatDate(selected.lastPaymentDate) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Balance</span><span>{formatCurrency(selected.balance)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Data usage</span><span>{selected.usagePercentage}%</span></div>
              <button
                onClick={() => navigate(`/customers/${selected.id}`)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
              >
                View customer profile
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
