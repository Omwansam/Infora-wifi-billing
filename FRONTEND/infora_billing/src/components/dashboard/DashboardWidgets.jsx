import React from 'react';
import { motion } from 'framer-motion';
import { formatDateTime } from '../../lib/utils';
import { BRAND } from '../../lib/brand';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe,
  Router,
  Shield,
  Ticket,
  UserPlus,
  Wifi,
} from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl bg-slate-200" />
        <div className="h-80 rounded-2xl bg-slate-200" />
      </div>
    </div>
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

export function DashboardHeader({ user, generatedAt, onRefresh, refreshing }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = user?.first_name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-emerald-600">{BRAND.fullName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {greeting}, {name}
        </h1>
        <p className="mt-1 text-slate-500">
          Your network, billing, and subscribers at a glance.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {generatedAt && (
          <p className="text-xs text-slate-400">
            Updated {formatDateTime(generatedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

export function AlertBanner({ alerts, onNavigate }) {
  if (!alerts?.length) return null;

  const styles = {
    error: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <motion.button
          key={alert.title}
          type="button"
          onClick={() => onNavigate(alert.link)}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:opacity-90 ${styles[alert.level] || styles.info}`}
          {...fade()}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{alert.title}</p>
              <p className="text-sm opacity-80">{alert.message}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
        </motion.button>
      ))}
    </div>
  );
}

export function KpiCard({ title, value, subtitle, icon: Icon, accent, change, onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  const positive = change > 0;
  const negative = change < 0;

  return (
    <motion.div {...fade()}>
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition ${
          onClick ? 'hover:border-emerald-200 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
            {change != null && (
              <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                positive ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-slate-400'
              }`}>
                {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : negative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                {change > 0 ? '+' : ''}{change}% vs last month
              </div>
            )}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </Wrapper>
    </motion.div>
  );
}

export function Panel({ title, icon: Icon, iconColor = 'text-emerald-500', action, children, className = '' }) {
  return (
    <motion.div
      {...fade(0.1)}
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

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
  };
  const key = (status || '').toLowerCase().replace(' ', '_');
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[key] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function QuickAction({ icon: Icon, label, description, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-slate-100 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
    >
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="font-medium text-slate-800 group-hover:text-emerald-800">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </button>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
      <CheckCircle2 className="mb-2 h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export const QUICK_ACTIONS = [
  { label: 'Add customer', description: 'Register PPPoE or hotspot user', icon: UserPlus, color: 'bg-blue-500', path: '/customers/new' },
  { label: 'Record payment', description: 'M-Pesa or manual payment', icon: CreditCard, color: 'bg-emerald-500', path: '/billing/payments' },
  { label: 'Create invoice', description: 'Bill a subscriber', icon: FileText, color: 'bg-violet-500', path: '/billing/invoices/create' },
  { label: 'Service plans', description: 'Hotspot & PPPoE packages', icon: Wifi, color: 'bg-teal-500', path: '/plans' },
  { label: 'MikroTik routers', description: 'Sync & monitor devices', icon: Router, color: 'bg-slate-700', path: '/devices/mikrotik' },
  { label: 'Captive portal', description: 'Preview customer portal', icon: Globe, color: 'bg-cyan-500', path: '/portal', external: true },
  { label: 'KYC reviews', description: 'Verify customer documents', icon: Shield, color: 'bg-amber-500', path: '/customers/kyc' },
  { label: 'Support tickets', description: 'Open customer issues', icon: Ticket, color: 'bg-orange-500', path: '/tickets' },
];
