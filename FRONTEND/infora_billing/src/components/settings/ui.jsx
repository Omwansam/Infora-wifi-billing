import React from 'react';
import { AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';

/* -------------------------------------------------------------------------
 * Settings primitives.
 *
 * These carry the whole Settings surface, so they are written in the console's
 * current language rather than the light-only gray one they started in: slate
 * neutrals, rounded-2xl panels, and explicit `dark:` variants.
 *
 * The explicit variants matter. index.css remaps light utilities to dark
 * surfaces for the console at large, but that remap is a blanket default —
 * anything stating its own dark intent (specificity 0,2,0, emitted after the
 * remap block) wins. Settings states its own, so the panels here are designed
 * in both themes rather than inheriting an approximation of one.
 * ---------------------------------------------------------------------- */

export function Card({ title, description, children, action, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 pb-4 pt-5 dark:border-slate-800">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

/** A titled block *inside* a Card — the mock's "Active domain" / "Change domain". */
export function Section({ title, description, children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40 ${className}`}
    >
      {title && (
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      )}
      {description && (
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      )}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}

const CONTROL =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500';

/* Refs are forwarded so callers can insert a variable at the cursor rather
   than only appending to the end of the field. */
export const TextInput = React.forwardRef(function TextInput({ className = '', ...props }, ref) {
  return <input ref={ref} {...props} className={`${CONTROL} ${className}`} />;
});

export const Textarea = React.forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} {...props} className={`${CONTROL} ${className}`} />;
});

export function Select({ className = '', children, ...props }) {
  return (
    <select {...props} className={`${CONTROL} ${className}`}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function PrimaryButton({ children, loading, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, loading, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Two-or-more mutually exclusive choices, as in the mock's subdomain switch. */
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div
      className={`inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={on}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              on
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SaveBar({ onSave, saving, disabled, label = 'Save changes', children }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {children}
      <PrimaryButton onClick={onSave} loading={saving} disabled={disabled}>
        {label}
      </PrimaryButton>
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

const NOTE_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100',
  warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
};

export function Note({ icon: Icon, title, tone = 'info', children }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${NOTE_TONES[tone] || NOTE_TONES.info}`}>
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />}
      <div className="min-w-0">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className="text-sm leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Panels whose UI is designed but whose backend does not exist yet.
 *
 * Deliberately loud, and deliberately paired with inert controls rather than
 * hidden ones: an operator should be able to see what the feature will ask for
 * without a save button that quietly does nothing.
 */
export function NotWired({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <span className="mt-0.5 flex h-5 shrink-0 items-center rounded-full bg-amber-500/15 px-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Preview
      </span>
      <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{children}</p>
    </div>
  );
}

/**
 * Stands in for the save button on a preview panel.
 *
 * The controls themselves stay live — being able to click through a form is
 * most of what makes it reviewable — so the honesty has to live on the one
 * button that would otherwise imply persistence.
 */
export function UnavailableSave({ children = 'Nothing here saves yet.' }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
      <p className="text-xs text-slate-400 dark:text-slate-500">{children}</p>
      <button
        type="button"
        disabled
        title="Not available yet"
        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
      >
        Save changes
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Row-level controls.
 * ---------------------------------------------------------------------- */

/**
 * A switch in its own inset well, with the state spelled out beside it.
 *
 * The word matters: a lone toggle makes a reader work out which end is on from
 * its colour, and half of these settings are ones you check rather than change.
 */
export function ToggleRow({
  label, description, checked, onChange, disabled,
  onLabel = 'On', offLabel = 'Off', children,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      {description && (
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
        <span
          className={`text-sm font-medium ${
            checked
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {checked ? onLabel : offLabel}
        </span>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Clickable tokens that append into the field above them. */
export function VariableChips({ variables, onInsert }) {
  if (!variables?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          title={`Insert ${v}`}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * Save affordance that only appears once something is actually different.
 *
 * It sticks to the bottom of the scrolling panel rather than sitting at the end
 * of the form, because these panels are long enough that a save button below
 * the fold reads as "there is nothing to save".
 */
export function StickySaveBar({ dirty, saving, onSave, onReset, label = 'Save' }) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Unsaved changes
        </p>
        <div className="flex items-center gap-2">
          <GhostButton onClick={onReset} disabled={saving} className="px-3.5 py-2">
            Reset
          </GhostButton>
          <PrimaryButton onClick={onSave} loading={saving} className="px-5 py-2">
            {label}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}


/**
 * Splice a token into a field at the caret rather than appending to the end.
 *
 * Appending is wrong often enough to matter: these templates put the variable
 * mid-sentence ("Hi {first_name}, your…"), so a chip that always lands at the
 * end means retyping the tail every time.
 */
export function insertAtCursor(el, current, token) {
  const value = current || '';
  if (!el) return { next: value + token, caret: (value + token).length };
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  return { next: value.slice(0, start) + token + value.slice(end), caret: start + token.length };
}

/* -------------------------------------------------------------------------
 * Connection chrome — headers for panels that represent a live integration.
 * ---------------------------------------------------------------------- */

const PILL_TONES = {
  connected:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  idle: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/40',
  warn: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
};

export function StatusPill({ tone = 'idle', children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        PILL_TONES[tone] || PILL_TONES.idle
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Compact header for a panel whose headline is a connection rather than a
 * topic: a gateway, or one provider inside a gateway. Replaces the display
 * heading, because "Not connected" is the first thing worth knowing and a
 * 36px title pushes it below the fold.
 */
export function DetailHeader({
  icon: Icon, iconClass, eyebrow, title, subtitle, status, action, onBack, backLabel = 'Back',
}) {
  return (
    <header className="mb-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
      )}
      <div className="flex flex-wrap items-start gap-4">
        {Icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              iconClass || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {typeof Icon === 'string' ? (
              <span className="text-sm font-bold">{Icon}</span>
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {status}
          {action}
        </div>
      </div>
      <div className="mt-6 border-t border-slate-200 dark:border-slate-800" />
    </header>
  );
}

/** One selectable service in a provider grid. */
export function ProviderTile({ mark, markClass, name, category, onSelect, active, actionLabel = 'Configure' }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col rounded-2xl border p-5 text-left transition ${
        active
          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30 dark:border-emerald-500/60 dark:bg-emerald-950/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${markClass}`}
        >
          {mark}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </span>
          <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{category}</span>
        </span>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        {actionLabel}
        <span aria-hidden="true">›</span>
      </span>
    </button>
  );
}
