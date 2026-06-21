import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import PaymentStatusBadge from '../billing/PaymentStatusBadge';
import { getFinanceLeads } from '../../services/financeService';

export default function FinanceLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getFinanceLeads({ search: searchTerm || undefined });
      if (response.success) {
        setLeads(response.data.leads || []);
        setStats(response.data.stats || {});
      } else {
        toast.error(response.message || 'Failed to load leads');
      }
    } catch {
      toast.error('Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(loadLeads, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadLeads, searchTerm]);

  const statsCards = useMemo(
    () => [
      {
        title: 'Open Leads',
        value: stats.total_leads ?? leads.length,
        subtitle: 'Pending signup prospects',
        icon: Users,
        accent: 'from-violet-500 to-purple-600',
      },
      {
        title: 'New This Month',
        value: stats.new_this_month ?? 0,
        subtitle: 'Recently added inquiries',
        icon: TrendingUp,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Pipeline Value',
        value: formatCurrency(stats.pipeline_value ?? 0),
        subtitle: 'Estimated monthly if converted',
        icon: DollarSign,
        accent: 'from-indigo-500 to-blue-600',
      },
    ],
    [stats, leads.length]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">Finance</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Sales Leads</h1>
              <p className="text-slate-600 mt-1">Prospects awaiting activation and onboarding</p>
            </div>
            <button
              onClick={loadLeads}
              disabled={loading}
              className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent mx-auto" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16">
              <TrendingUp className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No leads found</h3>
              <p className="text-slate-500 mt-1">Pending customer signups will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Lead</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Interested Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Est. Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Added</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                            {customerInitials(lead.name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{lead.name}</p>
                            <PaymentStatusBadge status="pending" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{lead.email}</p>
                          <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{lead.phone || '—'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {lead.service_plan?.name || lead.package || 'Not selected'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(lead.estimated_value || lead.service_plan?.price || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {lead.created_at ? formatDate(lead.created_at) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/customers/${lead.id}`)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100"
                        >
                          View
                          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
