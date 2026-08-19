import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cable, Map as MapIcon, Network, Share2 } from 'lucide-react';
import PageShell from '../layout/PageShell';

const TABS = [
  { label: 'Map', path: '/fiber/map', icon: MapIcon },
  { label: 'Nodes', path: '/fiber/nodes', icon: Network },
  { label: 'Cables', path: '/fiber/cables', icon: Cable },
  { label: 'Splice plan', path: '/fiber/splices', icon: Share2 },
];

/**
 * Chrome for the fiber section.
 *
 * `bleed` drops the page padding and max-width so the map can use the whole
 * viewport — a plant map is one of the few screens where more pixels is
 * straightforwardly more useful.
 */
export default function FiberLayout({ title, subtitle, action, bleed = false, children }) {
  const location = useLocation();

  return (
    <PageShell
      spacing="space-y-0"
      maxWidth={bleed ? 'max-w-none' : 'max-w-7xl'}
      className={bleed ? 'p-0 sm:p-0' : undefined}
    >
      <div className={bleed ? 'px-4 pt-4 sm:px-6 sm:pt-6' : ''}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">
            Fiber plant
          </p>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
            </div>
            {action}
          </div>
        </motion.div>

        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none sm:mx-0 sm:flex-wrap">
          {TABS.map((tab) => {
            const active = location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`inline-flex shrink-0 items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </PageShell>
  );
}
