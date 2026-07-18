import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare, Mail, Smartphone, Webhook, Send, BarChart3, Zap,
  Check, Settings2, Plus, X, Eye, EyeOff, ExternalLink, Info,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Toggle, LoadingBlock, Field, TextInput, PrimaryButton } from '../ui';

const INTEGRATIONS = [
  {
    key: 'africastalking',
    name: "Africa's Talking",
    category: 'SMS Gateway',
    icon: MessageSquare,
    iconClass: 'bg-orange-50 text-orange-600',
    desc: 'Send transactional SMS — payment receipts, expiry reminders and vouchers.',
  },
  {
    key: 'smtp',
    name: 'Email (SMTP)',
    category: 'Email',
    icon: Mail,
    iconClass: 'bg-sky-50 text-sky-600',
    desc: 'Deliver invoices and account emails through your own mail server.',
  },
  {
    key: 'mpesa',
    name: 'M-Pesa Daraja',
    category: 'Payments',
    icon: Smartphone,
    iconClass: 'bg-emerald-50 text-emerald-600',
    desc: 'STK push and C2B collections. Credentials are managed under the Payments tab.',
  },
  {
    key: 'telegram',
    name: 'Telegram Bot',
    category: 'Alerts',
    icon: Send,
    iconClass: 'bg-cyan-50 text-cyan-600',
    desc: 'Push router and payment alerts to a Telegram group or channel.',
  },
  {
    key: 'webhooks',
    name: 'Webhooks',
    category: 'Developer',
    icon: Webhook,
    iconClass: 'bg-violet-50 text-violet-600',
    desc: 'POST real-time events (payments, sessions, tickets) to your own endpoint.',
  },
  {
    key: 'analytics',
    name: 'Google Analytics',
    category: 'Analytics',
    icon: BarChart3,
    iconClass: 'bg-amber-50 text-amber-600',
    desc: 'Track captive-portal visits and conversions with your GA4 property.',
  },
  {
    key: 'zapier',
    name: 'Zapier',
    category: 'Automation',
    icon: Zap,
    iconClass: 'bg-rose-50 text-rose-600',
    desc: 'Connect Lumen to 6,000+ apps without writing any code.',
  },
];

