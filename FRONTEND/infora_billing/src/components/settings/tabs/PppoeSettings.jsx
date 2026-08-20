import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gauge, MessageSquare, Radio, Users } from 'lucide-react';
import ModulesSettings from './ModulesSettings';
import { Card } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > PPPoE.
 *
 * PPPoE has exactly one true setting — whether the module is on. Speed, FUP
 * and billing cycle are per-plan, and the reminders are per-message-template,
 * because that is where they are actually enforced. Rather than mirror those
 * into a second place that can drift, this panel owns the switch and points at
 * the page that owns each of the rest.
 * ---------------------------------------------------------------------- */

const ELSEWHERE = [
  {
    icon: Gauge,
    title: 'Speed limits & fair-use policy',
    detail:
      'Download/upload caps, the FUP threshold and what happens after it are set per package, so different tiers can throttle differently.',
    label: 'Open packages',
    to: '/plans',
  },
  {
    icon: MessageSquare,
    title: 'Expiry reminders & receipts',
    detail:
      'When a fixed-line subscriber is warned before expiry, and what the message says, is shared with every other channel.',
    label: 'Message templates',
    tab: 'templates',
  },
  {
    icon: Radio,
    title: 'Authentication',
    detail:
      'PPPoE sessions authenticate against RADIUS. NAS clients, accounting and CoA live on the RADIUS panel.',
    label: 'RADIUS server',
    tab: 'radius',
  },
  {
    icon: Users,
    title: 'The subscribers themselves',
    detail:
      'Creating a PPPoE account, resetting a password or moving someone between packages happens on the subscriber record.',
    label: 'Open subscribers',
    to: '/clients',
  },
];

export default function PppoeSettings({ isAdmin, onNavigate }) {
  return (
    <div className="space-y-6">
      <ModulesSettings
        isAdmin={isAdmin}
        only={['pppoe_enabled']}
        title="PPPoE"
        description="Username-and-password broadband for fixed-line subscribers"
      />

      <Card
        title="Configured elsewhere"
        description="These are PPPoE settings, but they belong to the record that enforces them"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {ELSEWHERE.map((item) => {
            const Icon = item.icon;
            const action = item.to ? (
              <Link
                to={item.to}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
              >
                {item.label}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.(item.tab)}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
              >
                {item.label}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            );
            return (
              <li key={item.title} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
                {action}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
