import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertCircle, ArrowUpRight, CreditCard, Loader2, Lock, RefreshCw, X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import platformSubscriptionService from '../../services/platformSubscriptionService';
import { BRAND } from '../../lib/brand';

const STATUS_TONE = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  void: 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800',
};

function money(amount, currency) {
  const value = Number(amount || 0);
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeDays(iso) {
  if (!iso) return '';
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  const past = Math.abs(days);
  return `${past} day${past === 1 ? '' : 's'} ago`;
}

/** The headline figure: days remaining, or the word that replaces it. */
function daysLeftDisplay(subscription) {
  if (!subscription?.expires_at) return { value: 'Unlimited', hint: 'no expiry set' };
  const left = subscription.days_left;
  if (left === null || left === undefined) return { value: '—', hint: '' };
  if (left < 0) return { value: 'Expired', hint: 'platform subscription' };
  if (left === 0) return { value: 'Today', hint: 'expires today' };
  return { value: `${left} day${left === 1 ? '' : 's'}`, hint: 'platform subscription' };
}

function StatCell({ label, value, hint, tone = '' }) {
  return (
    <div className="flex-1 px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white ${tone}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function PayDialog({ invoice, defaultPhone, onClose, onSent }) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!phone.trim()) {
      toast.error('Enter the M-Pesa number to prompt');
      return;
    }
    setSending(true);
    try {
      const result = await platformSubscriptionService.payInvoice(invoice.id, phone.trim());
      toast.success(result?.delivery?.note || 'Payment prompt sent');
      onSent(invoice);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not send the prompt');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Pay {money(invoice.amount, invoice.currency)}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            An M-Pesa prompt goes to this number for invoice{' '}
            <span className="font-mono text-slate-700 dark:text-slate-200">{invoice.number}</span>.
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              M-Pesa number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            onClick={submit}
            disabled={sending}
            className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Send prompt
          </button>
          <p className="text-center text-xs text-slate-400">
            Nothing is charged until you enter your PIN on the phone.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PlatformSubscriptionPage() {
  const { user } = useAuth();
  const { refresh: refreshGate } = useSubscription();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [awaiting, setAwaiting] = useState(null);
  const [openingPdf, setOpeningPdf] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await platformSubscriptionService.get());
    } catch (error) {
      toast.error(error.message || 'Could not load your subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const subscription = data?.subscription;
  const invoices = data?.invoices || [];
  const currency = subscription?.currency || 'KES';
  const canPay = Boolean(data?.can_pay);
  const platformName = subscription?.platform_name || BRAND.companyName;

  const openInvoice = useMemo(
    () => invoices.find((i) => i.status === 'pending') || null,
    [invoices],
  );

  // The callback settles the invoice, not the push — so poll until the backend
  // says it is paid rather than assuming the prompt succeeded.
  const startPolling = useCallback((invoice) => {
    setAwaiting(invoice.id);
    clearInterval(pollRef.current);
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 180_000) {
        clearInterval(pollRef.current);
        setAwaiting(null);
        return;
      }
      try {
        const result = await platformSubscriptionService.invoiceStatus(invoice.id);
        if (result?.invoice?.status === 'paid') {
          clearInterval(pollRef.current);
          setAwaiting(null);
          toast.success('Payment received — access restored');
          await load();
          await refreshGate();
        }
      } catch {
        // Transient failure; the next tick tries again.
      }
    }, 4000);
  }, [load, refreshGate]);

  const openPdf = async (invoice) => {
    setOpeningPdf(invoice.id);
    try {
      await platformSubscriptionService.openInvoiceDocument(invoice.id);
    } catch (error) {
      toast.error(error.message || 'Could not open the invoice');
    } finally {
      setOpeningPdf(null);
    }
  };

  const daysLeft = daysLeftDisplay(subscription);
  const amountDue = subscription?.amount_due || 0;
  const locked = Boolean(subscription?.locked);

  return (
    <div className="min-h-full bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Billing <span className="mx-1.5">—</span> Subscription
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Your <span className="text-orange-500">subscription.</span>
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Your {platformName} platform subscription — every invoice in one place,
                pay the open ones in a click.
              </p>
            </div>
            {canPay && openInvoice && (
              <button
                onClick={() => setPaying(openInvoice)}
                className="inline-flex shrink-0 items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pay {money(amountDue || openInvoice.amount, currency)}
              </button>
            )}
          </div>
        </motion.div>

        {locked && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div className="text-sm">
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                The rest of the console is locked
              </p>
              <p className="mt-0.5 text-orange-800 dark:text-orange-300">
                {canPay
                  ? 'Settle the open invoice below and every page unlocks immediately. Your network keeps running throughout — subscribers, RADIUS and the captive portal are unaffected.'
                  : 'Ask an administrator on this account to settle the open invoice. Your network keeps running throughout.'}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your subscription…
          </div>
        ) : !subscription ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">No subscription on file</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              This account is not linked to a tenant, so there is nothing to bill.
            </p>
          </div>
        ) : (
          <>
            {/* Stat strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-7 flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:divide-x sm:divide-y-0"
            >
              <StatCell
                label="Expires"
                value={shortDate(subscription.expires_at)}
                hint={subscription.expires_at ? relativeDays(subscription.expires_at) : 'not set'}
              />
              <StatCell
                label="Days left"
                value={daysLeft.value}
                hint={subscription.is_trial && !subscription.expired ? 'free trial' : daysLeft.hint}
                tone={subscription.expired ? 'text-slate-900 dark:text-white' : ''}
              />
              <StatCell
                label="Amount due"
                value={money(amountDue, currency)}
                hint={amountDue > 0 ? 'outstanding' : 'nothing outstanding'}
              />
            </motion.div>

            {/* Invoices */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 rounded-2xl border border-slate-200 bg-slate-100/60 p-3 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-start justify-between gap-4 px-3 pb-3 pt-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Invoices</h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Every platform-subscription invoice, newest first. Unpaid invoices can be settled here.
                  </p>
                </div>
                <button
                  onClick={load}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"
                  title="Reload"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                        <th className="px-5 py-3 font-semibold">Invoice</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Amount</th>
                        <th className="px-5 py-3 font-semibold">Due</th>
                        <th className="px-5 py-3 font-semibold">Paid</th>
                        <th className="px-5 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                            No invoices yet.
                          </td>
                        </tr>
                      ) : invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-4 font-mono text-[13px] font-medium text-slate-900 dark:text-white">
                            {invoice.number}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_TONE[invoice.status] || STATUS_TONE.pending}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {money(invoice.amount, invoice.currency)}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {shortDate(invoice.due_at)}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {invoice.paid_at ? shortDate(invoice.paid_at) : '—'}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {invoice.status === 'pending' && canPay && (
                                <button
                                  onClick={() => setPaying(invoice)}
                                  disabled={awaiting === invoice.id}
                                  className="inline-flex items-center rounded-full bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
                                >
                                  {awaiting === invoice.id ? (
                                    <>
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Waiting
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Pay
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => openPdf(invoice)}
                                disabled={openingPdf === invoice.id}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {openingPdf === invoice.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <>PDF <ArrowUpRight className="ml-0.5 h-3 w-3" /></>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {invoices.length > 0 && (
                  <div className="border-t border-slate-100 py-3.5 text-center text-sm text-slate-400 dark:border-slate-800">
                    {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </motion.section>

            {awaiting && (
              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for the M-Pesa confirmation — you can leave this page open.
              </p>
            )}
          </>
        )}

        <p className="mt-12 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          © {new Date().getFullYear()} {platformName} Technologies
        </p>
      </div>

      {paying && (
        <PayDialog
          invoice={paying}
          defaultPhone={data?.tenant?.phone || user?.phone || ''}
          onClose={() => setPaying(null)}
          onSent={startPolling}
        />
      )}
    </div>
  );
}
