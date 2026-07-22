import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, Loader2, RefreshCw, Unplug, Radio, Database, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import radiusService from '../../services/radiusService';
import { getAccessToken } from '../../utils/authToken';
import { formatBytes, formatDuration } from '../../lib/networkUtils';
import { formatDateTime } from '../../lib/utils';

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Closed' },
  { key: '', label: 'All' },
];

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

export default function AccountingPage() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('active');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = getAccessToken();
      const [sesRes, statRes] = await Promise.all([
        radiusService.getRadiusSessions(token, { per_page: 100, status: status || undefined, search: search || undefined }),
        radiusService.getRadiusStats(token),
      ]);
      setSessions(sesRes?.data?.sessions || []);
      setStats(statRes?.data || {});
    } catch (e) {
      toast.error(e.message || 'Failed to load accounting');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  const terminate = async (s) => {
    if (!window.confirm(`Terminate session for ${s.username}?`)) return;
    setBusyId(s.id);
    try {
      await radiusService.terminateRadiusSession(getAccessToken(), s.id);
      toast.success('Session terminated');
      load(true);
    } catch (e) {
      toast.error(e.message || 'Terminate failed');
    } finally {
      setBusyId(null);
    }
  };

  const totalTraffic = useMemo(() => sessions.reduce((sum, s) => sum + (s.bytes_in || 0) + (s.bytes_out || 0), 0), [sessions]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-950/50"><Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">RADIUS Accounting</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Session records from FreeRADIUS accounting (radacct).</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi icon={Radio} label="Active" value={loading ? '—' : (stats.active_sessions ?? 0)} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" />
          <Kpi icon={Users} label="Total sessions" value={loading ? '—' : (stats.total_sessions ?? 0)} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" />
          <Kpi icon={Database} label="Total data" value={loading ? '—' : `${stats.total_gb ?? 0} GB`} tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" />
          <Kpi icon={Activity} label="Shown traffic" value={loading ? '—' : formatBytes(totalTraffic)} tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => (
              <button key={t.key} onClick={() => setStatus(t.key)} className={`rounded-lg px-3 py-2 text-sm font-medium ${status === t.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{t.label}</button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Login, IP, session id…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No sessions for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">NAS</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Traffic</th><th className="px-4 py-3">State</th><th className="px-4 py-3 text-right"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3"><p className="font-medium text-slate-900 dark:text-white">{s.customer_name || s.username}</p><p className="font-mono text-xs text-slate-500">{s.username}</p></td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{s.ip_address || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.device_name || s.nas_ip || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{s.session_start ? formatDateTime(s.session_start) : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{formatDuration(s.duration)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{formatBytes((s.bytes_in || 0) + (s.bytes_out || 0))}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{s.is_active ? 'Active' : 'Closed'}</span></td>
                      <td className="px-4 py-3 text-right">{s.is_active && <button onClick={() => terminate(s)} disabled={busyId === s.id} className="inline-flex items-center justify-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40" title="Terminate">{busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
