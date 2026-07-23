import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Play,
  Users,
  Package,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import toast from 'react-hot-toast';

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 border-slate-100 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide mt-1 opacity-80">{label}</div>
    </div>
  );
}

function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportClients() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null); // dry-run summary
  const [result, setResult] = useState(null); // commit summary
  const [busy, setBusy] = useState(false);
  // Operator resolution for unmatched packages: { oldPlanName: planId | '__create__' }
  const [planChoices, setPlanChoices] = useState({});
  const [defaultStatus, setDefaultStatus] = useState('active');

  // Turn planChoices into the API's plan_map (name→id) + create_plans (names).
  const buildMapping = (choices = planChoices) => {
    const planMap = {};
    const createPlans = [];
    Object.entries(choices).forEach(([name, choice]) => {
      if (choice === '__create__') createPlans.push(name);
      else if (choice) planMap[name] = Number(choice);
    });
    return { planMap, createPlans };
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.onerror = () => toast.error('Could not read the file');
    reader.readAsText(file);
  };

  const onDownloadTemplate = async () => {
    const res = await customerService.getImportTemplate();
    if (res.success) {
      downloadText('infora_client_import_template.csv', res.data);
    } else {
      toast.error(res.error || 'Could not download template');
    }
  };

  const runPreview = async (choices = planChoices) => {
    if (!csvText.trim()) {
      toast.error('Upload a CSV first');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { planMap, createPlans } = buildMapping(choices);
      const res = await customerService.importCustomers({
        csv: csvText, dryRun: true, defaultStatus, planMap, createPlans,
      });
      if (res.success) {
        setPreview(res.data);
        // Prefill each package choice with the server's default action (create,
        // or map to a suggested package) the first time we see it.
        setPlanChoices((prev) => {
          const next = { ...prev };
          (res.data.plan_resolutions || []).forEach((u) => {
            if (next[u.name] === undefined) next[u.name] = u.default ?? '';
          });
          return next;
        });
        if (res.data.errors > 0) {
          toast.error(`${res.data.errors} row(s) still need attention`);
        } else {
          toast.success(`${res.data.would_create} row(s) ready to import`);
        }
      } else {
        toast.error(res.error || 'Preview failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    setBusy(true);
    try {
      const { planMap, createPlans } = buildMapping();
      const res = await customerService.importCustomers({
        csv: csvText, dryRun: false, defaultStatus, planMap, createPlans,
      });
      if (res.success) {
        setResult(res.data);
        toast.success(`Imported ${res.data.created} client(s)`);
      } else {
        toast.error(res.error || 'Import failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = (summary) => {
    const bad = (summary.rows || []).filter((r) => r.status === 'error');
    const lines = [['row', 'name', 'login', 'errors']]
      .concat(bad.map((r) => [
        r.row,
        r.data?.name || '',
        r.data?.login || '',
        (r.messages || []).join('; '),
      ]))
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadText('import_errors.csv', lines);
  };

  const summary = result || preview;

  const rowTone = (status) =>
    status === 'error'
      ? 'bg-rose-50/60'
      : status === 'created'
        ? 'bg-emerald-50/60'
        : '';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Migration</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Import clients</h1>
          <p className="text-slate-600 mt-1 max-w-2xl">
            Bring subscribers over from another billing system. Imported clients keep their original
            connection username &amp; password, so the router keeps them online without any change on
            the customer&rsquo;s side.
          </p>
        </motion.div>

        {/* Step 1 — template + upload */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step 1 — Prepare the file</h2>
              <p className="text-sm text-slate-600 mt-2 max-w-xl">
                Download the template, fill one row per subscriber (or clean your old export to match
                the columns), then upload it. Map each client to a package by its exact name.
              </p>
            </div>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 shrink-0"
            >
              <Download className="h-4 w-4" />
              Download template
            </button>
          </div>

          <div className="mt-6">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onPickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 py-10 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                {fileName ? <FileSpreadsheet className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-900">
                  {fileName || 'Click to upload a CSV'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {fileName ? 'Choose a different file' : 'or drag it onto the button'}
                </p>
              </div>
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => runPreview()}
              disabled={busy || !csvText}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {busy && !result ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Preview import
            </button>
          </div>
        </section>

        {/* Step 2/3 — preview + commit */}
        {summary && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {result ? 'Step 3 — Results' : 'Step 2 — Dry-run preview'}
              </h2>
              {summary.errors > 0 && (
                <button
                  type="button"
                  onClick={() => downloadErrors(summary)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download errors
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total rows" value={summary.total} />
              {result ? (
                <>
                  <StatCard label="Created" value={summary.created} tone="emerald" />
                  <StatCard label="Failed" value={summary.failed} tone={summary.failed ? 'rose' : 'slate'} />
                  <StatCard label="Need reconfigure" value={summary.needs_reconfigure} tone={summary.needs_reconfigure ? 'amber' : 'slate'} />
                </>
              ) : (
                <>
                  <StatCard label="Ready to import" value={summary.would_create} tone="emerald" />
                  <StatCard label="Errors" value={summary.errors} tone={summary.errors ? 'rose' : 'slate'} />
                  <StatCard label="Valid" value={summary.valid} tone="slate" />
                </>
              )}
            </div>

            {/* Auto-cleaning report — deterministic fixes the system applied. */}
            {summary.status_normalizations?.length > 0 && (
              <div className="mb-6 rounded-xl bg-sky-50 border border-sky-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sky-700">
                  <Wand2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Auto-cleaned statuses</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.status_normalizations.map((s) => (
                    <span
                      key={`${s.from}->${s.to}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-sky-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      <code className="text-slate-500">{s.from}</code>
                      <span className="text-sky-400">→</span>
                      <code className="font-semibold text-slate-800">{s.to}</code>
                      <span className="text-slate-400">×{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Packages from the old system — auto-created by default, remappable. */}
            {!result && summary.plan_resolutions?.length > 0 && (() => {
              const createCount = summary.plan_resolutions.filter((u) => (planChoices[u.name] ?? u.default) === '__create__').length;
              return (
              <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-5">
                <div className="flex items-start gap-2">
                  <Package className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      {summary.plan_resolutions.length} package name{summary.plan_resolutions.length === 1 ? '' : 's'} from the old system {summary.plan_resolutions.length === 1 ? "isn't" : "aren't"} in Infora yet
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                      They&rsquo;ll be <strong>created automatically</strong> (as placeholder packages at
                      price&nbsp;0 — set pricing in Packages afterwards). Map one to an existing package
                      instead if you&rsquo;d rather.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {summary.plan_resolutions.map((u) => (
                    <div key={u.name} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-lg border border-amber-100 px-3 py-2">
                      <div className="flex items-center gap-2 sm:w-56 shrink-0">
                        <code className="text-sm font-semibold text-slate-800">{u.name}</code>
                        <span className="text-xs text-slate-400">×{u.count}</span>
                      </div>
                      <span className="hidden sm:inline text-amber-400">→</span>
                      <select
                        value={planChoices[u.name] ?? u.default ?? ''}
                        onChange={(e) =>
                          setPlanChoices((prev) => ({ ...prev, [u.name]: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                      >
                        <option value="__create__">➕ Create &ldquo;{u.name}&rdquo; as a new package</option>
                        {(summary.available_plans || []).map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            Map to: {p.name} ({p.speed})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Unknown statuses become
                    <select
                      value={defaultStatus}
                      onChange={(e) => setDefaultStatus(e.target.value)}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="active">active</option>
                      <option value="pending">pending</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => runPreview()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {createCount > 0 ? `Apply — create ${createCount} package${createCount === 1 ? '' : 's'} & preview` : 'Apply & preview again'}
                  </button>
                </div>
              </div>
              );
            })()}

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Login</th>
                    <th className="px-3 py-2 font-semibold">Plan</th>
                    <th className="px-3 py-2 font-semibold">Expiry</th>
                    <th className="px-3 py-2 font-semibold">Status / issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(summary.rows || []).map((r) => (
                    <tr key={r.row} className={rowTone(r.status)}>
                      <td className="px-3 py-2 text-slate-400">{r.row}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.data?.name}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{r.data?.login}</td>
                      <td className="px-3 py-2 text-slate-700">{r.data?.plan}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {r.data?.subscription_end ? String(r.data.subscription_end).slice(0, 10) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'error' ? (
                          <span className="inline-flex items-start gap-1.5 text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{(r.messages || []).join('; ')}</span>
                          </span>
                        ) : r.status === 'created' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Created {r.data?.account_number ? `(${r.data.account_number})` : ''}
                            {r.data?.password_generated ? ' — new password' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Ready{r.data?.password_generated ? ' — password will be generated' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {result ? (
                <button
                  type="button"
                  onClick={() => navigate('/clients')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                >
                  <Users className="h-4 w-4" />
                  View clients
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runCommit}
                  disabled={busy || !summary.would_create}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                  title={!summary.would_create ? 'Fix the errors above first' : undefined}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Import {summary.would_create || 0} client{summary.would_create === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
