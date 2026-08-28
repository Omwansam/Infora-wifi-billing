import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import Modal, { CancelButton, ConfirmButton } from './Modal';
import { INPUT } from '../parts';
import { formatCurrency } from '../../../../lib/utils';

/* -------------------------------------------------------------------------
 * Set when the subscription ends — the single most-used action on this page.
 *
 * Three ways to say the same thing, because operators arrive with three
 * different intents: a quick extension ("give them another week"), an exact
 * date ("their invoice runs to the 30th"), and a package switch ("they've
 * upgraded"). All three post to the same endpoint.
 * ---------------------------------------------------------------------- */

const QUICK = [
  { key: '1h', label: '+1 hr' },
  { key: '1d', label: '+1 day' },
  { key: '7d', label: '+7 days' },
  { key: '1mo', label: '+1 mo' },
];

/** `datetime-local` wants 'YYYY-MM-DDTHH:mm' in local time. */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ChangeExpiryModal({
  open, onClose, onSubmit, client, subscription, plans = [], saving,
}) {
  const [expiry, setExpiry] = useState('');
  const [planId, setPlanId] = useState('');
  const [graceDays, setGraceDays] = useState(0);
  const [notify, setNotify] = useState(true);
  const [quick, setQuick] = useState(null);

  useEffect(() => {
    if (!open) return;
    setExpiry(toLocalInput(subscription?.expires_at));
    setPlanId(client?.service_plan?.id ? String(client.service_plan.id) : '');
    setGraceDays(subscription?.grace_days ?? 0);
    setNotify(true);
    setQuick(null);
  }, [open, subscription, client]);

  const submit = () => {
    const payload = { graceDays: Number(graceDays) || 0, notify };
    if (quick) {
      payload.extend = quick;
    } else if (expiry) {
      // datetime-local has no zone; the browser's own offset is the operator's
      // intent, and the server converts to the UTC the column stores.
      payload.expiry = new Date(expiry).toISOString();
    }
    if (planId && String(planId) !== String(client?.service_plan?.id || '')) {
      payload.planId = Number(planId);
    }
    onSubmit(payload);
  };

  const selectedPlan = plans.find((plan) => String(plan.id) === String(planId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={CalendarClock}
      title="Change expiry"
      description={`Set when ${client?.name || 'this subscriber'}'s subscription should end.`}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton onClick={submit} busy={saving}>Save expiry</ConfirmButton>
        </>
      }
    >
      <div className="space-y-5 text-left">
        <div>
          <label htmlFor="expiry-date" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Expiry date
          </label>
          <input
            id="expiry-date"
            type="datetime-local"
            value={expiry}
            disabled={Boolean(quick)}
            onChange={(event) => { setExpiry(event.target.value); setQuick(null); }}
            className={INPUT}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Or extend by</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setQuick(quick === option.key ? null : option.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  quick === option.key
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            An extension stacks onto a future expiry, and counts from today once it has lapsed.
          </p>
        </div>

        <div>
          <label htmlFor="expiry-plan" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Package <span className="font-normal text-slate-400">· optional</span>
          </label>
          <select
            id="expiry-plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className={INPUT}
          >
            <option value="">Keep current package</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.speed} · {formatCurrency(plan.price)}
              </option>
            ))}
          </select>
          {selectedPlan && String(selectedPlan.id) !== String(client?.service_plan?.id || '') && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              Switching package re-provisions RADIUS at {selectedPlan.speed}.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="expiry-grace" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Grace period <span className="font-normal text-slate-400">· optional</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="expiry-grace"
              type="number"
              min="0"
              max="90"
              value={graceDays}
              onChange={(event) => setGraceDays(event.target.value)}
              className={INPUT}
            />
            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">days</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {Number(graceDays) > 0
              ? `Access continues for ${graceDays} day${Number(graceDays) === 1 ? '' : 's'} past the expiry.`
              : 'No grace — access stops at the expiry.'}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Text the subscriber their new expiry date
            <span className="block text-xs text-slate-400 dark:text-slate-500">
              Uses the "Expiry date changed" template from Settings.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
