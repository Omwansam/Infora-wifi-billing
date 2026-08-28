import React from 'react';

/* The tab bar doubles as a map of the account: each count says how much is
   behind that tab before the operator spends a click finding out. A count of
   zero is shown, not hidden — "no payments" is itself the answer. */

export default function DetailTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 overflow-x-auto">
      <div
        role="tablist"
        aria-label="Subscriber detail sections"
        className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    selected
                      ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
