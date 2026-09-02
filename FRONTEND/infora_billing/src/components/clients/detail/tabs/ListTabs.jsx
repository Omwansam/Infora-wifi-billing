import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, CreditCard, LifeBuoy, Loader2, MessageSquare, Package, Send, Smartphone,
  StickyNote, Trash2, Wifi,
} from 'lucide-react';
import { Panel, DataTable, Td, Chip, EmptyState, PanelSkeleton, INPUT, SummaryStrip } from '../parts';
import { formatBytes } from '../../../../lib/networkUtils';
import { formatCurrency } from '../../../../lib/utils';
import { formatPaymentMethod } from '../../../../lib/billingFormatters';

/* -------------------------------------------------------------------------
 * The seven list tabs. They share the same shell — panel, table, empty state —
 * so they live together rather than as seven near-identical files.
 * ---------------------------------------------------------------------- */

function when(value, withTime = true) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function duration(seconds) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// --- Sessions --------------------------------------------------------------

/**
 * Colour follows blame, not severity: a subscriber switching off their router is
 * not a problem, and a line that keeps dropping is, even though both are just
 * "the session ended".
 */
const CAUSE_TONE = {
  line: 'critical',
  network: 'warning',
  policy: 'info',
  subscriber: 'neutral',
  unknown: 'neutral',
};

