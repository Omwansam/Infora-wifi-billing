import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Shield, Activity, Users, Trash2, Edit, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import { unwrapList, formatBytes, formatDuration } from '../../lib/networkUtils';
import radiusService from '../../services/radiusService';
import { useConfirm } from '../../contexts/ConfirmContext';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const CLIENT_FORM = { name: '', host: '', secret: '', auth_port: 1812, acct_port: 1813, nas_type: 'other' };
const VIEW_TABS = [
  { value: 'clients', label: 'Clients' },
  { value: 'sessions', label: 'Sessions' },
];

export default function RadiusPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('clients');
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [billingRadius, setBillingRadius] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(CLIENT_FORM);
  const [actionId, setActionId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const [clientsRes, sessionsRes, statsRes, billingRes] = await Promise.all([
        radiusService.getRadiusClients(token),
        radiusService.getRadiusSessions(token, { per_page: 50, search: searchTerm || undefined }),
        radiusService.getRadiusStats(token).catch(() => null),
        radiusService.getBillingRadiusStatus(token).catch(() => null),
      ]);
      setClients(unwrapList(clientsRes));
      setSessions(unwrapList(sessionsRes));
      if (statsRes?.data) setStats(statsRes.data);
      if (billingRes?.data) setBillingRadius(billingRes.data);
    } catch {
      toast.error('Failed to load RADIUS data');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(loadData, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadData, searchTerm]);

  const statsCards = useMemo(
    () => [
      { title: 'NAS Clients', value: clients.length, icon: Shield, accent: 'from-indigo-500 to-violet-600' },
      { title: 'Active Sessions', value: stats.active_sessions ?? sessions.filter((s) => s.is_active).length, icon: Activity, accent: 'from-emerald-500 to-teal-600' },
      { title: 'Total Sessions', value: stats.total_sessions ?? sessions.length, icon: Users, accent: 'from-cyan-500 to-blue-600' },
      { title: 'Traffic', value: `${stats.total_gb ?? 0} GB`, icon: Activity, accent: 'from-amber-500 to-orange-600' },
    ],
    [clients, sessions, stats]
  );

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.host?.includes(searchTerm)),
    [clients, searchTerm]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      if (editing) {
        await radiusService.updateRadiusClient(token, editing.id, form);
        toast.success('Client updated');
      } else {
        await radiusService.createRadiusClient(token, form);
        toast.success('Client created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    }
  };

  const handleDelete = async (client) => {
    if (!(await confirm({ title: 'Remove RADIUS client?', message: `RADIUS client "${client.name}" will be removed.`, confirmLabel: 'Remove', tone: 'danger' }))) return;
    try {
      const token = getAccessToken();
      await radiusService.deleteRadiusClient(token, client.id);
      toast.success('Client removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleTest = async (clientId) => {
    try {
      setActionId(clientId);
      const token = getAccessToken();
      const res = await radiusService.testRadiusClient(token, clientId);
      toast.success(res.message || 'Connection test completed');
    } catch (error) {
      toast.error(error.message || 'Test failed');
    } finally {
      setActionId(null);
    }
  };

  const handleTerminate = async (sessionId) => {
    try {
      setActionId(sessionId);
      const token = getAccessToken();
      await radiusService.terminateRadiusSession(token, sessionId);
      toast.success('Session terminated');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Terminate failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <NetworkLayout
      title="RADIUS"
      subtitle="NAS clients, live sessions, and authentication accounting"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {view === 'clients' && (
            <button onClick={() => { setEditing(null); setForm(CLIENT_FORM); setShowForm(true); }} className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </button>
          )}
        </div>
      }
    >
      {billingRadius && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Auth backend</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{billingRadius.auth_mode || 'freeradius_postgresql'}</p>
              <p className="text-sm text-slate-600 mt-1">
                {billingRadius.total_users ?? 0} provisioned users · {billingRadius.active_sessions ?? 0} live sessions
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <span className={`px-3 py-1.5 rounded-full font-medium ${billingRadius.radius_secret_configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {billingRadius.radius_secret_configured ? 'RADIUS secret OK' : 'Secret not set'}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-indigo-200 text-indigo-800 font-medium">
                {billingRadius.isp_name || 'ISP'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{stat.title}</p><p className="text-xl font-bold mt-1">{stat.value}</p></div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}><stat.icon className="h-5 w-5" /></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl" />
        </div>
        <div className="flex gap-2">
          {VIEW_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setView(tab.value)} className={`px-3.5 py-2 rounded-full text-sm font-medium ${view === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto" /></div>
      ) : view === 'clients' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredClients.map((client, index) => (
            <motion.div key={client.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{client.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{client.host}:{client.auth_port}</p>
                </div>
                <ActiveBadge active={client.is_active} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">NAS Type</dt><dd className="font-medium">{client.nas_type}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Acct Port</dt><dd className="font-medium">{client.acct_port}</dd></div>
              </dl>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest(client.id)} disabled={actionId === client.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700"><Zap className="h-3.5 w-3.5 mr-1" />Test</button>
                <button onClick={() => { setEditing(client); setForm({ ...client, secret: '' }); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(client)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">IP</th>
                  <th className="px-5 py-3 font-semibold">Traffic</th>
                  <th className="px-5 py-3 font-semibold">Started</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="font-medium">{session.username}</div><div className="text-xs text-slate-500">{session.customer_name || '—'}</div></td>
                    <td className="px-5 py-4">{session.device_name || '—'}</td>
                    <td className="px-5 py-4 font-mono">{session.ip_address || '—'}</td>
                    <td className="px-5 py-4">{formatBytes((session.bytes_in || 0) + (session.bytes_out || 0))}</td>
                    <td className="px-5 py-4 text-slate-500">{session.session_start ? formatDate(session.session_start) : '—'}</td>
                    <td className="px-5 py-4 text-right">
                      {session.is_active ? (
                        <button onClick={() => handleTerminate(session.id)} disabled={actionId === session.id} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700">Terminate</button>
                      ) : (
                        <span className="text-xs text-slate-400">{formatDuration(session.duration)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form initial={{ scale: 0.96 }} animate={{ scale: 1 }} onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{editing ? 'Edit Client' : 'Add RADIUS Client'}</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
              <div className="space-y-3">
                <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required placeholder="Host / IP" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required={!editing} placeholder="Shared secret" value={form.secret} onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Auth port" value={form.auth_port} onChange={(e) => setForm((p) => ({ ...p, auth_port: Number(e.target.value) }))} className="px-3 py-2.5 border rounded-xl" />
                  <input type="number" placeholder="Acct port" value={form.acct_port} onChange={(e) => setForm((p) => ({ ...p, acct_port: Number(e.target.value) }))} className="px-3 py-2.5 border rounded-xl" />
                </div>
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold">Save Client</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
