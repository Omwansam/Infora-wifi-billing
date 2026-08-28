import React from 'react';
import { motion } from 'framer-motion';

/* -------------------------------------------------------------------------
 * The furniture the subscriber detail page is built from.
 *
 * Console design language: slate neutrals, emerald as the accent, indigo/sky
 * for secondary tints, rounded-2xl panels with rounded-xl blocks inside them,
 * and explicit `dark:` on every colour utility — never relying on the blanket
 * remap in index.css.
 * ---------------------------------------------------------------------- */

export const PANEL =
  'rounded-2xl border border-slate-200 bg-white shadow-sm '
  + 'dark:border-slate-800 dark:bg-slate-900';

export const BLOCK =
  'rounded-xl border border-slate-100 bg-slate-50/70 '
  + 'dark:border-slate-800 dark:bg-slate-800/40';

export const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none '
  + 'transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 '
  + 'disabled:cursor-not-allowed disabled:opacity-60 '
  + 'dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';

/** A titled card. `action` sits opposite the title on the same line. */
export function Panel({ icon: Icon, title, subtitle, action, children, className = '', delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`${PANEL} ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              {Icon && <Icon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

/** Label/value line for the definition-list panels (network, reference). */
export function DataRow({ icon: Icon, label, value, mono, action, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0 dark:border-slate-800">
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${
            tone || 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {value ?? '—'}
        </span>
        {action}
      </span>
    </div>
  );
}

const TILE_TONES = {
  neutral: 'text-slate-900 dark:text-white',
  good: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
  muted: 'text-slate-400 dark:text-slate-500',
};

/**
 * A number that is the whole answer — no plot, so no tooltip.
 * `label` sentence case, `value` large, `sub` the one line of context.
 */
export function StatTile({ label, value, sub, tone = 'neutral' }) {
  return (
    <div className="min-w-0 flex-1 px-5 py-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tracking-tight ${TILE_TONES[tone]}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

const CHIP_TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30',
  accent: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30',
  critical: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30',
};

export function Chip({ icon: Icon, children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${CHIP_TONES[tone]} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

/** The state a panel shows when there is genuinely nothing to show. */
export function EmptyState({ icon: Icon, title, hint, action, compact }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-14'}`}>
      {Icon && <Icon className="h-6 w-6 text-slate-300 dark:text-slate-600" />}
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PanelSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

/** A row of copy-to-clipboard affordance shared by the login/IP/MAC values. */
export function CopyButton({ value, label = 'Value', onCopied }) {
  if (!value) return null;
  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value));
          onCopied?.(`${label} copied`);
        } catch {
          onCopied?.('Copy failed', true);
        }
      }}
      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

/** Table shell used by the list tabs, with the horizontal scroll they need. */
export function DataTable({ head, children, empty }) {
  if (empty) return empty;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {head.map((cell) => (
              <th
                key={cell.key ?? cell.label}
                className={`whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${cell.align === 'right' ? 'text-right' : ''}`}
              >
                {cell.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, align, mono, muted, className = '' }) {
  return (
    <td
      className={`whitespace-nowrap px-5 py-3 ${align === 'right' ? 'text-right' : ''} ${
        mono ? 'font-mono text-xs' : ''
      } ${muted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'} ${className}`}
    >
      {children}
    </td>
  );
}
