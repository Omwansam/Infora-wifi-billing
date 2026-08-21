import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock3, Router, Send, TrendingUp } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import IntegrationsSettings from './IntegrationsSettings';
import {
  Card, Field, Select, TextInput, Textarea, Toggle, ToggleRow, VariableChips,
  StickySaveBar, LoadingBlock, Note, PrimaryButton, insertAtCursor,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Operator alerts.
 *
 * The one notification group not addressed to a subscriber: router health,
 * sent to whoever runs the network. The master switch is a derived control —
 * there is no single "alerts enabled" flag in the backend, only the three
 * router_health events, so "on" here means "at least one of them is on" and
 * flipping it off remembers what was on so it can be put back.
 *
 * Outage compensation and the sales digest are backed by /settings/automation.
 * Compensation reads the device_outages log the liveness monitor writes, so the
 * credits listed below are real ones rather than a projection.
 * ---------------------------------------------------------------------- */

const GROUP = 'router_health';

/** One event: its own switch, its own message body, its own variables. */
function AlertEvent({ ev, onChange }) {
  const ref = useRef(null);

  const insert = (token) => {
    const { next, caret } = insertAtCursor(ref.current, ev.template, token);
    onChange({ ...ev, template: next });
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ev.label}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{ev.description}</p>
        </div>
        <Toggle checked={ev.enabled} onChange={(v) => onChange({ ...ev, enabled: v })} />
      </div>

      {ev.enabled && (
        <div className="mt-3">
          <Textarea
            ref={ref}
            rows={2}
            value={ev.template || ''}
            placeholder={ev.default_template}
            onChange={(e) => onChange({ ...ev, template: e.target.value })}
          />
          <VariableChips variables={ev.variables} onInsert={insert} />
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Leave blank to send the default shown above.
          </p>
        </div>
      )}
    </div>
  );
}

