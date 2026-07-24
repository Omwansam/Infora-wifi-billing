import React from 'react';
import { AlertCircle, Clock, Loader2, PauseCircle, CheckCircle2, Archive } from 'lucide-react';

// Status + priority presentation, shared by the list and the detail drawer.
export const STATUS_META = {
  open: { label: 'Open', icon: AlertCircle, cls: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30' },
  pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30' },
  in_progress: { label: 'In progress', icon: Loader2, cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30' },
  on_hold: { label: 'On hold', icon: PauseCircle, cls: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30' },
  resolved: { label: 'Resolved', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' },
  closed: { label: 'Closed', icon: Archive, cls: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:ring-slate-600/40' },
};

export const PRIORITY_META = {
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600/40', dot: 'bg-slate-400' },
  medium: { label: 'Medium', cls: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30', dot: 'bg-sky-500' },
  high: { label: 'High', cls: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30', dot: 'bg-orange-500' },
  critical: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30', dot: 'bg-rose-500' },
};

export const STATUS_OPTIONS = ['open', 'pending', 'in_progress', 'on_hold', 'resolved', 'closed'];
export const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

export function StatusBadge({ status, className = '' }) {
  const m = STATUS_META[status] || STATUS_META.open;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls} ${className}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority, className = '' }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
