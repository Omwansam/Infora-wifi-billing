import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Calendar, CalendarDays, CheckCircle2, CreditCard, Eye, EyeOff, Gauge,
  Hash, History, KeyRound, Loader2, MailOpen, MapPin, MessageSquare, Phone, Router,
  ShieldCheck, Smartphone, User, Wifi, Zap,
} from 'lucide-react';
import { Panel, DataRow, Chip, EmptyState, CopyButton, BLOCK } from '../parts';
import ActivityHeatmap from '../charts/ActivityHeatmap';
import { formatBytes } from '../../../../lib/networkUtils';
import { formatCurrency } from '../../../../lib/utils';

/* Timeline dot colour per event tone. The server sends the tone so a new event
   type is painted correctly without waiting on a frontend release. */
const TONE_DOT = {
  neutral: 'bg-slate-300 dark:bg-slate-600',
  good: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

/* PPPoE and WireGuard are spelled, not shouted — toUpperCase() turns them into
   PPPOE and WIREGUARD, which is not how either product is written. */
const CONNECTION_LABEL = { pppoe: 'PPPoE', hotspot: 'Hotspot', wireguard: 'WireGuard' };

export function connectionLabel(value) {
  return CONNECTION_LABEL[value] || 'PPPoE';
}

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function OverviewTab({
  overview, client, onSendSms, onRevealPassword, password, revealing, onCopy,
}) {
  const timeline = overview?.timeline || [];
  const network = overview?.network || {};
  const reference = overview?.reference || {};
  const fup = overview?.fup || {};

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Panel
          icon={History}
          title="Subscription lifecycle"
          subtitle="Account events from signup to now"
        >
          {timeline.length ? (
            <ol className="relative px-5 py-4">
              {timeline.map((event, index) => (
                <li key={event.id ?? `synthetic-${index}`} className="relative flex gap-4 pb-5 last:pb-0">
                  {index < timeline.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-4 h-full w-px bg-slate-200 dark:bg-slate-700"
                    />
                  )}
                  <span
                    className={`relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                      TONE_DOT[event.tone] || TONE_DOT.neutral
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {event.title}
                      </p>
                      <time className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {formatWhen(event.created_at)}
                      </time>
                    </div>
                    {event.detail && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {event.detail}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {event.amount != null && (
                        <Chip tone="good">{formatCurrency(event.amount)}</Chip>
                      )}
                      {event.actor && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          by {event.actor}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={History} title="No account events yet" compact />
          )}
        </Panel>

        <Panel icon={CalendarDays} title="Activity" subtitle="Connection history · last 365 days">
          <ActivityHeatmap
            days={overview?.activity?.days || []}
            activeDays={overview?.activity?.active_days || 0}
          />
        </Panel>

        <FupPanel fup={fup} plan={overview?.plan} />
      </div>

      <div className="space-y-5">
        <Panel icon={Wifi} title="Device & network">
          <DataRow
            icon={Router}
            label="Router"
            value={network.router
              ? (network.router.id
                  ? <Link to={`/devices/${network.router.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{network.router.name}</Link>
                  : network.router.name)
              : '—'}
          />
          <DataRow icon={Smartphone} label="Type" value={connectionLabel(network.connection_type)} />
          <DataRow
            icon={User}
            label="Username"
            value={network.username}
            mono
            action={<CopyButton value={network.username} label="Username" onCopied={onCopy} />}
          />
          {(network.connection_type === 'pppoe' || network.connection_type === 'hotspot') && (
            <DataRow
              icon={KeyRound}
              label="Password"
              value={password ?? '•••••••'}
              mono
              action={
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={onRevealPassword}
                    disabled={revealing}
                    title={password ? 'Hide password' : 'Reveal password'}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    {revealing
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  {password && <CopyButton value={password} label="Password" onCopied={onCopy} />}
                </span>
              }
            />
          )}
          {network.ip_address && (
            <DataRow
              icon={Zap}
              label="IP address"
              value={network.ip_address}
              mono
              action={<CopyButton value={network.ip_address} label="IP address" onCopied={onCopy} />}
            />
          )}
          {network.mac_address && (
            <DataRow icon={Hash} label="MAC" value={network.mac_address} mono />
          )}
        </Panel>

        <Panel
          icon={MessageSquare}
          title="Communications"
          action={
            <button
              type="button"
              onClick={onSendSms}
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Send SMS
            </button>
          }
        >
          {overview?.messages?.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.messages.map((message) => (
                <li key={message.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {message.title}
                    </p>
                    <time className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                      {formatWhen(message.created_at)}
                    </time>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {message.message}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={MailOpen}
              title="Nothing sent to this subscriber yet"
              compact
              action={
                <button
                  type="button"
                  onClick={onSendSms}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Send SMS
                </button>
              }
            />
          )}
        </Panel>

        <Panel icon={Hash} title="Reference">
          <DataRow icon={Hash} label="Account ID" value={`#${reference.account_id ?? client?.id}`} mono />
          {reference.account_number && (
            <DataRow
              icon={CreditCard}
              label="Account number"
              value={reference.account_number}
              mono
              action={<CopyButton value={reference.account_number} label="Account number" onCopied={onCopy} />}
            />
          )}
          <DataRow
            icon={Phone}
            label="Phone"
            value={reference.phone}
            mono
            action={<CopyButton value={reference.phone} label="Phone" onCopied={onCopy} />}
          />
          {reference.address && <DataRow icon={MapPin} label="Address" value={reference.address} />}
          <DataRow icon={ShieldCheck} label="KYC" value={
            <Chip tone={reference.kyc_status === 'verified' ? 'good' : reference.kyc_status === 'rejected' ? 'critical' : 'warning'}>
              {(reference.kyc_status || 'pending').replace('_', ' ')}
            </Chip>
          } />
          <DataRow icon={Calendar} label="Acquired via" value={reference.acquired_via} />
        </Panel>
      </div>
    </div>
  );
}

/**
 * Fair use. Three genuinely different states, painted differently:
 * no policy on the plan, within the allowance, over it (or throttled).
 */
function FupPanel({ fup, plan }) {
  if (!fup?.monitored) {
    return (
      <Panel icon={Gauge} title="Fair use policy">
        <div className="px-5 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No data cap on{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {plan?.name || 'this package'}
            </span>
            {' — '}usage is unlimited.
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Set a quota on the package to surface a fair-use meter here. Used so far this
            period: {formatBytes(fup?.used_bytes || 0)}.
          </p>
        </div>
      </Panel>
    );
  }

  const percent = Math.min(100, fup.percent || 0);
  const over = fup.state === 'throttled' || fup.state === 'exceeded';
  const warning = fup.state === 'warning';
  const barTone = over ? 'bg-rose-500' : warning ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <Panel
      icon={Gauge}
      title="Fair use policy"
      subtitle={`Resets ${fup.reset_cycle} · allowance ${fup.cap_display}`}
      action={
        /* The chip and the bar must never disagree: an amber bar beside a green
           "Within allowance" chip is the panel contradicting itself. */
        fup.throttled
          ? <Chip icon={AlertTriangle} tone="critical">Throttled to {fup.throttled_speed}</Chip>
          : over
            ? <Chip icon={AlertTriangle} tone="critical">Over allowance</Chip>
            : warning
              ? <Chip icon={AlertTriangle} tone="warning">Approaching limit</Chip>
              : <Chip icon={CheckCircle2} tone="good">Within allowance</Chip>
      }
    >
      <div className="px-5 py-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              {formatBytes(fup.used_bytes)}
            </span>{' '}
            of {formatBytes(fup.threshold_bytes)}
          </p>
          <p className={`text-sm font-semibold ${over ? 'text-rose-600 dark:text-rose-400' : warning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {fup.percent}%
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${barTone}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className={`mt-4 flex flex-wrap gap-4 ${BLOCK} px-4 py-3`}>
          <Split label="Download" value={formatBytes(fup.down_bytes)} />
          <Split label="Upload" value={formatBytes(fup.up_bytes)} />
          <Split
            label="Period started"
            value={new Date(fup.period_start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          />
        </div>
      </div>
    </Panel>
  );
}

function Split({ label, value }) {
  return (
    <div className="min-w-[92px]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
