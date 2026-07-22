import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Loader2, RefreshCw, AlertTriangle, XCircle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMonitoringAlerts } from '../../services/reportsService';

const REFRESH_SECONDS = 60;

const LEVEL = {
  error: { badge: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/30 dark:text-rose-300', dot: 'bg-rose-500', Icon: XCircle, ring: 'border-rose-200 dark:border-rose-900/50' },
  warning: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/15 dark:bg-amber-950/30 dark:text-amber-300', dot: 'bg-amber-500', Icon: AlertTriangle, ring: 'border-amber-200 dark:border-amber-900/50' },
  info: { badge: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/30 dark:text-blue-300', dot: 'bg-blue-500', Icon: Info, ring: 'border-blue-200 dark:border-blue-900/50' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ error: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getMonitoringAlerts();
      if (res.success) {
        setAlerts(res.data?.data?.alerts || []);
        setCounts(res.data?.data?.counts || { error: 0, warning: 0, info: 0 });
      } else toast.error(res.error || 'Failed to load alerts');
    } catch (e) {
      toast.error(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), REFRESH_SECONDS * 1000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 dark:bg-amber-950/50"><Bell className="h-6 w-6 text-amber-600 dark:text-amber-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Alerts</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Operational issues needing attention.</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          {['error', 'warning', 'info'].map((lvl) => {
            const cfg = LEVEL[lvl];
            return (
              <div key={lvl} className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${cfg.ring}`}>
                <div className="flex items-center gap-2"><cfg.Icon className={`h-4 w-4 ${lvl === 'error' ? 'text-rose-500' : lvl === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} /><span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 capitalize">{lvl}</span></div>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{loading ? '—' : counts[lvl] || 0}</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">All clear</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No active alerts right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((a, i) => {
                const cfg = LEVEL[a.level] || LEVEL.info;
                const Row = (
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${cfg.badge}`}>{a.category}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{a.message}</p>
                    </div>
                    {a.link && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                  </div>
                );
                return a.link ? <Link key={i} to={a.link}>{Row}</Link> : <div key={i}>{Row}</div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
