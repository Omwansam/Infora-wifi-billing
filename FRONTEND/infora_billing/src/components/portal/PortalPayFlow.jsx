import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  RefreshCw,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import portalService from '../../services/portalService';
import { portalClasses, usePortalTheme } from './PortalThemeContext';
import {
  CopyCredential,
  PayStepIndicator,
  PortalBadge,
  PortalButton,
  PortalGlassCard,
  PortalInput,
  PortalLabel,
} from './PortalUI';

const STEPS = {
  FORM: 'form',
  SENDING: 'sending',
  WAITING: 'waiting',
  SUCCESS: 'success',
  ERROR: 'error',
};

function payStepFromState(step) {
  if (step === STEPS.FORM || step === STEPS.ERROR) return 0;
  if (step === STEPS.SENDING || step === STEPS.WAITING) return 1;
  if (step === STEPS.SUCCESS) return 2;
  return 0;
}

export default function PortalPayFlow({
  title,
  subtitle,
  amount,
  planName,
  planMeta,
  defaultPhone = '',
  onSubmit,
  successKind = 'hotspot',
  onReset,
}) {
  const { isLight, accent, accentFg } = usePortalTheme();
  const cx = portalClasses(isLight);
  const [phone, setPhone] = useState(defaultPhone);
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState(STEPS.FORM);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const currentPayStep = useMemo(() => payStepFromState(step), [step]);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setMessage('Enter your M-Pesa phone number');
      setStep(STEPS.ERROR);
      return;
    }

    setStep(STEPS.SENDING);
    setMessage('Sending payment request to your phone…');

    const purchase = await onSubmit({ phone: phone.trim(), fullName: fullName.trim() });
    if (!purchase.success) {
      setStep(STEPS.ERROR);
      setMessage(purchase.error || 'Could not start payment');
      return;
    }

    const checkoutId = purchase.data?.checkout_request_id;
    if (!checkoutId) {
      setStep(STEPS.ERROR);
      setMessage('Missing payment reference from server');
      return;
    }

    setStep(STEPS.WAITING);
    setMessage(purchase.message || 'Check your phone and enter your M-Pesa PIN…');

    const poll = await portalService.pollPaymentStatus(checkoutId);
    if (poll.success) {
      setResult(poll.data);
      setStep(STEPS.SUCCESS);
      setMessage('Payment successful — you are connected!');
      return;
    }

    setStep(STEPS.ERROR);
    setMessage(poll.error || 'Payment did not complete');
  };

  const retry = () => {
    setStep(STEPS.FORM);
    setMessage('');
  };

  const accentSurface = {
    backgroundColor: 'var(--portal-accent-soft)',
    borderColor: 'var(--portal-accent-ring)',
  };

  return (
    <PortalGlassCard glow className="overflow-hidden">
      <PayStepIndicator step={currentPayStep} />

      <AnimatePresence mode="wait">
        {step === STEPS.SUCCESS && result ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-6 flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1"
                style={{
                  backgroundColor: 'var(--portal-accent-soft)',
                  // eslint-disable-next-line no-restricted-syntax
                  ['--tw-ring-color']: 'var(--portal-accent-ring)',
                  color: 'var(--portal-accent)',
                }}
              >
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <PortalBadge variant="success">Payment confirmed</PortalBadge>
                <h3 className={`mt-2 text-xl font-bold ${cx.text}`}>You are all set!</h3>
                <p className={`mt-1 text-sm ${cx.textMuted}`}>{message}</p>
              </div>
            </div>

            {successKind === 'hotspot' && result.wifi_credentials && (
              <div className="space-y-3 rounded-2xl border p-5" style={accentSurface}>
                <p
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--portal-accent)' }}
                >
                  <Wifi className="h-4 w-4" />
                  Hotspot login credentials
                </p>
                <CopyCredential label="Username" value={result.wifi_credentials.username} />
                <CopyCredential label="Password" value={result.wifi_credentials.password} />
                {result.expires_at && (
                  <p className={`flex items-center gap-2 text-xs ${cx.textSubtle}`}>
                    <Clock className="h-3.5 w-3.5" />
                    Access valid until {new Date(result.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {successKind === 'pppoe' && result.access && (
              <div className="rounded-2xl border p-5" style={accentSurface}>
                <p className={`font-semibold ${cx.text}`}>{result.access.title}</p>
                <p className={`mt-2 text-sm ${cx.textMuted}`}>{result.access.message}</p>
                {result.access.expires_at && (
                  <p className={`mt-3 text-xs ${cx.textSubtle}`}>
                    Active until {new Date(result.access.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {result.receipt && (
              <p
                className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                  isLight ? 'bg-slate-50 text-slate-600' : 'bg-black/25 text-white/65'
                }`}
              >
                M-Pesa receipt: <span className={`font-mono ${cx.text}`}>{result.receipt}</span>
              </p>
            )}

            {onReset && (
              <PortalButton variant="secondary" onClick={onReset} className="mt-6 w-full">
                Done
              </PortalButton>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-6">
              <PortalBadge variant="mpesa">M-Pesa STK Push</PortalBadge>
              <h3 className={`mt-3 text-xl font-bold ${cx.text}`}>{title}</h3>
              {subtitle && (
                <p className={`mt-2 text-sm leading-relaxed ${cx.textMuted}`}>{subtitle}</p>
              )}
            </div>

            {planName && (
              <div
                className={`mb-6 rounded-2xl border p-4 ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-black/25'
                }`}
              >
                <p className={`text-xs uppercase tracking-wider ${cx.textSubtle}`}>Selected package</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className={`text-lg font-semibold ${cx.text}`}>{planName}</p>
                  {amount != null && (
                    <span
                      className="rounded-xl px-3 py-1.5 text-lg font-bold"
                      style={{
                        backgroundColor: 'var(--portal-accent-soft)',
                        color: 'var(--portal-accent)',
                      }}
                    >
                      {formatCurrency(amount)}
                    </span>
                  )}
                </div>
                {planMeta && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {planMeta.speed && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                          isLight ? 'bg-white text-slate-600 ring-1 ring-slate-200' : 'bg-white/5 text-white/65'
                        }`}
                      >
                        <Gauge className="h-3 w-3" />
                        {planMeta.speed}
                      </span>
                    )}
                    {planMeta.duration_label && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                          isLight ? 'bg-white text-slate-600 ring-1 ring-slate-200' : 'bg-white/5 text-white/65'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {planMeta.duration_label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {(step === STEPS.SENDING || step === STEPS.WAITING) && (
              <div className="mb-6 rounded-2xl border p-5" style={accentSurface}>
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--portal-accent)' }} />
                  <div>
                    <p className={`font-medium ${cx.text}`}>
                      {step === STEPS.SENDING ? 'Starting payment…' : 'Waiting for M-Pesa…'}
                    </p>
                    <p className={`mt-1 text-sm ${cx.textMuted}`}>{message}</p>
                  </div>
                </div>
                {step === STEPS.WAITING && (
                  <p className={`mt-4 text-xs ${cx.textSubtle}`}>
                    A prompt should appear on your phone. Enter your M-Pesa PIN to approve.
                  </p>
                )}
              </div>
            )}

            {step === STEPS.ERROR && (
              <div
                className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
                  isLight
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-red-400/20 bg-red-500/10 text-red-100'
                }`}
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Payment issue</p>
                  <p className="mt-1 text-sm opacity-90">{message}</p>
                </div>
              </div>
            )}

            {(step === STEPS.FORM || step === STEPS.ERROR) && (
              <form onSubmit={handlePay} className="space-y-4">
                {successKind === 'hotspot' && (
                  <div>
                    <PortalLabel>Your name (optional)</PortalLabel>
                    <PortalInput
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="How should we call you?"
                    />
                  </div>
                )}
                <div>
                  <PortalLabel>M-Pesa phone number</PortalLabel>
                  <div className="relative">
                    <Smartphone
                      className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--portal-accent)' }}
                    />
                    <PortalInput
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      required
                      className="pl-11"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold shadow-sm transition hover:brightness-110"
                  style={{
                    backgroundColor: accent,
                    color: accentFg,
                    boxShadow: `0 10px 30px -10px var(--portal-accent-glow)`,
                  }}
                >
                  Pay with M-Pesa {amount != null ? formatCurrency(amount) : ''}
                </button>
                {step === STEPS.ERROR && (
                  <button
                    type="button"
                    onClick={retry}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm ${
                      isLight
                        ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'border-white/10 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                )}
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PortalGlassCard>
  );
}
