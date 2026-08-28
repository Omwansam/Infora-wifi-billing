import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, CalendarClock, FileText, Gift, KeyRound, MessageSquare,
  Pause, Trash2, User, Wallet,
} from 'lucide-react';
import Modal, { CancelButton, ConfirmButton } from './Modal';
import {
  Consequence, Field, MessagePreview, SecretRow, Select, SummaryCard, TextInput, Toggle,
} from './fields';
import { formatCurrency } from '../../../../lib/utils';

/* -------------------------------------------------------------------------
 * The dialogs behind the ⋯ menu.
 *
 * Each one leads with what is about to happen — a summary card or the literal
 * SMS — then the controls, then the consequence in words. None of these actions
 * is undone by closing the dialog, so the confirm button is never the first
 * place the operator learns what it does.
 * ---------------------------------------------------------------------- */

// --- Compensate -----------------------------------------------------------

/* Outages are measured in whatever unit they actually lasted. Offering only
   days forces "0.002 days" for a three-minute drop, so the wire unit is
   minutes and the picker speaks human. */
const DURATIONS = [
  { value: 3, label: '3 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
  { value: 4320, label: '3 days' },
  { value: 10080, label: '7 days' },
  { value: 43200, label: '30 days' },
];

function humaniseMinutes(minutes) {
  if (!minutes) return '—';
  if (minutes % 1440 === 0) { const d = minutes / 1440; return `${d} day${d === 1 ? '' : 's'}`; }
  if (minutes % 60 === 0) { const h = minutes / 60; return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function CompensateModal({ open, onClose, onSubmit, client, subscription, saving }) {
  const [minutes, setMinutes] = useState(60);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinutes(60); setReason(''); setNotify(false);
  }, [open]);

  // Compensation stacks onto a future expiry and counts from now once lapsed —
  // the same rule the server applies, shown so the two cannot disagree.
  const newExpiry = useMemo(() => {
    const base = subscription?.expires_at ? new Date(subscription.expires_at) : new Date();
    const from = base > new Date() ? base : new Date();
    return new Date(from.getTime() + minutes * 60000);
  }, [subscription, minutes]);

  return (
    <Modal
      open={open} onClose={onClose} icon={Gift} title="Compensate"
      description={`Give ${client?.name || 'this subscriber'} service time back after an outage.`}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton
            busy={saving}
            onClick={() => onSubmit({ minutes, reason: reason.trim(), notify })}
          >
            Add {humaniseMinutes(minutes)}
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <SummaryCard
          badge="1"
          value={client?.name}
          caption="subscriber"
          result={`+${humaniseMinutes(minutes)}`}
          resultCaption="added to expiry"
        />

        <Field label="Compensation duration" required htmlFor="comp-duration">
          <Select
            id="comp-duration" value={String(minutes)}
            onChange={(v) => setMinutes(Number(v))}
            options={DURATIONS.map((d) => ({ value: String(d.value), label: d.label }))}
          />
        </Field>

        <Field label="Reason" htmlFor="comp-reason"
               hint="Recorded on the package history, so the next operator can see why the expiry moved.">
          <TextInput id="comp-reason" value={reason} onChange={setReason}
                     placeholder="Fibre cut on the Ngong line" />
        </Field>

        <Consequence>
          Expiry moves to{' '}
          <strong className="font-semibold text-slate-800 dark:text-slate-100">
            {newExpiry.toLocaleString(undefined, {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </strong>
          . Time is added on top of whichever is later — now, or the current expiry.
        </Consequence>

        <Toggle checked={notify} onChange={setNotify}
                label="Notify by SMS" hint="Let them know their service is back." />
      </div>
    </Modal>
  );
}

// --- Send credentials -----------------------------------------------------

export function SendCredentialsModal({ open, onClose, onSubmit, client, preview, loading, saving }) {
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(preview?.body || ''); }, [preview, open]);

  const blocked = preview?.error || !client?.phone;

  return (
    <Modal
      open={open} onClose={onClose} icon={KeyRound} title="Send credentials"
      description={client?.phone
        ? <>Review the login below, then deliver it to <strong className="font-semibold text-slate-700 dark:text-slate-200">{client.phone}</strong>.</>
        : 'This subscriber has no phone number on file.'}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton busy={saving} disabled={blocked || !message.trim()}
                         onClick={() => onSubmit(message.trim())}>
            Send credentials
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        {preview?.error ? (
          <Consequence tone="warning">{preview.error}</Consequence>
        ) : (
          <>
            <SecretRow icon={User} label="Username" value={preview?.username} />
            <SecretRow icon={KeyRound} label="Password" value={preview?.password} secret />
          </>
        )}

        <Field label="Message preview">
          <MessagePreview value={message} onChange={setMessage} loading={loading}
                          error={preview?.error ? 'Nothing to send yet.' : null} />
        </Field>

        <Consequence tone="warning">
          The password goes out in the clear over SMS. What we file on the subscriber's
          record is only that credentials were sent — never the password itself.
        </Consequence>
      </div>
    </Modal>
  );
}

// --- Send payment details -------------------------------------------------

export function SendPaymentDetailsModal({ open, onClose, onSubmit, client, preview, loading, saving }) {
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(preview?.body || ''); }, [preview, open]);

  const unconfigured = preview?.collection_route === 'unconfigured';

  return (
    <Modal
      open={open} onClose={onClose} icon={Wallet} title="Send payment details"
      description={client?.phone
        ? <><strong className="font-semibold text-slate-700 dark:text-slate-200">{client.name}</strong> will receive this SMS at {client.phone}.</>
        : 'This subscriber has no phone number on file.'}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton busy={saving} disabled={!client?.phone || !message.trim()}
                         onClick={() => onSubmit(message.trim())}>
            Send payment details
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        {preview?.reference && (
          <SummaryCard
            value={preview.reference}
            caption="payment reference"
            result={preview.amount ? formatCurrency(preview.amount) : '—'}
            resultCaption="due"
          />
        )}

        <Field label="Message preview">
          <MessagePreview value={message} onChange={setMessage} loading={loading} />
        </Field>

        {unconfigured && (
          <Consequence tone="warning">
            No collection route is set up under Settings → Payments, so the message cannot
            name a paybill or till. Add one and this will fill itself in.
          </Consequence>
        )}
      </div>
    </Modal>
  );
}