export function SessionsTab({ data, loading, page, onPage, summary }) {
  if (loading) return <Panel title="Sessions"><PanelSkeleton rows={6} /></Panel>;
  const sessions = data?.sessions || [];
  const stability = summary?.stability;

  return (
    <Panel
      icon={Wifi}
      title="Sessions"
      subtitle={`${data?.total || 0} RADIUS accounting record${data?.total === 1 ? '' : 's'}`}
    >
      {summary && (
        <SummaryStrip
          items={[
            { label: 'Last 30 days', value: summary.count_30d, sub: 'sessions' },
            { label: 'Data moved', value: formatBytes(summary.bytes_30d), sub: 'last 30 days' },
            summary.longest_seconds > 0 && {
              label: 'Longest', value: duration(summary.longest_seconds), sub: 'single session',
            },
            /* Repeated short sessions are a fault announcing itself, and every
               individual row looks unremarkable -- counting them is what makes
               the pattern visible. */
            stability && {
              label: 'Stability',
              value: stability.flapping ? 'Unstable' : 'Steady',
              sub: stability.summary,
              tone: stability.flapping ? 'critical' : 'good',
            },
          ]}
        />
      )}
      <DataTable
        head={[
          { label: 'Started' }, { label: 'Duration' }, { label: 'IP' },
          { label: 'Download', align: 'right' }, { label: 'Upload', align: 'right' },
          { label: 'Ended' }, { label: 'Why it ended' },
        ]}
        empty={!sessions.length && (
          <EmptyState
            icon={Wifi}
            title="No sessions on record"
            hint="Sessions appear here once the subscriber's router authenticates against RADIUS."
          />
        )}
      >
        {sessions.map((session) => (
          <tr key={session.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Td>
              <span className="flex items-center gap-2">
                {session.live && (
                  <span className="relative flex h-2 w-2" title="Live now">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
                {when(session.started_at)}
              </span>
            </Td>
            <Td muted>{duration(session.duration_seconds)}</Td>
            <Td mono muted>{session.ip_address || '—'}</Td>
            <Td align="right">{formatBytes(session.down_bytes)}</Td>
            <Td align="right">{formatBytes(session.up_bytes)}</Td>
            <Td muted>
              {session.live ? <Chip tone="good">Live</Chip> : when(session.ended_at)}
            </Td>
            {/* The disconnect reason used to live in a title= tooltip, which is
                invisible on touch and to anyone not hovering the exact word — and
                it is the field that says whether a drop was the customer, our
                router, or the line. */}
            <Td muted>
              {session.live ? '—' : (
                session.cause
                  ? (
                    /* Chip takes no title, so the explanation hangs off a wrapper —
                       the chip itself has to carry the meaning without it. */
                    <span title={session.cause.detail}>
                      <Chip tone={CAUSE_TONE[session.cause.blame] || 'neutral'}>
                        {session.cause.label}
                      </Chip>
                    </span>
                  )
                  : <span className="text-slate-400 dark:text-slate-500">Not reported</span>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>

      {data?.pages > 1 && (
        <nav className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Page {page} of {data.pages}
          </p>
          <div className="flex gap-2">
            <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</PagerButton>
            <PagerButton disabled={page >= data.pages} onClick={() => onPage(page + 1)}>Next</PagerButton>
          </div>
        </nav>
      )}
    </Panel>
  );
}

function PagerButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

// --- Payments --------------------------------------------------------------

const PAYMENT_TONE = { completed: 'good', pending: 'warning', failed: 'critical', refunded: 'neutral' };

export function PaymentsTab({ data, loading, summary }) {
  if (loading) return <Panel title="Payments"><PanelSkeleton rows={5} /></Panel>;
  const payments = data?.payments || [];

  return (
    <Panel icon={CreditCard} title="Payments" subtitle={`${data?.total || 0} recorded`}>
      {summary && (
        <SummaryStrip
          items={[
            {
              label: 'Total paid',
              value: formatCurrency(summary.total_paid),
              /* "Never paid" is a billing problem; "nothing this month" is a
                 calendar entry. The lifetime-value tile could not tell them
                 apart, so it said Ksh 0.00 to both. */
              sub: summary.ever_paid ? `${summary.completed} payment${summary.completed === 1 ? '' : 's'}` : 'Never paid',
              tone: summary.ever_paid ? 'good' : 'warning',
            },
            summary.ever_paid && {
              label: 'Average', value: formatCurrency(summary.average),
              sub: summary.top_method ? `mostly ${formatPaymentMethod(summary.top_method)}` : null,
            },
            summary.ever_paid && {
              label: 'Last payment',
              value: summary.days_since_last === 0 ? 'Today' : `${summary.days_since_last}d ago`,
              sub: when(summary.last_paid_at, false),
            },
            summary.failed > 0 && {
              label: 'Not completed', value: summary.failed,
              sub: 'failed or pending', tone: 'warning',
            },
          ]}
        />
      )}
      <DataTable
        head={[
          { label: 'Date' }, { label: 'Amount', align: 'right' }, { label: 'Method' },
          { label: 'Reference' }, { label: 'Status' },
        ]}
        empty={!payments.length && (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            hint="M-Pesa, cash and card payments all land here as they are recorded."
          />
        )}
      >
        {payments.map((payment) => (
          <tr key={payment.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Td>{when(payment.payment_date)}</Td>
            <Td align="right" className="font-semibold">{formatCurrency(payment.amount)}</Td>
            <Td muted>{formatPaymentMethod(payment.method)}</Td>
            <Td mono muted>{payment.reference || '—'}</Td>
            <Td>
              <Chip tone={PAYMENT_TONE[payment.status] || 'neutral'}>{payment.status}</Chip>
            </Td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

// --- Package history -------------------------------------------------------

export function PackageHistoryTab({ events, loading, joinedAt }) {
  if (loading) return <Panel title="Package history"><PanelSkeleton rows={5} /></Panel>;

  const changes = events?.length || 0;
  // No change recorded means they are still on what they signed up with, so the
  // clock starts at the join date rather than reading as "unknown".
  const since = events?.[0]?.created_at || joinedAt;
  const days = since
    ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86400000))
    : null;

  return (
    <Panel
      icon={Package}
      title="Package history"
      subtitle="Every change to what this subscriber pays for"
    >
      {(changes > 0 || since) && (
        <SummaryStrip
          items={[
            { label: 'Changes', value: changes,
              sub: changes === 0 ? 'still on the original plan' : null },
            days !== null && {
              label: 'On this plan',
              value: days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`,
              sub: when(since, false),
            },
          ]}
        />
      )}
      <DataTable
        head={[{ label: 'When' }, { label: 'Change' }, { label: 'From → to' }, { label: 'By' }]}
        empty={!events?.length && (
          <EmptyState
            icon={Package}
            title="No package changes recorded"
            hint="Switching package or moving the expiry from this page writes an entry here."
          />
        )}
      >
        {(events || []).map((event, index) => (
          <tr key={event.id ?? index} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Td>{when(event.created_at)}</Td>
            <Td className="font-medium">{event.title}</Td>
            <Td muted className="max-w-xs truncate">{event.detail || '—'}</Td>
            <Td muted>{event.actor || 'System'}</Td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

// --- Messages --------------------------------------------------------------

export function MessagesTab({ messages, loading, onSendSms, summary, lifecycle }) {
  if (loading) return <Panel title="SMS"><PanelSkeleton rows={5} /></Panel>;
  const armed = (lifecycle || []).filter((e) => e.enabled);

  return (
    <Panel
      icon={MessageSquare}
      title="Messages"
      subtitle="Everything sent to this subscriber"
      action={
        <button
          type="button"
          onClick={onSendSms}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Send className="h-3.5 w-3.5" />
          Send SMS
        </button>
      }
    >
      {summary?.total > 0 && (
        <SummaryStrip
          items={[
            { label: 'Sent', value: summary.total, sub: 'all channels' },
            summary.by_channel?.sms && { label: 'SMS', value: summary.by_channel.sms },
            summary.by_channel?.email && { label: 'Email', value: summary.by_channel.email },
            summary.last_at && { label: 'Last sent', value: when(summary.last_at, false) },
          ]}
        />
      )}
      {/* An empty log reads as "nothing has happened", but most lifecycle events
          ship switched off — so the usual reason nothing was sent is that nothing
          was ever armed. Say which, rather than leaving it to be discovered. */}
      {lifecycle?.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/30">
          {armed.length > 0 ? (
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{armed.length} automatic message{armed.length === 1 ? '' : 's'}</span>
              {' '}armed for this subscriber: {armed.map((e) => e.label).join(', ')}.
            </p>
          ) : (
            <p className="text-amber-700 dark:text-amber-400">
              No automatic messages are switched on — nothing will reach this
              subscriber unless someone sends it by hand.
            </p>
          )}
        </div>
      )}
      {messages?.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {messages.map((message) => (
            <li key={message.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {message.title}
                  <Chip tone={message.channel === 'email' ? 'info' : 'neutral'}>
                    {message.channel}
                  </Chip>
                </p>
                <time className="text-xs text-slate-400 dark:text-slate-500">
                  {when(message.created_at)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {message.message}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="No messages sent yet"
          hint="Credentials, payment details and manual SMS all appear on this thread."
        />
      )}
    </Panel>
  );
}

// --- Tickets ---------------------------------------------------------------

const TICKET_TONE = { open: 'warning', in_progress: 'info', resolved: 'good', closed: 'neutral' };

export function TicketsTab({ data, loading, summary }) {
  if (loading) return <Panel title="Tickets"><PanelSkeleton rows={4} /></Panel>;
  const tickets = data?.tickets || [];

  return (
    <Panel icon={LifeBuoy} title="Tickets" subtitle={`${data?.total || 0} support ticket${data?.total === 1 ? '' : 's'}`}>
      {summary?.total > 0 && (
        <SummaryStrip
          items={[
            {
              label: 'Still open', value: summary.open,
              tone: summary.open > 0 ? 'warning' : 'good',
              sub: summary.open === 0 ? 'nothing outstanding' : null,
            },
            { label: 'Resolved', value: summary.resolved },
            /* An open ticket's age is the number that matters -- a list sorted by
               date buries the one that has been waiting three weeks. */
            summary.oldest_open_days !== null && summary.oldest_open_days !== undefined && {
              label: 'Oldest open',
              value: `${summary.oldest_open_days}d`,
              sub: when(summary.oldest_open_at, false),
              tone: summary.oldest_open_days > 7 ? 'critical' : 'neutral',
            },
          ]}
        />
      )}
      <DataTable
        head={[{ label: 'Ticket' }, { label: 'Subject' }, { label: 'Priority' }, { label: 'Status' }, { label: 'Opened' }]}
        empty={!tickets.length && (
          <EmptyState icon={LifeBuoy} title="No tickets for this subscriber" />
        )}
      >
        {tickets.map((ticket) => (
          <tr key={ticket.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Td mono muted>
              <Link to={`/tickets/${ticket.id}`} className="hover:underline">
                {ticket.ticket_number}
              </Link>
            </Td>
            <Td className="max-w-xs truncate font-medium">{ticket.subject}</Td>
            <Td muted>{ticket.priority}</Td>
            <Td><Chip tone={TICKET_TONE[ticket.status] || 'neutral'}>{String(ticket.status).replace('_', ' ')}</Chip></Td>
            <Td muted>{when(ticket.created_at, false)}</Td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

// --- Devices ---------------------------------------------------------------

export function DevicesTab({ devices, loading, summary }) {
  if (loading) return <Panel title="Devices"><PanelSkeleton rows={4} /></Panel>;

  return (
    <Panel
      icon={Smartphone}
      title="Devices"
      subtitle="Registered hardware, plus every MAC that has authenticated"
    >
      {summary?.total > 0 && (
        <SummaryStrip
          items={[
            { label: 'Devices seen', value: summary.total },
            { label: 'Registered', value: summary.registered,
              sub: summary.registered === 0 ? 'none added by hand' : null },
            { label: 'From RADIUS only', value: summary.seen_only },
          ]}
        />
      )}
      <DataTable
        head={[{ label: 'Device' }, { label: 'MAC' }, { label: 'Last IP' }, { label: 'Source' }, { label: 'Last seen' }]}
        empty={!devices?.length && (
          <EmptyState
            icon={Smartphone}
            title="No devices seen yet"
            hint="A device appears once it authenticates, even if it was never registered by hand."
          />
        )}
      >
        {(devices || []).map((device, index) => (
          <tr key={device.mac || index} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Td className="font-medium">
              {/* An unregistered MAC used to render as "Unnamed device". The OUI
                  answers the question support actually has: is this the CPE we
                  installed, or the customer's phone? */}
              {device.name || device.model || device.vendor || 'Unnamed device'}
              {!device.name && !device.model && device.vendor && (
                <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  (from MAC)
                </span>
              )}
              {device.sessions ? (
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                  {device.sessions} session{device.sessions === 1 ? '' : 's'}
                </span>
              ) : null}
            </Td>
            <Td mono muted>{device.mac || '—'}</Td>
            <Td mono muted>{device.ip || '—'}</Td>
            <Td>
              <Chip tone={device.source === 'registered' ? 'accent' : 'neutral'}>
                {device.source === 'registered' ? 'Registered' : 'Seen on RADIUS'}
              </Chip>
            </Td>
            <Td muted>{when(device.last_seen)}</Td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

// --- Notes -----------------------------------------------------------------

export function NotesTab({ notes, loading, onAdd, onDelete, saving, summary }) {
  const [draft, setDraft] = useState('');

  if (loading) return <Panel title="Notes"><PanelSkeleton rows={4} /></Panel>;

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const ok = await onAdd(draft.trim());
    if (ok) setDraft('');
  };

  return (
    <Panel
      icon={StickyNote}
      title="Notes"
      subtitle="Internal thread — operators only, never shown to the subscriber"
    >
      {summary?.total > 0 && (
        <SummaryStrip
          items={[
            { label: 'Notes', value: summary.total },
            summary.private > 0 && { label: 'Internal only', value: summary.private,
              sub: 'not shown to the subscriber' },
            summary.last_at && { label: 'Last note', value: when(summary.last_at, false) },
          ]}
        />
      )}
      <form onSubmit={submit} className="border-b border-slate-100 p-5 dark:border-slate-800">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Add an internal note…"
          className={`${INPUT} resize-y`}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Post note
          </button>
        </div>
      </form>

      {notes?.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {notes.map((note) => (
            <li key={note.id} className="group flex items-start gap-3 px-5 py-4">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {note.content}
                </p>
                <time className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                  {when(note.created_at)}
                </time>
              </div>
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                title="Delete note"
                className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={StickyNote} title="No notes yet" hint="Anything the next operator should know goes here." />
      )}
    </Panel>
  );
}
