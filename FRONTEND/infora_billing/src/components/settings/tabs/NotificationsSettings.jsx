import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Info } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import {
  Card, Textarea, Toggle, VariableChips, StickySaveBar, LoadingBlock, Note,
  insertAtCursor,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Message templates.
 *
 * Every automatic message a subscriber can receive, grouped the way the
 * backend catalogue groups them (services/notification_events.py).
 *
 * Two things are deliberately not copied from the mock this was drawn against:
 * its `@variable` syntax and its invented template list. Our placeholders are
 * `{first_name}` and the catalogue is server-owned — rendering the mock's
 * tokens would produce templates that interpolate nothing. The chips come
 * straight from each event's own `variables`, so they cannot drift.
 *
 * `only` / `exclude` split this endpoint across two panels; Operator alerts
 * owns router_health. Saving posts just the rows on screen — the backend
 * upserts by event key, so the other panel's preferences are untouched.
 * ---------------------------------------------------------------------- */

const CHANNEL_STYLES = {
  sms: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  email:
    'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/30',
};

function ChannelBadge({ channel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
        CHANNEL_STYLES[channel] || CHANNEL_STYLES.sms
      }`}
    >
      {channel === 'email' ? 'Email' : 'SMS'}
    </span>
  );
}

/** One template: switch on the right, body and its variables underneath. */
function TemplateCard({ ev, onChange }) {
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
          <div className="flex flex-wrap items-center gap-2">
            <ChannelBadge channel={ev.channel} />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ev.label}</p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {ev.description}
          </p>
        </div>
        <Toggle checked={ev.enabled} onChange={(v) => onChange({ ...ev, enabled: v })} />
      </div>

      {ev.enabled && (
        <div className="mt-3">
          <Textarea
            ref={ref}
            rows={3}
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

export default function NotificationsSettings({ only, exclude, intro = true }) {
  const [groups, setGroups] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getNotifications(getAccessToken());
      let list = data.groups || [];
      if (only) list = list.filter((g) => only.includes(g.key));
      if (exclude) list = list.filter((g) => !exclude.includes(g.key));
      setGroups(list);
      setBaseline(JSON.stringify(list));
    } catch (e) {
      toast.error(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
    // `only`/`exclude` are per-panel constants; the panel remounts on tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateEvent = (gi, ei, next) => {
    setGroups((gs) =>
      gs.map((g, gIdx) =>
        gIdx === gi ? { ...g, events: g.events.map((e, eIdx) => (eIdx === ei ? next : e)) } : g,
      ),
    );
  };

  const dirty = useMemo(
    () => Boolean(groups) && JSON.stringify(groups) !== baseline,
    [groups, baseline],
  );

  const flat = useMemo(
    () =>
      (groups || []).flatMap((g) =>
        g.events.map(({ event_key, channel, enabled, template }) => ({
          event_key, channel, enabled, template,
        })),
      ),
    [groups],
  );

  const save = async () => {
    try {
      setSaving(true);
      await settingsService.saveNotifications(getAccessToken(), flat);
      setBaseline(JSON.stringify(groups));
      toast.success('Message templates saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !groups) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {intro && (
        <Note icon={Info} title="Click a variable to drop it into the message" tone="info">
          <p className="mt-1">
            Switch each message on or off, and rewrite the body if the default does not sound like
            you. Placeholders are filled in per subscriber when the message is sent; leave a body
            blank to keep the system default.
          </p>
        </Note>
      )}

      {groups.map((group, gi) => (
        <Card key={group.key} title={group.label} description={group.description}>
          <div className="space-y-3">
            {group.events.map((ev, ei) => (
              <TemplateCard
                key={`${ev.event_key}-${ev.channel}`}
                ev={ev}
                onChange={(next) => updateEvent(gi, ei, next)}
              />
            ))}
          </div>
        </Card>
      ))}

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => setGroups(JSON.parse(baseline))}
        label="Save templates"
      />
    </div>
  );
}
