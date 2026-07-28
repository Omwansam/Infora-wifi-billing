import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ClipboardCopy,
  FileUp,
  Loader2,
  Play,
  Radio,
  ShieldCheck,
  Terminal,
  Upload,
} from 'lucide-react';

import deviceService from '../../services/deviceService';
import { importService } from '../../services/importService';
import { getAccessToken } from '../../utils/authToken';
import RouterProfileCard from './RouterProfileCard';

const TRANSPORTS = [
  {
    id: 'export',
    icon: FileUp,
    title: 'Upload a config export',
    blurb: 'No access to the router needed. Works through any NAT or CGNAT.',
    recommended: true,
  },
  {
    id: 'agent',
    icon: Terminal,
    title: 'Run a read-only script',
    blurb: 'Paste one script into the router terminal; it uploads its findings to us.',
  },
  {
    id: 'ssh',
    icon: Radio,
    title: 'Scan over SSH',
    blurb: 'For routers already registered and reachable from this server.',
  },
];

export default function RouterImport() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [transport, setTransport] = useState('export');
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [exportText, setExportText] = useState('');
  const [fileName, setFileName] = useState('');
  const [agent, setAgent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // deviceService throws on failure (unlike the apiCall-based services),
        // and a failure here is not fatal: the export and agent transports need
        // no registered device at all.
        const data = await deviceService.getDevices(getAccessToken());
        if (cancelled) return;
        const list = data?.devices || data?.data || data || [];
        setDevices(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setDevices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExportText(await file.text());
    setError(null);
  };

  /**
   * Poll a run until it stops scanning.
   *
   * The SSH scan is asynchronous: an empty router takes ~15 s over the
   * management tunnel and a few hundred secrets take considerably longer than
   * any request should be held open for. The POST returns 202 with a run id and
   * the real result arrives here.
   */
  const awaitScan = async (runId, { tries = 120, intervalMs = 2000 } = {}) => {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const response = await importService.getRun(runId);
      if (!response.success) return { error: response.error || 'Lost contact with the scan' };
      const run = response.data.run;
      if (run.status === 'failed') return { error: run.error || 'Scan failed on the router' };
      if (run.status !== 'scanning') {
        return { data: { run, packages: response.data.packages || [], counts: run.counts || {} } };
      }
      setProgress(`Reading the router… ${Math.round((attempt * intervalMs) / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return { error: 'The scan is taking unusually long — check Import history for run status.' };
  };

  const runScan = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);

    let response;
    if (transport === 'ssh') {
      if (!deviceId) {
        setError('Pick a router to scan.');
        setBusy(false);
        return;
      }
      response = await importService.scanRouter(Number(deviceId));
      if (response.success && response.data?.run?.id) {
        const settled = await awaitScan(response.data.run.id);
        setProgress(null);
        if (settled.error) setError(settled.error);
        else setResult(settled.data);
        setBusy(false);
        return;
      }
    } else {
      if (!exportText.trim()) {
        setError('Paste or upload a RouterOS export first.');
        setBusy(false);
        return;
      }
      // Parsing an uploaded export is fast and stays synchronous.
      response = await importService.uploadExport(exportText, deviceId ? Number(deviceId) : null);
    }

    if (response.success) {
      setResult(response.data);
    } else {
      setError(response.error || 'Scan failed');
    }
    setBusy(false);
  };

  const fetchAgentScript = async () => {
    setBusy(true);
    setError(null);
    const response = await importService.getAgentScript(deviceId ? Number(deviceId) : null);
    if (response.success) {
      setAgent(response.data);
    } else {
      setError(response.error || 'Could not generate the scan script');
    }
    setBusy(false);
  };

  const copyScript = async () => {
    if (!agent?.script) return;
    try {
      await navigator.clipboard.writeText(agent.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the script and copy it manually.');
    }
  };

  const fingerprint = result?.run?.fingerprint;
  const blocking = fingerprint?.blocking;

  const packageSummary = useMemo(() => {
    const packages = result?.packages || [];
    return {
      total: packages.length,
      creating: packages.filter((p) => p.decision === 'create').length,
    };
  }, [result]);

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
            Import from a router
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            Read a MikroTik&rsquo;s subscribers, profiles and address plan. Every profile becomes a
            package and every secret becomes a client — while the router keeps running whatever
            billing system it is running today.
          </p>
        </motion.div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold">This step is read-only.</p>
            <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
              Nothing is created, changed or removed on the router. Subscribers stay on their current
              system until you run the cutover yourself.
            </p>
          </div>
        </div>

        {/* Step 1 — how we read the router */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Step 1 — How should we read it?
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {TRANSPORTS.map((option) => {
              const Icon = option.icon;
              const active = transport === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setTransport(option.id);
                    setError(null);
                  }}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {option.title}
                    </span>
                  </div>
                  {option.recommended && (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Easiest
                    </span>
                  )}
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{option.blurb}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Router {transport === 'ssh' ? '(required)' : '(optional — links the run to a device)'}
            </label>
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Not linked to a registered router</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.device_name || device.name} ({device.device_ip || device.ip})
                </option>
              ))}
            </select>
          </div>

          {transport === 'export' && (
            <div className="mt-6">
              <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                In the router terminal run{' '}
                <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
                  /export show-sensitive
                </code>{' '}
                on RouterOS v7, or{' '}
                <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
                  /export
                </code>{' '}
                on v6, then paste or upload the result.
                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                  On v7, leaving off <code className="font-mono">show-sensitive</code> strips every
                  password — the scan will tell you if that happened.
                </span>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".rsc,.txt,text/plain"
                onChange={onPickFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {fileName || 'Upload a .rsc export'}
                </p>
              </button>

              <textarea
                value={exportText}
                onChange={(event) => setExportText(event.target.value)}
                rows={8}
                placeholder="…or paste the export here"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {transport === 'agent' && (
            <div className="mt-6">
              {!agent ? (
                <button
                  type="button"
                  onClick={fetchAgentScript}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                  Generate the scan script
                </button>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Paste this into the router terminal. Read it first — there is no write command
                      in it.
                    </p>
                    <button
                      type="button"
                      onClick={copyScript}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
                    {agent.script}
                  </pre>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    When it finishes, open{' '}
                    <Link
                      to={`/import/runs/${agent.run?.id}`}
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      run #{agent.run?.id}
                    </Link>{' '}
                    to review what it found.
                  </p>
                </>
              )}
            </div>
          )}

          {transport !== 'agent' && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={runScan}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {progress || 'Scan router'}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}
        </section>

        {/* Step 2 — what we found */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <RouterProfileCard fingerprint={fingerprint} />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Step 2 — What we found
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {result.counts?.total ?? 0}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">subscribers</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {packageSummary.creating}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    packages to create
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {result.counts?.with_password ?? 0}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    with a usable password
                  </p>
                </div>
              </div>

              {blocking ? (
                <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  This scan cannot be imported as-is — fix the problem above and scan again.
                  Importing now would replace working credentials and knock every client offline.
                </p>
              ) : (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(`/import/runs/${result.run.id}`)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Review, price and import
                  </button>
                </div>
              )}
            </section>
          </motion.div>
        )}
      </div>
    </div>
  );
}
