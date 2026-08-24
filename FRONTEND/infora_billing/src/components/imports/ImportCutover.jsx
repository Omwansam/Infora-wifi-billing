import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Undo2,
  XCircle,
} from 'lucide-react';

import { importService } from '../../services/importService';

const CARD =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8';
const LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const INPUT =
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const STEP_HEAD = 'text-[11px] font-bold uppercase tracking-wider text-slate-400';

function Stat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900 dark:text-slate-100',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  return (
    <div>
      <p className={`text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function ScriptBlock({ title, script, onCopy, copied }) {
  if (!script) return null;
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
        {script}
      </pre>
    </div>
  );
}

export default function ImportCutover() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [state, setState] = useState(null);
  const [watch, setWatch] = useState(null);

  const [limit, setLimit] = useState(5);
  const [profile, setProfile] = useState('');
  const [interim, setInterim] = useState('1m');
  const [fasttrack, setFasttrack] = useState('remove');

  const [script, setScript] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [verifyProgress, setVerifyProgress] = useState(null);

  const cancelVerify = useRef(false);

  // --- data -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await importService.listRuns();
      if (cancelled) return;
      // apiCall resolves rather than throwing, so the failure branch is explicit.
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

  const loadState = useCallback(async (id) => {
    if (!id) return;
    const response = await importService.cutoverStatus(id);
    if (response.success) setState(response.data);
    else setError(response.error || 'Could not read cutover status');
  }, []);

  useEffect(() => {
    setState(null);
    setWatch(null);
    setScript(null);
    setNotice(null);
    setError(null);
    loadState(runId);
  }, [runId, loadState]);

  const verification = state?.verification;
  const profiles = state?.profiles || [];
  const hasHotspot = (state?.kinds?.hotspot || 0) > 0;

  const readiness = useMemo(() => {
    if (!verification || !verification.total) return null;
    if (verification.pending) {
      return { tone: 'slate', text: `${verification.pending} client(s) not checked yet` };
    }
    if (verification.failed) {
      return {
        tone: 'rose',
        text: `${verification.failed} client(s) would NOT authenticate — fix before moving them`,
      };
    }
    if (verification.warned) {
      return { tone: 'amber', text: `${verification.warned} client(s) authenticate with warnings` };
    }
    return { tone: 'emerald', text: 'Every imported client authenticates against Infora' };
  }, [verification]);

  // --- actions ----------------------------------------------------------

  const copyScript = async () => {
    if (!script?.text) return;
    try {
      await navigator.clipboard.writeText(script.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the script and copy it manually.');
    }
  };

  /**
   * Verification is resumable: the server works to a deadline and tells us what
   * is still pending, so we loop until it reports none left. That keeps a
   * 400-client check off a single long-held request without needing shared
   * progress state across gunicorn workers.
   */
  const runVerification = async () => {
    if (!runId) return setError('Pick an imported run first.');
    setBusy('verify');
    setError(null);
    setNotice(null);
    cancelVerify.current = false;

    let guard = 0;
    let summary = null;
    while (guard < 40 && !cancelVerify.current) {
      guard += 1;
      // eslint-disable-next-line no-await-in-loop
      const response = await importService.verifyRun(runId, { only_pending: true });
      if (!response.success) {
        setError(response.error || 'Verification failed');
        break;
      }
      summary = response.data;
      setVerifyProgress(summary);
      if (!summary.pending || !summary.checked_now) break;
    }
    if (summary) setState((prev) => (prev ? { ...prev, verification: summary } : prev));
    await loadState(runId);
    setVerifyProgress(null);
    setBusy(null);
    return undefined;
  };

  const recheckOne = async (login) => {
    setBusy(`recheck-${login}`);
    const response = await importService.verifyRun(runId, { only_pending: false, logins: [login] });
    if (!response.success) setError(response.error || 'Re-check failed');
    await loadState(runId);
    setBusy(null);
  };

  const generateCutover = async ({ dryRun = false } = {}) => {
    if (!runId) return setError('Pick an imported run first.');
    setBusy(dryRun ? 'preview' : 'cutover');
    setError(null);
    setNotice(null);
    const response = await importService.cutoverScript(runId, {
      limit: Number(limit) || undefined,
      profile: profile || undefined,
      dry_run: dryRun,
    });
    if (response.success) {
      const { count, unverified, marked } = response.data;
      setScript({ kind: 'cutover', text: response.data.script, count, unverified });
      setNotice(
        marked
          ? `${count} subscriber(s) marked as moved. The next batch will be the next ${count === 1 ? 'one' : 'ones'}.`
          : `Preview only — nothing was marked as moved.`,
      );
      await loadState(runId);
    } else {
      setError(response.error || 'Could not build the script');
    }
    setBusy(null);
    return undefined;
  };

  const generateRollback = async () => {
    if (!runId) return setError('Pick an imported run first.');
    setBusy('rollback');
    setError(null);
    const response = await importService.rollbackScript(runId, {});
    if (response.success) {
      setScript({ kind: 'rollback', text: response.data.script, count: response.data.count });
      setNotice('Batch marks cleared — these subscribers count as not moved again.');
      await loadState(runId);
    } else {
      setError(response.error || 'Could not build the script');
    }
    setBusy(null);
    return undefined;
  };

  const resetBatch = async () => {
    setBusy('reset');
    const response = await importService.cutoverReset(runId, {});
    if (response.success) {
      setNotice(`${response.data.reset} subscriber(s) marked as not moved.`);
      await loadState(runId);
    } else {
      setError(response.error || 'Could not reset the batch');
    }
    setBusy(null);
  };

  const refreshWatch = useCallback(async () => {
    if (!runId) return;
    setBusy('watch');
    const response = await importService.cutoverWatch(runId);
    if (response.success) setWatch(response.data);
    else setError(response.error || 'Could not read the watch');
    setBusy(null);
  }, [runId]);

  // --- render -----------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/import"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to import
          </Link>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Migration</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Migration &amp; cutover
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            Move subscribers from their current billing system onto Infora, a batch at a time, with a
            one-command rollback at every step.
          </p>
        </motion.div>

        {/* Run picker + progress */}
        <section className={`mb-6 ${CARD}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <label htmlFor="run" className={LABEL}>Imported run</label>
              <select
                id="run"
                value={runId}
                onChange={(event) => setRunId(event.target.value)}
                className={`w-72 ${INPUT}`}
              >
                <option value="">Select a run…</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    #{run.id} — {run.device_name || run.source} ({run.counts?.created ?? 0} clients)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => loadState(runId)}
              disabled={!runId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {!runs.length && (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              No completed imports yet. Run{' '}
              <Link to="/import/router" className="font-semibold text-blue-600 hover:text-blue-700">
                Import from a router
              </Link>{' '}
              first — a cutover moves subscribers that Infora already knows about.
            </p>
          )}

          {state && (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-8">
                <Stat label="imported" value={state.total} />
                <Stat label="moved" value={state.moved} tone={state.moved ? 'emerald' : 'slate'} />
                <Stat label="remaining" value={state.remaining} />
                <Stat
                  label="verified ok"
                  value={verification?.passed ?? 0}
                  tone={verification?.passed ? 'emerald' : 'slate'}
                />
                {Boolean(verification?.failed) && (
                  <Stat label="would fail" value={verification.failed} tone="rose" />
                )}
              </div>
              {state.total > 0 && (
                <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round((state.moved / state.total) * 100)}%` }}
                  />
                </div>
              )}
              {!state.device_id && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This run is not linked to a registered router, so the adoption script and the
                  router side of the watch are unavailable. Re-scan with a router selected to get
                  them.
                </p>
              )}
            </>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}
          {notice && (
            <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              {notice}
            </p>
          )}
        </section>

        {/* Step 1 — adopt */}
        <section className={`mb-6 ${CARD}`}>
          <h2 className={STEP_HEAD}>Step 1 — Adopt the router</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Adds Infora as an <strong>extra</strong> RADIUS server and enables RADIUS AAA. It touches
            no bridge, pool, DHCP server, address, NAT rule or user. RouterOS checks its own{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
              /ppp secret
            </code>{' '}
            database before it asks RADIUS, so running this changes nothing for anyone — it only
            opens the door.
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="interim" className={LABEL}>Accounting interval</label>
              <select id="interim" value={interim} onChange={(e) => setInterim(e.target.value)} className={`w-40 ${INPUT}`}>
                <option value="1m">1 minute (cutover)</option>
                <option value="5m">5 minutes (normal)</option>
                <option value="10m">10 minutes</option>
              </select>
            </div>
            <div>
              <label htmlFor="fasttrack" className={LABEL}>FastTrack</label>
              <select id="fasttrack" value={fasttrack} onChange={(e) => setFasttrack(e.target.value)} className={`w-56 ${INPUT}`}>
                <option value="remove">Remove (accounting works)</option>
                <option value="keep">Keep (usage will read zero)</option>
              </select>
            </div>
            <a
              href={runId ? importService.adoptionScriptUrl(runId, { interim, fasttrack }) : undefined}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 ${
                runId && state?.device_id ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <Download className="h-4 w-4" />
              Adoption script
            </a>
          </div>

          <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
            A shorter interval during the cutover window means you see traffic while you are still
            watching the screen. FastTrack short-circuits the forwarding path RADIUS accounting
            observes — leave it in and every usage figure and FUP reads zero; remove it and CPU rises
            on a weak board.
          </p>
        </section>

        {/* Step 2 — verify */}
        <section className={`mb-6 ${CARD}`}>
          <h2 className={STEP_HEAD}>Step 2 — Would they actually authenticate?</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Sends a real RADIUS Access-Request for every imported client — MS-CHAPv2 for PPPoE, PAP
            for hotspot, each the way that subscriber really dials — and reads the reply. This is the
            check that turns a cutover from &ldquo;paste and hope&rdquo; into something you can run on a live
            network.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runVerification}
              disabled={!runId || busy === 'verify'}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy === 'verify' ? 'Checking…' : 'Verify every client'}
            </button>
            {busy === 'verify' && (
              <button
                type="button"
                onClick={() => { cancelVerify.current = true; }}
                className="text-sm font-medium text-slate-500 underline hover:text-slate-800"
              >
                Stop
              </button>
            )}
            {verifyProgress && (
              <span className="text-sm text-slate-500">
                {verifyProgress.total - verifyProgress.pending} / {verifyProgress.total} checked
              </span>
            )}
          </div>

          {verification?.total > 0 && (
            <div className="mt-5">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {verification.headline}
              </p>
              {readiness && (
                <p
                  className={`mt-1 text-sm font-medium ${
                    {
                      emerald: 'text-emerald-600 dark:text-emerald-400',
                      amber: 'text-amber-600 dark:text-amber-400',
                      rose: 'text-rose-600 dark:text-rose-400',
                      slate: 'text-slate-500',
                    }[readiness.tone]
                  }`}
                >
                  {readiness.text}
                </p>
              )}

              {Boolean(verification.problems?.length) && (
                <ul className="mt-4 space-y-2">
                  {verification.problems.map((problem) => (
                    <li
                      key={problem.id}
                      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                        problem.state === 'fail'
                          ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20'
                          : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                      }`}
                    >
                      {problem.state === 'fail' ? (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {problem.login}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {problem.kind}
                            {problem.profile ? ` · ${problem.profile}` : ''}
                          </span>
                        </p>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300">{problem.detail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => recheckOne(problem.login)}
                        disabled={busy === `recheck-${problem.login}`}
                        className="shrink-0 text-xs font-semibold text-slate-500 underline hover:text-slate-800 disabled:opacity-50 dark:hover:text-slate-200"
                      >
                        Re-check
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="mt-5 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
            The probe reaches FreeRADIUS from the app, so it proves the subscriber half of the chain
            — radcheck, the plan group, reply attributes, mschap. It says nothing about the router&rsquo;s
            own NAS entry and shared secret; the adoption step and your first canary client prove
            that half.
          </p>
        </section>

        {/* Step 3 — move a batch */}
        <section className={`mb-6 ${CARD}`}>
          <h2 className={STEP_HEAD}>Step 3 — Move a batch</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Disabling a subscriber&rsquo;s local credential is exactly &ldquo;route this one person through
            Infora&rdquo;. Credentials are disabled, never deleted, so the password stays on the router and
            rollback costs one command. <strong>Start with a batch of 1</strong> and confirm they come
            back online before touching a larger batch.
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="batch" className={LABEL}>Batch size</label>
              <input
                id="batch"
                type="number"
                min="1"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className={`w-24 ${INPUT}`}
              />
            </div>
            <div>
              <label htmlFor="profile" className={LABEL}>Package</label>
              <select id="profile" value={profile} onChange={(e) => setProfile(e.target.value)} className={`w-56 ${INPUT}`}>
                <option value="">Any package</option>
                {profiles.map((row) => (
                  <option key={row.profile} value={row.profile === '(no profile)' ? '' : row.profile}>
                    {row.profile} — {row.remaining} left
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => generateCutover({ dryRun: true })}
              disabled={!runId || busy === 'preview'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Preview
            </button>
            <button
              type="button"
              onClick={() => generateCutover({ dryRun: false })}
              disabled={!runId || busy === 'cutover' || state?.remaining === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'cutover' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Move next batch
            </button>
            {Boolean(state?.moved) && (
              <button
                type="button"
                onClick={resetBatch}
                disabled={busy === 'reset'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Undo2 className="h-4 w-4" />
                Mark all as not moved
              </button>
            )}
          </div>

          {hasHotspot && (
            <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              This run has {state.kinds.hotspot} hotspot subscriber(s). They are moved through{' '}
              <code className="font-mono">/ip hotspot user</code>, not{' '}
              <code className="font-mono">/ppp secret</code> — the script routes each entry to the
              menu that owns it.
            </p>
          )}

          {Boolean(script?.unverified?.length) && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {script.unverified.length} of these have not passed verification (
                {script.unverified.slice(0, 5).join(', ')}
                {script.unverified.length > 5 ? '…' : ''}). Moving a client whose credentials do not
                authenticate takes them offline with no fallback. Run Step 2 first.
              </span>
            </p>
          )}

          {script?.kind === 'cutover' && (
            <ScriptBlock
              title={`Moves ${script.count} subscriber(s). Paste in the router terminal.`}
              script={script.text}
              onCopy={copyScript}
              copied={copied}
            />
          )}
        </section>

        {/* Step 4 — watch */}
        <section className={`mb-6 ${CARD}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className={STEP_HEAD}>Step 4 — Who has not come back?</h2>
            <button
              type="button"
              onClick={refreshWatch}
              disabled={!runId || busy === 'watch'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {busy === 'watch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Check now
            </button>
          </div>

          {!watch ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              After you paste a batch, check here. It compares who you moved against who is actually
              holding a live session through Infora, and names the difference.
            </p>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-8">
                <Stat label="moved" value={watch.moved} />
                <Stat
                  label="online via Infora"
                  value={watch.online_via_infora}
                  tone={watch.moved && watch.online_via_infora === watch.moved ? 'emerald' : 'slate'}
                />
                <Stat
                  label="not back yet"
                  value={watch.not_back_yet.length}
                  tone={watch.not_back_yet.length ? 'rose' : 'emerald'}
                />
                {watch.router?.available && (
                  <>
                    <Stat label="router ppp active" value={watch.router.ppp_active ?? '—'} />
                    <Stat label="local secrets left" value={watch.router.local_secrets_enabled ?? '—'} />
                  </>
                )}
              </div>

              {!watch.router?.available && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Router-side counts unavailable — {watch.router?.reason}
                </p>
              )}

              {watch.not_back_yet.length === 0 && watch.moved > 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Every subscriber you moved is holding a live session through Infora.
                </p>
              )}

              {Boolean(watch.not_back_yet.length) && (
                <ul className="mt-4 space-y-2">
                  {watch.not_back_yet.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.login}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {row.kind}
                          {row.profile ? ` · ${row.profile}` : ''}
                        </span>
                      </p>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                        {row.verify_detail
                          || 'No live session yet. A CPE can take a minute to redial — if it persists, roll this one back.'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                A session counts as live while its accounting is fresh, so a client that has only
                just redialled may take a moment to appear.
              </p>
            </>
          )}
        </section>

        {/* Rollback */}
        <section className={`${CARD} border-rose-200 dark:border-rose-900/40`}>
          <h2 className={STEP_HEAD}>Rollback</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Re-enables every local credential this run moved and removes our RADIUS entry.{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">use-radius</code>{' '}
            is left alone on purpose — with the local database restored it is inert, and turning it
            off is the one step that could surprise someone already migrated.
          </p>
          <button
            type="button"
            onClick={generateRollback}
            disabled={!runId || busy === 'rollback'}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            {busy === 'rollback' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Rollback script
          </button>

          {script?.kind === 'rollback' && (
            <ScriptBlock
              title={`Re-enables ${script.count} local credential(s) and removes our RADIUS entry.`}
              script={script.text}
              onCopy={copyScript}
              copied={copied}
            />
          )}
        </section>

        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Verify on your RouterOS version that local credentials are checked before RADIUS — the
          whole gradual cutover depends on it. Move one volunteer first and confirm they come back
          online before touching a batch.
        </p>
      </div>
    </div>
  );
}
