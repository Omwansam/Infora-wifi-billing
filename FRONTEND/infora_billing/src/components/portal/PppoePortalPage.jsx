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
import { portalClasses, usePortalTheme } from './PortalThemeContext';
import {
  ConnectionStatusRing,
  PortalBadge,
  PortalButton,
  PortalFadeIn,
  PortalGlassCard,
  PortalInput,
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
        <PppoeBody
          config={config}
          ispId={ispId}
          account={account}
          setAccount={setAccount}
          lookupLoading={lookupLoading}
          setLookupLoading={setLookupLoading}
          lookupError={lookupError}
          setLookupError={setLookupError}
          status={status}
          setStatus={setStatus}
          paying={paying}
          setPaying={setPaying}
        />
      )}
    </PortalShell>
  );
}

function PppoeBody({
  config,
  ispId,
  account,
  setAccount,
  lookupLoading,
  setLookupLoading,
  lookupError,
  setLookupError,
  status,
  setStatus,
  paying,
  setPaying,
}) {
  const { isLight, accent, accentFg } = usePortalTheme();
  const cx = portalClasses(isLight);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PortalFadeIn>
        <div>
          <PortalBadge variant="warning">Subscriber account</PortalBadge>
          <h2 className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${cx.text}`}>
            My internet account
          </h2>
          <p className={`mt-2 max-w-lg text-sm ${cx.textMuted}`}>{config.pppoe_welcome}</p>
        </div>
      </PortalFadeIn>

      {!paying && (
        <PortalFadeIn delay={0.05}>
          <PortalGlassCard>
            <h3 className={`text-base font-semibold ${cx.text}`}>Find your connection</h3>
            <p className={`mt-1 text-sm ${cx.textMuted}`}>
              Enter the username, email, or phone registered on your PPPoE account.
            </p>
            <form
              className="mt-5"
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
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${cx.textSubtle}`}
                  />
                  <PortalInput
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder="e.g. john@email.com or 0712345678"
                    className="pl-11"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: accent, color: accentFg }}
                >
                  {lookupLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    'Check status'
                  )}
                </button>
              </div>
              {lookupError && (
                <p
                  className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
                    isLight
                      ? 'bg-red-50 text-red-800 ring-red-200'
                      : 'bg-red-500/10 text-red-200 ring-red-400/20'
                  }`}
                >
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
            className="mb-5 inline-flex items-center gap-2 text-sm hover:opacity-80"
            style={{ color: accent }}
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
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: User, title: 'Look up', text: 'Use email, phone, or PPPoE username.' },
              { icon: WifiOff, title: 'See status', text: 'Know immediately if you are offline.' },
              { icon: CreditCard, title: 'Pay & restore', text: 'M-Pesa renews your monthly package.' },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className={`rounded-xl border p-4 text-center ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-black/20'
                }`}
              >
                <Icon className="mx-auto mb-2 h-5 w-5" style={{ color: accent }} />
                <p className={`text-sm font-medium ${cx.text}`}>{title}</p>
                <p className={`mt-1 text-xs ${cx.textMuted}`}>{text}</p>
              </div>
            ))}
          </div>
        </PortalFadeIn>
      )}
    </div>
  );
}

function AccountStatusCard({ status, onRenew, onReset }) {
  const { isLight, accent, accentFg } = usePortalTheme();
  const cx = portalClasses(isLight);
  const access = status.access || {};
  const isOffline = !access.has_internet;

  const cardStyle = isOffline
    ? undefined
    : {
        borderColor: 'var(--portal-accent-ring)',
        backgroundImage: `linear-gradient(180deg, var(--portal-accent-softer), transparent 70%)`,
      };

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        isOffline
          ? isLight
            ? 'border-amber-200 bg-amber-50'
            : 'border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-transparent'
          : isLight
            ? 'bg-white'
            : ''
      }`}
      style={cardStyle}
    >
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <ConnectionStatusRing
          online={!isOffline}
          label={isOffline ? 'No internet' : 'Online'}
        />
        <div>
          <PortalBadge variant={isOffline ? 'warning' : 'success'}>{access.state}</PortalBadge>
          <h3 className={`mt-3 text-xl font-bold sm:text-2xl ${cx.text}`}>{access.title}</h3>
          <p className={`mt-2 text-sm leading-relaxed ${cx.textMuted}`}>{access.message}</p>
        </div>
      </div>

      <div
        className={`border-t p-6 sm:p-8 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-black/20'
        }`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile icon={User} label="Account name" value={status.full_name} />
          <InfoTile icon={Package} label="Current package" value={status.package || '—'} />
          <InfoTile
            icon={CreditCard}
            label="Amount due"
            value={formatCurrency(status.amount_due || 0)}
            highlight
          />
          {status.subscription_end && (
            <InfoTile
              icon={Calendar}
              label={isOffline ? 'Expired on' : 'Valid until'}
              value={formatDateTime(status.subscription_end)}
            />
          )}
        </div>

        {isOffline && (
          <div
            className={`mt-5 flex items-start gap-3 rounded-xl border p-4 ${
              isLight
                ? 'border-amber-200 bg-amber-100/70 text-amber-900'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
            }`}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Your connection is paused</p>
              <p className="mt-1 text-sm opacity-90">
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
            className="rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:brightness-110"
            style={{
              backgroundColor: accent,
              color: accentFg,
              boxShadow: `0 10px 24px -10px var(--portal-accent-glow)`,
            }}
          >
            {isOffline ? 'Pay & restore internet' : 'Renew package'}
          </button>
          <PortalButton variant="secondary" onClick={onReset}>
            Look up another account
          </PortalButton>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, highlight = false }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div
      className={`rounded-xl border p-4 ${
        isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-black/25'
      }`}
    >
      <div className={`mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wider ${cx.textSubtle}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={`font-semibold ${highlight ? 'text-lg' : ''} ${cx.text}`}
        style={highlight ? { color: 'var(--portal-accent)' } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
