import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, RefreshCw, Server, Users, Trash2, Download, Router, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import { unwrapList } from '../../lib/networkUtils';
import wireguardService from '../../services/wireguardService';
import { useConfirm } from '../../contexts/ConfirmContext';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const SERVER_FORM = {
  name: '',
  endpoint: '',
  port: 51820,
  subnet: '10.200.200.0/24',
  server_address: '10.200.200.1/24',
  dns_servers: '8.8.8.8,8.8.4.4',
  mtu: 1420,
  deployment_mode: 'linux',
};

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function WireGuardPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('servers');
  const [servers, setServers] = useState([]);
  const [peers, setPeers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(SERVER_FORM);

  const loadServers = useCallback(async () => {
    const token = getAccessToken();
    const res = await wireguardService.listServers(token);
    setServers(unwrapList(res));
  }, []);

  const loadPeers = useCallback(async (serverId) => {
    if (!serverId) {
      setPeers([]);
      return;
    }
    const token = getAccessToken();
    const res = await wireguardService.getServerPeers(token, serverId);
    setPeers(unwrapList(res));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadServers();
    } catch {
      toast.error('Failed to load WireGuard servers');
    } finally {
      setLoading(false);
    }
  }, [loadServers]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedServer) loadPeers(selectedServer);
  }, [selectedServer, loadPeers]);

  const filteredServers = useMemo(
    () => servers.filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase())),
    [servers, searchTerm],
  );

  const stats = useMemo(() => ({
    servers: servers.length,
    peers: servers.reduce((n, s) => n + (s.stats?.peer_count || 0), 0),
    active: servers.reduce((n, s) => n + (s.stats?.active_peers || 0), 0),
  }), [servers]);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      await wireguardService.createServer(token, form);
      toast.success('WireGuard server created');
      setShowForm(false);
      setForm(SERVER_FORM);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Create failed');
    }
  };

  const handleSyncStats = async () => {
    try {
      const token = getAccessToken();
      const res = await wireguardService.syncStats(token);
      toast.success(`Stats updated: ${res.data?.updated ?? 0} peer(s)`);
      if (selectedServer) loadPeers(selectedServer);
      loadData();
    } catch {
      toast.error('Stats sync failed (is wg installed?)');
    }
  };

  const authDownload = async (url, filename) => {
    const token = getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <NetworkLayout
      title="WireGuard VPN"
      subtitle="ISP-scoped VPN servers and customer peers"
      action={(
        <div className="flex gap-2">
          <button type="button" onClick={handleSyncStats} className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Activity className="h-4 w-4 mr-2" /> Sync stats
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            <Plus className="h-4 w-4 mr-2" /> Add server
          </button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Servers', value: stats.servers, icon: Server },
          { label: 'Peers', value: stats.peers, icon: Users },
          { label: 'Active (3m)', value: stats.active, icon: Activity },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <card.icon className="h-8 w-8 text-indigo-500 opacity-80" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['servers', 'peers'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${view === v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {v}
          </button>
        ))}
        <button type="button" onClick={loadData} className="ml-auto inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search servers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white"
          />
        </div>
      </div>

      {view === 'servers' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="table-scroll">
          <table className="min-w-full min-w-[720px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Name', 'Endpoint', 'Subnet', 'Mode', 'Peers', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.endpoint}:{s.port}</td>
                  <td className="px-4 py-3 text-sm font-mono">{s.subnet}</td>
                  <td className="px-4 py-3 text-sm capitalize">{s.deployment_mode}</td>
                  <td className="px-4 py-3 text-sm">{s.stats?.peer_count ?? 0}</td>
                  <td className="px-4 py-3"><ActiveBadge active={s.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setSelectedServer(s.id); setView('peers'); }} className="text-indigo-600 text-sm hover:underline">Peers</button>
                      <button
                        type="button"
                        onClick={() => authDownload(wireguardService.downloadServerConfigUrl(s.id), `wg-server-${s.id}.conf`).catch(() => toast.error('Download failed'))}
                        className="text-slate-600 hover:text-slate-900"
                        title="Server config"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => authDownload(wireguardService.downloadMikrotikScriptUrl(s.id), `wg-mikrotik-${s.id}.rsc`).catch(() => toast.error('Download failed'))}
                        className="text-slate-600 hover:text-slate-900"
                        title="MikroTik script"
                      >
                        <Router className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const r = await wireguardService.syncServerMikrotik(getAccessToken(), s.id);
                            toast.success(`MikroTik sync: ${r.data?.pushed ?? 0} peer(s)`);
                            if (selectedServer === s.id) loadPeers(s.id);
                          } catch (e) {
                            toast.error(e.message);
                          }
                        }}
                        className="text-emerald-600 hover:text-emerald-800 text-sm"
                        title="Push all peers to MikroTik"
                      >
                        Push
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!loading && filteredServers.length === 0 && (
            <p className="p-8 text-center text-slate-500">No WireGuard servers — create one per ISP.</p>
          )}
        </div>
      )}

      {view === 'peers' && (
        <div>
          <select
            value={selectedServer || ''}
            onChange={(e) => setSelectedServer(Number(e.target.value) || null)}
            className="mb-4 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select server...</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="table-scroll">
            <table className="min-w-full min-w-[800px] divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Customer', 'IP', 'MikroTik', 'Handshake', 'RX', 'TX', 'Status', ''].map((h) => (
                    <th key={h || 'x'} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {peers.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.customer_name}</p>
                      <p className="text-xs text-slate-500">{p.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{p.assigned_ip}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.mikrotik_sync_error ? (
                        <span className="text-rose-600" title={p.mikrotik_sync_error}>Error</span>
                      ) : p.mikrotik_synced_at ? (
                        <span className="text-emerald-600">Synced</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.last_handshake ? formatDate(p.last_handshake) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{formatBytes(p.rx_bytes)}</td>
                    <td className="px-4 py-3 text-sm">{formatBytes(p.tx_bytes)}</td>
                    <td className="px-4 py-3"><ActiveBadge active={p.is_active} /></td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!(await confirm({ title: 'Deprovision peer?', message: 'This WireGuard peer will be removed and its access revoked.', confirmLabel: 'Deprovision', tone: 'danger' }))) return;
                          try {
                            await wireguardService.deletePeer(getAccessToken(), p.id);
                            toast.success('Peer removed');
                            loadPeers(selectedServer);
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {selectedServer && peers.length === 0 && (
              <p className="p-8 text-center text-slate-500">No peers on this server. Provision from customer detail.</p>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.form
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onSubmit={handleCreateServer}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">New WireGuard server</h3>
              {['name', 'endpoint', 'subnet', 'server_address', 'dns_servers'].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{field.replace('_', ' ')}</label>
                  <input
                    name={field}
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    required={['name', 'endpoint', 'subnet'].includes(field)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                  <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deployment</label>
                  <select value={form.deployment_mode} onChange={(e) => setForm((f) => ({ ...f, deployment_mode: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                    <option value="linux">Linux / Docker</option>
                    <option value="mikrotik">MikroTik (RouterOS v7+)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-slate-200">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white">Create</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
