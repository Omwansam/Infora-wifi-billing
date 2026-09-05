import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Info, Loader2, Power,
  RefreshCw, Sparkles, Users, X, Zap,
} from 'lucide-react';
import deviceService from '../../services/deviceService';
import { getAccessToken } from '../../utils/authToken';
import { formatDuration } from '../../lib/networkUtils';

/* -------------------------------------------------------------------------
 * One outage, diagnosed.
 *
 * The deterministic findings load immediately and cost nothing. The AI
 * narrative is a button, never automatic: an operator opening six rows to scan
 * them should not spend six model calls, and the evidence has to be readable
 * and trustworthy on its own before anything writes prose over it.
 * ---------------------------------------------------------------------- */

const TONES = {
  critical: { icon: AlertTriangle, cls: 'text-rose-600 dark:text-rose-400', label: 'Critical' },
  serious: { icon: AlertTriangle, cls: 'text-orange-600 dark:text-orange-400', label: 'Needs attention' },
  warning: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400', label: 'Worth knowing' },
  good: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Healthy' },
  note: { icon: Info, cls: 'text-slate-400 dark:text-slate-500', label: 'Note' },
};

function Fact({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export default function OutageAnalysisDrawer({ deviceId, outageId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    deviceService.getOutageAnalysis(getAccessToken(), deviceId, outageId)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Could not analyse this outage'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, outageId]);

  // Escape closes, like every other drawer in the console.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const explain = async () => {
    setAiLoading(true); setAiError(null);
    try {
      const result = await deviceService.explainOutage(getAccessToken(), deviceId, outageId);
      setAi(result);
    } catch (e) {
      setAiError(e.configured === false
        ? `${e.message} You can turn the assistant on under Settings → AI Assistant.`
        : (e.message || 'The assistant could not answer'));
    } finally { setAiLoading(false); }
  };

  const outage = data?.outage;
  const restart = data?.restart;
  const impact = data?.impact;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <AnimatePresence>
        <motion.aside
          initial={{ x: 560 }} animate={{ x: 0 }} exit={{ x: 560 }}
          transition={{ type: 'tween', duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-label="Outage analysis"
          className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl dark:bg-slate-950"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Outage analysis
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                {outage ? new Date(outage.started_at).toLocaleString() : 'Loading…'}
              </h2>
              {outage && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {outage.device_name} · {outage.open ? 'still open' : `${formatDuration(outage.minutes * 60)} of downtime`}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />Analysing…
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            {data && !loading && (
              <>
                {/* The evidence, before any interpretation of it. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact
                    icon={Clock} label="Duration"
                    value={outage.open ? 'Open' : formatDuration(outage.minutes * 60)}
                  />
                  <Fact
                    icon={Power} label="Restarted"
                    value={restart.known ? (restart.rebooted ? 'Yes' : 'No') : 'Unknown'}
                    sub={restart.known
                      ? `uptime after: ${formatDuration(restart.uptime_after)}`
                      : 'no samples either side'}
                  />
                  <Fact
                    icon={Users} label="Clients cut off"
                    value={impact.clients_known ? impact.clients_at_drop : '—'}
                    sub={impact.clients_known ? 'as last reported' : 'not sampled'}
                  />
                  <Fact
                    icon={Activity} label="Others down"
                    value={`${data.scope.concurrent.length}/${Math.max(0, data.scope.fleet_total - 1)}`}
                    sub="failed at the same time"
                  />
                </div>

                <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  What the evidence says
                </h3>
                <ul className="mt-3 space-y-3">
                  {data.findings.map((f) => {
                    const tone = TONES[f.tone] || TONES.note;
                    const Icon = tone.icon;
                    return (
                      <li key={f.title} className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.cls}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            <span className="sr-only">{tone.label}: </span>{f.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{f.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {data.scope.concurrent.length > 0 && (
                  <>
                    <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Failed alongside this one
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {data.scope.concurrent.map((c) => (
                        <li key={`${c.device_id}-${c.started_at}`}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{c.device_name}</span>
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">
                            {new Date(c.started_at).toLocaleTimeString()} · {formatDuration(c.minutes * 60)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Opt-in, and said so plainly. */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                        <Sparkles className="h-4 w-4 text-violet-500" />Ask the assistant
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Sends the evidence above to your configured model for a written diagnosis.
                        Nothing is sent until you press it.
                      </p>
                    </div>
                    <button
                      type="button" onClick={explain} disabled={aiLoading}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      {ai ? 'Ask again' : 'Diagnose'}
                    </button>
                  </div>

                  {aiError && (
                    <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      {aiError}
                    </p>
                  )}
                  {ai && (
                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {ai.answer}
                      </p>
                      <p className="mt-2 text-[10px] text-slate-400">
                        {ai.model}{ai.source ? ` · ${ai.source} key` : ''} — a hypothesis from the evidence
                        above, not a measurement. Verify before dispatching.
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <RefreshCw className="h-3 w-3" />
                  Findings are recomputed from stored samples each time this opens.
                </p>
              </>
            )}
          </div>
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}
