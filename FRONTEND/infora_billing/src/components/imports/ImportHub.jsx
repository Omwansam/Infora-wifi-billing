import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ArrowRight,
  FileSpreadsheet,
  History,
  Loader2,
  Router,
  ShieldCheck,
} from 'lucide-react';

import { importService } from '../../services/importService';
import RunStatusPill from './RunStatusPill';

const SOURCES = [
  {
    to: '/import/router',
    icon: Router,
    title: 'From a router',
    blurb:
      'Point at a MikroTik and read its PPPoE secrets, profiles, pools and hotspot users. Every profile becomes a package; hundreds of clients land in one pass.',
    accent: 'bg-blue-100 text-blue-600',
  },
  {
    to: '/import/file',
    icon: FileSpreadsheet,
    title: 'From a file',
    blurb:
      'Upload a CSV exported from your old billing system. Best when the old system holds the names, phone numbers and due dates.',
    accent: 'bg-violet-100 text-violet-600',
  },
  {
    to: '/import/cutover',
    icon: ArrowLeftRight,
    title: 'Migration & cutover',
    blurb:
      'Already imported? Move subscribers onto Infora one batch at a time, watch them come online, and roll back instantly if anything looks wrong.',
    accent: 'bg-amber-100 text-amber-600',
  },
];

export default function ImportHub() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await importService.listRuns();
      if (cancelled) return;
      // apiCall resolves rather than throwing, so the failure branch is explicit.
      if (response.success) {
        setRuns(response.data?.runs || []);
        setError(null);
      } else {
        setError(response.error || 'Could not load import history');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Migration</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Import</h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            Bring an existing network onto Infora without disturbing it. Scanning is read-only, the
            import is reviewed before it writes anything, and the router is only reconfigured when
            you explicitly cut over.
          </p>
        </motion.div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {SOURCES.map((source, index) => {
            const Icon = source.icon;
            return (
              <motion.div
                key={source.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={source.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${source.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {source.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">{source.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                    Start
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold">Scanning never changes the router.</p>
            <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
              Every command a scan runs is a read. Your existing billing system keeps authenticating
              subscribers exactly as it does now, and keeps doing so until you choose to cut over.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recent runs
            </h2>
            <Link
              to="/import/runs"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <History className="h-4 w-4" />
              All history
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No imports yet. Pick a source above to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    <th className="pb-2 font-semibold">Run</th>
                    <th className="pb-2 font-semibold">Source</th>
                    <th className="pb-2 font-semibold">Router</th>
                    <th className="pb-2 font-semibold">Found</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 8).map((run) => (
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
                      <td className="py-3">
                        <RunStatusPill status={run.status} />
                      </td>
                      <td className="py-3 text-slate-500">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
