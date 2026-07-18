import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare, Mail, Smartphone, Webhook, Send, BarChart3,
  Zap, Check, Settings2, Plus,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Toggle, LoadingBlock } from '../ui';

const INTEGRATIONS = [
  {
    key: 'africastalking',
    name: "Africa's Talking",
    category: 'SMS Gateway',
    icon: MessageSquare,
    iconClass: 'bg-orange-50 text-orange-600',
    desc: 'Send transactional SMS — payment receipts, expiry reminders and vouchers.',
    status: 'connected',
  },
  {
    key: 'smtp',
    name: 'Email (SMTP)',
    category: 'Email',
    icon: Mail,
    iconClass: 'bg-sky-50 text-sky-600',
    desc: 'Deliver invoices and account emails through your own mail server.',
    status: 'connected',
  },
  {
    key: 'mpesa',
    name: 'M-Pesa Daraja',
    category: 'Payments',
    icon: Smartphone,
    iconClass: 'bg-emerald-50 text-emerald-600',
    desc: 'STK push and C2B collections. Manage credentials under the Payments tab.',
    status: 'configured',
  },
  {
    key: 'telegram',
    name: 'Telegram Bot',
    category: 'Alerts',
    icon: Send,
    iconClass: 'bg-cyan-50 text-cyan-600',
    desc: 'Push router and payment alerts to a Telegram group or channel.',
    status: 'disconnected',
  },
  {
    key: 'webhooks',
    name: 'Webhooks',
    category: 'Developer',
    icon: Webhook,
    iconClass: 'bg-violet-50 text-violet-600',
    desc: 'POST real-time events (payments, sessions, tickets) to your own endpoint.',
    status: 'disconnected',
  },
  {
    key: 'analytics',
    name: 'Google Analytics',
    category: 'Analytics',
    icon: BarChart3,
    iconClass: 'bg-amber-50 text-amber-600',
    desc: 'Track captive-portal visits and conversions with your GA4 property.',
    status: 'disconnected',
  },
  {
    key: 'zapier',
    name: 'Zapier',
    category: 'Automation',
    icon: Zap,
    iconClass: 'bg-rose-50 text-rose-600',
    desc: 'Connect Lumen to 6,000+ apps without writing any code.',
    status: 'disconnected',
  },
];

function StatusPill({ status }) {
  const map = {
    connected: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-700' },
    configured: { label: 'Configured', cls: 'bg-emerald-50 text-emerald-700' },
    disconnected: { label: 'Not connected', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] || map.disconnected;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

export default function IntegrationsSettings() {
  const [loading, setLoading] = useState(true);
  const [enabledMap, setEnabledMap] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await settingsService.getIntegrations(getAccessToken());
        const map = {};
        (d.integrations || []).forEach((it) => { map[it.key] = !!it.enabled; });
        setEnabledMap(map);
      } catch (e) {
        toast.error(e.message || 'Failed to load integrations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (item) => {
    const key = item.key;
    const next = !enabledMap[key];
    const prev = enabledMap;
    setEnabledMap((m) => ({ ...m, [key]: next }));
    setSavingKey(key);
    try {
      await settingsService.saveIntegration(getAccessToken(), key, { enabled: next });
      toast.success(`${item.name} ${next ? 'connected' : 'disconnected'}`);
    } catch (e) {
      setEnabledMap(prev);
      toast.error(e.message || 'Update failed');
    } finally {
      setSavingKey(null);
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
            const active = !!enabledMap[it.key];
            const status = active ? (it.key === 'mpesa' ? 'configured' : 'connected') : 'disconnected';
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
                    onClick={() => toast('Configuration panel coming soon', { icon: '⚙️' })}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    {active ? <Settings2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {active ? 'Configure' : 'Connect'}
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
    </div>
  );
}
