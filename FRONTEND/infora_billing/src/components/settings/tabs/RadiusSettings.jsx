import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Server, Radio, Network, ShieldCheck, Activity, Eye, EyeOff,
  Plus, Trash2, Info, Wifi,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, Toggle, PrimaryButton, SaveBar, LoadingBlock } from '../ui';

export default function RadiusSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [server, setServer] = useState({
    host: '',
    authPort: '1812',
    acctPort: '1813',
    secret: '',
    nasId: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const [accounting, setAccounting] = useState({ interim: true, coa: true, dataUsage: true });

  const [nasClients, setNasClients] = useState([]);
  const [newNas, setNewNas] = useState({ name: '', ip: '', secret: '' });

  useEffect(() => {
    (async () => {
      try {
        const d = await settingsService.getRadius(getAccessToken());
        setEnabled(!!d.enabled);
        setServer({
          host: d.host || '',
          authPort: String(d.auth_port ?? '1812'),
          acctPort: String(d.acct_port ?? '1813'),
          secret: d.shared_secret || '',
          nasId: d.nas_identifier || '',
        });
        setAccounting({
          interim: !!d.acct_interim, coa: !!d.coa_enabled, dataUsage: !!d.data_usage_enforce,
        });
        setNasClients(d.nas_clients || []);
      } catch (e) {
        toast.error(e.message || 'Failed to load RADIUS settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = async (payload, prevRestore) => {
    try {
      await settingsService.saveRadius(getAccessToken(), payload);
    } catch (e) {
      if (prevRestore) prevRestore();
      toast.error(e.message || 'Update failed');
    }
  };

  const toggleEnabled = (value) => {
    const prev = enabled;
    setEnabled(value);
    patch({ enabled: value }, () => setEnabled(prev));
  };

  const toggleAccounting = (key, value) => {
    const prev = accounting;
    setAccounting((a) => ({ ...a, [key]: value }));
    const map = { interim: 'acct_interim', coa: 'coa_enabled', dataUsage: 'data_usage_enforce' };
    patch({ [map[key]]: value }, () => setAccounting(prev));
  };

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.saveRadius(getAccessToken(), {
        enabled,
        host: server.host,
        auth_port: server.authPort,
        acct_port: server.acctPort,
        shared_secret: server.secret,
        nas_identifier: server.nasId,
      });
      toast.success('RADIUS settings saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addNas = async () => {
    if (!newNas.name.trim() || !newNas.ip.trim()) return toast.error('Name and IP are required');
    try {
      const res = await settingsService.addRadiusNas(getAccessToken(), {
        name: newNas.name, ip: newNas.ip, secret: newNas.secret,
      });
      setNasClients((list) => [...list, res.nas]);
      setNewNas({ name: '', ip: '', secret: '' });
      toast.success('NAS client added');
    } catch (e) {
      toast.error(e.message || 'Could not add NAS client');
    }
  };

  const removeNas = async (id) => {
    const prev = nasClients;
    setNasClients((list) => list.filter((n) => n.id !== id));
    try {
      await settingsService.deleteRadiusNas(getAccessToken(), id);
      toast.success('NAS client removed');
    } catch (e) {
      setNasClients(prev);
      toast.error(e.message || 'Could not remove NAS client');
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Connection status banner */}
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${
          enabled ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'
            }`}
          >
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              RADIUS is {enabled ? 'enabled' : 'disabled'}
            </p>
            <p className="text-xs text-gray-500">
              {enabled
                ? 'Routers authenticate PPPoE and hotspot users against your RADIUS server.'
                : 'Turn on to centralize authentication, accounting and disconnects.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm">
              <Activity className="h-3.5 w-3.5" />
              Online
            </span>
          )}
          <Toggle checked={enabled} onChange={toggleEnabled} />
        </div>
      </div>

      {/* Server settings */}
      <Card title="RADIUS Server" description="Connection details your NAS devices use to reach the server">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Server Host / IP" className="md:col-span-2">
            <div className="relative">
              <Server className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <TextInput
                value={server.host}
                placeholder="radius.yourdomain.com"
                className="pl-9"
                onChange={(e) => setServer({ ...server, host: e.target.value })}
              />
            </div>
          </Field>
          <Field label="Authentication Port" hint="Default 1812">
            <TextInput
              value={server.authPort}
              onChange={(e) => setServer({ ...server, authPort: e.target.value })}
            />
          </Field>
          <Field label="Accounting Port" hint="Default 1813">
            <TextInput
              value={server.acctPort}
              onChange={(e) => setServer({ ...server, acctPort: e.target.value })}
            />
          </Field>
          <Field label="Shared Secret" hint="Must match the secret configured on each router">
            <div className="relative">
              <TextInput
                type={showSecret ? 'text' : 'password'}
                value={server.secret}
                placeholder="Enter shared secret"
                className="pr-10 font-mono"
                onChange={(e) => setServer({ ...server, secret: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="NAS Identifier" hint="Identifies this Lumen instance to the server">
            <TextInput
              value={server.nasId}
              onChange={(e) => setServer({ ...server, nasId: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-6">
          <SaveBar onSave={save} saving={saving} />
        </div>
      </Card>

      {/* Accounting & CoA */}
      <Card title="Accounting & CoA" description="How usage is tracked and how active sessions are controlled">
        {[
          { key: 'interim', name: 'Interim accounting updates', desc: 'Receive periodic usage updates while a session is active.', icon: Activity },
          { key: 'coa', name: 'Change of Authorization (CoA)', desc: 'Disconnect or re-authorize live sessions remotely — used to cut off expired users instantly.', icon: ShieldCheck },
          { key: 'dataUsage', name: 'Data-usage enforcement', desc: 'Apply FUP data caps from your plans against RADIUS accounting counters.', icon: Wifi },
        ].map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                <p className="text-sm text-gray-500">{row.desc}</p>
              </div>
              <Toggle checked={accounting[row.key]} onChange={(v) => toggleAccounting(row.key, v)} />
            </div>
          );
        })}
      </Card>

      {/* NAS clients */}
      <Card
        title="NAS Clients"
        description="Routers and access points allowed to talk to the RADIUS server"
      >
        {nasClients.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No NAS clients yet. Add your first router below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-3">Device</th>
                  <th className="pb-3">IP Address</th>
                  <th className="pb-3">Secret</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nasClients.map((n) => (
                  <tr key={n.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <Network className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-gray-900">{n.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-600">{n.ip}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-400">••••••••</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeNas(n.id)}
                        className="text-gray-400 transition hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 md:grid-cols-[1fr_1fr_1fr_auto]">
          <TextInput
            value={newNas.name}
            placeholder="Router name"
            onChange={(e) => setNewNas({ ...newNas, name: e.target.value })}
          />
          <TextInput
            value={newNas.ip}
            placeholder="IP address"
            onChange={(e) => setNewNas({ ...newNas, ip: e.target.value })}
          />
          <TextInput
            value={newNas.secret}
            placeholder="Shared secret"
            onChange={(e) => setNewNas({ ...newNas, secret: e.target.value })}
          />
          <PrimaryButton onClick={addNas} className="shrink-0">
            <Plus className="h-4 w-4" /> Add
          </PrimaryButton>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
          <Info className="h-3.5 w-3.5" />
          Each router must use the same shared secret you enter here for authentication to succeed.
        </p>
      </Card>
    </div>
  );
}
