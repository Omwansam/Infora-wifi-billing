import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, MessageCircle, MessageSquare, Send } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { BRAND } from '../../../lib/brand';
import { useSettingsChrome } from '../chrome';
import {
  Card, Field, TextInput, Textarea, Select, StickySaveBar, StatusPill,
  ProviderTile, LoadingBlock, Note, PrimaryButton, GhostButton, TestResult,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Communications and Settings > WhatsApp.
 *
 * One component for both, because the two are the same shape: pick a gateway,
 * save its credentials, prove it with a test send, make it the active one.
 *
 * Everything on screen comes from GET /settings/messaging/<channel> — the
 * provider list, each provider's fields, which are secret, which are required
 * and what is already configured. Nothing about a vendor is hardcoded here, so
 * adding a gateway is a backend registry entry and this panel picks it up with
 * no change at all.
 *
 * Two rules the backend enforces and this panel mirrors:
 *   · a provider cannot be made active until its required fields are saved,
 *     so "active" can never point at credentials that do not exist;
 *   · switching provider leaves the previous one's credentials in place, which
 *     is what makes trying a vendor for a week a reversible decision.
 * ---------------------------------------------------------------------- */

const CHANNEL = {
  sms: {
    label: 'SMS',
    icon: MessageSquare,
    tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    eyebrow: 'SMS provider',
    testLabel: 'Send test SMS',
    fallbackName: `${BRAND.name} SMS`,
    fallbackSub: 'Platform default',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    tint: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300',
    eyebrow: 'WhatsApp provider',
    testLabel: 'Send test message',
    fallbackName: 'Not sending',
    fallbackSub: 'No gateway selected',
  },
};

const MARK_TINTS = [
  'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300',
];

/** Stable per-provider tint, so a gateway keeps its colour between visits. */
function tintFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return MARK_TINTS[hash % MARK_TINTS.length];
}

const MASK = '********';

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

