import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Loader2, RefreshCw, Radio, Users, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { getReport } from '../../services/reportsService';

const REFRESH_SECONDS = 30;

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p></div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function gb(bytes) { return (bytes / (1024 ** 3)).toFixed(2); }

export default function TrafficPage() {
  const [data, setData] = useState({ kpis: {}, top_users: [], traffic_trend: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getReport('network');
      if (res.success) setData(res.data?.data || { kpis: {}, top_users: [], traffic_trend: [] });
      else toast.error(res.error || 'Failed to load traffic');
    } catch (e) {
      toast.error(e.message || 'Failed to load traffic');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), REFRESH_SECONDS * 1000);
    return () => clearInterval(t);
  }, [load]);

  const { kpis, top_users: topUsers, traffic_trend: trend } = data;
  const maxTrend = Math.max(1, ...trend.map((t) => t.gb || 0));
  const maxUser = Math.max(1, ...topUsers.map((u) => u.bytes || 0));

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-100 p-3 dark:bg-cyan-950/50"><TrendingUp className="h-6 w-6 text-cyan-600 dark:text-cyan-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Network Traffic</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Bandwidth usage from RADIUS accounting (last 30 days).</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi icon={Database} label="Total data" value={loading ? '—' : `${kpis.total_gb ?? 0} GB`} tone="bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300" />
          <Kpi icon={Radio} label="Active sessions" value={loading ? '—' : (kpis.active_sessions ?? 0)} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" />
          <Kpi icon={Users} label="Sessions (30d)" value={loading ? '—' : (kpis.total_sessions ?? 0)} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Traffic by month (GB)</h2>
            {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div> : trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No data.</p>
            ) : (
              <div className="flex h-48 items-end gap-2">
                {trend.map((t) => (
                  <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-gradient-to-t from-cyan-500 to-cyan-400" style={{ height: `${((t.gb || 0) / maxTrend) * 100}%` }} title={`${t.gb} GB`} /></div>
                    <span className="text-[10px] text-slate-400">{t.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Top users by traffic</h2>
            {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div> : topUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No data.</p>
            ) : (
              <div className="space-y-3">
                {topUsers.map((u) => (
                  <div key={u.username}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate font-mono text-slate-700 dark:text-slate-300">{u.username}</span><span className="tabular-nums text-slate-500">{gb(u.bytes)} GB</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(u.bytes / maxUser) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
