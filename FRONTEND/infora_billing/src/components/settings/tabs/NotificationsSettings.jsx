import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Info, ChevronDown } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Toggle, Textarea, SaveBar, LoadingBlock } from '../ui';

function ChannelBadge({ channel }) {
  const isSms = channel === 'sms';
  return (
    <span
      className={`inline-flex items-center justify-center w-12 shrink-0 text-[10px] font-bold uppercase tracking-wide ${
        isSms ? 'text-sky-600 dark:text-sky-400' : 'text-fuchsia-600 dark:text-fuchsia-400'
      }`}
    >
      {isSms ? 'SMS' : 'Email'}
    </span>
  );
}

function EventRow({ ev, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-3.5 first:pt-0">
      <div className="flex items-center gap-3">
        <ChannelBadge channel={ev.channel} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ev.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{ev.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Edit message <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <Toggle checked={ev.enabled} onChange={(v) => onChange({ ...ev, enabled: v })} />
      </div>
      {open && (
        <div className="ml-12 mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <Textarea
            rows={3}
            value={ev.template}
            placeholder={ev.default_template}
            onChange={(e) => onChange({ ...ev, template: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ev.variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...ev, template: `${ev.template || ''}${v}` })}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Leave blank to use the system default.</p>
        </div>
      )}
    </div>
  );
}

/**
 * `only` / `exclude` split the same endpoint across two panels: subscriber-facing
 * message templates, and the router-health digests that go to your own team.
 * Saving posts just the rows on screen — the backend upserts by event key, so
 * the other panel's preferences are untouched.
 */
export default function NotificationsSettings({ only, exclude, intro = true }) {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getNotifications(getAccessToken());
        let list = data.groups || [];
        if (only) list = list.filter((g) => only.includes(g.key));
        if (exclude) list = list.filter((g) => !exclude.includes(g.key));
        setGroups(list);
      } catch (e) {
        toast.error(e.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateEvent = (gi, ei, next) => {
    setGroups((gs) => {
      const copy = gs.map((g) => ({ ...g, events: [...g.events] }));
      copy[gi].events[ei] = next;
      return copy;
    });
  };

  const flat = useMemo(
    () =>
      (groups || []).flatMap((g) =>
        g.events.map((e) => ({ event_key: e.event_key, channel: e.channel, enabled: e.enabled, template: e.template })),
      ),
    [groups],
  );

  const save = async () => {
    try {
      setSaving(true);
      await settingsService.saveNotifications(getAccessToken(), flat);
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !groups) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      {intro && (
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/40">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
        <div>
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Customisable messages</p>
          <p className="text-sm text-sky-700 dark:text-sky-200">
            Toggle each notification on or off, and optionally customise the message text. Use{' '}
            <span className="font-mono">{'{variable}'}</span> placeholders shown below each template. Leave blank to use the system default.
          </p>
        </div>
      </div>
      )}

      {groups.map((group, gi) => (
        <Card key={group.key} title={group.label} description={group.description}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {group.events.map((ev, ei) => (
              <EventRow key={`${ev.event_key}-${ev.channel}`} ev={ev} onChange={(next) => updateEvent(gi, ei, next)} />
            ))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-4 z-10">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <SaveBar onSave={save} saving={saving} label="Save Preferences" />
        </div>
      </div>
    </div>
  );
}
