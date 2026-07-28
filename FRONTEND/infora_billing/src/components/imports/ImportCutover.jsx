import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ClipboardCopy, Download, Loader2, Undo2 } from 'lucide-react';

import { importService } from '../../services/importService';

const STEPS = [
  {
    title: 'Adopt the router',
    body:
      'Run the adoption script. It adds Infora as an extra RADIUS server and enables RADIUS AAA. It touches no bridge, pool, DHCP server, address, NAT rule or user — your subscribers keep their IPs and keep authenticating against the old system.',
  },
  {
    title: 'Move a few volunteers',
    body:
      'RouterOS checks its own /ppp secret database before it asks RADIUS. Disabling one subscriber’s secret is exactly "route this one person through Infora". Watch them come back online with the right speed.',
  },
  {
    title: 'Roll forward in batches',
    body:
      'A package at a time, or fifty clients at a time. Between batches, check Online Users fills up and accounting flows.',
  },
  {
    title: 'Retire the old system',
    body:
      'Once every session is served by Infora, remove the incumbent RADIUS entry and archive its export. Keep it read-only for a soak week.',
  },
];

export default function ImportCutover() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [limit, setLimit] = useState(5);
  const [script, setScript] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await importService.listRuns();
      if (cancelled) return;
      if (response.success) {
        const completed = (response.data?.runs || []).filter((r) => r.status === 'completed');
        setRuns(completed);
        if (completed.length) setRunId(String(completed[0].id));
      } else {
        setError(response.error || 'Could not load import history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async (kind) => {
    if (!runId) {
      setError('Pick an imported run first.');
      return;
    }
    setBusy(true);
    setError(null);
    const response =
      kind === 'rollback'
        ? await importService.rollbackScript(runId)
        : await importService.cutoverScript(runId, { limit: Number(limit) || undefined });
    if (response.success) {
      setScript({ kind, text: response.data.script, count: response.data.count });
    } else {
      setError(response.error || 'Could not build the script');
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!script?.text) return;
    try {
      await navigator.clipboard.writeText(script.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the script and copy it manually.');
    }
  };

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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Migration</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Migration &amp; cutover
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            Move subscribers from their current billing system onto Infora, a batch at a time, with a
            one-command rollback at every step.
          </p>
        </motion.div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            How the cutover works
          </h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Verify on your RouterOS version that local secrets are checked before RADIUS — the whole
            gradual cutover depends on it. Move one volunteer first and confirm they come back
            online before touching a batch.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Generate a script
          </h2>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Imported run
              </label>
              <select
                value={runId}
                onChange={(event) => setRunId(event.target.value)}
                className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select a run…</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    #{run.id} — {run.device_name || run.source} ({run.counts?.created ?? 0} clients)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Batch size
              </label>
              <input
                type="number"
                min="1"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="w-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={() => generate('cutover')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Move this batch
            </button>
            {runId && (
              <a
                href={importService.adoptionScriptUrl(runId)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <Download className="h-4 w-4" />
                Adoption script
              </a>
            )}
            <button
              type="button"
              onClick={() => generate('rollback')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" />
              Rollback script
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          {script && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {script.kind === 'rollback'
                    ? 'Re-enables every local secret and removes our RADIUS entry.'
                    : `Moves ${script.count} subscriber(s). Secrets are disabled, never deleted — undo with disabled=no.`}
                </p>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
                {script.text}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
