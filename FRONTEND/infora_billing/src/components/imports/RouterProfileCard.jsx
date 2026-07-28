import React from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Info, ShieldAlert } from 'lucide-react';

const AUTH_LABELS = {
  local: 'Local subscriber database',
  delegated: 'External RADIUS billing',
  hybrid: 'Mixed — local + external RADIUS',
  'queue-billed': 'Static / queue-billed network',
  unknown: 'Nothing recognisable found',
};

const PASSWORD_TONES = {
  readable: { icon: CheckCircle2, tone: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  partial: { icon: AlertTriangle, tone: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  hidden: { icon: ShieldAlert, tone: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  'no-roster': { icon: Info, tone: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
};

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

/**
 * The Router profile card — the first thing shown after a scan.
 *
 * It exists to answer "what am I looking at, and what can I actually get from
 * it" before the operator invests any effort. The password state is the most
 * important line on the page: an unreadable roster has to stop the import, not
 * decorate it.
 */
export default function RouterProfileCard({ fingerprint }) {
  if (!fingerprint || !fingerprint.counts) return null;

  const { device = {}, counts = {}, passwords = {}, findings = [] } = fingerprint;
  const passwordTone = PASSWORD_TONES[passwords.state] || PASSWORD_TONES['no-roster'];
  const PasswordIcon = passwordTone.icon;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Router profile
          </h2>
          <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            {AUTH_LABELS[fingerprint.auth_mode] || fingerprint.auth_mode}
          </p>
          {fingerprint.vendor && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Looks like <span className="font-semibold">{fingerprint.vendor}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <Cpu className="h-4 w-4 text-slate-400" />
          <span>
            {device.model || 'Unknown board'}
            {device.version ? ` · RouterOS ${device.version}` : ''}
          </span>
        </div>
      </div>

      <div className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 ${passwordTone.bg}`}>
        <PasswordIcon className={`mt-0.5 h-5 w-5 shrink-0 ${passwordTone.tone}`} />
        <p className="text-sm text-slate-800">{passwords.detail}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="PPPoE secrets" value={counts.ppp_secrets ?? 0} />
        <Stat label="Online now" value={counts.ppp_active ?? 0} />
        <Stat label="Hotspot users" value={counts.hotspot_users ?? 0} />
        <Stat label="Profiles" value={counts.ppp_profiles ?? 0} />
        <Stat label="Queues" value={counts.queues ?? 0} />
        <Stat label="Pools" value={counts.pools ?? 0} />
      </div>

      {findings.length > 0 && (
        <ul className="mt-5 space-y-2">
          {findings.map((finding, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              {finding}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
