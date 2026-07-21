import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Monitor, Trash2, Edit, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import { unwrapList } from '../../lib/networkUtils';
import snmpService from '../../services/snmpService';
import { useConfirm } from '../../contexts/ConfirmContext';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const FORM = { name: '', host: '', port: 161, snmp_version: '2c', community: 'public' };

export default function SnmpPage() {
  const confirm = useConfirm();
  const [devices, setDevices] = useState([]);
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
      const res = await snmpService.getSNMPDevices(token);
      setDevices(unwrapList(res));
    } catch {
      toast.error('Failed to load SNMP devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(
    () => devices.filter((d) => d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.host?.includes(searchTerm)),
    [devices, searchTerm]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      if (editing) {
        await snmpService.updateSNMPDevice(token, editing.id, form);
        toast.success('SNMP device updated');
      } else {
        await snmpService.createSNMPDevice(token, form);
        toast.success('SNMP device created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    }
  };

  const handleDelete = async (device) => {
    if (!(await confirm({ title: 'Remove SNMP device?', message: `SNMP device "${device.name}" will be removed.`, confirmLabel: 'Remove', tone: 'danger' }))) return;
    try {
      const token = getAccessToken();
      await snmpService.deleteSNMPDevice(token, device.id);
      toast.success('Device removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleTest = async (deviceId) => {
    try {
      setActionId(deviceId);
      const token = getAccessToken();
      const res = await snmpService.testSNMPConnection(token, deviceId);
      toast.success(res.message || 'SNMP test completed');
    } catch (error) {
      toast.error(error.message || 'Test failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <NetworkLayout
      title="SNMP Monitoring"
      subtitle="Poll network gear and track device health"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => { setEditing(null); setForm(FORM); setShowForm(true); }} className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Monitored Devices', value: devices.length, accent: 'from-cyan-500 to-blue-600' },
          { title: 'SNMPv3', value: devices.filter((d) => d.snmp_version === '3').length, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Recently Polled', value: devices.filter((d) => d.last_poll).length, accent: 'from-emerald-500 to-teal-600' },
        ].map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{stat.title}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search SNMP devices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-600 border-t-transparent mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200"><Monitor className="h-12 w-12 text-slate-300 mx-auto" /><p className="mt-4 text-slate-600">No SNMP devices configured</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((device, index) => (
            <motion.div key={device.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{device.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{device.host}:{device.port}</p>
                </div>
                <ActiveBadge active={device.is_active} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Version</dt><dd className="font-medium">v{device.snmp_version}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Last Poll</dt><dd className="font-medium">{device.last_poll ? formatDate(device.last_poll) : 'Never'}</dd></div>
              </dl>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest(device.id)} disabled={actionId === device.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-50 text-cyan-700"><Zap className="h-3.5 w-3.5 mr-1" />Poll</button>
                <button onClick={() => { setEditing(device); setForm({ ...FORM, ...device }); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(device)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form initial={{ scale: 0.96 }} animate={{ scale: 1 }} onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{editing ? 'Edit Device' : 'Add SNMP Device'}</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
              <div className="space-y-3">
                <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <input required placeholder="Host" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <select value={form.snmp_version} onChange={(e) => setForm((p) => ({ ...p, snmp_version: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl">
                  <option value="1">v1</option><option value="2c">v2c</option><option value="3">v3</option>
                </select>
                {form.snmp_version !== '3' && (
                  <input placeholder="Community" value={form.community} onChange={(e) => setForm((p) => ({ ...p, community: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                )}
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold">Save Device</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
