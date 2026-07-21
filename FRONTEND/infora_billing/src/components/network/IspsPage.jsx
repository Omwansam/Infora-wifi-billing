import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Globe, Users, Router, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatCurrency, formatDate } from '../../lib/utils';
import ispService from '../../services/ispService';
import { useConfirm } from '../../contexts/ConfirmContext';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const EMPTY_FORM = {
  name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  subscription_plan: 'basic',
  max_devices: 10,
  max_customers: 100,
};

export default function IspsPage() {
  const confirm = useConfirm();
  const [isps, setIsps] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const [listRes, statsRes] = await Promise.all([
        ispService.getISPs(token, { per_page: 100, search: searchTerm || undefined }),
        ispService.getAllISPStats(token).catch(() => ({})),
      ]);
      setIsps(listRes.isps || []);
      setStats(statsRes);
    } catch {
      toast.error('Failed to load ISPs');
      setIsps([]);
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
      { title: 'Total ISPs', value: stats.total_isps ?? isps.length, icon: Globe, accent: 'from-indigo-500 to-violet-600' },
      { title: 'Active ISPs', value: stats.active_isps ?? isps.filter((i) => i.is_active).length, icon: Users, accent: 'from-emerald-500 to-teal-600' },
      { title: 'Devices', value: stats.total_devices ?? 0, icon: Router, accent: 'from-cyan-500 to-blue-600' },
      { title: 'Revenue', value: formatCurrency(stats.total_revenue ?? 0), icon: Globe, accent: 'from-amber-500 to-orange-600' },
    ],
    [stats, isps]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (isp) => {
    setEditing(isp);
    setForm({
      name: isp.name,
      company_name: isp.company_name,
      email: isp.email,
      phone: isp.phone || '',
      address: isp.address || '',
      subscription_plan: isp.subscription_plan || 'basic',
      max_devices: isp.max_devices || 10,
      max_customers: isp.max_customers || 100,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = getAccessToken();
      if (editing) {
        await ispService.updateISP(token, editing.id, form);
        toast.success('ISP updated');
      } else {
        await ispService.createISP(token, form);
        toast.success('ISP created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (isp) => {
    if (!(await confirm({ title: 'Delete ISP?', message: `ISP "${isp.name}" will be permanently deleted.`, confirmLabel: 'Delete ISP', tone: 'danger' }))) return;
    try {
      const token = getAccessToken();
      await ispService.deleteISP(token, isp.id);
      toast.success('ISP deleted');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <NetworkLayout
      title="ISP Management"
      subtitle="Multi-tenant providers, limits, and RADIUS credentials"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={openCreate} className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700">
            <Plus className="h-4 w-4 mr-2" />
            Add ISP
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.title}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search ISPs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto" /></div>
        ) : isps.length === 0 ? (
          <div className="py-16 text-center text-slate-500">No ISPs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-5 py-3 font-semibold">ISP</th>
                  <th className="px-5 py-3 font-semibold">Plan</th>
                  <th className="px-5 py-3 font-semibold">Limits</th>
                  <th className="px-5 py-3 font-semibold">Usage</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isps.map((isp) => (
                  <tr key={isp.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{isp.name}</div>
                      <div className="text-xs text-slate-500">{isp.company_name} · {isp.email}</div>
                    </td>
                    <td className="px-5 py-4 capitalize">{isp.subscription_plan}</td>
                    <td className="px-5 py-4">{isp.max_devices} devices · {isp.max_customers} customers</td>
                    <td className="px-5 py-4">
                      {isp.stats?.device_count ?? 0} devices · {isp.stats?.customer_count ?? 0} customers
                    </td>
                    <td className="px-5 py-4"><ActiveBadge active={isp.is_active} /></td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => openEdit(isp)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(isp)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }} onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editing ? 'Edit ISP' : 'Add ISP'}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ['name', 'ISP Name', 'text'],
                  ['company_name', 'Company', 'text'],
                  ['email', 'Email', 'email'],
                  ['phone', 'Phone', 'text'],
                  ['subscription_plan', 'Plan', 'text'],
                ].map(([key, label, type]) => (
                  <input key={key} required={['name', 'company_name', 'email'].includes(key)} type={type} placeholder={label} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="px-3 py-2.5 border border-slate-200 rounded-xl" />
                ))}
                <input type="number" placeholder="Max devices" value={form.max_devices} onChange={(e) => setForm((p) => ({ ...p, max_devices: Number(e.target.value) }))} className="px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input type="number" placeholder="Max customers" value={form.max_customers} onChange={(e) => setForm((p) => ({ ...p, max_customers: Number(e.target.value) }))} className="px-3 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <textarea placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="w-full mt-4 px-3 py-2.5 border border-slate-200 rounded-xl" rows={2} />
              <button type="submit" disabled={saving} className="w-full mt-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Update ISP' : 'Create ISP'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
