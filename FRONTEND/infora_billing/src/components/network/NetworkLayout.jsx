import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Database, Lock, Key, Network } from 'lucide-react';
import PageShell from '../layout/PageShell';

// RADIUS moved to Security, SNMP moved to Monitoring (consolidated IA).
const TABS = [
  { label: 'ISPs', path: '/network/isps', icon: Globe },
  { label: 'LDAP', path: '/network/ldap', icon: Database },
  { label: 'VPN', path: '/network/vpn', icon: Lock },
  { label: 'WireGuard', path: '/network/wireguard', icon: Network },
  { label: 'EAP', path: '/network/eap', icon: Key },
];

export default function NetworkLayout({ title, subtitle, action, children }) {
  const location = useLocation();

  return (
    <PageShell spacing="space-y-0">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Network</p>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-slate-600 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      </motion.div>

      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none sm:mx-0 sm:flex-wrap">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`inline-flex shrink-0 items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </PageShell>
  );
}
