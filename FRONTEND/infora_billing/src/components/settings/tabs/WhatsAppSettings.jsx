import React, { useState } from 'react';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import { Card, Field, TextInput, Select, Toggle, Note, NotWired, UnavailableSave } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > WhatsApp — design only.
 *
 * WhatsApp already exists in this codebase, but only one way: the platform
 * sends a signup OTP through it (services/whatsapp_otp.py). That is our number
 * and our account. A tenant sending *their own* receipts and reminders over
 * WhatsApp is a different integration that does not exist — no provider row,
 * no send path, no template approval flow. The note below says so rather than
 * letting the OTP feature imply this one works.
 * ---------------------------------------------------------------------- */

const PROVIDERS = [
  ['meta', 'Meta WhatsApp Cloud API'],
  ['twilio', 'Twilio'],
  ['360dialog', '360dialog'],
];

const TEMPLATES = [
  ['payment_received', 'Payment received', 'Receipt with the amount, plan and new expiry date.'],
  ['expiry_reminder', 'Expiry reminder', 'Sent a configurable number of days before a subscription lapses.'],
  ['voucher_issued', 'Voucher issued', 'The code itself, plus how long it lasts.'],
];

export default function WhatsAppSettings() {
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('meta');
  const [enabled, setEnabled] = useState({
    payment_received: true,
    expiry_reminder: true,
    voucher_issued: false,
  });

  return (
    <div className="space-y-6">
      <NotWired>
        Nothing on this panel saves. WhatsApp is currently used one way only — the platform sends
        your signup OTP through its own number. Sending <em>your</em> receipts and reminders over
        WhatsApp needs a provider row, a send path and Meta template approval, none of which exist
        yet. Until then, receipts and reminders go out over SMS and email.
      </NotWired>

      <div className="space-y-6">
          <Card
            title="Gateway"
            description="The business number subscribers would receive messages from"
          >
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Send over WhatsApp
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Falls back to SMS whenever a number has no WhatsApp account.
                  </p>
                </div>
              </div>
              <Toggle checked={sending} onChange={setSending} />
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Provider">
                <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  {PROVIDERS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Business phone number" hint="In full international form.">
                <TextInput placeholder="+254700000000" />
              </Field>
              <Field label="Phone number ID">
                <TextInput placeholder="From your provider's dashboard" />
              </Field>
              <Field label="Business account ID">
                <TextInput placeholder="WABA ID" />
              </Field>
              <Field
                label="Access token"
                hint="Would be encrypted at rest and returned masked."
                className="md:col-span-2"
              >
                <TextInput type="password" placeholder="Permanent access token" />
              </Field>
            </div>
          </Card>

          <Card
            title="Approved templates"
            description="WhatsApp only delivers pre-approved templates outside a 24-hour reply window"
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {TEMPLATES.map(([key, name, detail]) => (
                <div key={key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{detail}</p>
                  </div>
                  <Toggle
                    checked={!!enabled[key]}
                    onChange={(v) => setEnabled((e) => ({ ...e, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Note icon={ShieldCheck} title="Template approval is on Meta's side" tone="warn">
                <p className="mt-1">
                  Each template has to be submitted and approved in your WhatsApp Business account
                  before it can be sent. Approval usually takes minutes but can be rejected — the
                  wording would need to match what you registered, exactly.
                </p>
              </Note>
            </div>

            <div className="mt-6">
              <UnavailableSave />
            </div>
          </Card>
      </div>
    </div>
  );
}
