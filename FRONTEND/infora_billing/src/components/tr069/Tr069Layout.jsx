import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, Radio, ServerCog, ShieldAlert,
         ShieldCheck, ShieldQuestion } from 'lucide-react';
import PageShell from '../layout/PageShell';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard is blocked on insecure origins; the text is selectable anyway.
        }
      }}
      className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Whether CPE can actually reach the endpoint printed beside it.
 *
 * A configured ACS URL proves nothing — the path runs CPE -> MikroTik -> WireGuard
 * -> container DNAT -> Flask, and any hop can be down while the URL still looks
 * right. This turns that into one glance, and the deep probe into one click.
 */
function AcsHealth({ health }) {
  if (!health) return null;
  const { state, verdict, onCheck, checking } = health;
  const tone = {
    ok: { cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30', Icon: ShieldCheck },
    warn: { cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/30', Icon: ShieldAlert },
    fail: { cls: 'bg-rose-500/10 text-rose-300 ring-rose-500/30', Icon: ShieldAlert },
  }[state] || { cls: 'bg-white/5 text-slate-300 ring-white/10', Icon: ShieldQuestion };
  const Icon = checking ? Loader2 : tone.Icon;

  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={checking}
      title={verdict || 'Check whether routers can reach the ACS'}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
                  font-medium ring-1 ring-inset transition-opacity hover:opacity-80
                  disabled:cursor-wait ${tone.cls}`}
    >
      <Icon className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
      {checking ? 'Checking\u2026'
        : state === 'ok' ? 'Reachable'
        // 'warn' is a partial path — one router down out of several — not the same
        // as a broken ACS, and labelling both "Path problem" cried wolf.
        : state === 'warn' ? 'Degraded'
        : state === 'fail' ? 'Path problem'
        : 'Check path'}
    </button>
  );
}

/**
 * Console chrome for the ACS.
 *
 * Deliberately not the Devices header: TR-069 is a protocol surface where the
 * *server* is the thing you supervise, so the page opens on ACS state — the
 * endpoint CPE dial into and how much of the fleet is currently talking —
 * rather than on a tab bar.
 */
export default function Tr069Layout({
  title,
  subtitle,
  action,
  acsUrl,
  acsHealth,
  chips = [],
  backTo,
  backLabel,
  eyebrow = 'Auto Configuration Server',
  children,
}) {
  // `undefined` means the caller has nothing to say about the endpoint (or is
  // still loading); `null` means the server confirmed it is unset.
  const showEndpoint = acsUrl !== undefined;
  return (
    <PageShell spacing="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 shadow-lg ring-1 ring-slate-800"
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              {backTo ? (
                <Link to={backTo} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel || 'Back'}
                </Link>
              ) : (
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  <ServerCog className="h-3.5 w-3.5" />
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-2 truncate text-2xl font-bold text-white sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-300">{subtitle}</p>}
            </div>
            {action && <div className="flex flex-wrap gap-2">{action}</div>}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
            {showEndpoint ? (
              <div className="flex min-w-0 items-center gap-2">
                <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Endpoint
                </span>
                {acsUrl ? (
                  <>
                    <code className="truncate rounded bg-black/30 px-2 py-1 font-mono text-xs text-cyan-100">{acsUrl}</code>
                    <CopyButton value={acsUrl} />
                    <AcsHealth health={acsHealth} />
                  </>
                ) : (
                  <span className="text-xs text-amber-300">
                    Not configured — set <code className="font-mono">TR069_ACS_URL</code> so enrolled devices know where to call.
                  </span>
                )}
              </div>
            ) : (
              <span />
            )}

            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10"
                  >
                    {chip.icon && <chip.icon className={`h-3 w-3 ${chip.tone || 'text-slate-400'}`} />}
                    <span className="font-semibold tabular-nums text-white">{chip.value}</span>
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {children}
    </PageShell>
  );
}
