import React, { useEffect, useState } from 'react';
import { Gauge, Gift, MessageSquare } from 'lucide-react';
import Modal, { CancelButton, ConfirmButton } from './Modal';
import { INPUT } from '../parts';

/* The smaller dialogs behind the ⋯ menu. Each states plainly what it will do to
   the account, because none of them are reversible by closing the dialog. */

export function SendSmsModal({ open, onClose, onSubmit, client, saving }) {
  const [message, setMessage] = useState('');

  useEffect(() => { if (open) setMessage(''); }, [open]);

  // GSM-7 segments at 160 chars, then 153 per part once concatenated. Showing
  // the count matters because each segment is separately billed.
  const length = message.length;
  const segments = length === 0 ? 0 : length <= 160 ? 1 : Math.ceil(length / 153);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={MessageSquare}
      title="Send SMS"
      description={client?.phone
        ? `To ${client.phone}`
        : 'This subscriber has no phone number on file.'}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton
            onClick={() => onSubmit(message.trim())}
            disabled={!message.trim() || !client?.phone}
            busy={saving}
          >
            Send
          </ConfirmButton>
        </>
      }
    >
      <div className="text-left">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          placeholder="Type the message…"
          disabled={!client?.phone}
          className={`${INPUT} resize-y`}
        />
        <p className="mt-2 flex justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>{length} character{length === 1 ? '' : 's'}</span>
          <span>{segments} SMS segment{segments === 1 ? '' : 's'}</span>
        </p>
      </div>
    </Modal>
  );
}

export function CompensateModal({ open, onClose, onSubmit, client, saving }) {
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDays(1); setReason(''); setNotify(true);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Gift}
      title="Compensate"
      description={`Give ${client?.name || 'this subscriber'} service time back after an outage.`}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton
            onClick={() => onSubmit({ days: Number(days), reason: reason.trim(), notify })}
            disabled={!(Number(days) > 0)}
            busy={saving}
          >
            Add {Number(days) || 0} day{Number(days) === 1 ? '' : 's'}
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        <div>
          <label htmlFor="comp-days" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Days to add
          </label>
          <input
            id="comp-days"
            type="number" min="0.5" step="0.5" max="365"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="comp-reason" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Reason
          </label>
          <input
            id="comp-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Fibre cut on the Ngong line"
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Recorded on the subscriber's package history, so the next operator can see why
            the expiry moved.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">Text them the new expiry</span>
        </label>
      </div>
    </Modal>
  );
}

export function FupOverrideModal({ open, onClose, onSubmit, fup, saving }) {
  const [days, setDays] = useState(30);
  useEffect(() => { if (open) setDays(30); }, [open]);

  const exempt = Boolean(fup?.exempt_until);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Gauge}
      tone="warning"
      title={exempt ? 'Remove FUP override' : 'Override fair use'}
      description={exempt
        ? 'Put this account back under the package\'s fair-use policy.'
        : 'Release this account from fair-use throttling for a set period.'}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton
            tone="warning"
            busy={saving}
            onClick={() => onSubmit(exempt
              ? { action: 'enforce' }
              : { action: 'release', days: Number(days) || 30 })}
          >
            {exempt ? 'Re-apply policy' : 'Release from throttle'}
          </ConfirmButton>
        </>
      }
    >
      <div className="space-y-4 text-left">
        {exempt ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Fair-use enforcement resumes immediately. If the account is already over its
            allowance, the next enforcement pass will throttle it again.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="fup-days" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Exempt for
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="fup-days"
                  type="number" min="1" max="365"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className={INPUT}
                />
                <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">days</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The account returns to full plan speed now and the scheduler will leave it
              alone until the window ends — without the window, the next enforcement pass
              would simply throttle it again.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ConfirmModal({
  open, onClose, onConfirm, icon, tone = 'critical', title, description, body, confirmLabel, saving,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={icon}
      tone={tone}
      title={title}
      description={description}
      footer={
        <>
          <CancelButton onClick={onClose} disabled={saving} />
          <ConfirmButton tone={tone} onClick={onConfirm} busy={saving}>
            {confirmLabel}
          </ConfirmButton>
        </>
      }
    >
      <p className="text-left text-sm text-slate-600 dark:text-slate-300">{body}</p>
    </Modal>
  );
}
