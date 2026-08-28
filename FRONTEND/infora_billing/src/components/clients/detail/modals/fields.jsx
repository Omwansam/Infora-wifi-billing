import React, { useState } from 'react';
import { Check, ChevronDown, Copy, Eye, EyeOff } from 'lucide-react';

/* -------------------------------------------------------------------------
 * The pieces every action dialog is built from.
 *
 * They exist so eight dialogs that all ask "what, for how long, and should we
 * tell them" ask it the same way — same label weight, same hint placement, same
 * switch. Console palette throughout: slate neutrals, emerald accent, explicit
 * dark: on every colour.
 * ---------------------------------------------------------------------- */

export function Field({ label, hint, required, htmlFor, children }) {
  return (
    <div>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
          {required && <span className="ml-0.5 text-emerald-600 dark:text-emerald-400">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

const CONTROL =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none '
  + 'transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 '
  + 'disabled:cursor-not-allowed disabled:opacity-60 '
  + 'dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export function Select({ id, value, onChange, options, disabled }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL} cursor-pointer appearance-none pr-10`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function TextInput({ id, type = 'text', value, onChange, placeholder, min, max, step, disabled }) {
  return (
    <input
      id={id} type={type} value={value} placeholder={placeholder}
      min={min} max={max} step={step} disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={CONTROL}
    />
  );
}

/** The switch from the action dialogs — a labelled row, not a bare checkbox. */
export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40 ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox" className="peer sr-only" checked={checked} disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="block h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/40 dark:bg-slate-600" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/**
 * The headline card: what is about to happen, in the largest type in the
 * dialog. It restates the operator's own inputs so the consequence is read
 * before the confirm button is pressed, not after.
 */
export function SummaryCard({ badge, value, caption, result, resultCaption, tone = 'accent' }) {
  const tones = {
    accent: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10',
    warning: 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10',
    critical: 'border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10',
  };
  const resultTones = {
    accent: 'text-emerald-700 dark:text-emerald-300',
    warning: 'text-amber-700 dark:text-amber-300',
    critical: 'text-rose-700 dark:text-rose-300',
  };
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${tones[tone]}`}>
      <div className="flex min-w-0 items-center gap-3">
        {badge && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
            {badge}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight text-slate-900 dark:text-white">{value}</p>
          {caption && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{caption}</p>}
        </div>
      </div>
      {result && (
        <div className="shrink-0 text-right">
          <p className={`text-lg font-semibold leading-tight ${resultTones[tone]}`}>{result}</p>
          {resultCaption && <p className="text-xs text-slate-500 dark:text-slate-400">{resultCaption}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * The exact SMS, editable.
 *
 * Shown because a canned message about someone's money or password should be
 * read before it is sent, and editable because the operator often knows
 * something the template does not. The segment count is here since each
 * segment is separately billed.
 */
export function MessagePreview({ value, onChange, loading, error, rows = 5 }) {
  const length = value?.length || 0;
  const segments = length === 0 ? 0 : length <= 160 ? 1 : Math.ceil(length / 153);

  if (loading) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
    );
  }
  if (error) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        {error}
      </p>
    );
  }
  return (
    <>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL} resize-y leading-relaxed`}
      />
      <p className="mt-1.5 flex justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>{length} characters</span>
        <span>{segments} SMS segment{segments === 1 ? '' : 's'}</span>
      </p>
    </>
  );
}

/** A credential the operator may need to read aloud — copyable, optionally masked. */
export function SecretRow({ icon: Icon, label, value, secret }) {
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked — the value is on screen either way */ }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800/40">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate font-mono text-sm font-medium text-slate-900 dark:text-white">
          {revealed ? value : '•'.repeat(Math.min(12, String(value || '').length))}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {secret && (
          <IconButton onClick={() => setRevealed((on) => !on)} title={revealed ? 'Hide' : 'Reveal'}>
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </IconButton>
        )}
        <IconButton onClick={copy} title={`Copy ${label.toLowerCase()}`}>
          {copied
            ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            : <Copy className="h-4 w-4" />}
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({ onClick, title, children }) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}

/** A short "here is what this will do" line under the controls. */
export function Consequence({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    critical: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  };
  return (
    <p className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${tones[tone]}`}>{children}</p>
  );
}
