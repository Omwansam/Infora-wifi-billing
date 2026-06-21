import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Server, Wrench, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import DevicesLayout from './DevicesLayout';

const INITIAL_EQUIPMENT = [
  { id: 1, name: 'Mikrotik RB4011 Router', type: 'Router', price: 45000, paidAmount: 45000, status: 'Active', location: 'Main Office' },
  { id: 2, name: 'Cisco Catalyst 2960 Switch', type: 'Switch', price: 135000, paidAmount: 67500, status: 'Installment', location: 'Server Room' },
  { id: 3, name: 'Ubiquiti UniFi AP AC Pro', type: 'Access Point', price: 18500, paidAmount: 18500, status: 'Active', location: 'Lobby' },
  { id: 4, name: 'Dell PowerEdge R740', type: 'Server', price: 420000, paidAmount: 210000, status: 'Installment', location: 'Data Center' },
];

const TYPE_TABS = [
  { value: 'all', label: 'All Types' },
  { value: 'Router', label: 'Routers' },
  { value: 'Switch', label: 'Switches' },
  { value: 'Access Point', label: 'Access Points' },
  { value: 'Server', label: 'Servers' },
];

function EquipmentStatusBadge({ status }) {
  const styles = {
    Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Installment: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Pending: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.Pending}`}>
      {status}
    </span>
  );
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState(INITIAL_EQUIPMENT);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Router', price: '', location: '' });

  const filtered = useMemo(
    () =>
      equipment.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        return matchesSearch && matchesType;
      }),
    [equipment, searchTerm, typeFilter]
  );

  const stats = useMemo(
    () => ({
      total: equipment.length,
      active: equipment.filter((item) => item.status === 'Active').length,
      assetValue: equipment.reduce((sum, item) => sum + item.price, 0),
      outstanding: equipment.reduce((sum, item) => sum + (item.price - item.paidAmount), 0),
    }),
    [equipment]
  );

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Equipment name is required');
      return;
    }
    setEquipment((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: form.name,
        type: form.type,
        price: Number(form.price) || 0,
        paidAmount: 0,
        status: 'Pending',
        location: form.location || 'Unassigned',
      },
    ]);
    toast.success('Equipment added');
    setShowForm(false);
    setForm({ name: '', type: 'Router', price: '', location: '' });
  };

  return (
    <DevicesLayout
      title="Equipment Inventory"
      subtitle="Physical assets, procurement, and deployment tracking"
      action={
        <button
          onClick={() => setShowForm(true)}
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
          { title: 'Asset Value', value: formatCurrency(stats.assetValue), icon: Server, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Outstanding', value: formatCurrency(stats.outstanding), icon: Wrench, accent: 'from-amber-500 to-orange-600' },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((item, index) => {
          const paidPct = item.price > 0 ? Math.round((item.paidAmount / item.price) * 100) : 0;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex gap-3">
                  <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-sm text-slate-500">{item.type} · {item.location}</p>
                  </div>
                </div>
                <EquipmentStatusBadge status={item.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-slate-500">Purchase Price</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(item.price)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Paid</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(item.paidAmount)}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Payment progress</span>
                  <span>{paidPct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-800 rounded-full" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

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
              onSubmit={handleAdd}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Add Equipment</h2>
                <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input required placeholder="Equipment name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                  <option>Router</option>
                  <option>Switch</option>
                  <option>Access Point</option>
                  <option>Server</option>
                </select>
                <input type="number" placeholder="Price (KES)" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold">
                Save Equipment
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </DevicesLayout>
  );
}
