import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CircleSlash, Loader2, Plug, RefreshCw, Search, Trash2, X } from 'lucide-react';

import FiberLayout from './FiberLayout';
import { nodeMeta } from './fiberMeta';
import fiberService from '../../services/fiberService';
import cpeService from '../../services/cpeService';
import { customerService } from '../../services/customerService';
import { getAccessToken } from '../../utils/authToken';
import { useConfirm } from '../../contexts/ConfirmContext';

// TIA-598-C strand order. Techs read these colours off the tube, so offering
// them in the standard sequence is faster and less error-prone than free text.
const FIBER_COLORS = [
  { name: 'Blue', hex: '#2563eb' }, { name: 'Orange', hex: '#ea580c' },
  { name: 'Green', hex: '#16a34a' }, { name: 'Brown', hex: '#78350f' },
  { name: 'Slate', hex: '#64748b' }, { name: 'White', hex: '#e2e8f0' },
  { name: 'Red', hex: '#dc2626' }, { name: 'Black', hex: '#0f172a' },
  { name: 'Yellow', hex: '#eab308' }, { name: 'Violet', hex: '#7c3aed' },
  { name: 'Rose', hex: '#f43f5e' }, { name: 'Aqua', hex: '#06b6d4' },
];

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function ColorPicker({ value, onChange, label }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1">
        {FIBER_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            title={color.name}
            onClick={() => onChange(value === color.name ? '' : color.name)}
            className={`h-6 w-6 rounded border-2 transition-transform ${
              value === color.name ? 'scale-110 border-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-700'
            }`}
            style={{ background: color.hex }}
          />
        ))}
      </div>
      {value && <p className="mt-1 text-xs text-slate-500">{value}</p>}
    </div>
  );
}

