import React, { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Card, Select, Field, NotWired, UnavailableSave } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > AI Assistant — design only.
 *
 * No AI provider exists anywhere in this codebase: no key column, no client,
 * no route, no assistant surface for it to answer on. The controls are live so
 * the panel can be clicked through and argued about; the save button is the one
 * thing disabled, because it is the only control that would imply otherwise.
 *
 * Two deliberate departures from the mock this came from:
 *
 *   · the mock listed `claude-sonnet-4-6`. The current models are Opus 5,
 *     Sonnet 5 and Haiku 4.5, so the picker names those — shipping a stale
 *     model id inside a design is how it ends up in the implementation.
 *   · "Internal AI" is billed as costing nothing in the mock. It is not free to
 *     us, so it is described as included in the plan and metered by a daily
 *     allowance — the version that survives a finance conversation.
 * ---------------------------------------------------------------------- */

const PROVIDERS = [
  {
    id: 'internal',
    name: 'Internal AI',
    host: 'Included with your plan',
    detail: 'No API key needed — runs on our account against your daily allowance.',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    host: 'anthropic.com',
    detail: 'Claude Opus 5, Sonnet 5 and Haiku 4.5.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    host: 'openai.com',
    detail: 'GPT-4o, GPT-4o mini and family.',
  },
];

const MODELS = {
  anthropic: [
    ['claude-opus-5', 'Claude Opus 5 — most capable'],
    ['claude-sonnet-5', 'Claude Sonnet 5 — balanced'],
    ['claude-haiku-4-5', 'Claude Haiku 4.5 — fastest, cheapest'],
  ],
  openai: [
    ['gpt-4o', 'GPT-4o'],
    ['gpt-4o-mini', 'GPT-4o mini'],
  ],
};

const KEY_PREFIX = { anthropic: 'sk-ant-', openai: 'sk-' };

function ProviderCard({ provider, selected, onSelect }) {
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
      <span
        className={`pr-6 text-sm font-semibold ${
          selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {provider.name}
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
  const [provider, setProvider] = useState('internal');
  const [model, setModel] = useState('claude-opus-5');
  const [apiKey, setApiKey] = useState('');
  const [reveal, setReveal] = useState(false);

  const internal = provider === 'internal';
  const models = MODELS[provider] || [];

  // Keep the model valid for the provider rather than carrying a Claude id
  // across to OpenAI.
  const pick = (id) => {
    setProvider(id);
    const list = MODELS[id];
    if (list) setModel(list[0][0]);
  };

  const placeholder = useMemo(
    () => (internal ? '' : `${KEY_PREFIX[provider]}…`),
    [internal, provider],
  );

  return (
    <div className="space-y-6">
      <NotWired>
        Nothing on this panel saves. There is no AI provider wired into the backend — no key
        storage, no client, no route, and no assistant surface for it to answer on. This settles
        what the feature would ask you for; ask for it to be built and it will be built against
        these controls.
      </NotWired>

      <Card
        title="Provider"
        description="Which large language model powers the AI assistant for your dashboard."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              selected={provider === p.id}
              onSelect={pick}
            />
          ))}
        </div>

        {!internal && (
          <div className="mt-5 max-w-sm">
            <Field label="Model" hint="Higher tiers cost more per message and answer better.">
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Card>

      <Card
        title="API key"
        description={
          internal
            ? 'Nothing to configure while the assistant runs on our account.'
            : 'Optional — leave it blank to keep using the internal AI instead.'
        }
      >
        {internal ? (
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Internal AI runs on our account, so there is no key to enter and no provider bill
            reaches you. Usage counts against your plan&apos;s daily assistant allowance — pick a
            provider above and add your own key to lift that ceiling.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Enter your own key and the assistant calls{' '}
              {PROVIDERS.find((p) => p.id === provider)?.name} directly on your account — usage and
              costs are billed to you, and the daily allowance stops applying.
            </p>
            <div className="relative max-w-xl">
              <input
                type={reveal ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                autoComplete="off"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 font-mono text-sm text-slate-900 outline-none transition placeholder:font-mono placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
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
              Anthropic keys start with <span className="font-mono">sk-ant-</span>; OpenAI keys
              start with <span className="font-mono">sk-</span>. It would be encrypted at rest and
              returned masked, the way SMS and M-Pesa credentials already are.
            </p>
          </>
        )}

        <div className="mt-6">
          <UnavailableSave />
        </div>
      </Card>
    </div>
  );
}
