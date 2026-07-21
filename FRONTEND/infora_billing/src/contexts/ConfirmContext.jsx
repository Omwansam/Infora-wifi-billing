import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * App-wide confirmation dialog. Replaces window.confirm() with a styled,
 * theme-aware modal. Usage:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, message, tone: 'danger' }))) return;
 *
 * Returns a Promise<boolean> — true when the user confirms.
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialog({
        title: options.title || 'Are you sure?',
        message: options.message || '',
        confirmLabel: options.confirmLabel || (options.tone === 'danger' ? 'Delete' : 'Confirm'),
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'default',
      });
    });
  }, []);

  const settle = useCallback((result) => {
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
    setDialog(null);
  }, []);

  const danger = dialog?.tone === 'danger';
  const Icon = danger ? Trash2 : AlertTriangle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => settle(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      danger
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{dialog.title}</h3>
                    {dialog.message && (
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {dialog.message}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => settle(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    onClick={() => settle(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {dialog.cancelLabel}
                  </button>
                  <button
                    onClick={() => settle(true)}
                    autoFocus
                    className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${
                      danger
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                  >
                    {dialog.confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
