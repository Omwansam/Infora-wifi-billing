import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Plus,
  RefreshCw,
  Router,
  Sparkles,
  UserPlus,
  WifiOff,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '../../lib/utils';
import { formatBytes } from '../../lib/networkUtils';
import { sanitizeBrandText } from '../../lib/brand';

/* -------------------------------------------------------------------------
 * The hero is deliberately dark in both themes. It reads as the cover of the
 * page rather than the first card on it, which is what lets the greeting carry
 * this much type without competing with the panels underneath.
 * ---------------------------------------------------------------------- */

const EVENT_ROTATE_MS = 6000;

const EVENT_STYLES = {
  subscriber: { icon: UserPlus, tint: 'text-sky-300' },
  payment: { icon: CreditCard, tint: 'text-emerald-300' },
  router: { icon: WifiOff, tint: 'text-amber-300' },
};

function timeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return { greeting: 'Good morning', shift: 'Morning shift', isMorning: true };
  if (hour < 17) return { greeting: 'Good afternoon', shift: 'Afternoon shift', isMorning: false };
  if (hour < 22) return { greeting: 'Good evening', shift: 'Evening shift', isMorning: false };
  return { greeting: 'Good evening', shift: 'Night shift', isMorning: false };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** The one line that says whether anything is wrong, in the order it matters. */
function attentionLine(summary, smsBalance) {
  const items = [];
  if (smsBalance !== null && smsBalance <= 10) items.push('SMS credit low');
  if (summary.offline_devices > 0) items.push(`${plural(summary.offline_devices, 'router')} offline`);
  if (summary.expired_subscriptions > 0) {
    items.push(`${plural(summary.expired_subscriptions, 'expired subscription')}`);
  }
  if (summary.overdue_invoices > 0) items.push(`${plural(summary.overdue_invoices, 'overdue invoice')}`);
  if (summary.open_tickets > 0) items.push(`${plural(summary.open_tickets, 'open ticket')}`);

  if (!items.length) {
    return { text: 'Nothing needs you right now — the network is running clean.', clean: true };
  }
  const shown = items.slice(0, 2).join(' · ');
  const tail = items.length > 2 ? ` and ${items.length - 2} more` : '';
  const closing = items.length === 1 ? 'this needs a minute.' : 'a few things need a minute.';
  return { text: `${shown}${tail} — ${closing}`, clean: false };
}

/** The second line: warmer, and only ever says something true about today. */
function flavourLine({ revenueToday, onlineNow, joinedToday, isMorning }) {
  if (revenueToday > 0) return `${formatCurrency(revenueToday)} collected so far today.`;
  if (joinedToday > 0) return `${plural(joinedToday, 'new subscriber')} signed up today.`;
  if (onlineNow > 0) return `${plural(onlineNow, 'subscriber')} online right now.`;
  if (isMorning) return 'A fresh start — make it a good one.';
  return 'Quiet so far — nothing has come through today.';
}

function countJoinedToday(events) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return events.filter(
    (event) => event.type === 'subscriber' && new Date(event.timestamp).getTime() >= midnight.getTime(),
  ).length;
}

function Sparkline({ series }) {
  const values = series.map((point) => point.sessions || 0);
  const width = 280;
  const height = 60;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const coords = values.map((value, i) => {
    const x = i * step;
    const y = height - 4 - (value / max) * (height - 12);
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1] || [width, height];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
      role="img"
      aria-label={`Sessions per hour: ${values.join(', ')}`}
    >
      <defs>
        <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroSparkFill)" />
      <path
        d={line}
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3" fill="#e0f2fe" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function HeroAction({ icon: Icon, children, onClick, variant = 'glass', spinning = false, disabled }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-soft)/0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
  const styles = {
    primary: 'bg-white text-slate-900 shadow-sm hover:bg-sky-50',
    glass: 'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/15',
    ghost: 'text-white/60 hover:text-white',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {Icon && <Icon className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />}
      {children}
    </button>
  );
}

