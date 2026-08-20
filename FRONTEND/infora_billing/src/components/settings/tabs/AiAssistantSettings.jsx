import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, Field, TextInput, Select, Toggle, NotWired, UnavailableSave } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > AI Assistant — design only.
 *
 * There is no AI provider anywhere in this codebase yet (no key storage, no
 * client, no route), so nothing here saves. The controls are live so the panel
 * can be clicked through and argued about; the save button is the one thing
 * that is disabled, because it is the only control that would imply otherwise.
 * ---------------------------------------------------------------------- */

const MODELS = [
  ['claude-opus-5', 'Claude Opus 5 — most capable'],
  ['claude-sonnet-5', 'Claude Sonnet 5 — balanced'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 — fastest, cheapest'],
];

const ABILITIES = [
  {
    key: 'tickets',
    name: 'Draft ticket replies',
    detail: 'Suggest a first response to a support ticket from the subscriber’s account history.',
  },
  {
    key: 'triage',
    name: 'Explain router faults',
    detail: 'Turn a device’s recent logs and interface counters into a plain-English diagnosis.',
  },
  {
    key: 'reports',
    name: 'Summarise the day',
    detail: 'A short written digest of revenue, churn and outages alongside the Overview numbers.',
  },
];

export default function AiAssistantSettings() {
  // Local-only state: it makes the panel feel real to click through, and is
  // thrown away on unmount because there is nowhere to put it.
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState(MODELS[0][0]);
  const [abilities, setAbilities] = useState({ tickets: true, triage: true, reports: false });

  return (
    <div className="space-y-6">
      <NotWired>
        Nothing on this panel saves. There is no AI provider wired into the backend yet — no key
        storage, no client, no route — so this is the shape of the feature rather than the feature.
        Ask for it to be built and the controls below are what it will be built against.
      </NotWired>

      <div className="space-y-6">
          <Card
            title="Provider"
            description="Which model answers, and on whose account the tokens are billed"
          >
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Enable the assistant
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Off until a key is saved. Nothing is sent anywhere while this is off.
                  </p>
                </div>
              </div>
              <Toggle checked={enabled} onChange={setEnabled} />
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Provider" hint="Anthropic is the only provider planned for the first release.">
                <Select value="anthropic" onChange={() => {}}>
                  <option value="anthropic">Anthropic</option>
                </Select>
              </Field>
              <Field label="Model" hint="Opus for quality, Haiku when volume matters more than nuance.">
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="API key"
                hint="Would be encrypted at rest and returned masked, the same way SMS and M-Pesa credentials already are."
                className="md:col-span-2"
              >
                <TextInput type="password" placeholder="sk-ant-…" />
              </Field>
            </div>
          </Card>

          <Card
            title="What it may do"
            description="Each ability is a separate opt-in — the assistant only sees what the ability needs"
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ABILITIES.map((ability) => (
                <div key={ability.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {ability.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{ability.detail}</p>
                  </div>
                  <Toggle
                    checked={!!abilities[ability.key]}
                    onChange={(v) => setAbilities((a) => ({ ...a, [ability.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6">
              <UnavailableSave />
            </div>
          </Card>
      </div>
    </div>
  );
}