// --- FUP override ---------------------------------------------------------

const FUP_MODES = [
  { value: 'inherit', label: 'Inherit package policy',
    blurb: 'No override. Fair use behaves exactly as the package defines it.' },
  { value: 'exempt', label: 'Exempt — suspend FUP for this user',
    blurb: 'Never throttled, however much they use. Full plan speed at all times.' },
  { value: 'throttle', label: 'Throttle — rate-limit past the cap',
    blurb: 'Slowed to the package’s throttled speed past the cap, even if the package would not.' },
  { value: 'disconnect', label: 'Disconnect — drop past the cap',
    blurb: 'The session is dropped past the cap rather than slowed. They must wait for the reset.' },
];

const FUP_WINDOWS = [
  { value: '0', label: 'Until removed by hand' },
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export function FupOverrideModal({ open, onClose, onSubmit, fup, saving }) {
  const [mode, setMode] = useState('inherit');
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode(fup?.override_mode || 'inherit');
    setReason(fup?.override_reason || '');
    setDays(fup?.override_until ? '30' : '0');
  }, [open, fup]);

  const selected = FUP_MODES.find((m) => m.value === mode);
  const dirty = mode !== (fup?.override_mode || 'inherit') || reason !== (fup?.override_reason || '');

  return (
    <Modal
      open={open} onClose={onClose} icon={AlertTriangle} tone="warning" title="FUP override"
      description="Use overrides sparingly — for when support needs to bypass or force this subscriber's fair-use behaviour."
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone="warning" busy={saving} disabled={!dirty}
                         onClick={() => onSubmit({ mode, reason: reason.trim(), days: Number(days) || null })}>
            Apply override
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <Field label="Override mode" required htmlFor="fup-mode">
          <Select id="fup-mode" value={mode} onChange={setMode}
                  options={FUP_MODES.map((m) => ({ value: m.value, label: m.label }))} />
        </Field>

        {selected && (
          <Consequence tone={mode === 'inherit' ? 'neutral' : mode === 'disconnect' ? 'critical' : 'warning'}>
            {selected.blurb}
          </Consequence>
        )}

        {mode !== 'inherit' && (
          <Field label="Override lasts" htmlFor="fup-days"
                 hint="An override with no end date quietly becomes policy. Prefer a window.">
            <Select id="fup-days" value={days} onChange={setDays} options={FUP_WINDOWS} />
          </Field>
        )}

        <Field label="Reason" htmlFor="fup-reason">
          <textarea
            id="fup-reason" value={reason} rows={3} maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this override being applied?"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {reason.length} / 500 characters · saved with the override.
          </p>
        </Field>
      </div>
    </Modal>
  );
}