function ProviderField({ field, value, onChange }) {
  const common = {
    value: value ?? '',
    onChange: (e) => onChange(field.name, e.target.value),
  };
  return (
    <Field label={field.label} hint={field.hint} required={field.required}>
      {field.secret ? (
        <SecretInput
          value={common.value}
          placeholder="••••••••"
          onChange={common.onChange}
        />
      ) : field.choices ? (
        <Select {...common}>
          {field.choices.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      ) : field.multiline ? (
        <Textarea rows={4} spellCheck={false} className="font-mono text-xs" {...common} />
      ) : (
        <TextInput spellCheck={false} {...common} />
      )}
    </Field>
  );
}

function ProviderDetail({ channel, provider, onSaved, onActivated }) {
  const meta = CHANNEL[channel];

  // A masked secret is a placeholder, not a value: show it empty so "leave
  // blank to keep the saved one" is literally true.
  const initial = useMemo(() => {
    const base = {};
    provider.fields.forEach((f) => {
      const saved = provider.config?.[f.name];
      base[f.name] = saved === MASK ? '' : (saved ?? f.default ?? '');
    });
    return base;
  }, [provider]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [phone, setPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const save = async () => {
    try {
      setSaving(true);
      const config = { ...form };
      // Omitting a blank secret leaves the stored ciphertext untouched.
      provider.fields.forEach((f) => {
        if (f.secret && !config[f.name]) delete config[f.name];
      });
      await settingsService.saveIntegration(getAccessToken(), provider.id, {
        enabled: true, config,
      });
      toast.success(`${provider.name} credentials saved`);
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    try {
      setActivating(true);
      const res = await settingsService.setActiveProvider(getAccessToken(), channel, provider.id);
      toast.success(res.message);
      onActivated();
    } catch (e) {
      toast.error(e.message || 'Could not switch provider');
    } finally {
      setActivating(false);
    }
  };

  const sendTest = async () => {
    setResult(null);
    try {
      setTesting(true);
      const res = await settingsService.testMessagingProvider(
        getAccessToken(), channel, provider.id, { phone: phone.trim() },
      );
      setResult({
        ok: true,
        detail: res.message,
        via: res.provider_name + (res.message_id ? ` · id ${res.message_id}` : ''),
      });
    } catch (e) {
      setResult({ ok: false, detail: e.message || 'Send failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!provider.verified && (
        <Note title="Check the endpoint before you rely on this one" tone="warn">
          <p className="mt-1">
            {provider.name}&apos;s API is not one we have been able to verify against live
            documentation, so the endpoint and field names below are a best effort. They are
            editable — if your account uses a different host or path, paste it in and the gateway
            works without waiting on a release. Send a test before switching your subscribers onto
            it.
          </p>
        </Note>
      )}

      <Card
        title="Credentials"
        description="Stored encrypted. Leave a secret blank to keep the one already saved."
      >
        <div className="space-y-5">
          {provider.fields.map((f) => (
            <ProviderField key={f.name} field={f} value={form[f.name]} onChange={set} />
          ))}
        </div>

        {!provider.active && provider.configured && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Credentials are saved but {meta.label} still leaves on{' '}
              {channel === 'sms' ? 'the platform default' : 'nothing'}.
            </p>
            <PrimaryButton onClick={activate} loading={activating} className="px-4 py-2">
              Use {provider.name}
            </PrimaryButton>
          </div>
        )}
      </Card>

      <Card
        title="Test delivery"
        description="Sends through this provider's saved credentials, whether or not it is the active one."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Phone number" hint="Where the test message is sent." className="flex-1">
              <TextInput
                value={phone}
                placeholder="+254712345678"
                spellCheck={false}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <PrimaryButton
              onClick={sendTest}
              loading={testing}
              disabled={!phone.trim() || !provider.configured}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              {meta.testLabel}
            </PrimaryButton>
          </div>

          {!provider.configured && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Save the required credentials first — the test uses what is stored, not what is on
              screen.
            </p>
          )}
          {dirty && provider.configured && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You have unsaved changes — the test uses what is saved. Save first to test the new
              values.
            </p>
          )}

          <TestResult result={result} />
        </div>
      </Card>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => setForm(initial)}
        label="Save credentials"
      />
    </div>
  );
}

export default function MessagingSettings({ channel }) {
  const meta = CHANNEL[channel];
  const { setChrome } = useSettingsChrome();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await settingsService.getMessaging(getAccessToken(), channel));
    } catch (e) {
      toast.error(e.message || `Failed to load ${meta.label} providers`);
    } finally {
      setLoading(false);
    }
  }, [channel, meta.label]);

  useEffect(() => {
    load();
  }, [load]);

  const provider = useMemo(
    () => (data?.providers || []).find((p) => p.id === selectedId) || null,
    [data, selectedId],
  );

  useEffect(() => {
    if (!provider) {
      setChrome(null);
      return undefined;
    }
    setChrome({
      icon: provider.mark,
      iconClass: tintFor(provider.id),
      eyebrow: meta.eyebrow,
      title: provider.name,
      subtitle: provider.region,
      status: (
        <StatusPill tone={provider.active ? 'connected' : provider.configured ? 'warn' : 'idle'}>
          {provider.active ? 'Active' : provider.configured ? 'Saved, not active' : 'Not connected'}
        </StatusPill>
      ),
      onBack: () => setSelectedId(null),
      backLabel: 'All providers',
    });
    return () => setChrome(null);
  }, [provider, meta.eyebrow, setChrome]);

  const revert = async () => {
    try {
      setReverting(true);
      const res = await settingsService.setActiveProvider(getAccessToken(), channel, '');
      toast.success(res.message);
      load();
    } catch (e) {
      toast.error(e.message || 'Could not revert');
    } finally {
      setReverting(false);
    }
  };

  if (loading || !data) return <LoadingBlock />;

  if (provider) {
    return (
      <ProviderDetail
        channel={channel}
        provider={provider}
        onSaved={load}
        onActivated={() => {
          load();
          setSelectedId(null);
        }}
      />
    );
  }

  const active = data.providers.find((p) => p.active) || null;
  const configuredCount = data.providers.filter((p) => p.configured).length;
  const FallbackIcon = meta.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {data.providers.length} providers · {configuredCount} with credentials ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400">
            {active ? `${active.name} active` : `${meta.fallbackName.toLowerCase()}`}
          </span>
        </p>
        {active && (
          <GhostButton onClick={revert} loading={reverting} className="px-3.5 py-2">
            {channel === 'sms' ? 'Use the platform default' : 'Stop sending'}
          </GhostButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!active && (
          <ProviderTile
            mark={<FallbackIcon className="h-5 w-5" />}
            markClass={meta.tint}
            name={meta.fallbackName}
            category={meta.fallbackSub}
            actionLabel={data.platform_fallback ? 'In use' : 'Nothing selected'}
            active
            onSelect={() => {}}
          />
        )}
        {data.providers.map((p) => (
          <ProviderTile
            key={p.id}
            mark={p.mark}
            markClass={tintFor(p.id)}
            name={
              <>
                {p.name}
                {p.active && (
                  <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                    Active
                  </span>
                )}
                {!p.active && p.configured && (
                  <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                    Saved
                  </span>
                )}
              </>
            }
            category={p.region}
            active={p.active}
            actionLabel={p.configured ? 'Manage' : 'Configure'}
            onSelect={() => setSelectedId(p.id)}
          />
        ))}
      </div>

      <Note
        title={
          data.platform_fallback
            ? 'Anything not connected falls back to the platform gateway'
            : 'WhatsApp has no shared fallback'
        }
        tone="info"
      >
        <p className="mt-1">
          {data.platform_fallback
            ? `Until you pick a provider, receipts and reminders go out on ${BRAND.name}'s own gateway and count against your plan. Connect one to send on your own account with your own sender ID.`
            : 'A shared number cannot carry another business’s branding, so WhatsApp only sends once you connect a gateway of your own. Until then these messages go out over SMS.'}
        </p>
      </Note>
    </div>
  );
}
