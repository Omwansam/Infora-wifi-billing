import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Server, Wrench, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import { getAccessToken } from '../../utils/authToken';
import equipmentService from '../../services/equipmentService';
import { useConfirm } from '../../contexts/ConfirmContext';
import DevicesLayout from './DevicesLayout';

const TYPE_TABS = [
  { value: 'all', label: 'All Types' },
  { value: 'Router', label: 'Routers' },
  { value: 'Switch', label: 'Switches' },
  { value: 'Access Point', label: 'Access Points' },
  { value: 'Server', label: 'Servers' },
  { value: 'Other', label: 'Other' },
];

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  installment: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  pending: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  retired: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

const EMPTY_FORM = {
  name: '', equipment_type: 'Router', vendor: '', serial_number: '',
  price: '', paid_amount: '', status: '', location: '',
  purchase_date: '', warranty_until: '', notes: '',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status || 'pending'}
    </span>
  );
}

export default function EquipmentPage() {
  const confirm = useConfirm();
  const [equipment, setEquipment] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, asset_value: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const [items, statsRes] = await Promise.all([
        equipmentService.list(token),
        equipmentService.stats(token).catch(() => null),
      ]);
      setEquipment(items);
      if (statsRes) setStats(statsRes);
    } catch (error) {
      toast.error(error.message || 'Could not load equipment');
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () =>
      equipment.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.equipment_type === typeFilter;
        return matchesSearch && matchesType;
      }),
    [equipment, searchTerm, typeFilter]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      equipment_type: item.equipment_type || 'Router',
      vendor: item.vendor || '',
      serial_number: item.serial_number || '',
      price: item.price ?? '',
      paid_amount: item.paid_amount ?? '',
      status: item.status || '',
      location: item.location || '',
      purchase_date: item.purchase_date || '',
      warranty_until: item.warranty_until || '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Equipment name is required');
      return;
    }
    setSaving(true);
    try {
      const token = getAccessToken();
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        paid_amount: Number(form.paid_amount) || 0,
      };
      if (editing) {
        await equipmentService.update(token, editing.id, payload);
        toast.success('Equipment updated');
      } else {
        await equipmentService.create(token, payload);
        toast.success('Equipment added');
      }
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Delete equipment?',
      message: `"${item.name}" will be permanently removed from the equipment register. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const token = getAccessToken();
      await equipmentService.remove(token, item.id);
      toast.success('Equipment deleted');
      setEquipment((prev) => prev.filter((e) => e.id !== item.id));
      load();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const setField = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <DevicesLayout
      title="Equipment Inventory"
      subtitle="Physical assets, procurement, and deployment tracking"
      action={
        <button
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black self-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Equipment
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { title: 'Total Assets', value: stats.total, icon: Server, accent: 'from-slate-600 to-slate-800' },
          { title: 'Active', value: stats.active, icon: Wrench, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Asset Value', value: formatCurrency(stats.asset_value || 0), icon: Server, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Outstanding', value: formatCurrency(stats.outstanding || 0), icon: Wrench, accent: 'from-amber-500 to-orange-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
          >
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
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium ${
                  typeFilter === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-transparent mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Server className="h-12 w-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-slate-600">No equipment yet — add your first asset</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((item, index) => {
            const paidPct = item.price > 0 ? Math.round(((item.paid_amount || 0) / item.price) * 100) : 0;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                      <Server className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
                      <p className="text-sm text-slate-500 truncate">
                        {item.equipment_type}{item.location ? ` · ${item.location}` : ''}
                        {item.serial_number ? ` · SN ${item.serial_number}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={item.status} />
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-slate-500">Purchase Price</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(item.price || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Paid</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(item.paid_amount || 0)}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Payment progress</span>
                    <span>{paidPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 rounded-full" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.form
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              onSubmit={handleSave}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">{editing ? 'Edit Equipment' : 'Add Equipment'}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input required placeholder="Equipment name" value={form.name} onChange={(e) => setField('name', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.equipment_type} onChange={(e) => setField('equipment_type', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                    <option>Router</option>
                    <option>Switch</option>
                    <option>Access Point</option>
                    <option>Server</option>
                    <option>Other</option>
                  </select>
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                    <option value="">Auto status</option>
                    <option value="pending">Pending</option>
                    <option value="installment">Installment</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Vendor" value={form.vendor} onChange={(e) => setField('vendor', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                  <input placeholder="Serial number" value={form.serial_number} onChange={(e) => setField('serial_number', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Price (KES)" value={form.price} onChange={(e) => setField('price', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Paid amount (KES)" value={form.paid_amount} onChange={(e) => setField('paid_amount', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                </div>
                <input placeholder="Location" value={form.location} onChange={(e) => setField('location', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Purchase date</label>
                    <input type="date" value={form.purchase_date || ''} onChange={(e) => setField('purchase_date', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Warranty until</label>
                    <input type="date" value={form.warranty_until || ''} onChange={(e) => setField('warranty_until', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                  </div>
                </div>
                <textarea rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <button type="submit" disabled={saving} className="w-full mt-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Save Changes' : 'Save Equipment'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </DevicesLayout>
  );
}
