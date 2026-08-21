import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, MessageSquare, Send } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { BRAND } from '../../../lib/brand';
import { useSettingsChrome } from '../chrome';
import {
  Card, Field, TextInput, Select, StickySaveBar, StatusPill, ProviderTile,
  LoadingBlock, NotWired, Note, UnavailableSave, PrimaryButton, TestResult,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Communications — the outbound SMS gateway.
 *
 * What is actually true underneath, and why this panel is shaped the way it is:
 *
 *   · services/notification_dispatch.send_sms knows exactly one provider,
 *     africastalking, called over plain HTTP. It resolves this tenant's own
 *     row first and the platform's env config second, so the platform default
 *     is a real always-present route, not a marketing card.
 *   · Africa's Talking is fully wired: credentials saved here are what the
 *     next receipt actually goes out on.
 *   · every other vendor has no code at all.
 *
 * Credential shapes are marked `verified` only where the vendor's API is one
 * we can state with confidence. The rest show the shape these gateways
 * normally use and say it needs confirming — inventing a schema and having it
 * silently be wrong is worse than admitting the gap.
 * ---------------------------------------------------------------------- */

const KEY_AT = 'africastalking';
const MASK = '********';

const F = {
  apiKey: { name: 'api_key', label: 'API key', secret: true, required: true },
  username: { name: 'username', label: 'Username', required: true },
  senderId: { name: 'sender_id', label: 'Sender ID', required: true, hint: 'The alphanumeric or shortcode your messages come from.' },
};

/** The typical Kenyan bulk-SMS shape: username + key + sender id. */
const COMMON = [F.username, F.apiKey, F.senderId];

const PROVIDERS = [
  {
    id: 'africastalking', name: "Africa's Talking", region: 'Pan-African',
    mark: 'AT', markClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
    verified: true, wired: true,
    fields: [
      F.username, F.apiKey, F.senderId,
      {
        name: 'environment', label: 'Environment', select: true,
        options: [['production', 'Production'], ['sandbox', 'Sandbox']],
        hint: 'Sandbox only delivers to numbers registered in your AT simulator.',
      },
    ],
  },
  {
    id: 'twilio', name: 'Twilio', region: 'Global',
    mark: 'T', markClass: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    verified: true,
    fields: [
      { name: 'account_sid', label: 'Account SID', required: true },
      { name: 'auth_token', label: 'Auth token', secret: true, required: true },
      { name: 'from', label: 'From number', required: true, hint: 'e.g. +14155551234' },
    ],
  },
  {
    id: 'infobip', name: 'Infobip', region: 'Global',
    mark: 'I', markClass: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    verified: true,
    fields: [
      F.apiKey,
      { name: 'base_url', label: 'Base URL', required: true, hint: 'e.g. https://xxxxx.api.infobip.com' },
      F.senderId,
    ],
  },
  {
    id: 'textbee', name: 'TextBee', region: 'Global · via Android device',
    mark: 'TB', markClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    verified: true,
    fields: [
      F.apiKey,
      { name: 'device_id', label: 'Device ID', required: true, hint: 'The Android handset that relays the messages.' },
    ],
    note: 'Sends through a phone you own rather than a carrier account — cheap, but it stops when the handset does.',
  },
  { id: 'advanta', name: 'Advanta SMS', region: 'Kenya', mark: 'AS', markClass: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300', fields: COMMON },
  { id: 'beem', name: 'Beem', region: 'East Africa', mark: 'B', markClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300', fields: COMMON },
  { id: 'mobilesasa', name: 'MobileSasa', region: 'Kenya', mark: 'MS', markClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', fields: COMMON },
  { id: 'onfon', name: 'Onfon Media', region: 'Kenya', mark: 'OM', markClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300', fields: COMMON },
  { id: 'talksasa', name: 'TalkSasa', region: 'East Africa', mark: 'TS', markClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', fields: COMMON },
  { id: 'bonga', name: 'Bonga SMS', region: 'Kenya', mark: 'BS', markClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', fields: COMMON },
  { id: 'blessedtexts', name: 'BlessedTexts', region: 'Kenya', mark: 'BT', markClass: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300', fields: COMMON },
  { id: 'bytewave', name: 'Bytewave SMS', region: 'Kenya', mark: 'BW', markClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300', fields: COMMON },
  { id: 'texin', name: 'Texin Bulk SMS', region: 'Kenya', mark: 'TB', markClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', fields: COMMON },
  { id: 'pandora', name: 'Pandora SMS', region: 'East Africa', mark: 'PS', markClass: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300', fields: COMMON },
  { id: 'hostpinnacle', name: 'BulkSMS (Host Pinnacle)', region: 'Kenya', mark: 'HP', markClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300', fields: COMMON },
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

function CredentialFields({ fields, values, onChange }) {
  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <Field key={f.name} label={f.label} hint={f.hint} required={f.required}>
          {f.secret ? (
            <SecretInput
              value={values[f.name] || ''}
              placeholder="••••••••"
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          ) : f.select ? (
            <Select value={values[f.name] || f.options[0][0]} onChange={(e) => onChange(f.name, e.target.value)}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
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
  );
}

/** Test delivery — designed, but there is no send-test route to call. */
function TestDelivery({ dirty }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    setResult(null);
    try {
      setSending(true);
      const res = await settingsService.testIntegration(getAccessToken(), 'africastalking', {
        phone: phone.trim(),
      });
      setResult({
        ok: true,
        detail: res.message,
        via: `${res.source === 'platform' ? 'the platform gateway' : 'your gateway'}${
          res.sender_id ? ` as ${res.sender_id}` : ''
        }`,
      });
    } catch (e) {
      setResult({ ok: false, detail: e.message || 'Send failed' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="Test delivery"
      description="Send a one-off SMS through the credentials that are saved right now."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Phone number" hint="Where the test SMS is sent." className="flex-1">
            <TextInput
              value={phone}
              placeholder="0712345678"
              spellCheck={false}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <PrimaryButton onClick={send} loading={sending} disabled={!phone.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
            Send test SMS
          </PrimaryButton>
        </div>

        {dirty && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You have unsaved changes — the test uses what is saved, not what is on screen. Save
            first to test the new values.
          </p>
        )}

        <TestResult result={result} />
      </div>
    </Card>
  );
}

/* --- Africa's Talking: the one provider whose credentials really save ----- */
function AfricasTalkingDetail({ row, onSaved }) {
  const blank = { username: '', api_key: '', sender_id: '', environment: 'production' };
  const initial = useMemo(() => {
    const next = { ...blank, ...(row?.config || {}) };
    if (next.api_key === MASK) next.api_key = '';
    return next;
  }, [row]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const save = async () => {
    try {
      setSaving(true);
      const config = { ...form };
      if (!config.api_key) delete config.api_key; // blank keeps the stored one
      const res = await settingsService.saveIntegration(getAccessToken(), KEY_AT, {
        enabled: true, config,
      });
      toast.success("Africa's Talking credentials saved");
      onSaved(res.integration);
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Credentials" description="Stored encrypted. Edit a field and save to update it.">
        <CredentialFields fields={PROVIDERS[0].fields} values={form} onChange={set} />
        <div className="mt-5">
          <Note title="This is live once you save" tone="success">
            <p className="mt-1">
              Receipts, expiry reminders and vouchers go out on this account as soon as the
              credentials are saved, with your sender ID on them. Clear the username or key and
              everything falls back to the platform gateway. Send a test below before trusting it
              with a real receipt.
            </p>
          </Note>
        </div>
      </Card>

      <TestDelivery dirty={dirty} />

      <StickySaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setForm(initial)} />
    </div>
  );
}

/* --- Every other vendor: shape only ------------------------------------- */
function UnbuiltDetail({ provider }) {
  const [values, setValues] = useState({});
  return (
    <div className="space-y-6">
      <NotWired>
        Nothing here saves. {provider.name} has no integration in this system —{' '}
        <span className="font-mono">send_sms</span> knows one provider, Africa&apos;s Talking, and
        falls back to logging. This page exists to pin down what building it would need.
      </NotWired>

      <Card title="Credentials" description="Would be stored encrypted; edit a field and save to update it.">
        <CredentialFields
          fields={provider.fields}
          values={values}
          onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))}
        />

        {!provider.verified && (
          <div className="mt-5">
            <Note title="Confirm these fields before building" tone="warn">
              <p className="mt-1">
                This is the shape Kenyan bulk-SMS gateways normally use — a username, an API key
                and a registered sender ID. {provider.name}&apos;s actual API has not been checked,
                so treat the list as a starting point rather than a spec.
              </p>
            </Note>
          </div>
        )}
        {provider.note && (
          <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {provider.note}
          </p>
        )}

        <div className="mt-6">
          <UnavailableSave />
        </div>
      </Card>
    </div>
  );
}

/* --- The platform default ------------------------------------------------ */
function PlatformDetail() {
  return (
    <div className="space-y-6">
      <Card
        title="Platform SMS"
        description={`Messages leave on ${BRAND.name}'s own gateway account. Nothing to configure.`}
      >
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          This is what carries your receipts and reminders today, and it is the fallback whenever
          no gateway of your own is connected. Volume counts against your plan. Connect a provider
          below to send on your own account and your own sender ID instead — useful once you want
          subscribers to see your brand rather than ours on the message.
        </p>
        <div className="mt-5">
          <Note title="Delivery depends on the server's configuration" tone="info">
            <p className="mt-1">
              The platform route is only live where <span className="font-mono">SMS_ENABLED</span>{' '}
              and <span className="font-mono">SMS_PROVIDER</span> are set on the server. Where they
              are not, messages are written to the log instead of sent — which looks identical
              from in here, so check with whoever runs the deployment if a message never arrives.
            </p>
          </Note>
        </div>
      </Card>
    </div>
  );
}

export default function CommunicationsSettings() {
  const { setChrome } = useSettingsChrome();
  const [selectedId, setSelectedId] = useState(null);
  const [atRow, setAtRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getIntegrations(getAccessToken());
      setAtRow((data.integrations || []).find((i) => i.key === KEY_AT) || null);
    } catch (e) {
      toast.error(e.message || 'Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const atConnected = Boolean(atRow?.enabled && atRow?.config?.username);

  const provider = useMemo(
    () => (selectedId === 'platform' ? null : PROVIDERS.find((p) => p.id === selectedId) || null),
    [selectedId],
  );
  const onPlatform = selectedId === 'platform';

  useEffect(() => {
    if (!provider && !onPlatform) {
      setChrome(null);
      return undefined;
    }
    const connected = provider ? provider.id === 'africastalking' && atConnected : true;
    setChrome({
      icon: provider ? provider.mark : MessageSquare,
      iconClass: provider
        ? provider.markClass
        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      eyebrow: 'SMS provider',
      title: provider ? provider.name : `${BRAND.name} SMS`,
      subtitle: provider ? provider.region : 'Kenya · platform default',
      status: (
        <StatusPill tone={connected ? 'connected' : 'idle'}>
          {onPlatform ? 'Active' : connected ? 'Connected' : 'Not connected'}
        </StatusPill>
      ),
      onBack: () => setSelectedId(null),
      backLabel: 'All providers',
    });
    return () => setChrome(null);
  }, [provider, onPlatform, atConnected, setChrome]);

  if (loading) return <LoadingBlock />;

  if (onPlatform) return <PlatformDetail />;
  if (provider) {
    return provider.wired ? (
      <AfricasTalkingDetail row={atRow} onSaved={setAtRow} />
    ) : (
      <UnbuiltDetail provider={provider} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProviderTile
          mark={<MessageSquare className="h-5 w-5" />}
          markClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
          name={
            <>
              {BRAND.name} SMS{' '}
              <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                Active
              </span>
            </>
          }
          category="Kenya · platform default"
          actionLabel="Manage"
          active
          onSelect={() => setSelectedId('platform')}
        />
        {PROVIDERS.map((p) => (
          <ProviderTile
            key={p.id}
            mark={p.mark}
            markClass={p.markClass}
            name={p.name}
            category={p.region}
            onSelect={() => setSelectedId(p.id)}
          />
        ))}
      </div>

      <NotWired>
        Africa&apos;s Talking is the only vendor with code behind it — connect it and your messages
        really do leave on your own account. Every other card opens the credential shape that
        building it would need, but cannot send. Anything not connected falls back to the{' '}
        {BRAND.name} default above.
      </NotWired>
    </div>
  );
}