function LiveStrip({ events, onNavigate }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    setIndex(0);
  }, [events.length]);

  useEffect(() => {
    if (events.length < 2) return undefined;
    const timer = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % events.length);
    }, EVENT_ROTATE_MS);
    return () => clearInterval(timer);
  }, [events.length]);

  if (!events.length) {
    return (
      <div className="relative flex items-center gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-2.5 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35 ring-1 ring-inset ring-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          Live
        </span>
        <p className="text-sm text-white/40">
          Nothing has happened yet — new subscribers and payments land here as they come in.
        </p>
      </div>
    );
  }

  const event = events[index];
  const { icon: Icon, tint } = EVENT_STYLES[event.type] || EVENT_STYLES.subscriber;

  return (
    <div
      className="relative flex items-center gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-2.5 sm:px-6"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Live
      </span>

      {/* Fixed height + absolute children so the two lines cross-fade over each
          other; a `mode="wait"` swap would blank the strip between events. */}
      <div className="relative h-5 min-w-0 flex-1">
        <AnimatePresence initial={false}>
          <motion.button
            key={`${event.type}-${event.timestamp}-${index}`}
            type="button"
            onClick={() => event.path && onNavigate?.(event.path)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="group absolute inset-0 flex w-full min-w-0 items-center gap-2 text-left"
          >
            <Icon className={`h-4 w-4 shrink-0 ${tint}`} />
            <span className="truncate text-sm text-white/75">
              <span className="text-white/55">{event.title}</span>{' '}
              <span className="font-semibold text-white">{event.subject}</span>{' '}
              <span className="text-white/55">
                {event.type === 'payment' && event.amount ? formatCurrency(event.amount) : event.detail}
              </span>
              <span className="text-white/30"> · {formatRelativeTime(event.timestamp)}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/0 transition group-hover:text-white/50" />
          </motion.button>
        </AnimatePresence>
      </div>

      {events.length > 1 && (
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {events.map((item, i) => (
            <button
              key={`${item.timestamp}-${i}`}
              type="button"
              aria-label={`Show event ${i + 1} of ${events.length}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-white/70' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewHero({ user, data, generatedAt, refreshing, onRefresh, onNavigate }) {
  const { greeting, shift, isMorning } = useMemo(() => timeOfDay(), []);

  const name = user?.first_name || user?.email?.split('@')[0] || 'there';
  const orgName = sanitizeBrandText(data?.organization?.name, 'Your network');

  const summary = data?.summary || {};
  const pulse = data?.pulse || {};
  const activity = pulse.activity || {};
  const series = activity.series || [];
  const events = pulse.events || [];

  const onlineNow = pulse.online_now ?? data?.session_counts?.all ?? data?.active_sessions ?? 0;
  const smsBalance = data?.sms_usage ? data.sms_usage.balance ?? null : null;
  const revenueToday = data?.revenue_periods?.today ?? summary.today_payments ?? 0;

  const attention = useMemo(() => attentionLine(summary, smsBalance), [summary, smsBalance]);
  const flavour = useMemo(
    () => flavourLine({ revenueToday, onlineNow, joinedToday: countJoinedToday(events), isMorning }),
    [revenueToday, onlineNow, events, isMorning],
  );

  const hasActivity = series.some((point) => (point.sessions || 0) > 0);
  const windowHours = activity.window_hours || 12;
  const AttentionIcon = attention.clean ? CheckCircle2 : AlertTriangle;

  const updatedAt = generatedAt
    ? new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit' }).format(new Date(generatedAt))
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-xl shadow-slate-900/20 ring-1 ring-white/10"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-24 -top-40 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: 'hsl(var(--brand) / 0.28)' }}
        />
        <div
          className="absolute -right-24 -top-16 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: 'hsl(var(--brand-soft) / 0.22)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-slate-950/45 to-slate-950/95" />
      </div>

      <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <span className="text-white/70">{orgName}</span>
            <span className="hidden text-white/20 sm:inline">—</span>
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <span
                className={`h-1.5 w-1.5 rounded-full ${onlineNow > 0 ? 'animate-pulse bg-emerald-400' : 'bg-white/25'}`}
              />
              {onlineNow} online right now
            </span>
            <span className="hidden text-white/20 sm:inline">—</span>
            <span className="text-white/40">{shift}</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {greeting},{' '}
            <span
              className="font-serif [font-variant-caps:small-caps]"
              style={{ color: 'hsl(var(--brand-soft))' }}
            >
              {name}.
            </span>
          </h1>

          <div className="mt-2 space-y-1">
            <p className="flex items-start gap-2 text-sm text-white/80 sm:text-[15px]">
              <AttentionIcon
                className={`mt-0.5 h-4 w-4 shrink-0 ${attention.clean ? 'text-emerald-300' : 'text-amber-300'}`}
              />
              <span>{attention.text}</span>
            </p>
            <p className="flex items-start gap-2 text-sm text-white/55">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
              <span className="font-serif italic">{flavour}</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <HeroAction variant="primary" icon={Plus} onClick={() => onNavigate?.('/clients/pppoe/new')}>
              New PPPoE
            </HeroAction>
            <HeroAction icon={Plus} onClick={() => onNavigate?.('/clients/new')}>
              New hotspot
            </HeroAction>
            <HeroAction icon={Router} onClick={() => onNavigate?.('/devices/mikrotik')}>
              Add router
            </HeroAction>
            <HeroAction variant="ghost" icon={RefreshCw} spinning={refreshing} disabled={refreshing} onClick={onRefresh}>
              {refreshing ? 'Refreshing' : 'Refresh'}
            </HeroAction>
            {updatedAt && (
              <span className="hidden text-xs text-white/30 sm:inline">· updated {updatedAt}</span>
            )}
          </div>
        </div>

        <div className="w-full shrink-0 border-t border-white/10 pt-5 lg:w-72 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 lg:text-right">
            Connections · last {windowHours}h
          </p>
          <div className="mt-3">
            {hasActivity ? (
              <Sparkline series={series} />
            ) : (
              <div className="flex h-16 items-end">
                <div className="w-full border-b border-dashed border-white/15" />
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-white/45 lg:text-right">
            {hasActivity
              ? `${plural(activity.sessions || 0, 'session')} · ${formatBytes(activity.bytes_today || 0)} today`
              : `No connections in the last ${windowHours} hours`}
          </p>
        </div>
      </div>

      <LiveStrip events={events} onNavigate={onNavigate} />
    </motion.section>
  );
}
