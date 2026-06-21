import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Shield, Database, Monitor, Lock, Key } from 'lucide-react';

const TABS = [
  { label: 'ISPs', path: '/network/isps', icon: Globe },
  { label: 'RADIUS', path: '/network/radius', icon: Shield },
  { label: 'LDAP', path: '/network/ldap', icon: Database },
  { label: 'SNMP', path: '/network/snmp', icon: Monitor },
  { label: 'VPN', path: '/network/vpn', icon: Lock },
  { label: 'EAP', path: '/network/eap', icon: Key },
];

export default function NetworkLayout({ title, subtitle, action, children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Network</p>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-1">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
              {subtitle && <p className="text-slate-600 mt-1">{subtitle}</p>}
            </div>
            {action}
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
