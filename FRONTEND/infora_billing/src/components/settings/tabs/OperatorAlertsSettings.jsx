import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock3, Router, TrendingUp } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import IntegrationsSettings from './IntegrationsSettings';
import {
  Card, Textarea, Toggle, ToggleRow, VariableChips, StickySaveBar,
  LoadingBlock, NotWired, insertAtCursor,
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
 * Outage compensation and sales digests are ideas with no backend behind them.
 * They are drawn, and labelled as drawn.
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

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getNotifications(getAccessToken());
      const group = (data.groups || []).find((g) => g.key === GROUP);
      const list = group?.events || [];
      setEvents(list);
      setBaseline(JSON.stringify(list));
    } catch (e) {
      toast.error(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(events) && JSON.stringify(events) !== baseline,
    [events, baseline],
  );

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
      setBaseline(JSON.stringify(events));
      toast.success('Alert preferences saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setEvents(JSON.parse(baseline));

  if (loading || !events) return <LoadingBlock />;

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
        <div className="space-y-4">
          <NotWired>
            Nothing here saves. Crediting downtime needs something that does not exist yet: a
            record of which subscribers were behind a router while it was down, and a step that
            moves their expiry when it returns. The liveness data to build it on is already
            collected — it is the crediting half that is missing.
          </NotWired>
          <ToggleRow
            label="Compensate outages"
            description="Would be driven by the same monitoring that powers the status alerts above."
            checked={false}
            onChange={() => {}}
            onLabel="Enabled"
            offLabel="Disabled"
          />
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
        <div className="space-y-4">
          <NotWired>
            Nothing here saves. There is no scheduled digest job and no report template — the
            revenue figures it would send already exist on Overview, but nothing assembles or
            posts them on a timer.
          </NotWired>
          <ToggleRow
            label="Send sales digest"
            description="Would go to admin email addresses through the SMTP gateway under Email."
            checked={false}
            onChange={() => {}}
            onLabel="Enabled"
            offLabel="Disabled"
          />
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
