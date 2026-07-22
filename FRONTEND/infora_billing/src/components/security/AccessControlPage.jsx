import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Loader2, RefreshCw, Plus, Trash2, Server, ShieldCheck, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import settingsService from '../../services/settingsService';
import { getAccessToken } from '../../utils/authToken';

export default function AccessControlPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', ip: '', secret: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getRadius(getAccessToken());
      setConfig(data);
    } catch (e) {
      toast.error(e.message || 'Failed to load RADIUS access config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNas = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ip.trim()) { toast.error('Name and IP are required'); return; }
    setSaving(true);
    try {
      await settingsService.addRadiusNas(getAccessToken(), { name: form.name.trim(), ip: form.ip.trim(), secret: form.secret.trim() || undefined });
      toast.success('NAS client allowed');
      setForm({ name: '', ip: '', secret: '' });
      load();
    } catch (e) {
      toast.error(e.message || 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const removeNas = async (nas) => {
    if (!window.confirm(`Revoke access for ${nas.name} (${nas.ip})?`)) return;
    setBusyId(nas.id);
    try {
      await settingsService.deleteRadiusNas(getAccessToken(), nas.id);
      toast.success('NAS client removed');
      load();
    } catch (e) {
      toast.error(e.message || 'Remove failed');
    } finally {
      setBusyId(null);
    }
  };

  const nasClients = config?.nas_clients || [];
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 dark:bg-amber-950/50"><Key className="h-6 w-6 text-amber-600 dark:text-amber-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Access Control</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Which NAS devices (routers) may authenticate against RADIUS.</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {config?.enabled ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldOff className="h-5 w-5 text-slate-400" />}
                  <span className="font-semibold text-slate-900 dark:text-white">RADIUS {config?.enabled ? 'enabled' : 'disabled'}</span>
                </div>
                <div><span className="text-slate-500 dark:text-slate-400">Server </span><span className="font-mono text-slate-800 dark:text-slate-200">{config?.host || '—'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Ports </span><span className="font-mono text-slate-800 dark:text-slate-200">{config?.auth_port}/{config?.acct_port}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Secret </span><span className="font-mono text-slate-800 dark:text-slate-200">{config?.shared_secret ? '••••••••' : 'not set'}</span></div>
              </div>
            </div>

            <form onSubmit={addNas} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Allow a NAS device</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input className={field} placeholder="Name (e.g. Site-A router)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className={field} placeholder="IP address" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
                <input className={field} placeholder="Shared secret (optional)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Allow</button>
              </div>
            </form>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">Allowed NAS devices ({nasClients.length})</h2></div>
              {nasClients.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No NAS clients allowed yet. Add your routers above so they can talk to RADIUS.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {nasClients.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800"><Server className="h-4 w-4 text-slate-600 dark:text-slate-300" /></div><span className="font-medium text-slate-900 dark:text-white">{n.name}</span></div></td>
                        <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-400">{n.ip}</td>
                        <td className="px-5 py-3 text-right"><button onClick={() => removeNas(n)} disabled={busyId === n.id} className="inline-flex items-center justify-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40" title="Revoke">{busyId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
