import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CreditCard,
  MessageSquare,
  Package,
  Palette,
  PartyPopper,
  Router,
  UserPlus,
} from 'lucide-react';

/* -------------------------------------------------------------------------
 * "Set up your account" — the second block on Overview, and the only one that
 * is temporary. Every step is derived server-side from real account state, so
 * the card cannot be gamed and cannot go stale; once the sixth box ticks it
 * shows a single closing note and then never renders again.
 * ---------------------------------------------------------------------- */

const ACK_KEY = 'lumen-setup-acknowledged';

const STEP_ICONS = {
  branding: Palette,
  payments: CreditCard,
  sms: MessageSquare,
  plan: Package,
  subscriber: UserPlus,
  router: Router,
};

function readAck() {
  try {
    return window.localStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAck() {
  try {
    window.localStorage.setItem(ACK_KEY, '1');
  } catch {
    /* private mode — the card simply reappears next session */
  }
}

function ProgressBar({ percent }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'linear-gradient(to right, hsl(var(--brand)), hsl(var(--brand-soft)))' }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

function StepChip({ step, onNavigate }) {
  const Icon = STEP_ICONS[step.key] || Package;
  if (step.done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" />
        {step.title}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(step.path)}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-[hsl(var(--brand))] hover:text-[hsl(var(--brand))] dark:border-slate-700 dark:text-slate-300 dark:hover:border-[hsl(var(--brand-soft))] dark:hover:text-[hsl(var(--brand-soft))]"
    >
      <Icon className="h-3.5 w-3.5" />
      {step.title}
    </button>
  );
}

function CompletionCard({ total, onDismiss }) {
  return (
    <motion.div
      key="setup-complete"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.3 } }}
      className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
          <PartyPopper className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Your account is set up</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            All {total} steps are done — this card won&rsquo;t come back.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 self-start rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:self-auto"
      >
        Got it
      </button>
    </motion.div>
  );
}

export default function SetupChecklist({ setup, onNavigate }) {
  const [acknowledged, setAcknowledged] = useState(readAck);

  const dismiss = useCallback(() => {
    writeAck();
    setAcknowledged(true);
  }, []);

  // No payload (older backend, or the lookup failed) — say nothing rather than
  // showing a checklist we cannot stand behind.
  if (!setup || !Array.isArray(setup.steps) || !setup.steps.length) return null;

  const { steps, done, total, percent, complete } = setup;

  if (complete) {
    return (
      <AnimatePresence>
        {!acknowledged && <CompletionCard total={total} onDismiss={dismiss} />}
      </AnimatePresence>
    );
  }

  const next = setup.next || steps.find((step) => !step.done);
  const remaining = steps.filter((step) => !step.done && step.key !== next?.key);
  const finished = steps.filter((step) => step.done);
  const left = total - done;
  const NextIcon = STEP_ICONS[next?.key] || Package;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Set up your account
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {done} of {total} done · {left} step{left === 1 ? '' : 's'} left
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <ProgressBar percent={percent} />
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
            {percent}%
          </span>
        </div>
      </div>

      {next && (
        <button
          type="button"
          onClick={() => onNavigate?.(next.path)}
          className="group mt-3.5 flex w-full items-center gap-3 rounded-2xl p-3 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand))] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 sm:p-3.5"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--brand-strong)), hsl(var(--brand-soft)))',
            color: 'hsl(var(--brand-contrast))',
          }}
        >
          <span
            className="hidden shrink-0 rounded-lg p-2 ring-1 ring-inset sm:block"
            style={{
              backgroundColor: 'hsl(var(--brand-contrast) / 0.15)',
              '--tw-ring-color': 'hsl(var(--brand-contrast) / 0.2)',
            }}
          >
            <NextIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
                Next
              </span>
              <span className="truncate text-sm font-semibold sm:text-base">{next.title}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs opacity-75">{next.description}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:translate-x-1" />
        </button>
      )}

      {(remaining.length > 0 || finished.length > 0) && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {remaining.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Still to do
              </span>
              {remaining.map((step) => (
                <StepChip key={step.key} step={step} onNavigate={onNavigate} />
              ))}
            </div>
          )}
          {finished.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Already done
              </span>
              {finished.map((step) => (
                <StepChip key={step.key} step={step} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
