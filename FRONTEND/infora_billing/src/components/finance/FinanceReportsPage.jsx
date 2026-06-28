import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import { getFinanceSummary } from '../../services/financeService';

const PIE_COLORS = ['#0891b2', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function FinanceReportsPage() {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getFinanceSummary();
      if (response.success) {
        setSummary(response.data);
      } else {
        toast.error(response.message || 'Failed to load finance reports');
      }
    } catch {
      toast.error('Failed to load finance reports');
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Revenue',
        value: formatCurrency(summary.total_revenue ?? 0),
        subtitle: 'Paid invoices to date',
        icon: DollarSign,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Total Expenses',
        value: formatCurrency(summary.total_expenses ?? 0),
        subtitle: 'Recorded operating costs',
        icon: TrendingDown,
        accent: 'from-rose-500 to-red-600',
      },
      {
        title: 'Net Profit',
        value: formatCurrency(summary.net_profit ?? 0),
        subtitle: 'Revenue minus expenses',
        icon: TrendingUp,
        accent: 'from-indigo-500 to-violet-600',
      },
      {
        title: 'Monthly Recurring Revenue',
        value: formatCurrency(summary.monthly_recurring_revenue ?? 0),
        subtitle: `${summary.active_subscribers ?? 0} active subscribers`,
        icon: Users,
        accent: 'from-cyan-500 to-blue-600',
      },
    ],
    [summary]
  );

  const monthlyTrend = summary.monthly_trend || [];
  const planDistribution = (summary.plan_distribution || []).map((item) => ({
    name: item.name,
    value: item.subscribers,
    mrr: item.mrr,
  }));

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Finance</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Financial Reports</h1>
              <p className="text-slate-600 mt-1">Revenue, expenses, MRR, and subscriber distribution</p>
            </div>
            <button
              onClick={loadSummary}
              disabled={loading}
              className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto" />
            <p className="mt-4 text-slate-600">Loading financial reports...</p>
          </div>
        ) : (
          <>
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
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Revenue vs Expenses</h2>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-6">
                  <PieChartIcon className="h-5 w-5 text-cyan-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Subscribers by Plan</h2>
                </div>
                {planDistribution.length > 0 ? (
                  <>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {planDistribution.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {planDistribution.map((plan, index) => (
                        <div key={plan.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                            />
                            <span className="text-slate-700">{plan.name}</span>
                          </div>
                          <span className="font-medium text-slate-900">{plan.value} subs</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 text-center py-16">No plan distribution data yet.</p>
                )}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Profit Trend</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar
                      dataKey="profit"
                      name="Net Profit"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
