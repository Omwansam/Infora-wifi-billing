import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Network, Wifi, Users, CheckCircle2, Info } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Toggle, LoadingBlock } from '../ui';

const MODULES = [
  {
    key: 'pppoe_enabled',
    name: 'PPPoE',
    icon: Network,
    iconClass: 'bg-violet-50 text-violet-600',
    description: 'Enable PPPoE client management for broadband subscriptions with username/password authentication.',
  },
  {
    key: 'hotspot_enabled',
    name: 'Hotspot',
    icon: Wifi,
    iconClass: 'bg-emerald-50 text-emerald-600',
    description: 'Enable hotspot user management for time-based vouchers and WIFI access codes.',
  },
  {
    key: 'reseller_enabled',
    name: 'Reseller',
    icon: Users,
    iconClass: 'bg-amber-50 text-amber-600',
    description: 'Enable reseller management to create sub-accounts that can sell your packages.',
  },
];

export default function ModulesSettings({ isAdmin }) {
  const [modules, setModules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setModules(await settingsService.getModules(getAccessToken()));
      } catch (e) {
        toast.error(e.message || 'Failed to load modules');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (key, value) => {
    const prev = modules;
    setModules((m) => ({ ...m, [key]: value }));
    setSavingKey(key);
    try {
      await settingsService.saveModules(getAccessToken(), { [key]: value });
      toast.success('Module updated');
    } catch (e) {
      setModules(prev);
      toast.error(e.message || 'Update failed');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading || !modules) return <LoadingBlock />;

  return (
    <Card title="Modules" description="Features enabled for your ISP portal by your administrator">
      <div className="divide-y divide-gray-100">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const enabled = !!modules[mod.key];
          return (
            <div key={mod.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${mod.iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{mod.name}</p>
                <p className="text-sm text-gray-500">{mod.description}</p>
              </div>
              {isAdmin ? (
                <Toggle checked={enabled} onChange={(v) => toggle(mod.key, v)} disabled={savingKey === mod.key} />
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    enabled ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <Info className="h-3.5 w-3.5" />
        {isAdmin
          ? 'Toggling a module shows or hides its features across the portal.'
          : 'Module access is managed by your system administrator. Contact them to request changes.'}
      </div>
    </Card>
  );
}
