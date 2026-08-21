import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff, Send, Sparkles } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import {
  Card, Field, Select, ToggleRow, StickySaveBar, LoadingBlock, Note,
  PrimaryButton, TextInput,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > AI Assistant.
 *
 * Backed by /settings/ai — the provider list, model list and readiness all
 * come from the server, so a provider we have not implemented a client for is
 * reported as unavailable rather than quietly answered by a different vendor.
 * The ask box below sends a real question through whatever is configured.
 * ---------------------------------------------------------------------- */

function ProviderCard({ provider, selected, onSelect }) {
  const usable = provider.implemented;
  return (
    <button
      type="button"
      onClick={() => onSelect(provider.id)}
      aria-pressed={selected}
      className={`relative flex flex-col rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/30 dark:border-emerald-500/60 dark:bg-emerald-950/30'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <span className="flex flex-wrap items-center gap-2 pr-6">
        <span
          className={`text-sm font-semibold ${
            selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {provider.name}
        </span>
        {!usable && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
            No client
          </span>
        )}
      </span>
      <span className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
        {provider.host}
      </span>
      <span className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {provider.detail}
      </span>
    </button>
  );
}

export default function AiAssistantSettings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await settingsService.getAi(getAccessToken());
      const next = { enabled: res.enabled, provider: res.provider, model: res.model };
      setData(res);
      setForm(next);
      setBaseline(JSON.stringify(next));
    } catch (e) {
      toast.error(e.message || 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !form || !data) return <LoadingBlock />;

  const provider = data.providers.find((p) => p.id === form.provider) || data.providers[0];
  const dirty = JSON.stringify(form) !== baseline || Boolean(apiKey);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pick = (id) => {
    const spec = data.providers.find((p) => p.id === id);
    setForm((f) => ({
      ...f,
      provider: id,
      // Keep the model valid for the provider rather than carrying a Claude id
      // across to OpenAI.
      model: spec?.models?.some(([m]) => m === f.model) ? f.model : (spec?.models?.[0]?.[0] || ''),
    }));
  };

  const save = async () => {
    try {
      setSaving(true);
      await settingsService.saveAi(getAccessToken(), {
        ...form, ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setApiKey('');
      toast.success('AI settings saved');
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const ask = async () => {
    setAnswer(null);
    try {
      setAsking(true);
      const res = await settingsService.askAi(getAccessToken(), { question: question.trim() });
      setAnswer({ ok: true, text: res.answer, model: res.model, source: res.source });
    } catch (e) {
      setAnswer({ ok: false, text: e.message || 'The assistant could not answer' });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      {!data.ready && (
        <Note title="The assistant cannot answer yet" tone="warn">
          <p className="mt-1">{data.reason}</p>
        </Note>
      )}

      <Card
        title="Provider"
        description="Which model answers, and whose account pays for it."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <ToggleRow
          label="Enable the assistant"
          description="Off means nothing is ever sent to a model."
          checked={form.enabled}
          onChange={(v) => set('enabled', v)}
        />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {data.providers.map((p) => (
            <ProviderCard key={p.id} provider={p} selected={p.id === form.provider} onSelect={pick} />
          ))}
        </div>

        {provider?.models?.length > 0 && (
          <div className="mt-5 max-w-sm">
            <Field label="Model" hint="Higher tiers cost more per message and answer better.">
              <Select value={form.model} onChange={(e) => set('model', e.target.value)}>
                {provider.models.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Card>

      <Card
        title="API key"
        description={
          provider?.needs_key
            ? 'Your own key — usage and cost are billed to you, and the plan allowance stops applying.'
            : 'Nothing to configure while the assistant runs on our account.'
        }
      >
        {provider?.needs_key ? (
          <>
            <div className="relative max-w-xl">
              <TextInput
                type={reveal ? 'text' : 'password'}
                value={apiKey}
                placeholder={data.has_key ? '•••••••• (saved — type to replace)' : 'sk-ant-…'}
                autoComplete="off"
                className="pr-10 font-mono"
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                tabIndex={-1}
                aria-label={reveal ? 'Hide key' : 'Show key'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              Encrypted at rest and never shown again after saving. Leave blank to keep the key
              already stored.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Internal AI runs on our account, so no key is needed and no provider bill reaches you.
            Usage counts against your plan&apos;s daily allowance — add your own key to lift that.
          </p>
        )}
      </Card>

      <Card
        title="Ask it something"
        description="Sends a real question using the settings that are saved right now."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Question" className="flex-1">
              <TextInput
                value={question}
                placeholder="How many subscribers are past expiry?"
                onChange={(e) => setQuestion(e.target.value)}
              />
            </Field>
            <PrimaryButton
              onClick={ask}
              loading={asking}
              disabled={!question.trim() || !data.ready}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              Ask
            </PrimaryButton>
          </div>

          {dirty && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You have unsaved changes — the question uses what is saved. Save first.
            </p>
          )}

          {answer && (
            <div
              className={`rounded-xl border px-4 py-3 ${
                answer.ok
                  ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40'
              }`}
            >
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  answer.ok
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'font-mono text-xs text-rose-700 dark:text-rose-300'
                }`}
              >
                {answer.text}
              </p>
              {answer.ok && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {answer.model} · {answer.source === 'tenant' ? 'your key' : 'platform key'}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => { setForm(JSON.parse(baseline)); setApiKey(''); }}
      />
    </div>
  );
}
