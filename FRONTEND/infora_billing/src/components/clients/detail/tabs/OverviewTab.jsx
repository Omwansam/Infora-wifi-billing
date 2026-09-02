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

/**
 * Who owns the problem. Kept separate from the FUP/status tones so a line fault
 * never reads as a billing decision, and vice versa.
 */
const BLAME_TONE = {
  line: 'critical',
  network: 'warning',
  policy: 'info',
  subscriber: 'neutral',
  none: 'good',
  unknown: 'neutral',
};

const BLAME_LABEL = {
  line: 'Physical line',
  network: 'Our network',
  policy: 'Billing policy',
  subscriber: 'Subscriber side',
  none: 'Connected',
  unknown: 'Unclassified',
};

/**
 * The answer to the question the agent is being asked on the phone.
 *
 * Everything here was already computed somewhere — the subscription state, the
 * FUP snapshot, the account status, the last disconnect reason — but the page
 * only ever showed a bare "Offline" chip, so the agent had to guess which of the
 * five possible causes it was. This states one, and says what to do about it.
 */
function DiagnosisPanel({ diagnosis }) {
  if (!diagnosis?.reason) return null;
  const { online, reason, stability, last_seen: lastSeen } = diagnosis;
  const tone = BLAME_TONE[reason.blame] || 'neutral';

  return (
    <Panel
      icon={online ? CheckCircle2 : AlertTriangle}
      title={online ? 'Connection' : 'Why this subscriber is offline'}
      subtitle={online ? 'Live session on the router' : `Last seen ${formatWhen(lastSeen)}`}
    >
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {reason.headline}
          </p>
          <Chip tone={tone}>{BLAME_LABEL[reason.blame] || reason.blame}</Chip>
          {stability?.flapping && <Chip tone="critical" icon={Zap}>Unstable line</Chip>}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">{reason.detail}</p>

        {reason.fix && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            <span className="font-semibold">Next: </span>{reason.fix}
          </p>
        )}

        {stability?.sessions > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stability.summary}
            {stability.dominant_cause && (
              <> · mostly <span className="font-medium">{stability.dominant_cause.label}</span></>
            )}
          </p>
        )}
      </div>
    </Panel>
  );
}

const RISK_TONE = { high: 'critical', medium: 'warning', low: 'info', none: 'good' };
const RISK_LABEL = {
  high: 'High risk of leaving',
  medium: 'Worth a call',
  low: 'Minor concerns',
  none: 'Nothing of concern',
};

/**
 * Why this subscriber might not renew.
 *
 * Every signal here was already stored and none were read together, so a
 * subscriber who stopped using the line, missed a payment and opened a ticket
 * showed up as three unrelated rows on three different tabs. Retaining someone
 * costs one SMS; replacing them costs an acquisition.
 *
 * The reasons carry the weight, not the number — "score 62" is not actionable,
 * "never paid, and their line keeps dropping" is. The score is shown small for
 * sorting and comparison, and the reasons are shown large.
 */
function RiskPanel({ risk }) {
  if (!risk || risk.band === 'none') return null;

  return (
    <Panel
      icon={AlertTriangle}
      title="Retention risk"
      subtitle="Signals that this subscriber may not renew"
      action={<Chip tone={RISK_TONE[risk.band]}>{RISK_LABEL[risk.band]}</Chip>}
    >
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {risk.reasons.map((reason) => (
          <li key={reason.key} className="flex items-center gap-3 px-5 py-2.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                reason.weight >= 25 ? 'bg-rose-500'
                  : reason.weight >= 15 ? 'bg-amber-500' : 'bg-slate-400'
              }`}
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">{reason.label}</span>
          </li>
        ))}
      </ul>
      {/* Said out loud because the weights are a starting position, not a fitted
          model — there is no churn history in this system to fit against yet. */}
      <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Weighted from signals already on this page. The reasons matter more than the
        score, which is there for comparison between subscribers.
      </p>
    </Panel>
  );
}

/**
 * Which automated messages are actually switched on.
 *
 * An empty message log reads as "nothing has happened yet", but most catalogue
 * events ship disabled, so the usual reason nothing was sent is that nothing was
 * ever armed. Saying so is the difference between an operator who knows their
 * welcome SMS is off and one who finds out from a subscriber.
 */
function LifecycleMessages({ events }) {
  if (!events?.length) return null;
  const armed = events.filter((e) => e.enabled);
  const off = events.filter((e) => !e.enabled);

  return (
    <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Automatic messages
        </p>
        <Link
          to="/settings/notifications"
          className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Configure
        </Link>
      </div>

      {armed.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {armed.map((e) => (
            <Chip key={`${e.key}-${e.channel}`} tone="good">{e.label}</Chip>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          No automatic messages are switched on — this subscriber will never be
          messaged unless someone does it by hand.
        </p>
      )}

      {off.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {off.length} more {off.length === 1 ? 'is' : 'are'} switched off, including{' '}
          <span className="font-medium">{off.slice(0, 2).map((e) => e.label).join(', ')}</span>.
        </p>
      )}
    </div>
  );
}

export default function OverviewTab({
  overview, client, onSendSms, onRevealPassword, password, revealing, onCopy,
}) {
  const timeline = overview?.timeline || [];
  const network = overview?.network || {};
  const reference = overview?.reference || {};
  const fup = overview?.fup || {};
  const diagnosis = overview?.diagnosis;
  const risk = overview?.risk;
  const lifecycle = overview?.lifecycle_messages;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Above the lifecycle timeline on purpose: an agent opens this page
            because something is wrong, and the answer should not be below a
            year of history. */}
        <DiagnosisPanel diagnosis={diagnosis} />
        <RiskPanel risk={risk} />
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
            /* Offline subscribers are the ones being looked up, so the router has
               to survive the session ending — it comes from the last closed
               session when there is no live one. */
            label={network.router && !network.router_is_live ? 'Router (last seen)' : 'Router'}
            value={network.router
              ? (network.router.id
                  ? <Link to={`/devices/${network.router.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{network.router.name}</Link>
                  : network.router.name)
              : '—'}
            tone={network.router && !network.router_is_live
              ? 'text-slate-500 dark:text-slate-400' : undefined}
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
          <LifecycleMessages events={lifecycle} />
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
