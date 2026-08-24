import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { importService } from '../../services/importService';
import RunStatusPill from './RunStatusPill';
import TablePagination from '../ui/TablePagination';
import { useServerPagination } from '../../hooks/usePagination';

export default function ImportRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pager = useServerPagination({ storageKey: 'import-runs', defaultPageSize: 25 });
  const { page, pageSize, setTotals } = pager;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const response = await importService.listRuns({ page, per_page: pageSize });
      if (cancelled) return;
      if (response.success) {
        setRuns(response.data?.runs || []);
        setTotals(response.data);
        setError(null);
      } else {
        setError(response.error || 'Could not load import history');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, setTotals]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/import"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to import
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Import history</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Every scan and import, with what it created and whether it can still be reverted.
          </p>
        </motion.div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No imports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    <th className="pb-2 font-semibold">Run</th>
                    <th className="pb-2 font-semibold">Source</th>
                    <th className="pb-2 font-semibold">Router</th>
                    <th className="pb-2 font-semibold">Found</th>
                    <th className="pb-2 font-semibold">Created</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">By</th>
                    <th className="pb-2 font-semibold">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="py-3">
                        <Link
                          to={`/import/runs/${run.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          #{run.id}
                        </Link>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{run.source}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {run.device_name || '—'}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {run.counts?.total ?? '—'}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {run.counts?.created ?? '—'}
                      </td>
                      <td className="py-3">
                        <RunStatusPill status={run.status} />
                      </td>
                      <td className="py-3 text-slate-500">{run.created_by || '—'}</td>
                      <td className="py-3 text-slate-500">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <TablePagination {...pager.paginationProps} loading={loading} noun="import run" nounPlural="import runs" />
        </section>
      </div>
    </div>
  );
}
