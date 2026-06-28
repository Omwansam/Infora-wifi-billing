import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Download,
  MessageSquare,
  Router,
  TrendingUp,
  Upload,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardStats } from '../../services/dashboardService';
import { formatCurrency } from '../../lib/utils';
import { formatBytes } from '../../lib/networkUtils';
import {
  ChartFilterBar,
  DashboardError,
  DashboardHeader,
  DashboardPage,
  DashboardSkeleton,
  DataMetric,
  EmptyState,
  FeatureRoadmapSection,
  InlineStatRow,
  MiniBarChart,
  OnlineNowWidget,
  OperationsRow,
  OrganizationCard,
  Panel,
  RadiusPeriodCards,
  RevenuePeriodStrip,
  RouterHealthCard,
  SectionHeading,
  SubscriberStatusCard,
} from './DashboardWidgets';

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: 'var(--tooltip-bg, #fff)',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '13px',
  },
};

const REVENUE_CHART_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'all', label: 'All time' },
];

const REVENUE_TYPE_COLORS = { pppoe: '#6366f1', hotspot: '#a855f7' };

const PERIOD_KEY_MAP = {
  today: 'today',
  week: 'this_week',
  month: 'this_month',
  last_month: 'last_month',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [radiusPeriod, setRadiusPeriod] = useState('today');
  const [chartPeriod, setChartPeriod] = useState('today');
  const [routerFilter, setRouterFilter] = useState('all');
  const initialLoadDone = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    if (!silent) setError(null);
    try {
      const stats = await getDashboardStats({ routerId: routerFilter });
      setData(stats);
      setError(null);
    } catch (err) {
      if (!silent) {
        setData(null);
        setError(err?.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routerFilter]);

  useEffect(() => {
    load(initialLoadDone.current);
    initialLoadDone.current = true;
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), 60000);
    return () => clearInterval(timer);
  }, [load]);

  const go = (path) => navigate(path);

  const radiusStats = useMemo(
    () => data?.radius_periods?.[radiusPeriod] || {},
    [data?.radius_periods, radiusPeriod],
  );

  const revenueByType = useMemo(() => {
    const byType = data?.revenue_by_type || {};
    const pppoe = byType.pppoe || 0;
    const hotspot = byType.hotspot || 0;
    const total = pppoe + hotspot;
    const slices = [
      { name: 'PPPoE', value: pppoe, color: REVENUE_TYPE_COLORS.pppoe, pct: total ? Math.round((pppoe / total) * 100) : 0 },
      { name: 'Hotspot', value: hotspot, color: REVENUE_TYPE_COLORS.hotspot, pct: total ? Math.round((hotspot / total) * 100) : 0 },
    ];
    return { slices, total };
  }, [data?.revenue_by_type]);

  const revenueData = data?.revenue_data || [];
  const periods = data?.revenue_periods || {};

  const chartPeriodLabel = REVENUE_CHART_PERIODS.find((p) => p.value === chartPeriod)?.label || 'Today';
  const chartPeriodAmount = chartPeriod === 'all'
    ? revenueData.reduce((sum, r) => sum + (r.payments || 0), 0)
    : periods[PERIOD_KEY_MAP[chartPeriod]] || 0;

  const periodRevenueChart = useMemo(() => {
    if (chartPeriod === 'all') return null;
    const key = PERIOD_KEY_MAP[chartPeriod];
    return [{ label: chartPeriodLabel, amount: periods[key] || 0 }];
  }, [chartPeriod, chartPeriodLabel, periods]);

  const hotspotHourly = useMemo(
    () => (data?.hotspot_hourly || []).map((h) => ({ ...h, label: h.label || `${h.hour}:00` })),
    [data?.hotspot_hourly],
  );

  const smsDaily = useMemo(
    () => (data?.sms_daily || []).map((d) => ({ ...d, label: d.day })),
    [data?.sms_daily],
  );

  const topDataUsers = useMemo(() => {
    const byPeriod = data?.top_data_users_by_period;
    if (byPeriod && radiusPeriod in byPeriod) return byPeriod[radiusPeriod];
    return data?.top_data_users || [];
  }, [data?.top_data_users, data?.top_data_users_by_period, radiusPeriod]);

  const onlineCount = data?.session_counts?.all ?? data?.active_sessions ?? 0;

  if (loading) return <DashboardSkeleton />;
  if (error && !data) return <DashboardError message={error} onRetry={() => load()} />;

  const subscribers = data?.subscribers || {};
  const hotspot = data?.hotspot_activity || {};
  const sms = data?.sms_usage || {};
  const devices = data?.devices || [];
  const routerOptions = data?.routers?.length ? data.routers : devices;

  const showAllTimeChart = chartPeriod === 'all';
  const hasRevenueChart = showAllTimeChart
    ? revenueData.some((r) => r.revenue > 0 || r.payments > 0)
    : (periodRevenueChart?.[0]?.amount || 0) > 0;

  const radiusPeriodLabel = {
    today: 'Today',
    week: 'This week',
    month: 'This month',
    last_month: 'Last month',
    all: 'All time',
  }[radiusPeriod] || 'Today';

  return (
    <DashboardPage>
      <DashboardHeader
        user={user}
        generatedAt={data?.generated_at}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        onNavigate={go}
      />

      <RevenuePeriodStrip periods={data?.revenue_periods} />

      <ChartFilterBar
        routers={routerOptions}
        routerId={routerFilter}
        onRouterChange={setRouterFilter}
        period={chartPeriod}
        onPeriodChange={setChartPeriod}
        periodOptions={REVENUE_CHART_PERIODS}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Revenue chart"
            subtitle={`${chartPeriodLabel} · ${formatCurrency(chartPeriodAmount)}`}
            icon={TrendingUp}
            action={
              <button type="button" onClick={() => go('/billing/reports')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                View reports →
              </button>
            }
          >
            {hasRevenueChart ? (
              showAllTimeChart ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Paid invoices" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
                    <Line type="monotone" dataKey="payments" name="Payments" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={periodRevenueChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="amount" name="Collections" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <EmptyState icon={TrendingUp} message="No revenue for this period. Completed transactions will appear here." />
            )}
          </Panel>
          <OnlineNowWidget count={onlineCount} onClick={() => go('/clients/online')} />
        </div>

        <Panel title="This month" subtitle="Revenue by type" icon={Wifi} iconColor="text-violet-500">
          {revenueByType.total > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={revenueByType.slices} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {revenueByType.slices.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-sm font-bold text-slate-900 dark:text-white">
                Total {formatCurrency(revenueByType.total)}
              </p>
              <div className="mt-3 space-y-2">
                {revenueByType.slices.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(entry.value)} · {entry.pct}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <button type="button" onClick={() => go('/billing/payments')} className="text-left text-indigo-600 hover:underline">
                  View all transactions →
                </button>
                <button type="button" onClick={() => go('/billing/reports')} className="text-left text-indigo-600 hover:underline">
                  Payout history →
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon={Wifi} message="No payments this month yet" />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="SMS usage"
            subtitle="Messages sent over time — plan your top-ups"
            action={() => go('/communication/sms')}
            actionLabel="Manage SMS"
          />
          <Panel bare>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <InlineStatRow
                stats={[
                  { label: 'Sent', value: sms.sent ?? 0, sub: 'this period' },
                  { label: 'Failed', value: sms.failed ?? 0, sub: 'this period' },
                  { label: 'Balance', value: sms.balance ?? 0, sub: 'units left' },
                ]}
              />
              {sms.sent > 0 || smsDaily.some((d) => d.sent > 0) ? (
                <MiniBarChart data={smsDaily} dataKey="sent" color="#0ea5e9" height={140} />
              ) : (
                <EmptyState icon={MessageSquare} message="No SMS sent in this period. Usage appears here as you send messages." />
              )}
            </div>
          </Panel>
        </div>

        <div>
          <SectionHeading
            title="Hotspot activity"
            subtitle="Captive portal earnings — today's hourly breakdown"
            action={() => go('/clients/hotspot')}
            actionLabel="View users"
          />
          <Panel bare>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <InlineStatRow
                stats={[
                  { label: 'Today', value: formatCurrency(hotspot.today || 0), sub: `${hotspot.sales_today || 0} sales` },
                  { label: 'Yesterday', value: formatCurrency(hotspot.yesterday || 0) },
                  { label: 'This week', value: formatCurrency(hotspot.this_week || 0) },
                  { label: 'This month', value: formatCurrency(hotspot.this_month || 0) },
                ]}
              />
              {hotspotHourly.some((h) => h.amount > 0) ? (
                <MiniBarChart data={hotspotHourly} dataKey="amount" color="#a855f7" height={140} />
              ) : (
                <EmptyState icon={Wifi} message="No hotspot sales today yet. Captive portal purchases will appear here in real time." />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Data consumption"
          subtitle="RADIUS accounting"
          icon={Zap}
          iconColor="text-amber-500"
          className="lg:col-span-2"
        >
          <RadiusPeriodCards periods={data?.radius_periods} value={radiusPeriod} onChange={setRadiusPeriod} />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DataMetric icon={Download} label="Download" value={formatBytes(radiusStats.download_bytes || 0)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" />
            <DataMetric icon={Upload} label="Upload" value={formatBytes(radiusStats.upload_bytes || 0)} color="bg-orange-100 text-orange-600 dark:bg-orange-950/40" />
            <DataMetric icon={Zap} label="Live sessions" value={radiusStats.live_sessions ?? 0} color="bg-violet-100 text-violet-600 dark:bg-violet-950/40" />
            <DataMetric icon={Users} label="Unique users" value={radiusStats.unique_users ?? 0} color="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40" />
          </div>
          {(radiusStats.download_bytes || radiusStats.upload_bytes) === 0 && (
            <EmptyState icon={Zap} message="No RADIUS data for this period. Data appears once sessions are recorded." />
          )}
        </Panel>

        <Panel title="Top data users" subtitle={radiusPeriodLabel} icon={Users}>
          <div className="space-y-2">
            {(topDataUsers || []).map((u, i) => (
              <div key={`${u.username}-${i}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.connection_type}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{formatBytes(u.bytes)}</span>
              </div>
            ))}
            {!topDataUsers?.length && <EmptyState icon={Users} message="No sessions for this period" />}
          </div>
        </Panel>
      </div>

      <div>
        <SectionHeading title="Subscribers" subtitle="Current status across all users" />
        <Panel>
          <div className="space-y-8">
            <SubscriberStatusCard title="PPPoE clients" total={subscribers.pppoe?.total} stats={subscribers.pppoe} typeIcon={Router} />
            <div className="border-t border-slate-100 pt-8 dark:border-slate-800">
              <SubscriberStatusCard title="Hotspot users" total={subscribers.hotspot?.total} stats={subscribers.hotspot} typeIcon={Wifi} />
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <SectionHeading title="Router health" subtitle="MikroTik device status and load" action={() => go('/devices/mikrotik')} actionLabel="View all" />
        <Panel>
          <RouterHealthCard devices={devices} onNavigate={go} />
        </Panel>
      </div>

      <div>
        <SectionHeading title="Operations" subtitle="This month at a glance — click any card to view details" />
        <OperationsRow ops={data?.operations} onNavigate={go} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FeatureRoadmapSection roadmap={data?.roadmap} onNavigate={go} compact />
        <OrganizationCard org={data?.organization} />
      </div>
    </DashboardPage>
  );
}