// Per-integration config schema. Field names containing key/secret/token/password
// are treated as secrets by the backend (encrypted at rest, returned masked).
const INTEGRATION_FIELDS = {
  africastalking: [
    { name: 'username', label: 'Username', type: 'text', placeholder: 'e.g. sandbox', hint: "Your Africa's Talking username" },
    { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'AT API key' },
    { name: 'sender_id', label: 'Sender ID / Shortcode', type: 'text', placeholder: 'e.g. LUMEN (optional)' },
    { name: 'environment', label: 'Environment', type: 'select', options: [['sandbox', 'Sandbox'], ['production', 'Production']] },
  ],
  smtp: [
    { name: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.yourprovider.com' },
    { name: 'port', label: 'Port', type: 'number', placeholder: '587' },
    { name: 'username', label: 'Username', type: 'text', placeholder: 'you@yourdomain.com' },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'SMTP password' },
    { name: 'from_email', label: 'From Address', type: 'text', placeholder: 'noreply@yourdomain.com' },
    { name: 'encryption', label: 'Encryption', type: 'select', options: [['tls', 'STARTTLS'], ['ssl', 'SSL/TLS'], ['none', 'None']] },
  ],
  telegram: [
    { name: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF…', hint: 'Create a bot with @BotFather to get this' },
    { name: 'chat_id', label: 'Chat / Channel ID', type: 'text', placeholder: 'e.g. -1001234567890' },
  ],
  webhooks: [
    { name: 'endpoint_url', label: 'Endpoint URL', type: 'url', placeholder: 'https://your-service.com/webhooks/lumen' },
    { name: 'events', label: 'Events', type: 'text', placeholder: 'payments, sessions, tickets', hint: 'Comma-separated event types to deliver' },
  ],
  analytics: [
    { name: 'measurement_id', label: 'Measurement ID', type: 'text', placeholder: 'G-XXXXXXXXXX', hint: 'Your GA4 measurement ID' },
  ],
  zapier: [
    { name: 'webhook_url', label: 'Zapier Catch Hook URL', type: 'url', placeholder: 'https://hooks.zapier.com/hooks/catch/…' },
  ],
};

const INTEGRATION_NOTES = {
  webhooks: 'Your webhook signing secret lives under Settings → API Keys — use it to verify deliveries.',
  zapier: 'Generate an API key under Settings → API Keys so Zapier can authenticate to Lumen.',
};

function StatusPill({ status }) {
  const map = {
    connected: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-700' },
    configured: { label: 'Configured', cls: 'bg-emerald-50 text-emerald-700' },
    disconnected: { label: 'Not connected', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] || map.disconnected;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

function ConfigModal({ item, initialConfig, connected, saving, onClose, onSave, onDisconnect }) {
  const fields = INTEGRATION_FIELDS[item.key] || [];
  const Icon = item.icon;
  const note = INTEGRATION_NOTES[item.key];

  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach((fd) => {
      f[fd.name] = initialConfig?.[fd.name] ?? (fd.type === 'select' ? (fd.options?.[0]?.[0] ?? '') : '');
    });
    return f;
  });
  const [reveal, setReveal] = useState({});

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${item.iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{item.category}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-gray-500">{item.desc}</p>

          {fields.map((fd) => (
            <Field key={fd.name} label={fd.label} hint={fd.hint}>
              {fd.type === 'select' ? (
                <select
                  value={form[fd.name]}
                  onChange={(e) => set(fd.name, e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                >
                  {fd.options.map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              ) : fd.type === 'password' ? (
                <div className="relative">
                  <TextInput
                    type={reveal[fd.name] ? 'text' : 'password'}
                    value={form[fd.name]}
                    placeholder={fd.placeholder}
                    className="pr-10"
                    onChange={(e) => set(fd.name, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((r) => ({ ...r, [fd.name]: !r[fd.name] }))}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    {reveal[fd.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <TextInput
                  type={fd.type === 'number' ? 'number' : 'text'}
                  value={form[fd.name]}
                  placeholder={fd.placeholder}
                  onChange={(e) => set(fd.name, e.target.value)}
                />
              )}
            </Field>
          ))}

          {note && (
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{note}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
          {connected ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              Disconnect
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <PrimaryButton onClick={() => onSave(form)} loading={saving}>
              {connected ? 'Save changes' : 'Connect'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsSettings({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stateMap, setStateMap] = useState({}); // key -> { enabled, config }
  const [savingKey, setSavingKey] = useState(null);
  const [configuring, setConfiguring] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await settingsService.getIntegrations(getAccessToken());
        const map = {};
        (d.integrations || []).forEach((it) => {
          map[it.key] = { enabled: !!it.enabled, config: it.config || {} };
        });
        setStateMap(map);
      } catch (e) {
        toast.error(e.message || 'Failed to load integrations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isActive = (key) => !!stateMap[key]?.enabled;

  const toggle = async (item) => {
    const key = item.key;
    const next = !isActive(key);
    const prev = stateMap;
    setStateMap((m) => ({ ...m, [key]: { ...(m[key] || {}), enabled: next } }));
    setSavingKey(key);
    try {
      await settingsService.saveIntegration(getAccessToken(), key, { enabled: next });
      toast.success(`${item.name} ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setStateMap(prev);
      toast.error(e.message || 'Update failed');
    } finally {
      setSavingKey(null);
    }
  };

  const openConfig = (item) => {
    if (item.key === 'mpesa') {
      if (onNavigate) onNavigate('payments');
      else toast('Configure M-Pesa under Settings → Payments', { icon: '💳' });
      return;
    }
    setConfiguring(item);
  };

  const saveConfig = async (form) => {
    const item = configuring;
    setSavingConfig(true);
    try {
      const res = await settingsService.saveIntegration(getAccessToken(), item.key, { enabled: true, config: form });
      const cfg = res.integration?.config ?? form;
      setStateMap((m) => ({ ...m, [item.key]: { enabled: true, config: cfg } }));
      toast.success(`${item.name} connected`);
      setConfiguring(null);
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const disconnectConfig = async () => {
    const item = configuring;
    setSavingConfig(true);
    try {
      await settingsService.saveIntegration(getAccessToken(), item.key, { enabled: false });
      setStateMap((m) => ({ ...m, [item.key]: { ...(m[item.key] || {}), enabled: false } }));
      toast.success(`${item.name} disconnected`);
      setConfiguring(null);
    } catch (e) {
      toast.error(e.message || 'Update failed');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card
        title="Integrations"
        description="Connect Lumen to the external services that power notifications, payments and automation"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {INTEGRATIONS.map((it) => {
            const Icon = it.icon;
            const active = isActive(it.key);
            const isMpesa = it.key === 'mpesa';
            const status = active ? (isMpesa ? 'configured' : 'connected') : 'disconnected';
            return (
              <div
                key={it.key}
                className="flex flex-col rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${it.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{it.name}</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{it.category}</p>
                    </div>
                  </div>
                  <StatusPill status={status} />
                </div>

                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-500">{it.desc}</p>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openConfig(it)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    {isMpesa ? (
                      <><ExternalLink className="h-4 w-4" /> Open Payments</>
                    ) : active ? (
                      <><Settings2 className="h-4 w-4" /> Configure</>
                    ) : (
                      <><Plus className="h-4 w-4" /> Connect</>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    {active && <Check className="h-4 w-4 text-emerald-500" />}
                    <Toggle checked={active} onChange={() => toggle(it)} disabled={savingKey === it.key} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {configuring && (
        <ConfigModal
          item={configuring}
          initialConfig={stateMap[configuring.key]?.config || {}}
          connected={isActive(configuring.key)}
          saving={savingConfig}
          onClose={() => setConfiguring(null)}
          onSave={saveConfig}
          onDisconnect={disconnectConfig}
        />
      )}
    </div>
  );
}
