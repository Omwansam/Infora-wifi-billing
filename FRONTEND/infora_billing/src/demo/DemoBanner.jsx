import { useState } from 'react';
import { MARKETING_URL } from './config';

/**
 * Persistent ribbon shown on the public demo so visitors always know they
 * are in a sandbox. Data is sample data and resets on every reload.
 */
export default function DemoBanner() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-[9999] rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-700"
      >
        Demo
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-violet-500/30 bg-slate-900/95 px-4 py-2 text-center text-xs text-slate-200 backdrop-blur">
      <span>
        <span className="font-semibold text-violet-300">Lumen demo</span>
        {' '}— sample data only. Feel free to click anything; changes reset on reload.
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border border-slate-600 px-3 py-0.5 font-medium text-slate-200 transition hover:border-violet-400 hover:text-violet-300"
        >
          Reset data
        </button>
        <a
          href={`${MARKETING_URL}/signup`}
          className="rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-3 py-0.5 font-semibold text-white transition hover:opacity-90"
        >
          Get Lumen free →
        </a>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Hide demo banner"
          className="text-slate-400 transition hover:text-white"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
