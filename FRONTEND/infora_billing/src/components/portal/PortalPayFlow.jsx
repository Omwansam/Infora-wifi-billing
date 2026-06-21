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
import {
  CopyCredential,
  PayStepIndicator,
  PortalBadge,
  PortalGlassCard,
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
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
              </div>
              <div>
                <PortalBadge variant="success">Payment confirmed</PortalBadge>
                <h3 className="mt-2 text-xl font-bold text-white">You are all set!</h3>
                <p className="mt-1 text-sm text-white/65">{message}</p>
              </div>
            </div>

            {successKind === 'hotspot' && result.wifi_credentials && (
              <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <Wifi className="h-4 w-4" />
                  Hotspot login credentials
                </p>
                <CopyCredential label="Username" value={result.wifi_credentials.username} />
                <CopyCredential label="Password" value={result.wifi_credentials.password} />
                {result.expires_at && (
                  <p className="flex items-center gap-2 text-xs text-white/50">
                    <Clock className="h-3.5 w-3.5" />
                    Access valid until {new Date(result.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {successKind === 'pppoe' && result.access && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="font-semibold text-white">{result.access.title}</p>
                <p className="mt-2 text-sm text-white/70">{result.access.message}</p>
                {result.access.expires_at && (
                  <p className="mt-3 text-xs text-white/50">
                    Active until {new Date(result.access.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {result.receipt && (
              <p className="mt-4 rounded-xl bg-black/25 px-4 py-3 text-sm text-white/55">
                M-Pesa receipt: <span className="font-mono text-white">{result.receipt}</span>
              </p>
            )}

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="mt-6 w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Done
              </button>
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
              <h3 className="mt-3 text-xl font-bold text-white">{title}</h3>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/60">{subtitle}</p>}
            </div>

            {planName && (
              <div className="mb-6 rounded-2xl border border-white/8 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-wider text-white/40">Selected package</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-white">{planName}</p>
                  {amount != null && (
                    <span className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-lg font-bold text-emerald-100">
                      {formatCurrency(amount)}
                    </span>
                  )}
                </div>
                {planMeta && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {planMeta.speed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/55">
                        <Gauge className="h-3 w-3" />
                        {planMeta.speed}
                      </span>
                    )}
                    {planMeta.duration_label && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/55">
                        <Clock className="h-3 w-3" />
                        {planMeta.duration_label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {(step === STEPS.SENDING || step === STEPS.WAITING) && (
              <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
                  <div>
                    <p className="font-medium text-white">
                      {step === STEPS.SENDING ? 'Starting payment…' : 'Waiting for M-Pesa…'}
                    </p>
                    <p className="mt-1 text-sm text-white/60">{message}</p>
                  </div>
                </div>
                {step === STEPS.WAITING && (
                  <p className="mt-4 text-xs text-white/45">
                    A prompt should appear on your phone. Enter your M-Pesa PIN to approve.
                  </p>
                )}
              </div>
            )}

            {step === STEPS.ERROR && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                <div>
                  <p className="font-medium text-red-100">Payment issue</p>
                  <p className="mt-1 text-sm text-red-100/75">{message}</p>
                </div>
              </div>
            )}

            {(step === STEPS.FORM || step === STEPS.ERROR) && (
              <form onSubmit={handlePay} className="space-y-4">
                {successKind === 'hotspot' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/70">Your name (optional)</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="How should we call you?"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">M-Pesa phone number</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      required
                      className="w-full rounded-2xl border border-white/10 bg-black/30 py-3.5 pl-12 pr-4 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-xl shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-400"
                >
                  Pay with M-Pesa {amount != null ? formatCurrency(amount) : ''}
                </button>
                {step === STEPS.ERROR && (
                  <button
                    type="button"
                    onClick={retry}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm text-white/70 hover:bg-white/5"
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
