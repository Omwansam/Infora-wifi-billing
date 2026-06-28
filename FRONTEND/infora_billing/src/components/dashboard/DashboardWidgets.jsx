import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { formatBytes } from '../../lib/networkUtils';
import { BRAND } from '../../lib/brand';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Megaphone,
  MessageSquare,
  PauseCircle,
  Plus,
  Router,
  Smartphone,
  Users,
  Wallet,
  Wifi,
  Zap,
  Activity,
  Package,
  TrendingUp,
  Download,
  Upload,
  Lightbulb,
  ExternalLink,
  BarChart3,
} from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export function DashboardPage({ children }) {
  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 sm:space-y-8">{children}</div>
    </div>
  );
}

export function SnapshotStatsBar({ summary, activeSessions, smsBalance, onNavigate }) {
  const items = [
    { label: 'Routers', value: summary?.total_devices ?? 0, path: '/devices/mikrotik' },
    { label: 'Online', value: activeSessions ?? 0, path: '/clients/online', live: true },
    { label: 'PPPoE', value: summary?.pppoe_customers ?? 0, path: '/clients/pppoe' },
    { label: 'Hotspot', value: summary?.hotspot_customers ?? 0, path: '/clients/hotspot' },
    { label: 'SMS', value: smsBalance ?? 0, path: '/communication/sms' },
    { label: 'Tickets', value: summary?.open_tickets ?? 0, path: '/tickets' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onNavigate?.(item.path)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-800"
        >
          {item.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          <span className="font-semibold text-slate-900 dark:text-white">{item.value}</span>
          <span className="text-slate-500">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ChartFilterBar({ routers, routerId, onRouterChange, period, onPeriodChange, periodOptions }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Router</span>
        <select
          value={routerId}
          onChange={(e) => onRouterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">All routers ({routers?.length || 0})</option>
          {(routers || []).map((r) => (
            <option key={r.id} value={String(r.id)}>{r.name}</option>
          ))}
        </select>
      </div>
      <PeriodPills options={periodOptions} value={period} onChange={onPeriodChange} />
    </div>
  );
}

export function RadiusPeriodCards({ periods, value, onChange }) {
  const options = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'all', label: 'All time' },
  ];

  return (
    <div className="mb-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {options.map((opt) => {
        const stats = periods?.[opt.value] || {};
        const total = (stats.download_bytes || 0) + (stats.upload_bytes || 0);
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              active
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
              {opt.label}
            </p>
            <p className={`mt-1 text-sm font-bold ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {formatBytes(total)}
            </p>
            <div className={`mt-2 flex gap-3 text-[10px] ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
              <span className="inline-flex items-center gap-0.5">
                <Download className="h-3 w-3" />
                {formatBytes(stats.download_bytes || 0)}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Upload className="h-3 w-3" />
                {formatBytes(stats.upload_bytes || 0)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <DashboardPage>
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800 lg:col-span-2" />
          <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </DashboardPage>
  );
}

export function DashboardError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 px-6 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
      <h2 className="text-lg font-semibold text-slate-900">Could not load dashboard</h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        {message || 'Check that the backend is running and you are signed in.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Try again
      </button>
    </div>
  );
}

export function DashboardHeader({ user, generatedAt, onRefresh, refreshing, onNavigate }) {
  const name = user?.first_name || user?.email?.split('@')[0] || 'there';
  const longDate = new Intl.DateTimeFormat('en-KE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{BRAND.fullName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {longDate} · Network, billing, and subscribers at a glance
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {generatedAt && (
          <p className="hidden text-xs text-slate-400 sm:block">
            Updated {formatDateTime(generatedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={() => onNavigate?.('/clients/pppoe/new')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New PPPoE
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('/clients/new')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Hotspot
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('/devices/mikrotik')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Router className="h-4 w-4" />
          Add Router
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

export function Panel({ title, icon: Icon, iconColor = 'text-emerald-500', action, children, className = '', subtitle, bare }) {
  if (bare) {
    return (
      <motion.div {...fade(0.1)} className={className}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      {...fade(0.1)}
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

export function SectionHeading({ title, subtitle, action, actionLabel }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && actionLabel && (
        <button
          type="button"
          onClick={action}
          className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

export function PeriodPills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
            value === opt.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function RevenuePeriodStrip({ periods, highlight = 'this_month' }) {
  const [collapsed, setCollapsed] = useState(false);
  const items = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This week' },
    { key: 'this_month', label: 'This month' },
    { key: 'last_month', label: 'Last month' },
    { key: 'this_year', label: 'This year' },
  ];

  const monthChange = periods?.last_month
    ? Math.round(((periods.this_month - periods.last_month) / periods.last_month) * 1000) / 10
    : periods?.this_month > 0 ? 100 : 0;

  if (collapsed) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Revenue</p>
          <p className="text-xs text-slate-500">This month · {formatCurrency(periods?.this_month || 0)}</p>
        </div>
        <button type="button" onClick={() => setCollapsed(false)} className="text-sm text-indigo-600">
          Show <ChevronDown className="inline h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Revenue</h3>
          <p className="text-xs text-slate-500">Completed payments across all periods</p>
        </div>
        <button type="button" onClick={() => setCollapsed(true)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
          Hide <ChevronUp className="inline h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ key, label }) => {
          const amount = periods?.[key] || 0;
          const active = key === highlight;
          const showChange = key === 'this_month' && monthChange !== 0;
          return (
            <div
              key={key}
              className={`rounded-xl px-4 py-3 transition ${
                active
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                {label}
              </p>
              <p className={`mt-1 text-lg font-bold ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(amount)}
              </p>
              {showChange && (
                <p className={`mt-1 flex items-center gap-0.5 text-[10px] font-medium ${monthChange >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                  {monthChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(monthChange)}% vs prev
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OnlineNowWidget({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Online now</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-3xl font-bold text-slate-900 dark:text-white">{count ?? 0}</span>
        </div>
        <p className="text-xs text-slate-500">active sessions</p>
      </div>
      <span className="text-sm text-slate-400">View sessions →</span>
    </button>
  );
}

const STATUS_CARD_CONFIG = {
  active: { label: 'Active', icon: CheckCircle2, color: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  expired: { label: 'Expired', icon: Clock, color: 'text-rose-600', bar: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  suspended: { label: 'Suspended', icon: PauseCircle, color: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  new_month: { label: 'New / month', icon: Plus, color: 'text-indigo-600', bar: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  live_sessions: { label: 'Live sessions', icon: Zap, color: 'text-violet-600', bar: 'bg-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
};

export function SubscriberStatusCard({ title, total, stats, typeIcon: ConnIcon }) {
  const keys = ['active', 'expired', 'suspended', 'new_month', 'live_sessions'];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
          <ConnIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
          <p className="text-xs text-slate-500">{total ?? 0} total</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {keys.map((key) => {
          const cfg = STATUS_CARD_CONFIG[key];
          const Icon = cfg.icon;
          return (
            <div key={key} className={`relative overflow-hidden rounded-xl border border-slate-100 p-3 dark:border-slate-800 ${cfg.bg}`}>
              <Icon className={`h-4 w-4 ${cfg.color}`} />
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{stats?.[key] ?? 0}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{cfg.label}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${cfg.bar}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InlineStatRow({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-5 sm:grid-cols-4 dark:border-slate-800">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
          {s.sub && <p className="text-xs text-slate-500">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function OperationsRow({ ops, onNavigate }) {
  const items = [
    { key: 'expenses', label: 'Expenses', value: formatCurrency(ops?.expenses || 0), sub: '0 entries', icon: CreditCard, color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40', path: '/billing/reports' },
    { key: 'payouts', label: 'Payouts', value: formatCurrency(ops?.payouts || 0), sub: 'This month', icon: Wallet, color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40', path: '/billing/payments' },
    { key: 'invoices_due', label: 'Invoices due', value: String(ops?.invoices_due || 0), sub: formatCurrency(ops?.invoices_due_amount || 0), icon: Calendar, color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40', path: '/billing/invoices' },
    { key: 'sms_sent', label: 'SMS sent', value: String(ops?.sms_sent || 0), sub: `${ops?.sms_failed || 0} failed`, icon: Smartphone, color: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40', path: '/communication/sms' },
    { key: 'campaigns', label: 'Campaigns', value: String(ops?.campaigns || 0), sub: 'Active now', icon: Megaphone, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40', path: '/communication/campaigns' },
    { key: 'open_tickets', label: 'Open tickets', value: String(ops?.open_tickets || 0), sub: 'Platform support', icon: MessageSquare, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800', path: '/tickets' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate?.(item.path)}
          className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{item.value}</p>
            <p className="text-xs text-slate-400">{item.sub}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${item.color}`}>
            <item.icon className="h-4 w-4" />
          </div>
        </button>
      ))}
    </div>
  );
}

export function RouterHealthCard({ devices, onNavigate }) {
  const online = devices?.filter((d) => d.status === 'online').length || 0;
  const total = devices?.length || 0;
  const offline = total - online;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-900 dark:text-white">{online}</span> of {total} online this month
        </p>
        {offline > 0 && (
          <button type="button" onClick={() => onNavigate?.('/devices/mikrotik')} className="text-sm font-medium text-rose-600">
            {offline} offline · View all →
          </button>
        )}
      </div>
      <div className="space-y-3">
        {(devices || []).map((d) => {
          const cpu = d.cpu_percent ?? Math.min(95, Math.max(8, (d.clients || 0) * 5 + 20));
          const memory = d.memory_percent ?? Math.min(95, Math.max(15, 30 + (d.clients || 0) * 4));
          return (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
                    <Router className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.ip}{d.model ? ` · ${d.model}` : ''}</p>
                  </div>
                </div>
                <StatusPill status={d.status} />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
                    <span>CPU</span>
                    <span>{cpu}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${cpu}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
                    <span>Memory</span>
                    <span>{memory}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${memory}%` }} />
                  </div>
                </div>
              </div>
              {d.status === 'offline' && d.downtime && (
                <p className="mt-4 text-xs font-semibold text-amber-600">
                  Downtime this month · {d.downtime}
                </p>
              )}
              {d.status === 'online' && (
                <p className="mt-4 text-xs text-slate-400">{d.clients || 0} connected clients</p>
              )}
            </div>
          );
        })}
        {!devices?.length && <EmptyState icon={Router} message="No MikroTik routers configured" />}
      </div>
    </div>
  );
}

export function OrganizationCard({ org }) {
  const initial = (org?.name || 'L')[0].toUpperCase();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white">
          {initial}
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{org?.name || BRAND.companyName}</p>
          <p className="text-sm text-slate-500">{org?.tagline || 'Internet Service Provider'}</p>
        </div>
      </div>
      <dl className="mt-5 space-y-2 text-sm">
        {[
          ['Country', org?.country || 'KE'],
          ['Currency', org?.currency || 'KES'],
          ['Routers', org?.routers ?? 0],
          ['Packages', org?.packages ?? 0],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-slate-50 py-2 last:border-0 dark:border-slate-800">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-900 dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>
      {org?.modules?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Enabled modules</p>
          <div className="flex flex-wrap gap-1.5">
            {org.modules.map((m) => (
              <span key={m} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataMetric({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export { Download, Upload, Zap, Users, Activity };

export function StatusPill({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    online: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-emerald-100 text-emerald-700',
    paid: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
    offline: 'bg-red-100 text-red-700',
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-blue-100 text-blue-700',
    hotspot: 'bg-teal-100 text-teal-700',
    pppoe: 'bg-indigo-100 text-indigo-700',
    wireguard: 'bg-emerald-100 text-emerald-700',
  };
  const key = (status || '').toLowerCase().replace(' ', '_');
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[key] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function EmptyState({ message, icon: Icon = CheckCircle2 }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
      <Icon className="mb-3 h-10 w-10 opacity-25" strokeWidth={1.5} />
      <p className="max-w-xs text-sm leading-relaxed">{message}</p>
    </div>
  );
}

export function MiniBarChart({ data, dataKey, color = '#6366f1', height = 120 }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" interval="preserveStartEnd" />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v) => [typeof v === 'number' && v > 100 ? formatCurrency(v) : v, '']}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FeatureRoadmapSection({ roadmap, onNavigate, compact = false }) {
  const shipped = (roadmap || []).filter((r) => r.status === 'shipped');
  const planned = (roadmap || []).filter((r) => r.status === 'planned');

  if (compact) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Roadmap</h3>
        {shipped.length > 0 && (
          <ul className="space-y-2">
            {shipped.slice(0, 4).map((item) => (
              <li key={item.title} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                {item.title}
              </li>
            ))}
          </ul>
        )}
        {planned.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {planned.slice(0, 3).map((item) => (
              <li key={item.title} className="flex items-center gap-2 text-sm text-slate-500">
                <BarChart3 className="h-4 w-4 shrink-0 text-indigo-400" />
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Feature requests & roadmap"
        subtitle="Suggest improvements and see what we're building"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Your feature requests</h3>
            <button
              type="button"
              onClick={() => onNavigate?.('/tickets')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Suggest a feature
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500">Submit ideas via support tickets — we review every request.</p>
            <button type="button" onClick={() => onNavigate?.('/tickets')} className="mt-2 text-sm font-medium text-indigo-600">
              Open tickets <ExternalLink className="inline h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Roadmap</h3>
          {shipped.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Shipped
              </p>
              <ul className="space-y-2">
                {shipped.map((item) => (
                  <li key={item.title} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {planned.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Planned
              </p>
              <ul className="space-y-2">
                {planned.map((item) => (
                  <li key={item.title} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <BarChart3 className="h-4 w-4 shrink-0 text-indigo-400" />
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
