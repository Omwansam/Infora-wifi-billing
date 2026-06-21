import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  CreditCard,
  DollarSign,
  Package,
  Router,
  Server,
  Smartphone,
  Ticket,
  TrendingUp,
  Users,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardStats } from '../../services/dashboardService';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import {
  AlertBanner,
  DashboardError,
  DashboardHeader,
  DashboardSkeleton,
  EmptyState,
  KpiCard,
  Panel,
  QuickAction,
  QUICK_ACTIONS,
  StatusPill,
} from './DashboardWidgets';

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '13px',
  },
};

function DeviceStatusIcon({ status }) {
  return status === 'online' ? (
    <Wifi className="h-4 w-4 text-emerald-500" />
  ) : (
    <Server className="h-4 w-4 text-slate-400" />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const stats = await getDashboardStats();
      setData(stats);
    } catch (err) {
      setData(null);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const go = (path, external = false) => {
    if (external) {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(path);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (error && !data) return <DashboardError message={error} onRetry={() => load()} />;

  const s = data?.summary || {};
  const revenueData = data?.revenue_data || [];
  const packages = data?.package_distribution || [];
  const connections = data?.connection_distribution || [];

  const kpis = [
    {
      title: 'Total revenue',
      value: formatCurrency(s.total_revenue || data?.total_revenue || 0),
      subtitle: `${formatCurrency(s.monthly_revenue || 0)} this month`,
      icon: DollarSign,
      accent: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      change: s.revenue_change_pct,
      onClick: () => go('/billing/reports'),
    },
    {
      title: 'Monthly collections',
      value: formatCurrency(s.monthly_payments || data?.monthly_payments || 0),
      subtitle: `${formatCurrency(s.today_payments || 0)} collected today`,
      icon: CreditCard,
      accent: 'bg-gradient-to-br from-violet-500 to-purple-600',
      onClick: () => go('/billing/payments'),
    },
    {
      title: 'Active subscribers',
      value: (s.active_customers ?? data?.active_customers ?? 0).toLocaleString(),
      subtitle: `${s.total_customers || 0} total · MRR ${formatCurrency(s.mrr || 0)}`,
      icon: Users,
      accent: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      change: s.customer_change_pct,
      onClick: () => go('/customers'),
    },
    {
      title: 'M-Pesa payments',
      value: (s.mpesa_month_count || 0).toLocaleString(),
      subtitle: 'Completed STK pushes (30 days)',
      icon: Smartphone,
      accent: 'bg-gradient-to-br from-green-500 to-emerald-600',
      onClick: () => go('/billing/payments'),
    },
    {
      title: 'Overdue invoices',
      value: (s.overdue_invoices || 0).toLocaleString(),
      subtitle: formatCurrency(s.overdue_invoice_amount || 0) + ' outstanding',
      icon: TrendingUp,
      accent: 'bg-gradient-to-br from-amber-500 to-orange-600',
      onClick: () => go('/billing/invoices'),
    },
    {
      title: 'Expired packages',
      value: (s.expired_subscriptions || 0).toLocaleString(),
      subtitle: 'Need renewal via portal',
      icon: Package,
      accent: 'bg-gradient-to-br from-red-500 to-rose-600',
      onClick: () => go('/customers'),
    },
    {
      title: 'Routers online',
      value: `${s.online_devices || 0}/${s.total_devices || 0}`,
      subtitle: `${s.total_router_clients || 0} connected clients`,
      icon: Router,
      accent: 'bg-gradient-to-br from-slate-600 to-slate-800',
      onClick: () => go('/devices/mikrotik'),
    },
    {
      title: 'Open tickets',
      value: (s.open_tickets || 0).toLocaleString(),
      subtitle: `${s.kyc_pending || 0} KYC pending`,
      icon: Ticket,
      accent: 'bg-gradient-to-br from-cyan-500 to-blue-600',
      onClick: () => go('/tickets'),
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <DashboardHeader
        user={user}
        generatedAt={data?.generated_at}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <AlertBanner alerts={data?.alerts} onNavigate={go} />

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Revenue charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Revenue & collections"
          icon={TrendingUp}
          className="lg:col-span-2"
          action={
            <button type="button" onClick={() => go('/billing/reports')} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
              View reports →
            </button>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Paid invoices" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} />
              <Line type="monotone" dataKey="payments" name="Payments" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Connection types" icon={Wifi}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={connections.filter((c) => c.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {connections.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs text-slate-500">
            <div className="rounded-lg bg-teal-50 py-2">
              <p className="font-bold text-teal-700">{s.hotspot_customers || 0}</p>
              <p>Hotspot</p>
            </div>
            <div className="rounded-lg bg-blue-50 py-2">
              <p className="font-bold text-blue-700">{s.pppoe_customers || 0}</p>
              <p>PPPoE</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Package bar + activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Subscribers by package" icon={Package} iconColor="text-violet-500">
          {packages.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={packages} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" name="Subscribers" radius={[0, 6, 6, 0]}>
                  {packages.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No active service plans yet" />
          )}
        </Panel>

        <Panel title="Recent activity" icon={Activity} iconColor="text-orange-500">
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {(data?.recent_activity || []).length > 0 ? (
              data.recent_activity.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-50 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.message}</p>
                    <p className="text-xs text-slate-400">{item.timestamp ? formatDateTime(item.timestamp) : '—'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.amount != null && (
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                    )}
                    <StatusPill status={item.type === 'payment' ? 'completed' : item.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="No recent billing activity" />
            )}
          </div>
        </Panel>
      </div>

      {/* Tables row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Recent payments" icon={CreditCard}>
          <div className="space-y-3">
            {(data?.recent_payments || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{p.customer}</p>
                  <p className="text-xs text-slate-400">{p.method}{p.receipt ? ` · ${p.receipt}` : ''}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">{formatCurrency(p.amount)}</span>
              </div>
            ))}
            {!data?.recent_payments?.length && <EmptyState message="No payments yet" />}
          </div>
        </Panel>

        <Panel title="Overdue invoices" icon={TrendingUp} iconColor="text-amber-500">
          <div className="space-y-3">
            {(data?.overdue_invoices || []).map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => go(`/billing/invoices/${inv.id}`)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5 text-left transition hover:bg-amber-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{inv.customer}</p>
                  <p className="text-xs text-slate-500">{inv.invoice_number} · due {formatDate(inv.due_date)}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-amber-700">{formatCurrency(inv.amount)}</span>
              </button>
            ))}
            {!data?.overdue_invoices?.length && <EmptyState message="No overdue invoices — great!" />}
          </div>
        </Panel>

        <Panel title="Expiring soon" icon={Users} iconColor="text-blue-500">
          <div className="space-y-3">
            {(data?.expiring_subscriptions || []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go(`/customers/${c.id}`)}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-blue-50/50 px-3 py-2.5 text-left transition hover:bg-blue-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.package}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-blue-600">{formatDate(c.expires)}</span>
              </button>
            ))}
            {!data?.expiring_subscriptions?.length && <EmptyState message="No subscriptions expiring in 7 days" />}
          </div>
        </Panel>
      </div>

      {/* Network + new customers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Network devices"
          icon={Router}
          action={
            <button type="button" onClick={() => go('/devices/mikrotik')} className="text-xs font-medium text-emerald-600">
              Manage →
            </button>
          }
        >
          <div className="space-y-2">
            {(data?.devices || []).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <DeviceStatusIcon status={d.status} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.ip} · {d.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StatusPill status={d.status} />
                  <p className="mt-1 text-xs text-slate-400">{d.clients} clients</p>
                </div>
              </div>
            ))}
            {!data?.devices?.length && <EmptyState message="No MikroTik devices configured" />}
          </div>
        </Panel>

        <Panel title="New customers" icon={Users}>
          <div className="space-y-2">
            {(data?.recent_customers || []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go(`/customers/${c.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/30"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.package}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={c.connection_type} />
                  <StatusPill status={c.status} />
                </div>
              </button>
            ))}
            {!data?.recent_customers?.length && <EmptyState message="No customers yet" />}
          </div>
        </Panel>
      </div>

      {/* Subscriber health summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Active', value: s.active_customers, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Suspended', value: s.suspended_customers, color: 'text-red-600 bg-red-50' },
          { label: 'Pending', value: s.pending_customers, color: 'text-amber-600 bg-amber-50' },
          { label: 'Hotspot plans', value: s.hotspot_plans, color: 'text-teal-600 bg-teal-50' },
          { label: 'PPPoE plans', value: s.pppoe_plans, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'KYC verified', value: s.kyc_verified, color: 'text-blue-600 bg-blue-50' },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl px-4 py-3 text-center ${item.color}`}>
            <p className="text-xl font-bold">{item.value ?? 0}</p>
            <p className="text-xs font-medium opacity-80">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <Panel title="Quick actions" icon={Activity} iconColor="text-slate-500">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction
              key={action.label}
              {...action}
              onClick={() => go(action.path, action.external)}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
