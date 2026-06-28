import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Router,
  Wifi,
  Clock,
  Boxes,
  DollarSign,
  Star,
  CheckCircle,
  RefreshCw,
  Package,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPlans,
  getPlanStats,
  deletePlan,
} from '../../services/planService';
import { formatCurrency } from '../../lib/utils';
import PackageTableRow from './PackageTableRow';

const TYPE_TABS = [
  { key: 'all', label: 'All Packages', icon: Layers },
  { key: 'pppoe', label: 'PPPoE', icon: Router },
  { key: 'hotspot', label: 'Hotspot', icon: Wifi },
  { key: 'trial', label: 'Trial', icon: Clock },
  { key: 'bundle', label: 'Bundle', icon: Boxes },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'popular', label: 'Popular' },
];

export default function ServicePlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        per_page: 50,
        search: searchTerm || undefined,
        plan_type: typeFilter !== 'all' ? typeFilter : undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        popular: statusFilter === 'popular' ? true : undefined,
      };
      const response = await getPlans(params);
      if (response.success) {
        setPlans(response.data.plans || []);
      }
    } catch {
      toast.error('Failed to load packages');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await getPlanStats();
      if (response.success) setStats(response.data);
    } catch {
      setStats({});
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadPlans, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPlans, searchTerm]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = () => {
    loadPlans();
    loadStats();
  };

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete package "${plan.name}"?`)) return;
    try {
      setActionLoading(true);
      const response = await deletePlan(plan.id);
      if (response.success) {
        toast.success('Package deleted');
        loadPlans();
        loadStats();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditPlan = (plan) => navigate(`/plans/${plan.id}/edit`);

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Packages',
        value: stats.total_plans || 0,
        subtitle: `${stats.active_plans || 0} active · ${(stats.total_plans || 0) - (stats.active_plans || 0)} inactive`,
        icon: Package,
        accent: 'from-violet-500 to-purple-600',
      },
      {
        title: 'Active',
        value: stats.active_plans || 0,
        subtitle: 'Available for new clients',
        icon: CheckCircle,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Featured',
        value: stats.popular_plans || 0,
        subtitle: 'Shown on portal & signup',
        icon: Star,
        accent: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Avg. Price',
        value: formatCurrency(stats.average_price || 0),
        subtitle: stats.price_range
          ? `${formatCurrency(stats.price_range.min)} – ${formatCurrency(stats.price_range.max)}`
          : 'Monthly pricing',
        icon: DollarSign,
        accent: 'from-indigo-500 to-blue-600',
      },
    ],
    [stats]
  );

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">Pricing</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Packages</h1>
              <p className="text-slate-600 mt-1">PPPoE, hotspot, trial, and bundle pricing for your network</p>
            </div>
            <div className="flex flex-wrap gap-3 self-start">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate('/plans/new')}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white shadow-sm`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {TYPE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = typeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
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
                placeholder="Search package name or speed..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-violet-600 text-white shadow-sm'
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
                <tr className="border-b border-slate-100">
                  {['Package', 'Price', 'Duration', 'Data limit', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                        h === 'Actions' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-violet-500" />
                      Loading packages…
                    </td>
                  </tr>
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-semibold text-slate-900">No packages found</p>
                      <p className="text-sm text-slate-500 mt-1">Create a package or adjust your filters.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/plans/new')}
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add Package
                      </button>
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <PackageTableRow
                      key={plan.id}
                      plan={plan}
                      onEdit={handleEditPlan}
                      onDelete={handleDeletePlan}
                      deleting={actionLoading}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && plans.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 text-sm text-slate-600">
              {plans.length} package{plans.length !== 1 ? 's' : ''}
              {typeFilter !== 'all' ? ` · ${typeFilter}` : ''}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