export default function OperatorAlertsSettings() {
  const [events, setEvents] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // What was on before the master switch was thrown, so it can be restored.
  const [lastOn, setLastOn] = useState([]);
  const [auto, setAuto] = useState(null);
  const [autoBaseline, setAutoBaseline] = useState(null);
  const [sendingDigest, setSendingDigest] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, automation] = await Promise.all([
        settingsService.getNotifications(getAccessToken()),
        settingsService.getAutomation(getAccessToken()),
      ]);
      const group = (data.groups || []).find((g) => g.key === GROUP);
      const list = group?.events || [];
      setEvents(list);
      setBaseline(JSON.stringify(list));
      setAuto(automation);
      setAutoBaseline(JSON.stringify({ outage: automation.outage, digest: automation.digest }));
    } catch (e) {
      toast.error(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!events || !auto) return false;
    if (JSON.stringify(events) !== baseline) return true;
    return JSON.stringify({ outage: auto.outage, digest: auto.digest }) !== autoBaseline;
  }, [events, baseline, auto, autoBaseline]);

  const anyOn = useMemo(() => (events || []).some((e) => e.enabled), [events]);

  const setEvent = (i, next) =>
    setEvents((list) => list.map((e, idx) => (idx === i ? next : e)));

  const toggleAll = (on) => {
    setEvents((list) => {
      if (!on) {
        setLastOn(list.filter((e) => e.enabled).map((e) => e.event_key));
        return list.map((e) => ({ ...e, enabled: false }));
      }
      // Restoring: if nothing was remembered (first visit, all off), turn the
      // whole group on rather than leaving a switch that appears to do nothing.
      const restore = lastOn.length ? lastOn : list.map((e) => e.event_key);
      return list.map((e) => ({ ...e, enabled: restore.includes(e.event_key) }));
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      await settingsService.saveNotifications(
        getAccessToken(),
        events.map(({ event_key, channel, enabled, template }) => ({
          event_key, channel, enabled, template,
        })),
      );
      await settingsService.saveAutomation(getAccessToken(), {
        outage: { enabled: auto.outage.enabled, min_minutes: auto.outage.min_minutes },
        digest: {
          enabled: auto.digest.enabled,
          frequency: auto.digest.frequency,
          recipients: auto.digest.recipients,
        },
      });
      setBaseline(JSON.stringify(events));
      setAutoBaseline(JSON.stringify({ outage: auto.outage, digest: auto.digest }));
      toast.success('Alert preferences saved');
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setEvents(JSON.parse(baseline));
    setAuto((a) => ({ ...a, ...JSON.parse(autoBaseline) }));
  };

  const sendDigest = async () => {
    try {
      setSendingDigest(true);
      const res = await settingsService.sendDigestNow(getAccessToken());
      toast.success(res.message);
      load();
    } catch (e) {
      toast.error(e.message || 'Could not send the digest');
    } finally {
      setSendingDigest(false);
    }
  };

  if (loading || !events || !auto) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card
        title="MikroTik status alerts"
        description="Get notified the moment a router goes offline or reconnects."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <Router className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <div className="space-y-4">
          <ToggleRow
            label="Enable status alerts"
            description="Sent by SMS to your admin number, using the gateway configured under Communications."
            checked={anyOn}
            onChange={toggleAll}
          />

          {anyOn && (
            <div className="space-y-3">
              {events.map((ev, i) => (
                <AlertEvent
                  key={`${ev.event_key}-${ev.channel}`}
                  ev={ev}
                  onChange={(next) => setEvent(i, next)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Outage compensation"
        description="When a router goes offline, credit the downtime back to affected subscribers' expiry once it recovers."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Clock3 className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <div className="space-y-5">
          <ToggleRow
            label="Compensate outages"
            description="Driven by the same monitoring that powers the status alerts above."
            checked={auto.outage.enabled}
            onChange={(v) => setAuto((a) => ({ ...a, outage: { ...a.outage, enabled: v } }))}
            onLabel="Enabled"
            offLabel="Disabled"
          >
            {auto.outage.enabled && (
              <div className="max-w-xs">
                <Field
                  label="Ignore outages shorter than"
                  hint="Minutes. A brief reconnect is not worth a credit, and crediting it would bury the real outages in noise."
                >
                  <TextInput
                    type="number"
                    min={1}
                    value={auto.outage.min_minutes}
                    onChange={(e) => setAuto((a) => ({
                      ...a, outage: { ...a.outage, min_minutes: e.target.value },
                    }))}
                  />
                </Field>
              </div>
            )}
          </ToggleRow>

          <Note title="Only subscribers actually behind that router are credited" tone="info">
            <p className="mt-1">
              Who was affected comes from RADIUS sessions on that NAS during the outage — someone
              on a different router lost nothing and is not credited.
            </p>
          </Note>

          {auto.outage.recent.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recent outages
              </p>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {auto.outage.recent.slice(0, 6).map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {o.device_name || `Router ${o.device_id}`}
                        {o.open && (
                          <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                            Down now
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(o.started_at).toLocaleString()} · {o.minutes} min
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {o.compensated_at
                        ? `${o.compensated_customers} credited`
                        : o.open ? 'in progress' : 'not credited'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Sales reports"
        description="Automated email digests so admins don't have to log in to check revenue."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <TrendingUp className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <div className="space-y-5">
          <ToggleRow
            label="Send sales digest"
            description="Goes out through the SMTP gateway configured under Email."
            checked={auto.digest.enabled}
            onChange={(v) => setAuto((a) => ({ ...a, digest: { ...a.digest, enabled: v } }))}
            onLabel="Enabled"
            offLabel="Disabled"
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Frequency">
                <Select
                  value={auto.digest.frequency}
                  onChange={(e) => setAuto((a) => ({
                    ...a, digest: { ...a.digest, frequency: e.target.value },
                  }))}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </Select>
              </Field>
              <Field label="Recipients" hint="Comma-separated email addresses.">
                <TextInput
                  value={auto.digest.recipients}
                  placeholder="you@yourcompany.com, ops@yourcompany.com"
                  spellCheck={false}
                  onChange={(e) => setAuto((a) => ({
                    ...a, digest: { ...a.digest, recipients: e.target.value },
                  }))}
                />
              </Field>
            </div>
          </ToggleRow>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              What today&apos;s digest would say
            </p>
            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
{auto.digest.preview}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {auto.digest.last_sent_at
                ? `Last sent ${new Date(auto.digest.last_sent_at).toLocaleString()}.`
                : 'Never sent.'}
            </p>
            <PrimaryButton onClick={sendDigest} loading={sendingDigest} className="px-4 py-2">
              <Send className="h-4 w-4" />
              Send one now
            </PrimaryButton>
          </div>
        </div>
      </Card>

      <IntegrationsSettings
        only={['telegram']}
        title="Where alerts land"
        description="Connect a channel somebody actually watches out of hours"
      />

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={reset}
        label="Save alerts"
      />
    </div>
  );
}