// --- Pause ----------------------------------------------------------------

/** `datetime-local` wants 'YYYY-MM-DDTHH:mm' in local time. */
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PauseModal({ open, onClose, onSubmit, client, subscription, saving }) {
  const [autoResume, setAutoResume] = useState(false);
  const [until, setUntil] = useState('');
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAutoResume(false);
    setNotify(false);
    const week = new Date(Date.now() + 7 * 86400000);
    setUntil(toLocalInput(week));
  }, [open]);

  const banked = subscription?.days_remaining > 0 ? subscription.days_remaining : 0;

  return (
    <Modal
      open={open} onClose={onClose} icon={Pause} tone="warning" title="Pause subscription"
      description={`${client?.name || 'This subscriber'} won't be able to connect while paused, and the subscription clock stops ticking.`}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone="warning" busy={saving}
                         onClick={() => onSubmit({
                           pause_until: autoResume && until ? new Date(until).toISOString() : null,
                           notify,
                         })}>
            Pause subscription
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <SummaryCard
          tone="warning"
          value={banked ? `${banked} day${banked === 1 ? '' : 's'}` : 'No days left'}
          caption="currently remaining"
          result={banked ? 'banked' : '—'}
          resultCaption={banked ? 'returned on resume' : 'nothing to bank'}
        />

        <Toggle
          checked={autoResume} onChange={setAutoResume}
          label="Resume automatically"
          hint="Otherwise the subscription stays paused until an operator resumes it."
        />

        {autoResume && (
          <Field label="Resume on" htmlFor="pause-until">
            <TextInput id="pause-until" type="datetime-local" value={until} onChange={setUntil} />
          </Field>
        )}

        <Consequence>
          {banked
            ? <>Those {banked} day{banked === 1 ? '' : 's'} are banked now and handed back in full when the subscription resumes, so the pause costs them nothing. Use <strong className="font-semibold">Block</strong> instead if the clock should keep running.</>
            : <>There are no remaining days to bank. Pausing removes RADIUS access until the subscription resumes.</>}
        </Consequence>

        <Toggle checked={notify} onChange={setNotify}
                label="Send SMS notification" hint="Let the subscriber know their internet is paused." />
      </div>
    </Modal>
  );
}

// --- Generate invoice -----------------------------------------------------

