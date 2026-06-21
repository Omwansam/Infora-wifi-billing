import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Wifi,
  DollarSign,
  Star,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Users,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPlans,
  getPlanStats,
  deletePlan,
  togglePlanActive,
} from '../../services/planService';
import { formatCurrency } from '../../lib/utils';
import { normalizePlanFeatures } from '../../lib/planUtils';
import PlanFeatureIcon from './PlanFeatureIcon';
import PlanStatusBadge from './PlanStatusBadge';
import PlanForm from './PlanForm';

const FILTER_TABS = [
  { value: 'all', label: 'All Plans' },
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 12,
    total: 0,
    pages: 0,
  });

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current_page,
        per_page: pagination.per_page,
        search: searchTerm || undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        popular: statusFilter === 'popular' ? true : undefined,
      };
      const response = await getPlans(params);
      if (response.success) {
        setPlans(response.data.plans || []);
        setPagination((prev) => ({
          ...prev,
          current_page: response.data.current_page || 1,
          total: response.data.total || 0,
          pages: response.data.pages || 0,
        }));
      }
    } catch {
      toast.error('Failed to load plans');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.current_page, pagination.per_page, searchTerm, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await getPlanStats();
      if (response.success) {
        setStats(response.data);
      }
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

  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Delete "${planName}"? This cannot be undone.`)) return;
    try {
      setActionLoading(true);
      const response = await deletePlan(planId);
      if (response.success) {
        toast.success('Plan deleted');
        loadPlans();
        loadStats();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (planId) => {
    try {
      setActionLoading(true);
      const response = await togglePlanActive(planId);
      if (response.success) {
        toast.success(`Plan ${response.data.is_active ? 'activated' : 'deactivated'}`);
        loadPlans();
        loadStats();
      }
    } catch {
      toast.error('Failed to update plan status');
    } finally {
      setActionLoading(false);
    }
  };

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Plans',
        value: stats.total_plans || 0,
        subtitle: `${stats.active_plans || 0} currently active`,
        icon: Package,
        accent: 'from-cyan-500 to-blue-600',
      },
      {
        title: 'Active Plans',
        value: stats.active_plans || 0,
        subtitle: 'Available for new subscribers',
        icon: CheckCircle,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Popular Plans',
        value: stats.popular_plans || 0,
        subtitle: 'Featured on signup flows',
        icon: Star,
        accent: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Average Price',
        value: formatCurrency(stats.average_price || 0),
        subtitle: stats.price_range
          ? `${formatCurrency(stats.price_range.min)} – ${formatCurrency(stats.price_range.max)}`
          : 'Across all packages',
        icon: DollarSign,
        accent: 'from-indigo-500 to-violet-600',
      },
    ],
    [stats]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wider">Catalog</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Service Plans</h1>
              <p className="text-slate-600 mt-1">Packages, pricing tiers, and subscriber offerings</p>
            </div>
            <div className="flex gap-3 self-start">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Plan
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by plan name or speed..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPagination((prev) => ({ ...prev, current_page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPagination((prev) => ({ ...prev, current_page: 1 }));
                  }}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-600 border-t-transparent mx-auto" />
            <p className="mt-4 text-slate-600">Loading service plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Wifi className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No plans found</h3>
            <p className="mt-1 text-slate-500">Adjust filters or create your first service plan.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {plans.map((plan, index) => {
              const features = normalizePlanFeatures(plan.features);
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`relative rounded-2xl border bg-white shadow-sm overflow-hidden ${
                    plan.popular ? 'border-cyan-300 ring-1 ring-cyan-100' : 'border-slate-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold text-center py-1.5">
                      Most Popular
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{plan.speed}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {plan.popular && <PlanStatusBadge status="popular" />}
                        <PlanStatusBadge status={plan.is_active ? 'active' : 'inactive'} />
                      </div>
                    </div>

                    <div className="mb-5">
                      <span className="text-3xl font-bold text-slate-900">{formatCurrency(plan.price)}</span>
                      <span className="text-sm text-slate-500 ml-1">/month</span>
                    </div>

                    <div className="space-y-2 mb-5 min-h-[120px]">
                      {features.slice(0, 4).map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50">
                          <PlanFeatureIcon feature={feature} />
                          <span className="text-sm text-slate-700">{feature}</span>
                        </div>
                      ))}
                      {features.length > 4 && (
                        <p className="text-xs font-medium text-cyan-700 text-center pt-1">
                          +{features.length - 4} more features
                        </p>
                      )}
                      {features.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-6">No features listed</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/plans/${plan.id}`)}
                          className="p-2 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlan(plan);
                            setShowForm(true);
                          }}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Edit plan"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(plan.id)}
                          disabled={actionLoading}
                          className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id, plan.name)}
                          disabled={actionLoading}
                          className="p-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          title="Delete plan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center text-sm text-slate-500">
                        <Users className="h-4 w-4 mr-1.5" />
                        {plan.customers_count || 0}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 mt-6">
            <p className="text-sm text-slate-600">
              Showing {(pagination.current_page - 1) * pagination.per_page + 1}–
              {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page - 1 }))}
                disabled={pagination.current_page === 1}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-slate-600">
                Page {pagination.current_page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, current_page: prev.current_page + 1 }))}
                disabled={pagination.current_page === pagination.pages}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showForm && (
            <PlanForm
              planId={editingPlan?.id}
              onClose={() => {
                setShowForm(false);
                setEditingPlan(null);
              }}
              onSuccess={() => {
                setShowForm(false);
                setEditingPlan(null);
                loadPlans();
                loadStats();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
