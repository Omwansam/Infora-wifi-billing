import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CreditCard,
  Loader2,
  Package,
  Search,
  User,
  WifiOff,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import portalService from '../../services/portalService';
import PortalPayFlow from './PortalPayFlow';
import PortalShell from './PortalShell';
import {
  ConnectionStatusRing,
  PortalBadge,
  PortalFadeIn,
  PortalGlassCard,
  PortalSectionHeader,
} from './PortalUI';

export default function PppoePortalPage() {
  const [account, setAccount] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [status, setStatus] = useState(null);
  const [paying, setPaying] = useState(false);

  return (
    <PortalShell activeTab="pppoe">
      {({ config, ispId }) => (
        <div className="mx-auto max-w-2xl space-y-10">
          <PortalFadeIn>
            <div className="text-center">
              <PortalBadge variant="warning">Subscriber portal</PortalBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                My internet account
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-white/60">{config.pppoe_welcome}</p>
            </div>
          </PortalFadeIn>

          {!paying && (
            <PortalFadeIn delay={0.05}>
              <PortalGlassCard>
                <PortalSectionHeader
                  eyebrow="Account lookup"
                  title="Find your connection"
                  subtitle="Enter the username, email, or phone registered on your PPPoE account."
                />
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!account.trim()) {
                      setLookupError('Enter your username, email, or phone number');
                      return;
                    }
                    setLookupLoading(true);
                    setLookupError('');
                    const result = await portalService.lookupPppoe({
                      account: account.trim(),
                      ispId,
                    });
                    setLookupLoading(false);
                    if (result.success) {
                      setStatus(result.data);
                    } else {
                      setStatus(null);
                      setLookupError(result.error || 'Account not found');
                    }
                  }}
                >
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    PPPoE username, email, or phone
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                      <input
                        type="text"
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                        placeholder="e.g. john@email.com or 0712345678"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 py-3.5 pl-12 pr-4 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60"
                    >
                      {lookupLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Checking…
                        </>
                      ) : (
                        'Check status'
                      )}
                    </button>
                  </div>
                  {lookupError && (
                    <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/20">
                      {lookupError}
                    </p>
                  )}
                </form>
              </PortalGlassCard>
            </PortalFadeIn>
          )}

          {status && !paying && (
            <PortalFadeIn delay={0.1}>
              <AccountStatusCard
                status={status}
                onRenew={() => setPaying(true)}
                onReset={() => {
                  setStatus(null);
                  setAccount('');
                }}
              />
            </PortalFadeIn>
          )}

          {status && paying && (
            <PortalFadeIn className="mx-auto max-w-xl">
              <button
                type="button"
                onClick={() => setPaying(false)}
                className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to account summary
              </button>
              <PortalPayFlow
                title="Renew your package"
                subtitle={
                  status.access?.has_internet
                    ? 'Extend your subscription before it expires.'
                    : 'Your internet is switched off until this payment is completed.'
                }
                planName={status.package}
                amount={status.amount_due}
                defaultPhone={status.phone || ''}
                successKind="pppoe"
                onReset={() => {
                  setPaying(false);
                  portalService.lookupPppoe({ account: account.trim(), ispId }).then((r) => {
                    if (r.success) setStatus(r.data);
                  });
                }}
                onSubmit={({ phone }) =>
                  portalService.renewPppoe({
                    account: account.trim(),
                    phone,
                    planId: status.plan_id,
                    ispId,
                  })
                }
              />
            </PortalFadeIn>
          )}

          {!status && !paying && (
            <PortalFadeIn delay={0.1}>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: User, title: 'Look up', text: 'Use email, phone, or PPPoE username.' },
                  { icon: WifiOff, title: 'See status', text: 'Know immediately if you are offline.' },
                  { icon: CreditCard, title: 'Pay & restore', text: 'M-Pesa renews your monthly package.' },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-center">
                    <Icon className="mx-auto mb-2 h-5 w-5 text-emerald-300" />
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-1 text-xs text-white/45">{text}</p>
                  </div>
                ))}
              </div>
            </PortalFadeIn>
          )}
        </div>
      )}
    </PortalShell>
  );
}

function AccountStatusCard({ status, onRenew, onReset }) {
  const access = status.access || {};
  const isOffline = !access.has_internet;

  return (
    <div
      className={`overflow-hidden rounded-[1.75rem] border ${
        isOffline
          ? 'border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-transparent'
          : 'border-emerald-400/30 bg-gradient-to-b from-emerald-500/15 to-transparent'
      }`}
    >
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <ConnectionStatusRing
          online={!isOffline}
          label={isOffline ? 'No internet' : 'Online'}
        />
        <div>
          <PortalBadge variant={isOffline ? 'warning' : 'success'}>{access.state}</PortalBadge>
          <h3 className="mt-3 text-2xl font-bold text-white">{access.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{access.message}</p>
        </div>
      </div>

      <div className="border-t border-white/8 bg-black/20 p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoTile icon={User} label="Account name" value={status.full_name} />
          <InfoTile icon={Package} label="Current package" value={status.package || '—'} />
          <InfoTile icon={CreditCard} label="Amount due" value={formatCurrency(status.amount_due || 0)} highlight />
          {status.subscription_end && (
            <InfoTile
              icon={Calendar}
              label={isOffline ? 'Expired on' : 'Valid until'}
              value={formatDateTime(status.subscription_end)}
            />
          )}
        </div>

        {isOffline && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium text-amber-100">Your connection is paused</p>
              <p className="mt-1 text-sm text-amber-100/75">
                {status.package
                  ? `Pay for ${status.package} with M-Pesa to turn your internet back on.`
                  : 'Complete payment to restore your internet service.'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRenew}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400"
          >
            {isOffline ? 'Pay & restore internet' : 'Renew package early'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
          >
            Look up another account
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, highlight = false }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`font-semibold ${highlight ? 'text-emerald-200 text-lg' : 'text-white'}`}>{value}</p>
    </div>
  );
}
