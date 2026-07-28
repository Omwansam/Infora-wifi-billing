import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Undo2,
} from 'lucide-react';

import { importService } from '../../services/importService';
import RouterProfileCard from './RouterProfileCard';
import RunStatusPill from './RunStatusPill';

const ANCHORS = [
  {
    id: 'uniform',
    title: 'Give everyone a grace period',
    blurb: 'Safest. Nobody is cut off mid-migration; each client re-anchors on their first payment.',
  },
  {
    id: 'mined',
    title: 'Use the expiry found in router comments',
    blurb: 'Only honoured where the comment actually said "exp"/"due"; everyone else gets the grace period.',
  },
  {
    id: 'none',
    title: 'No expiry date',
    blurb: 'Import for records only. Nothing will expire until you set dates yourself.',
  },
];

function speedLabel(pkg) {
  if (!pkg.download_mbps) return '—';
  const down = `↓${pkg.download_mbps}M`;
  const up = pkg.upload_mbps ? ` ↑${pkg.upload_mbps}M` : '';
  return down + up;
}

export default function ImportRunDetail() {
  const { runId } = useParams();

  const [run, setRun] = useState(null);
  const [packages, setPackages] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [anchor, setAnchor] = useState('uniform');
  const [graceDays, setGraceDays] = useState(30);
  const [expiry, setExpiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    const [runResponse, candidateResponse] = await Promise.all([
      importService.getRun(runId),
      importService.getCandidates(runId, { perPage: 200 }),
    ]);

    if (runResponse.success) {
      setRun(runResponse.data.run);
      setPackages(runResponse.data.packages || []);
      setAvailablePlans(runResponse.data.available_plans || []);
      setError(null);
    } else {
      setError(runResponse.error || 'Could not load this run');
    }
    if (candidateResponse.success) {
      setCandidates(candidateResponse.data.candidates || []);
    }
    setLoading(false);
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePackage = (name, patch) => {
    setPackages((prev) => prev.map((p) => (p.name === name ? { ...p, ...patch } : p)));
  };

  const previewExpiry = async () => {
    setBusy(true);
    const response = await importService.planRun(runId, {
      packages,
      anchor,
      grace_days: Number(graceDays),
    });
    if (response.success) {
      setExpiry(response.data.expiry_preview);
      setError(null);
    } else {
      setError(response.error || 'Could not compute the expiry preview');
    }
    setBusy(false);
  };

  const commit = async (force = false) => {
    setBusy(true);
    setError(null);
    const response = await importService.commitRun(runId, {
      packages,
      anchor,
      grace_days: Number(graceDays),
      force,
    });
    if (response.success) {
      setResult(response.data);
      await load();
    } else {
      // A 409 here is the past-dated-expiry guard, not a crash — surface the
      // server's explanation rather than a generic failure.
      setError(response.error || 'Import failed');
    }
    setBusy(false);
  };

  const revert = async () => {
    if (!window.confirm('Delete every client this run created? Clients with payments are kept.')) {
      return;
    }
    setBusy(true);
    const response = await importService.revertRun(runId);
    if (response.success) {
      setResult(null);
      await load();
    } else {
      setError(response.error || 'Revert failed');
    }
    setBusy(false);
  };

  const creating = useMemo(
    () => packages.filter((p) => p.decision === 'create'),
    [packages],
  );
  const unpriced = useMemo(
    () => creating.filter((p) => !p.price && p.subscriber_count > 0),
    [creating],
  );

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const committed = run?.status === 'completed';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/import/runs"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            All runs
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Import run #{run?.id}
            </h1>
            <RunStatusPill status={run?.status} />
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {run?.source} · {run?.device_name || 'no linked router'} ·{' '}
            {run?.counts?.total ?? 0} subscribers found
          </p>
        </motion.div>

        {error && (
          <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        {run?.fingerprint && (
          <div className="mb-6">
            <RouterProfileCard fingerprint={run.fingerprint} />
          </div>
        )}

        {/* Pricing */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Step 1 — Price the packages
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Speeds come off the router; prices do not. Set what each package costs, or point it at a
            package you already have. Sorted by how many subscribers are on it.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="pb-2 font-semibold">Profile</th>
                  <th className="pb-2 font-semibold">Clients</th>
                  <th className="pb-2 font-semibold">Speed</th>
                  <th className="pb-2 font-semibold">Price</th>
                  <th className="pb-2 font-semibold">Cycle</th>
                  <th className="pb-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr
                    key={pkg.name}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{pkg.name}</p>
                      {pkg.warnings?.map((warning) => (
                        <p key={warning} className="mt-0.5 text-xs text-amber-600">
                          {warning}
                        </p>
                      ))}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {pkg.subscriber_count}
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {speedLabel(pkg)}
                    </td>
                    <td className="py-3">
                      <input
                        type="number"
                        min="0"
                        value={pkg.price ?? ''}
                        disabled={committed}
                        onChange={(event) =>
                          updatePackage(pkg.name, { price: Number(event.target.value) })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="number"
                        min="1"
                        value={pkg.billing_cycle_days ?? 30}
                        disabled={committed}
                        onChange={(event) =>
                          updatePackage(pkg.name, {
                            billing_cycle_days: Number(event.target.value),
                          })
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-3">
                      <select
                        value={pkg.map_to_plan_id ? String(pkg.map_to_plan_id) : pkg.decision}
                        disabled={committed}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === 'create' || value === 'skip') {
                            updatePackage(pkg.name, { decision: value, map_to_plan_id: null });
                          } else {
                            updatePackage(pkg.name, {
                              decision: 'create',
                              map_to_plan_id: Number(value),
                            });
                          }
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="create">Create new package</option>
                        <option value="skip">Skip</option>
                        {availablePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            Map to “{plan.name}”
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unpriced.length > 0 && !committed && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {unpriced.length} package(s) with subscribers still cost 0. They will import and bill
              nothing until you set a price.
            </p>
          )}
        </section>

        {/* Billing anchor */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Step 2 — When does everyone expire?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            The router does not know due dates. Pick how the first cycle is set — the safe answer is
            a grace period for everyone.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {ANCHORS.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={committed}
                onClick={() => setAnchor(option.id)}
                className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
                  anchor === option.id
                    ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {option.title}
                </p>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{option.blurb}</p>
              </button>
            ))}
          </div>

          {anchor !== 'none' && (
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-400">Grace period</label>
              <input
                type="number"
                min="1"
                value={graceDays}
                disabled={committed}
                onChange={(event) => setGraceDays(event.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-sm text-slate-500">days from today</span>
              <button
                type="button"
                onClick={previewExpiry}
                disabled={busy || committed}
                className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Preview dates
              </button>
            </div>
          )}

          {expiry && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                expiry.blocking
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {expiry.blocking ? (
                <>
                  <strong>{expiry.past_dated}</strong> of {expiry.total} clients would import already
                  expired and be suspended immediately. Change the anchor, or confirm explicitly.
                </>
              ) : (
                <>
                  {expiry.total} clients, none past-dated. Earliest expiry{' '}
                  {expiry.buckets?.[0]?.date || '—'}.
                </>
              )}
            </div>
          )}
        </section>

        {/* Review + commit */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Step 3 — Review and import
            </h2>
            {committed && (
              <div className="flex items-center gap-2">
                <a
                  href={importService.adoptionScriptUrl(runId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  Adoption script
                </a>
                <button
                  type="button"
                  onClick={revert}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Revert this run
                </button>
              </div>
            )}
          </div>

          {result && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Created {result.created} clients ({result.failed} failed,{' '}
                {result.needs_reconfigure} need new credentials).
                {result.skipped_static > 0 &&
                  ` ${result.skipped_static} static/queue clients were skipped — they cannot be enforced by RADIUS.`}
              </span>
            </div>
          )}

          <div className="mt-5 max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2 font-semibold">Login</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Profile</th>
                  <th className="px-3 py-2 font-semibold">Password</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className={`border-t border-slate-100 dark:border-slate-800/60 ${
                      candidate.status === 'created'
                        ? 'bg-emerald-50/40'
                        : candidate.status === 'error'
                          ? 'bg-rose-50/40'
                          : candidate.status === 'duplicate'
                            ? 'bg-slate-50/60'
                            : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                      {candidate.login || candidate.mac || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {candidate.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {candidate.phone || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {candidate.profile_name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {candidate.has_password ? (
                        <span className="text-emerald-600">kept</span>
                      ) : (
                        <span className="text-amber-600">will be generated</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {candidate.status}
                        {candidate.disabled ? ' · disabled' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!committed && (
            <div className="mt-6 flex justify-end gap-3">
              {expiry?.blocking && (
                <button
                  type="button"
                  onClick={() => commit(true)}
                  disabled={busy}
                  className="rounded-xl border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Import anyway
                </button>
              )}
              <button
                type="button"
                onClick={() => commit(false)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Import {candidates.filter((c) => c.status === 'new').length} clients
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
