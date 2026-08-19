import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, MapPin, MapPinOff, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

import FiberLayout from './FiberLayout';
import { NODE_KINDS, NODE_STATUS, nodeMeta } from './fiberMeta';
import fiberService from '../../services/fiberService';
import { useConfirm } from '../../contexts/ConfirmContext';

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function PortBar({ ports }) {
  if (!ports?.total) return <span className="text-xs text-slate-400">—</span>;
  const pct = (ports.used / ports.total) * 100;
  const full = ports.free === 0;
  return (
    <div className="w-28">
      <div className="flex items-baseline justify-between text-xs">
        <span className={full ? 'font-semibold text-red-600' : 'text-slate-600 dark:text-slate-300'}>
          {ports.used}/{ports.total}
        </span>
        {!full && <span className="text-slate-400">{ports.free} free</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full ${full ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NodeDialog({ node, nodes, onClose, onSaved }) {
  const editing = Boolean(node?.id);
  const [form, setForm] = useState({
    name: node?.name || '', code: node?.code || '', kind: node?.kind || 'odb',
    port_count: node?.port_count ?? '', split_ratio: node?.split_ratio || '',
    splitter_loss_db: node?.splitter_loss_db ?? '', parent_id: node?.parent_id ?? '',
    status: node?.status || 'active', address: node?.address || '',
    latitude: node?.latitude ?? '', longitude: node?.longitude ?? '',
    notes: node?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id || null };
      if (editing) await fiberService.updateNode(node.id, payload);
      else await fiberService.createNode(payload);
      toast.success(editing ? 'Node updated' : 'Node created');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{editing ? 'Edit node' : 'New node'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Name *</label><input value={form.name} onChange={set('name')} className={inputCls} placeholder="ODB-14 Ruiru" /></div>
            <div><label className={labelCls}>Code</label><input value={form.code} onChange={set('code')} className={inputCls} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Kind</label>
              <select value={form.kind} onChange={set('kind')} className={inputCls}>
                {Object.entries(NODE_KINDS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {Object.entries(NODE_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fed from</label>
            <select value={form.parent_id} onChange={set('parent_id')} className={inputCls}>
              <option value="">— nothing upstream (an OLT) —</option>
              {nodes.filter((n) => n.id !== node?.id).map((n) => (
                <option key={n.id} value={n.id}>{nodeMeta(n.kind).short} · {n.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">The upstream link the loss budget and fault analysis walk.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Ports</label><input type="number" min="0" value={form.port_count} onChange={set('port_count')} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Split</label>
              <select value={form.split_ratio} onChange={set('split_ratio')} className={inputCls}>
                <option value="">—</option>
                {['1:2', '1:4', '1:8', '1:16', '1:32', '1:64'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Loss dB</label><input type="number" step="0.1" value={form.splitter_loss_db} onChange={set('splitter_loss_db')} className={inputCls} placeholder="auto" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Latitude</label><input value={form.latitude} onChange={set('latitude')} className={inputCls} placeholder="-1.2864" /></div>
            <div><label className={labelCls}>Longitude</label><input value={form.longitude} onChange={set('longitude')} className={inputCls} placeholder="36.8172" /></div>
          </div>
          <p className="text-[11px] text-slate-400">Leave coordinates blank and place it by clicking on the map instead — usually faster and more accurate.</p>
          <div><label className={labelCls}>Address / landmark</label><input value={form.address} onChange={set('address')} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} className={inputCls} /></div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Cancel</button>
            <button onClick={submit} disabled={saving} className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FiberNodesPage() {
  const confirm = useConfirm();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fiberService.listNodes();
      setNodes(data?.nodes || []);
    } catch (error) {
      toast.error(error.message || 'Could not load nodes');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return nodes
      .filter((n) => kind === 'all' || n.kind === kind)
      .filter((n) => !needle || `${n.name} ${n.code || ''} ${n.address || ''}`.toLowerCase().includes(needle));
  }, [nodes, kind, search]);

  const remove = async (node) => {
    const ok = await confirm({
      title: `Delete ${node.name}?`,
      message: 'Its cables and port assignments go with it. Any ONT hanging off it becomes unassigned.',
      confirmText: 'Delete', destructive: true,
    });
    if (!ok) return;
    try {
      await fiberService.deleteNode(node.id);
      toast.success('Node deleted');
      await load();
    } catch (error) { toast.error(error.message || 'Delete failed'); }
  };

  const unplaced = nodes.filter((n) => !n.placed).length;

  return (
    <FiberLayout
      title="Plant nodes"
      subtitle="OLTs, cabinets, splitters and ODBs — the boxes your fibre passes through"
      action={(
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
          <button onClick={() => setEditing({})} className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> New node
          </button>
        </div>
      )}
    >
      {unplaced > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-slate-600 dark:text-slate-300">
            {unplaced} node{unplaced === 1 ? ' has' : 's have'} no coordinates and {unplaced === 1 ? 'does' : 'do'} not appear on the map.{' '}
            <Link to="/fiber/map" className="font-medium text-teal-700 hover:underline dark:text-teal-400">Place them on the map</Link>.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or address…" className={`${inputCls} pl-9`} />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <option value="all">All kinds</option>
          {Object.entries(NODE_KINDS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-white">{nodes.length === 0 ? 'No plant recorded yet' : 'Nothing matches'}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {nodes.length === 0
              ? 'Add your OLT first, then work outwards — cabinets, splitters, then the ODBs subscribers hang off.'
              : 'Try a different kind or clear the search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Node</th><th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Fed from</th><th className="px-4 py-3">Ports</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((node) => {
                const meta = nodeMeta(node.kind);
                const parent = node.parent_id ? byId[node.parent_id] : null;
                return (
                  <motion.tr key={node.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(node)} className="font-semibold text-slate-900 hover:text-teal-700 dark:text-white">{node.name}</button>
                      {node.code && <div className="text-xs text-slate-400">{node.code}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />{meta.label}
                      </span>
                      {node.split_ratio && <div className="text-xs text-slate-400">{node.split_ratio}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{parent ? parent.name : <span className="text-xs text-slate-400">— root —</span>}</td>
                    <td className="px-4 py-3"><PortBar ports={node.ports} /></td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: (NODE_STATUS[node.status] || NODE_STATUS.active).color }} />
                        {(NODE_STATUS[node.status] || NODE_STATUS.active).label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {node.placed
                        ? <MapPin className="h-4 w-4 text-teal-600" />
                        : <span className="text-xs text-slate-400">Not placed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to="/fiber/splices" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Ports</Link>
                        <button onClick={() => remove(node)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <NodeDialog node={editing.id ? editing : null} nodes={nodes} onClose={() => setEditing(null)} onSaved={load} />}
    </FiberLayout>
  );
}
