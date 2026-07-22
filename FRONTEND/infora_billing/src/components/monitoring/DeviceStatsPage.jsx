import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Loader2, RefreshCw, Cpu, MemoryStick, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { getReport } from '../../services/reportsService';
import { formatBytes } from '../../lib/networkUtils';

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

function memPct(d) {
  if (!d.mem_total || d.mem_free == null) return null;
  return Math.round(((d.mem_total - d.mem_free) / d.mem_total) * 100);
}

export default function DeviceStatsPage() {
  const [data, setData] = useState({ kpis: {}, devices: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getReport('devices');
      if (res.success) setData(res.data?.data || { kpis: {}, devices: [] });
      else toast.error(res.error || 'Failed to load device stats');
    } catch (e) {
      toast.error(e.message || 'Failed to load device stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), REFRESH_SECONDS * 1000);
    return () => clearInterval(t);
  }, [load]);

  const { kpis, devices } = data;

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-950/50"><Server className="h-6 w-6 text-blue-600 dark:text-blue-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Device Stats</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Live CPU, memory, and status across your routers.</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi icon={Server} label="Devices" value={loading ? '—' : (kpis.total ?? 0)} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" />
          <Kpi icon={Wifi} label="Online" value={loading ? '—' : (kpis.online ?? 0)} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" />
          <Kpi icon={WifiOff} label="Offline" value={loading ? '—' : (kpis.offline ?? 0)} tone="bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300" />
          <Kpi icon={Cpu} label="Avg CPU" value={loading ? '—' : (kpis.avg_cpu != null ? `${kpis.avg_cpu}%` : '—')} tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
          ) : devices.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No devices onboarded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">CPU</th><th className="px-4 py-3">Memory</th><th className="px-4 py-3">Last synced</th><th className="px-4 py-3 text-right"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {devices.map((d) => {
                    const mp = memPct(d);
                    const online = d.status === 'online';
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3"><p className="font-medium text-slate-900 dark:text-white">{d.name}</p><p className="font-mono text-xs text-slate-500">{d.ip}</p></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${online ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{d.status}</span></td>
                        <td className="px-4 py-3">
                          {d.cpu_load != null ? (
                            <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${d.cpu_load >= 80 ? 'bg-rose-500' : d.cpu_load >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, d.cpu_load)}%` }} /></div><span className="tabular-nums text-slate-600 dark:text-slate-300">{Math.round(d.cpu_load)}%</span></div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">{mp != null ? <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><MemoryStick className="h-3.5 w-3.5 text-slate-400" />{mp}% <span className="text-xs text-slate-400">of {formatBytes(d.mem_total)}</span></span> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{d.last_synced ? new Date(d.last_synced).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-right"><Link to="/devices/mikrotik" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"><ExternalLink className="h-3.5 w-3.5" />Manage</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
