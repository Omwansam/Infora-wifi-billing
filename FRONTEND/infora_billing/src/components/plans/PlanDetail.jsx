import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  DollarSign,
  TrendingUp,
  Wifi,
  Star,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPlan,
  deletePlan,
  togglePlanActive,
  togglePlanPopular,
  getPlanCustomers,
} from '../../services/planService';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useConfirm } from '../../contexts/ConfirmContext';
import { normalizePlanFeatures, planMonthlyRevenue } from '../../lib/planUtils';
import { customerInitials } from '../../lib/billingFormatters';
import PlanFeatureIcon from './PlanFeatureIcon';
import PlanStatusBadge from './PlanStatusBadge';

export default function PlanDetail() {
  const confirm = useConfirm();
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      const [planResponse, customersResponse] = await Promise.all([
        getPlan(planId),
        getPlanCustomers(planId, { per_page: 20 }),
      ]);
      if (planResponse.success) setPlan(planResponse.data);
      if (customersResponse.success) setCustomers(customersResponse.data.customers || []);
    } catch {
      toast.error('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanDetails();
  }, [planId]);

  const features = useMemo(() => normalizePlanFeatures(plan?.features), [plan]);
  const monthlyRevenue = useMemo(
    () => planMonthlyRevenue(plan, customers.length),
    [plan, customers.length]
  );

  const handleToggleActive = async () => {
    try {
      setActionLoading(true);
      const response = await togglePlanActive(planId);
      if (response.success) {
        setPlan(response.data);
        toast.success(`Plan ${response.data.is_active ? 'activated' : 'deactivated'}`);
      }
    } catch {
      toast.error('Failed to update plan status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePopular = async () => {
    try {
      setActionLoading(true);
      const response = await togglePlanPopular(planId);
      if (response.success) {
        setPlan(response.data);
        toast.success(response.data.popular ? 'Marked as popular' : 'Removed from popular');
      }
    } catch {
      toast.error('Failed to update popular status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: 'Delete plan?', message: 'This plan will be permanently deleted. This cannot be undone.', confirmLabel: 'Delete plan', tone: 'danger' }))) return;
    try {
      setActionLoading(true);
      const response = await deletePlan(planId);
      if (response.success) {
        toast.success('Plan deleted');
        navigate('/plans');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete plan');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center bg-white rounded-2xl border border-slate-200 p-10 max-w-md">
          <Wifi className="h-12 w-12 text-slate-300 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Package not found</h2>
          <button
            onClick={() => navigate('/plans')}
            className="mt-6 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium"
          >
            Back to Packages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button
            onClick={() => navigate('/plans')}
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Packages
          </button>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {plan.popular && <PlanStatusBadge status="popular" size="lg" />}
                <PlanStatusBadge status={plan.is_active ? 'active' : 'inactive'} size="lg" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{plan.name}</h1>
              <p className="text-slate-600 mt-1">{plan.speed} · Plan #{plan.id}</p>
            </div>
            <div className="flex gap-2 self-start">
              <button
                onClick={() => navigate(`/plans/${planId}/edit`)}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 text-white p-8 shadow-lg"
            >
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-cyan-200 text-sm font-medium uppercase tracking-wider">Monthly price</p>
                  <p className="text-4xl font-bold mt-1">{formatCurrency(plan.price)}</p>
                  <p className="text-slate-300 mt-2">{plan.speed}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-300 text-sm">Estimated MRR</p>
                  <p className="text-2xl font-semibold">{formatCurrency(monthlyRevenue)}</p>
                  <p className="text-slate-400 text-xs mt-1">{customers.length} subscribers</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Included Features</h2>
              {features.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <PlanFeatureIcon feature={feature} size="lg" />
                      <span className="text-slate-700 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No features configured for this plan.</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-slate-100">
                <button
                  onClick={handleToggleActive}
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
                    plan.is_active
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {plan.is_active ? 'Deactivate Plan' : 'Activate Plan'}
                </button>
                <button
                  onClick={handleTogglePopular}
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
                    plan.popular
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Star className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  {plan.popular ? 'Remove Popular Badge' : 'Mark as Popular'}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Subscribers</h2>
                <span className="text-sm text-slate-500">{customers.length} customers</span>
              </div>
              {customers.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {customers.slice(0, 8).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                          {customerInitials(customer.name || customer.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{customer.name || customer.full_name}</p>
                          <p className="text-sm text-slate-500">{customer.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/clients/${customer.id}`)}
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Users className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="mt-3 text-slate-500">No subscribers on this plan yet.</p>
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="h-4 w-4" />
                    Subscribers
                  </div>
                  <span className="font-semibold text-slate-900">{customers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <DollarSign className="h-4 w-4" />
                    Monthly revenue
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(monthlyRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <TrendingUp className="h-4 w-4" />
                    Per subscriber
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(plan.price)}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-900">{plan.created_at ? formatDate(plan.created_at) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="font-medium text-slate-900">{plan.updated_at ? formatDate(plan.updated_at) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Plan ID</dt>
                  <dd className="font-medium text-slate-900">#{plan.id}</dd>
                </div>
              </dl>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
