import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, Info, AlertTriangle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { logService } from '../../services/logService';

const LEVELS = [
  { value: 'all', label: 'All levels' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
];

const LEVEL_STYLE = {
  INFO: { badge: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/30 dark:text-blue-300', Icon: Info },
  WARNING: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/15 dark:bg-amber-950/30 dark:text-amber-300', Icon: AlertTriangle },
  ERROR: { badge: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/30 dark:text-rose-300', Icon: XCircle },
};

export default function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await logService.getLogs({ level, search: search || undefined, page, per_page: 25 });
      if (result.success) {
        setLogs(result.data?.logs || []);
        setPages(result.data?.pages || 1);
        setTotal(result.data?.total || 0);
      } else {
        toast.error(result.error || 'Failed to load logs');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [level, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-200 p-3 dark:bg-slate-800"><FileText className="h-6 w-6 text-slate-700 dark:text-slate-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">System Logs</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Audit trail of logins and administrative actions.</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search messages…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button key={l.value} onClick={() => { setPage(1); setLevel(l.value); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${level === l.value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{l.label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No log entries yet. Activity (logins, user changes) will appear here.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">User</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => {
                    const style = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
                    const { Icon } = style;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}><Icon className="h-3 w-3" />{log.level}</span></td>
                        <td className="px-4 py-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{log.type}</span></td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{log.message}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.user}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>{total} entr{total === 1 ? 'y' : 'ies'} · page {page} of {pages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
