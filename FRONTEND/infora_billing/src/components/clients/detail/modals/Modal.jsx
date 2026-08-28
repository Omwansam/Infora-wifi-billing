import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/* Shared dialog shell: backdrop, escape-to-close, focus trap by autofocus, and
   the icon/title/body/footer arrangement every dialog on this page uses. */

const ICON_TONES = {
  accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  critical: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
};

export default function Modal({
  open, onClose, icon: Icon, tone = 'accent', title, description, children, footer,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="relative px-6 pt-6 text-center">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
              {Icon && (
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ICON_TONES[tone]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              )}
              <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              )}
            </div>

            <div className="px-6 py-5">{children}</div>

            {footer && (
              <div className="flex gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CancelButton({ onClick, disabled, children = 'Cancel' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

const CONFIRM_TONES = {
  accent: 'bg-emerald-600 hover:bg-emerald-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  critical: 'bg-rose-600 hover:bg-rose-700',
};

export function ConfirmButton({ onClick, disabled, busy, tone = 'accent', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${CONFIRM_TONES[tone]}`}
    >
      {busy && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