function AssignDialog({ node, port, cables, nodes, onClose, onSaved }) {
  const [form, setForm] = useState({
    cable_id: '', fiber_number: '', tube_color: '', fiber_color: '',
    downstream_node_id: '', customer_id: '', cpe_device_id: '',
    status: 'in_use', loss_db: '', notes: '',
  });
  const [customers, setCustomers] = useState([]);
  const [onts, setOnts] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cpeService.listCpe(getAccessToken(), {}).then((d) => setOnts(d?.cpe || [])).catch(() => setOnts([]));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setCustomers([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const res = await customerService.getCustomers({ search: query.trim(), per_page: 8 });
        setCustomers(res?.data?.customers || res?.customers || res?.data || []);
      } catch { setCustomers([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      await fiberService.createSplice({
        node_id: node.id, port_number: port,
        ...form,
        cable_id: form.cable_id || null,
        downstream_node_id: form.downstream_node_id || null,
        customer_id: form.customer_id || null,
        cpe_device_id: form.cpe_device_id || null,
      });
      toast.success(`Port ${port} assigned`);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not assign the port');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{node.name} · port {port}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className={labelCls}>Serves</label>
            <select value={form.cpe_device_id} onChange={set('cpe_device_id')} className={inputCls}>
              <option value="">— an ONT —</option>
              {onts.map((ont) => (
                <option key={ont.id} value={ont.id}>
                  {ont.serial_number}{ont.customer_name ? ` · ${ont.customer_name}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Linking the ONT here is what tells the fault analysis which branch it hangs off —
              it is the difference between five separate slow-internet calls and one dimming branch.
            </p>
          </div>

          <div>
            <label className={labelCls}>Or a downstream node</label>
            <select value={form.downstream_node_id} onChange={set('downstream_node_id')} className={inputCls}>
              <option value="">—</option>
              {nodes.filter((n) => n.id !== node.id).map((n) => (
                <option key={n.id} value={n.id}>{nodeMeta(n.kind).short} · {n.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Subscriber (optional)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" className={`${inputCls} pl-9`} />
            </div>
            {customers.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {customers.map((c) => (
                  <button key={c.id} onClick={() => { setForm((f) => ({ ...f, customer_id: c.id })); setQuery(c.full_name || c.name); setCustomers([]); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                    {c.full_name || c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Cable</label>
              <select value={form.cable_id} onChange={set('cable_id')} className={inputCls}>
                <option value="">—</option>
                {cables.map((c) => <option key={c.id} value={c.id}>{c.name || `Cable ${c.id}`}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Strand #</label><input type="number" min="1" value={form.fiber_number} onChange={set('fiber_number')} className={inputCls} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorPicker label="Tube colour" value={form.tube_color} onChange={(v) => setForm((f) => ({ ...f, tube_color: v }))} />
            <ColorPicker label="Fibre colour" value={form.fiber_color} onChange={(v) => setForm((f) => ({ ...f, fiber_color: v }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {['in_use', 'reserved', 'faulty', 'spare'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Measured loss dB</label><input type="number" step="0.01" value={form.loss_db} onChange={set('loss_db')} className={inputCls} /></div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Cancel</button>
            <button onClick={submit} disabled={saving} className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign port
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FiberSplicePage() {
  const confirm = useConfirm();
  const [nodes, setNodes] = useState([]);
  const [cables, setCables] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const [nodeData, cableData] = await Promise.all([
        fiberService.listNodes(),
        fiberService.listCables().catch(() => ({ cables: [] })),
      ]);
      const all = nodeData?.nodes || [];
      setNodes(all);
      setCables(cableData?.cables || []);
      // Default to the first node that actually has ports to plan.
      const portable = all.filter((n) => (n.ports?.total || 0) > 0);
      if (!selectedId && portable.length) setSelectedId(portable[0].id);
    } catch (error) {
      toast.error(error.message || 'Could not load nodes');
    } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  const loadSheet = useCallback(async (nodeId) => {
    if (!nodeId) { setSheet(null); return; }
    try {
      setSheet(await fiberService.listSplices(nodeId));
    } catch (error) {
      toast.error(error.message || 'Could not load the port sheet');
      setSheet(null);
    }
  }, []);

  useEffect(() => { loadSheet(selectedId); }, [selectedId, loadSheet]);

  const portable = useMemo(() => nodes.filter((n) => (n.ports?.total || 0) > 0), [nodes]);
  const selected = sheet?.node;

  const clearPort = async (splice) => {
    const ok = await confirm({
      title: `Clear port ${splice.port_number}?`,
      message: 'The port becomes free. Any ONT linked through it stops being tied to this node, so it drops out of branch fault analysis.',
      confirmText: 'Clear port', destructive: true,
    });
    if (!ok) return;
    try {
      await fiberService.deleteSplice(splice.id);
      toast.success('Port cleared');
      await Promise.all([loadSheet(selectedId), loadNodes()]);
    } catch (error) { toast.error(error.message || 'Could not clear the port'); }
  };

  const refreshAll = async () => { await Promise.all([loadSheet(selectedId), loadNodes()]); };

  return (
    <FiberLayout
      title="Splice plan"
      subtitle="Which strand lands on which port, and what is on the other end"
      action={(
        <button onClick={refreshAll} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : portable.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Plug className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No nodes with ports yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Give a splitter or ODB a port count on the Nodes tab and its port sheet appears here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-1">
            {portable.map((node) => {
              const active = node.id === selectedId;
              const full = node.ports.free === 0;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? 'bg-teal-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: active ? '#fff' : nodeMeta(node.kind).color }} />
                    <span className="truncate">{node.name}</span>
                  </span>
                  <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-teal-100' : full ? 'font-semibold text-red-500' : 'text-slate-400'}`}>
                    {node.ports.used}/{node.ports.total}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="min-w-0">
            {!sheet ? (
              <div className="flex items-center gap-2 py-16 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading ports…</div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white">{selected.name}</h2>
                    <p className="text-xs text-slate-500">
                      {nodeMeta(selected.kind).label}
                      {selected.split_ratio && ` · ${selected.split_ratio}`}
                      {' · '}{selected.ports.used} of {selected.ports.total} ports used
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold tabular-nums ${selected.ports.free === 0 ? 'text-red-600' : 'text-teal-600'}`}>
                      {selected.ports.free ?? 0}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">free</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {sheet.ports.map(({ port_number: port, splice }) => (
                    <div
                      key={port}
                      className={`rounded-xl border p-3 transition-colors ${
                        splice
                          ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                          : 'border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-xs font-bold text-slate-400">P{port}</span>
                        {splice ? (
                          <button onClick={() => clearPort(splice)} className="rounded p-0.5 text-slate-300 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">free</span>
                        )}
                      </div>

                      {splice ? (
                        <div className="mt-1.5 space-y-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {splice.customer_name || (splice.cpe_device_id ? 'ONT' : '—')}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {splice.tube_color && (
                              <span className="h-3 w-3 rounded-sm border border-slate-200" title={`Tube: ${splice.tube_color}`}
                                style={{ background: (FIBER_COLORS.find((c) => c.name === splice.tube_color) || {}).hex }} />
                            )}
                            {splice.fiber_color && (
                              <span className="h-3 w-3 rounded-full border border-slate-200" title={`Fibre: ${splice.fiber_color}`}
                                style={{ background: (FIBER_COLORS.find((c) => c.name === splice.fiber_color) || {}).hex }} />
                            )}
                            {splice.fiber_number && <span className="text-[11px] text-slate-400">#{splice.fiber_number}</span>}
                            {splice.loss_db != null && <span className="text-[11px] tabular-nums text-slate-500">{splice.loss_db} dB</span>}
                          </div>
                          {splice.status !== 'in_use' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-amber-600">
                              <CircleSlash className="h-3 w-3" />{splice.status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigning(port)}
                          className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {assigning && selected && (
        <AssignDialog
          node={selected}
          port={assigning}
          cables={cables}
          nodes={nodes}
          onClose={() => setAssigning(null)}
          onSaved={refreshAll}
        />
      )}
    </FiberLayout>
  );
}
