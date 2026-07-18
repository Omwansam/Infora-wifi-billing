import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  KeyRound, Copy, Trash2, Eye, EyeOff, Plus, RefreshCw, Clock,
  ShieldCheck, Code2, AlertTriangle,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, PrimaryButton, LoadingBlock } from '../ui';

const SCOPE_OPTIONS = ['read', 'write', 'payments', 'webhooks'];

export default function ApiKeysSettings() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState([]);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['read']);
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState(null);

  const [webhookSecret, setWebhookSecret] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    try {
      const d = await settingsService.getApiKeys(getAccessToken());
      setKeys(d.keys || []);
      setWebhookSecret(d.webhook_secret || '');
    } catch (e) {
      toast.error(e.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (text, label = 'Copied to clipboard') => {
    navigator.clipboard?.writeText(text);
    toast.success(label);
  };

  const toggleScope = (s) =>
    setScopes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));

  const createKey = async () => {
    if (!name.trim()) return toast.error('Give the key a name');
    if (scopes.length === 0) return toast.error('Select at least one scope');
    setCreating(true);
    try {
      const d = await settingsService.createApiKey(getAccessToken(), { name: name.trim(), scopes });
      const created = d.api_key;
      setFreshKey(created.token);
      setKeys((list) => [
        {
          id: created.id, name: created.name, key: created.key,
          scopes: created.scopes, created: created.created, last_used: created.last_used,
        },
        ...list,
      ]);
      setName('');
      setScopes(['read']);
      toast.success('API key created');
    } catch (e) {
      toast.error(e.message || 'Could not create key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    const prev = keys;
    setKeys((list) => list.filter((k) => k.id !== id));
    try {
      await settingsService.deleteApiKey(getAccessToken(), id);
      toast.success('API key revoked');
    } catch (e) {
      setKeys(prev);
      toast.error(e.message || 'Could not revoke key');
    }
  };

  const regenWebhook = async () => {
    setRegenerating(true);
    try {
      const d = await settingsService.regenerateWebhookSecret(getAccessToken());
      setWebhookSecret(d.webhook_secret || '');
      toast.success('Webhook secret regenerated');
    } catch (e) {
      toast.error(e.message || 'Could not regenerate secret');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Freshly created key banner (shown once) */}
      {freshKey && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900">Copy your new API key now</p>
              <p className="text-xs text-emerald-700">For security this key is shown only once. Store it somewhere safe.</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-gray-800">
                  {freshKey}
                </code>
                <button
                  type="button"
                  onClick={() => copy(freshKey, 'API key copied')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFreshKey(null)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create new key */}
      <Card title="Create API key" description="Generate a key to access the Lumen REST API from your own systems">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Key name" hint="A label so you remember where it's used">
            <TextInput value={name} placeholder="e.g. Billing sync" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Scopes" hint="What this key is allowed to do">
            <div className="flex flex-wrap gap-2 pt-1">
              {SCOPE_OPTIONS.map((s) => {
                const on = scopes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      on
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <PrimaryButton onClick={createKey} loading={creating}>
            <Plus className="h-4 w-4" /> Generate key
          </PrimaryButton>
        </div>
      </Card>

      {/* Existing keys */}
      <Card title="Active keys" description="Revoke a key immediately if it may have been exposed">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">No API keys yet</p>
            <p className="text-sm text-gray-500">Generate one above to start using the API.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{k.name}</p>
                    {(k.scopes || []).map((s) => (
                      <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <code className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">{k.key}</code>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    Created {k.created || '—'} · Last used {k.last_used || 'Never'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(k.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 sm:self-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Webhook signing secret */}
      <Card title="Webhook signing secret" description="Verify that incoming webhook events genuinely came from Lumen">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <TextInput
              type={showWebhook ? 'text' : 'password'}
              value={webhookSecret}
              readOnly
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowWebhook((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copy(webhookSecret, 'Secret copied')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
            <button
              type="button"
              onClick={regenWebhook}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate
            </button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          Regenerating immediately invalidates the old secret — update your endpoints first.
        </p>
      </Card>

      {/* Docs callout */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
            <Code2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">API documentation</p>
            <p className="text-sm text-gray-500">Base URL, authentication, and endpoint reference for the Lumen API.</p>
          </div>
          <button
            type="button"
            onClick={() => toast('Docs open in a new tab', { icon: '📘' })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View docs
          </button>
        </div>
      </Card>
    </div>
  );
}
