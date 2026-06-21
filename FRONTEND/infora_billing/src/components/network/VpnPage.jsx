import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Lock, Users, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import { unwrapList } from '../../lib/networkUtils';
import vpnService from '../../services/vpnService';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const CONFIG_FORM = { name: '', vpn_type: 'wireguard', server_endpoint: '', server_port: 51820, allowed_ips: '10.0.0.0/24', dns_servers: '8.8.8.8' };
const VIEW_TABS = [{ value: 'configs', label: 'Servers' }, { value: 'clients', label: 'Clients' }];

export default function VpnPage() {
  const [view, setView] = useState('configs');
  const [configs, setConfigs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(CONFIG_FORM);
  const [clientForm, setClientForm] = useState({ name: '', vpn_config_id: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const [configsRes, clientsRes] = await Promise.all([
        vpnService.getVPNConfigs(token),
        vpnService.getVPNClients(token),
      ]);
      setConfigs(unwrapList(configsRes));
      setClients(unwrapList(clientsRes));
    } catch {
      toast.error('Failed to load VPN data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredConfigs = useMemo(
    () => configs.filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase())),
    [configs, searchTerm]
  );

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      if (editing) {
        await vpnService.updateVPNConfig(token, editing.id, form);
        toast.success('VPN config updated');
      } else {
        await vpnService.createVPNConfig(token, form);
        toast.success('VPN config created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    }
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      await vpnService.createVPNClient(token, clientForm);
      toast.success('VPN client created');
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Create client failed');
    }
  };

  const handleDeleteConfig = async (config) => {
    if (!window.confirm(`Remove VPN config "${config.name}"?`)) return;
    try {
      const token = getAccessToken();
      await vpnService.deleteVPNConfig(token, config.id);
      toast.success('Config removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Remove VPN client "${client.name}"?`)) return;
    try {
      const token = getAccessToken();
      await vpnService.deleteVPNClient(token, client.id);
      toast.success('Client removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <NetworkLayout
      title="VPN Configurations"
      subtitle="WireGuard and remote access tunnels"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditing(null);
              if (view === 'clients') {
                setClientForm({ name: '', vpn_config_id: configs[0]?.id || '' });
              } else {
                setForm(CONFIG_FORM);
              }
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-slate-700 to-slate-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            {view === 'clients' ? 'Add Client' : 'Add Config'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'VPN Servers', value: configs.length, icon: Lock, accent: 'from-slate-600 to-slate-800' },
          { title: 'Connected Clients', value: clients.length, icon: Users, accent: 'from-emerald-500 to-teal-600' },
          { title: 'WireGuard', value: configs.filter((c) => c.vpn_type === 'wireguard').length, icon: Lock, accent: 'from-indigo-500 to-violet-600' },
        ].map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{stat.title}</p><p className="text-2xl font-bold mt-1">{stat.value}</p></div>
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
        <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-transparent mx-auto" /></div>
      ) : view === 'configs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredConfigs.map((config, index) => (
            <motion.div key={config.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{config.name}</h3>
                  <p className="text-sm text-slate-500 capitalize">{config.vpn_type} · {config.server_endpoint || 'local'}</p>
                </div>
                <ActiveBadge active={config.is_active} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Port</dt><dd className="font-medium">{config.server_port || '—'}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Allowed IPs</dt><dd className="font-medium truncate">{config.allowed_ips || '—'}</dd></div>
              </dl>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => { setEditing(config); setForm({ ...CONFIG_FORM, ...config }); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDeleteConfig(config)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Config</th>
                <th className="px-5 py-3 font-semibold">IP</th>
                <th className="px-5 py-3 font-semibold">Last Connected</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-medium">{client.name}</td>
                  <td className="px-5 py-4">{configs.find((c) => c.id === client.vpn_config_id)?.name || client.vpn_config_id}</td>
                  <td className="px-5 py-4 font-mono">{client.client_ip || '—'}</td>
                  <td className="px-5 py-4 text-slate-500">{client.last_connected ? formatDate(client.last_connected) : 'Never'}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDeleteClient(client)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              onSubmit={view === 'clients' ? handleSaveClient : handleSaveConfig}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{view === 'clients' ? 'Add VPN Client' : editing ? 'Edit Config' : 'Add VPN Config'}</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
              {view === 'clients' ? (
                <div className="space-y-3">
                  <input required placeholder="Client name" value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                  <select required value={clientForm.vpn_config_id} onChange={(e) => setClientForm((p) => ({ ...p, vpn_config_id: Number(e.target.value) }))} className="w-full px-3 py-2.5 border rounded-xl">
                    <option value="">Select VPN config</option>
                    {configs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                  <select value={form.vpn_type} onChange={(e) => setForm((p) => ({ ...p, vpn_type: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl">
                    <option value="wireguard">WireGuard</option><option value="openvpn">OpenVPN</option><option value="ipsec">IPSec</option>
                  </select>
                  <input placeholder="Server endpoint" value={form.server_endpoint} onChange={(e) => setForm((p) => ({ ...p, server_endpoint: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                  <input type="number" placeholder="Port" value={form.server_port} onChange={(e) => setForm((p) => ({ ...p, server_port: Number(e.target.value) }))} className="w-full px-3 py-2.5 border rounded-xl" />
                </div>
              )}
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold">Save</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
