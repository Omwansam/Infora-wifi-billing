import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ban, CalendarClock, CheckCircle2, FileText, Gauge, Gift, Mail, MessageSquare,
  MoreHorizontal, Pause, Pencil, Phone, Play, Send, ShieldCheck, Trash2, Wallet, Wifi,
} from 'lucide-react';
import { Chip, CopyButton } from './parts';
import { customerInitials } from '../../../lib/billingFormatters';

/* -------------------------------------------------------------------------
 * The page's cover: who this is, what state they're in, and the four things an
 * operator does most. Everything rarer lives behind the ⋯ menu, so the header
 * stays a summary rather than a control panel.
 * ---------------------------------------------------------------------- */

const TYPE_LABEL = { pppoe: 'PPPoE', hotspot: 'Hotspot', wireguard: 'WireGuard' };

export default function DetailHero({
  client, overview, onCopy, onEdit, onSendSms, onChangeExpiry, actions,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const online = overview?.network?.online;
  const plan = overview?.plan;
  const suspended = client?.status === 'suspended';

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      /* The ⋯ dropdown is a child of this header, and framer-motion's animated
         opacity/transform makes the header its own stacking context — without
         an explicit z-index here the menu paints *behind* the KPI strip and
         panels that follow it in the DOM, however high its own z-index is. */
      className="relative z-30 mb-6"
    >
      <nav className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <Link to="/clients" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">
          Subscribers
        </Link>
        <span aria-hidden>—</span>
        <span className="text-slate-600 dark:text-slate-300">
          #{client?.account_number || client?.id}
        </span>
      </nav>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            {customerInitials(client?.name)}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {client?.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                @{overview?.network?.username || client?.radius_username || '—'}
                <CopyButton value={overview?.network?.username} label="Username" onCopied={onCopy} />
              </span>

              {online
                ? <Chip icon={Wifi} tone="good">Online</Chip>
                : <Chip tone="neutral">Offline</Chip>}

              {suspended && <Chip icon={Ban} tone="critical">Suspended</Chip>}

              <Chip tone="accent">{TYPE_LABEL[client?.connection_type] || 'PPPoE'}</Chip>

              {plan && (
                <Chip tone="info">
                  {plan.name}
                  {plan.download_mbps ? ` · ${plan.download_mbps}M/${plan.upload_mbps || plan.download_mbps}M` : ''}
                </Chip>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              {client?.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                  <CopyButton value={client.phone} label="Phone" onCopied={onCopy} />
                </span>
              )}
              {client?.email && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                  <CopyButton value={client.email} label="Email" onCopied={onCopy} />
                </span>
              )}
              {overview?.reference?.joined_at && (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Member since{' '}
                  {new Date(overview.reference.joined_at).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <HeroButton icon={MessageSquare} onClick={onSendSms}>SMS</HeroButton>
          <HeroButton icon={Pencil} onClick={onEdit} aria-label="Edit subscriber" />
          <button
            type="button"
            onClick={onChangeExpiry}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <CalendarClock className="h-4 w-4" />
            Change expiry
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <MenuItem icon={Send} onClick={() => { setMenuOpen(false); actions.sendCredentials(); }}>
                  Send credentials
                </MenuItem>
                <MenuItem icon={Wallet} onClick={() => { setMenuOpen(false); actions.sendPaymentDetails(); }}>
                  Send payment details
                </MenuItem>
                <MenuItem icon={FileText} onClick={() => { setMenuOpen(false); actions.generateInvoice(); }}>
                  Generate invoice
                </MenuItem>

                <Divider />

                {suspended ? (
                  <MenuItem icon={Play} onClick={() => { setMenuOpen(false); actions.resume(); }}>
                    Resume subscription
                  </MenuItem>
                ) : (
                  <MenuItem icon={Pause} onClick={() => { setMenuOpen(false); actions.pause(); }}>
                    Pause subscription
                  </MenuItem>
                )}
                <MenuItem icon={Gauge} onClick={() => { setMenuOpen(false); actions.fupOverride(); }}>
                  {overview?.fup?.exempt_until ? 'Remove FUP override' : 'FUP override'}
                </MenuItem>
                <MenuItem icon={Gift} onClick={() => { setMenuOpen(false); actions.compensate(); }}>
                  Compensate
                </MenuItem>

                <Divider />

                {suspended ? (
                  <MenuItem icon={CheckCircle2} tone="good" onClick={() => { setMenuOpen(false); actions.unblock(); }}>
                    Unblock subscriber
                  </MenuItem>
                ) : (
                  <MenuItem icon={Ban} tone="critical" onClick={() => { setMenuOpen(false); actions.block(); }}>
                    Block subscriber
                  </MenuItem>
                )}
                <MenuItem icon={Trash2} tone="critical" onClick={() => { setMenuOpen(false); actions.remove(); }}>
                  Delete subscriber
                </MenuItem>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function HeroButton({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

const MENU_TONES = {
  neutral: 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
  good: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
  critical: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
};

function MenuItem({ icon: Icon, children, tone = 'neutral', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium transition-colors ${MENU_TONES[tone]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </button>
  );
}

function Divider() {
  return <div className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />;
}
