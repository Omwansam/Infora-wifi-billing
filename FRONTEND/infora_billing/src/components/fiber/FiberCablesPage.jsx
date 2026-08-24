import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Cable, Loader2, RefreshCw, Ruler, Trash2 } from 'lucide-react';

import FiberLayout from './FiberLayout';
import { CABLE_TYPES, formatLength, nodeMeta } from './fiberMeta';
import fiberService from '../../services/fiberService';
import { useConfirm } from '../../contexts/ConfirmContext';
import TablePagination from '../ui/TablePagination';
import { useClientPagination } from '../../hooks/usePagination';

export default function FiberCablesPage() {
  const confirm = useConfirm();
  const [cables, setCables] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cableData, nodeData] = await Promise.all([
        fiberService.listCables(),
        fiberService.listNodes().catch(() => ({ nodes: [] })),
      ]);
      setCables(cableData?.cables || []);
      setNodes(nodeData?.nodes || []);
    } catch (error) {
      toast.error(error.message || 'Could not load cables');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const visible = useMemo(
    () => cables.filter((c) => type === 'all' || c.cable_type === type),
    [cables, type],
  );

  const { pageItems, paginationProps } = useClientPagination(visible, {
    storageKey: 'fiber-cables',
    defaultPageSize: 25,
    resetOn: [type],
    filteredFrom: cables.length,
  });

  // What an operator actually needs off this page: how much of each type is in
  // the ground, because that is what reorder decisions are made from.
  const totals = useMemo(() => {
    const out = {};
    for (const cable of cables) {
      const key = cable.cable_type || 'distribution';
      out[key] = (out[key] || 0) + (cable.length_m || 0);
    }
    return out;
  }, [cables]);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  const remove = async (cable) => {
    const ok = await confirm({
      title: `Delete ${cable.name || `cable ${cable.id}`}?`,
      message: 'Any port assignment referencing it keeps its port but loses the cable link.',
      confirmText: 'Delete', destructive: true,
    });
    if (!ok) return;
    try {
      await fiberService.deleteCable(cable.id);
      toast.success('Cable deleted');
      await load();
    } catch (error) { toast.error(error.message || 'Delete failed'); }
  };

  return (
    <FiberLayout
      title="Cable routes"
      subtitle="Every segment, its drawn route and the length you order by"
      action={(
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
          <Link to="/fiber/map" className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            <Cable className="mr-2 h-4 w-4" /> Draw on the map
          </Link>
        </div>
      )}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total route</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatLength(grandTotal)}</p>
        </div>
        {Object.entries(CABLE_TYPES).map(([key, meta]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />{meta.label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatLength(totals[key] || 0)}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <option value="all">All types</option>
          {Object.entries(CABLE_TYPES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Ruler className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No cable routes yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Draw them on the map by clicking along the real route. A straight line between two boxes
            underestimates what you actually have to buy and pull.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Cable</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From → To</th><th className="px-4 py-3 text-right">Length</th>
                <th className="px-4 py-3 text-right">Fibres</th><th className="px-4 py-3">Install</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageItems.map((cable) => {
                const meta = CABLE_TYPES[cable.cable_type] || CABLE_TYPES.distribution;
                const from = byId[cable.from_node_id];
                const to = cable.to_node_id ? byId[cable.to_node_id] : null;
                return (
                  <tr key={cable.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">{cable.name || `Cable ${cable.id}`}</span>
                      {cable.status === 'planned' && <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">planned</span>}
                      {!cable.path?.length && <div className="text-xs text-amber-600">No route drawn</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {from ? `${nodeMeta(from.kind).short} ${from.name}` : '—'}
                      <span className="mx-1.5 text-slate-300">→</span>
                      {to ? `${nodeMeta(to.kind).short} ${to.name}` : <span className="text-slate-400">open end</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">{formatLength(cable.length_m)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{cable.fiber_count ?? '—'}</td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-600 dark:text-slate-400">{cable.installation}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => remove(cable)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <TablePagination {...paginationProps} loading={loading} noun="cable" />
        </div>
      )}
    </FiberLayout>
  );
}
