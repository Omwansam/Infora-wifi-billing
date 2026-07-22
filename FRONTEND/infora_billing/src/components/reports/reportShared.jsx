import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Download, Loader2 } from 'lucide-react';

/** Default date range = last 30 days, as YYYY-MM-DD strings. */
export function useDateRange() {
  const today = new Date();
  const past = new Date(today.getTime() - 30 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const [from, setFrom] = useState(fmt(past));
  const [to, setTo] = useState(fmt(today));
  return { from, to, setFrom, setTo };
}

export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function KpiCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        {Icon && <div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>}
      </div>
    </div>
  );
}

export function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export default function ReportLayout({ icon: Icon, title, subtitle, tone = 'blue', range, onRefresh, onExport, loading, children }) {
  const toneBg = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  }[tone];
  const dateInput = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-3 ${toneBg}`}><Icon className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {range && (
              <>
                <input type="date" value={range.from} max={range.to} onChange={(e) => range.setFrom(e.target.value)} className={dateInput} />
                <span className="text-slate-400">→</span>
                <input type="date" value={range.to} min={range.from} onChange={(e) => range.setTo(e.target.value)} className={dateInput} />
              </>
            )}
            <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>
            {onExport && <button onClick={onExport} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900"><Download className="h-4 w-4" />CSV</button>}
          </div>
        </motion.div>
        {children}
      </div>
    </div>
  );
}
