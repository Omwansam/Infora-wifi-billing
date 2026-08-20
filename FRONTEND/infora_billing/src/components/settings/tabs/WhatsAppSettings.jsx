import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useSettingsChrome } from '../chrome';
import {
  Card, Field, TextInput, Note, NotWired, ProviderTile, StatusPill,
  UnavailableSave,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > WhatsApp — design only.
 *
 * WhatsApp already exists in this codebase, but only one way: the platform
 * sends *your signup OTP* through *our* number (services/whatsapp_otp.py).
 * A tenant sending their own receipts over WhatsApp is a different feature
 * with nothing behind it — no provider row, no send path, no template
 * approval. The list and the drill-down are real navigation; only the saving
 * is absent, and each provider page says so.
 *
 * The credential fields per provider are the ones each vendor actually issues,
 * so if this is built the shape does not have to be renegotiated.
 * ---------------------------------------------------------------------- */

const PROVIDERS = [
  {
    id: 'notiva',
    name: 'Notiva',
    category: 'WhatsApp Business',
    mark: 'N',
    markClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    fields: [
      { name: 'api_key', label: 'API key', secret: true },
      { name: 'sender_number', label: 'Sender number', hint: 'e.g. +254700000000' },
    ],
  },
  {
    id: 'apiwap',
    name: 'Apiwap',
    category: 'WhatsApp Business',
    mark: 'A',
    markClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    fields: [{ name: 'api_key', label: 'API key', secret: true }],
  },
  {
    id: 'infobip',
    name: 'Infobip',
    category: 'Global',
    mark: 'I',
    markClass: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    fields: [
      { name: 'api_key', label: 'API key', secret: true },
      { name: 'base_url', label: 'Base URL', hint: 'e.g. https://xxxxx.api.infobip.com' },
      { name: 'sender_number', label: 'Sender number', hint: 'The number registered with Infobip.' },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'Global',
    mark: 'T',
    markClass: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    fields: [
      { name: 'account_sid', label: 'Account SID' },
      { name: 'auth_token', label: 'Auth token', secret: true },
      { name: 'from', label: 'WhatsApp from', hint: 'e.g. +14155551234' },
    ],
  },
];

function SecretInput({ value, onChange, placeholder }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <TextInput
        type={reveal ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="pr-10"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        tabIndex={-1}
        aria-label={reveal ? 'Hide value' : 'Show value'}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
      >
        {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ProviderDetail({ provider, values, onChange }) {
  return (
    <div className="space-y-6">
      <NotWired>
        Nothing here saves. There is no WhatsApp provider row, no send path and no Meta template
        approval flow — the only WhatsApp in this system today is the signup OTP the platform
        sends from its own number. Until this is built, receipts and reminders go out over SMS.
      </NotWired>

      <Card title="Credentials" description="Would be stored encrypted; edit a field and save to update it.">
        <div className="space-y-5">
          {provider.fields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint}>
              {f.secret ? (
                <SecretInput
                  value={values[f.name] || ''}
                  placeholder="••••••••"
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
              ) : (
                <TextInput
                  value={values[f.name] || ''}
                  spellCheck={false}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>

        <div className="mt-6">
          <Note icon={ShieldCheck} title="Templates are approved on the provider's side" tone="warn">
            <p className="mt-1">
              WhatsApp only delivers pre-registered templates outside a 24-hour reply window, so
              each receipt and reminder would have to be submitted for approval and then matched
              word for word. That approval step is the reason this is a bigger job than an SMS
              gateway.
            </p>
          </Note>
        </div>

        <div className="mt-6">
          <UnavailableSave />
        </div>
      </Card>
    </div>
  );
}

export default function WhatsAppSettings() {
  const { setChrome } = useSettingsChrome();
  const [selectedId, setSelectedId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const provider = useMemo(
    () => PROVIDERS.find((p) => p.id === selectedId) || null,
    [selectedId],
  );

  // Drilling into a provider takes over the header; backing out hands it back.
  useEffect(() => {
    if (!provider) {
      setChrome(null);
      return undefined;
    }
    setChrome({
      icon: provider.mark,
      iconClass: provider.markClass,
      eyebrow: 'WhatsApp provider',
      title: provider.name,
      subtitle: provider.category,
      status: <StatusPill tone="idle">Not connected</StatusPill>,
      onBack: () => setSelectedId(null),
      backLabel: 'All providers',
    });
    return () => setChrome(null);
  }, [provider, setChrome]);

  const setField = (name, value) =>
    setDrafts((d) => ({ ...d, [selectedId]: { ...(d[selectedId] || {}), [name]: value } }));

  if (provider) {
    return (
      <ProviderDetail
        provider={provider}
        values={drafts[provider.id] || {}}
        onChange={setField}
      />
    );
  }

  return (
    <div className="space-y-6">
      <NotWired>
        Nothing on this panel saves. Pick a provider to see exactly which credentials it would
        ask for — that is what this is for. WhatsApp sending is not built; the only WhatsApp here
        today is the signup OTP the platform sends from its own number.
      </NotWired>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <ProviderTile
            key={p.id}
            mark={p.mark}
            markClass={p.markClass}
            name={p.name}
            category={p.category}
            onSelect={() => setSelectedId(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
