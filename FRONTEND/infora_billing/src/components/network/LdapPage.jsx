import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Database, Shield, Trash2, Edit, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { unwrapList } from '../../lib/networkUtils';
import ldapService from '../../services/ldapService';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const FORM = { name: '', host: '', port: 389, bind_dn: '', bind_password: '', base_dn: '', use_ssl: false, use_tls: true };

export default function LdapPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM);
  const [actionId, setActionId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const res = await ldapService.getLDAPServers(token);
      setServers(unwrapList(res));
    } catch {
      toast.error('Failed to load LDAP servers');
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(
    () => servers.filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.host?.includes(searchTerm)),
    [servers, searchTerm]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      if (editing) {
        await ldapService.updateLDAPServer(token, editing.id, form);
        toast.success('LDAP server updated');
      } else {
        await ldapService.createLDAPServer(token, form);
        toast.success('LDAP server created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    }
  };

  const handleDelete = async (server) => {
    if (!window.confirm(`Remove LDAP server "${server.name}"?`)) return;
    try {
      const token = getAccessToken();
      await ldapService.deleteLDAPServer(token, server.id);
      toast.success('Server removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleTest = async (serverId) => {
    try {
      setActionId(serverId);
      const token = getAccessToken();
      const res = await ldapService.testLDAPConnection(token, serverId);
      toast.success(res.message || 'Connection test completed');
    } catch (error) {
      toast.error(error.message || 'Test failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <NetworkLayout
      title="LDAP Servers"
      subtitle="Directory authentication and user sync"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => { setEditing(null); setForm(FORM); setShowForm(true); }} className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Servers', value: servers.length, icon: Database, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Active', value: servers.filter((s) => s.is_active).length, icon: Shield, accent: 'from-emerald-500 to-teal-600' },
          { title: 'TLS Enabled', value: servers.filter((s) => s.use_tls || s.use_ssl).length, icon: Shield, accent: 'from-cyan-500 to-blue-600' },
        ].map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{stat.title}</p><p className="text-2xl font-bold mt-1">{stat.value}</p></div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}><stat.icon className="h-5 w-5" /></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search LDAP servers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200"><Database className="h-12 w-12 text-slate-300 mx-auto" /><p className="mt-4 text-slate-600">No LDAP servers configured</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((server, index) => (
            <motion.div key={server.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{server.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{server.host}:{server.port}</p>
                </div>
                <ActiveBadge active={server.is_active} />
              </div>
              <p className="text-sm text-slate-600 mb-4 truncate">Base DN: {server.base_dn}</p>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest(server.id)} disabled={actionId === server.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700"><Zap className="h-3.5 w-3.5 mr-1" />Test</button>
                <button onClick={() => { setEditing(server); setForm({ ...FORM, ...server, bind_password: '' }); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(server)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form initial={{ scale: 0.96 }} animate={{ scale: 1 }} onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{editing ? 'Edit Server' : 'Add LDAP Server'}</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
              <div className="space-y-3">
                <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required placeholder="Host" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input type="number" placeholder="Port" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required placeholder="Bind DN" value={form.bind_dn} onChange={(e) => setForm((p) => ({ ...p, bind_dn: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required={!editing} type="password" placeholder="Bind password" value={form.bind_password} onChange={(e) => setForm((p) => ({ ...p, bind_password: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required placeholder="Base DN" value={form.base_dn} onChange={(e) => setForm((p) => ({ ...p, base_dn: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold">Save Server</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