export function InvoiceModal({ open, onClose, onSubmit, client, plan, saving }) {
  const [amount, setAmount] = useState('');
  const [dueDays, setDueDays] = useState('7');

  useEffect(() => {
    if (!open) return;
    setAmount(plan?.price != null ? String(plan.price) : '');
    setDueDays('7');
  }, [open, plan]);

  const value = Number(amount) || 0;

  return (
    <Modal
      open={open} onClose={onClose} icon={FileText} tone="info" title="Generate invoice"
      description={`Raise an invoice against ${client?.name || 'this subscriber'}'s account.`}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton busy={saving} disabled={value <= 0}
                         onClick={() => onSubmit({ amount: value, due_days: Number(dueDays) || 0 })}>
            Generate invoice
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <SummaryCard
          value={value > 0 ? formatCurrency(value) : '—'}
          caption={plan?.name ? `${plan.name} subscription` : 'Internet service'}
          result={`${dueDays || 0}d`}
          resultCaption="payment terms"
        />
        <Field label="Amount" required htmlFor="inv-amount">
          <TextInput id="inv-amount" type="number" min="0" step="1" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Due in" htmlFor="inv-due">
          <Select id="inv-due" value={dueDays} onChange={setDueDays} options={[
            { value: '0', label: 'Due immediately' }, { value: '3', label: '3 days' },
            { value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' },
          ]} />
        </Field>
      </div>
    </Modal>
  );
}

// --- Block / Delete -------------------------------------------------------

export function BlockModal({ open, onClose, onSubmit, client, subscription, saving }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} icon={Ban} tone="critical" title="Block subscriber"
      description="An enforcement action, not a pause."
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone="critical" busy={saving}
                         onClick={() => onSubmit(reason.trim() || 'Blocked by operator')}>
            Block subscriber
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <SummaryCard
          tone="critical"
          value={client?.name}
          caption="loses access immediately"
          result={subscription?.label || '—'}
          resultCaption="clock keeps running"
        />
        <Field label="Reason" htmlFor="block-reason"
               hint="Kept on the account history so the block can be explained later.">
          <TextInput id="block-reason" value={reason} onChange={setReason}
                     placeholder="Non-payment after two reminders" />
        </Field>
        <Consequence tone="critical">
          The subscription is <strong className="font-semibold">not</strong> extended — they will
          still expire on schedule while blocked. Use <strong className="font-semibold">Pause</strong> if
          the days should be given back.
        </Consequence>
      </div>
    </Modal>
  );
}

export function DeleteModal({ open, onClose, onSubmit, client, saving }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);

  // Typing the username is the only irreversible confirmation on this page.
  // A misfired click on a red button should not be able to erase an account.
  const expected = client?.radius_username || client?.name || '';
  const matches = typed.trim().toLowerCase() === String(expected).toLowerCase();

  return (
    <Modal
      open={open} onClose={onClose} icon={Trash2} tone="critical" title="Delete subscriber"
      description="This cannot be undone."
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone="critical" busy={saving} disabled={!matches} onClick={onSubmit}>
            Delete subscriber
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <Consequence tone="critical">
          Permanently removes <strong className="font-semibold">{client?.name}</strong>, their RADIUS
          credentials, sessions, devices, notes and account history. Payments and invoices are kept
          for accounting.
        </Consequence>
        <Field label={<>Type <span className="font-mono font-semibold">{expected}</span> to confirm</>}
               htmlFor="del-confirm">
          <TextInput id="del-confirm" value={typed} onChange={setTyped} placeholder={expected} />
        </Field>
      </div>
    </Modal>
  );
}

// --- Plain SMS ------------------------------------------------------------

export function SendSmsModal({ open, onClose, onSubmit, client, saving }) {
  const [message, setMessage] = useState('');
  useEffect(() => { if (open) setMessage(''); }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} icon={MessageSquare} title="Send SMS"
      description={client?.phone
        ? <>Goes to <strong className="font-semibold text-slate-700 dark:text-slate-200">{client.phone}</strong>.</>
        : 'This subscriber has no phone number on file.'}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton busy={saving} disabled={!message.trim() || !client?.phone}
                         onClick={() => onSubmit(message.trim())}>
            Send
          </ConfirmButton>
        </>
      }
    >
      <Field label="Message">
        <MessagePreview value={message} onChange={setMessage} />
      </Field>
    </Modal>
  );
}

// --- Generic confirm (resume, unblock) ------------------------------------

export function ConfirmModal({
  open, onClose, onConfirm, icon = CalendarClock, tone = 'accent',
  title, description, body, confirmLabel, saving,
}) {
  return (
    <Modal
      open={open} onClose={onClose} icon={icon} tone={tone} title={title} description={description}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone={tone} onClick={onConfirm} busy={saving}>{confirmLabel}</ConfirmButton>
        </>
      }
    >
      <p className="text-left text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
    </Modal>
  );
}
