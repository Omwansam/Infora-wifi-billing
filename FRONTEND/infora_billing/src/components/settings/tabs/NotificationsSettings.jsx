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
        isSms ? 'text-blue-600' : 'text-fuchsia-600'
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
          <p className="text-sm font-semibold text-gray-900">{ev.label}</p>
          <p className="text-xs text-gray-500">{ev.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          Edit message <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <Toggle checked={ev.enabled} onChange={(v) => onChange({ ...ev, enabled: v })} />
      </div>
      {open && (
        <div className="mt-3 ml-12 rounded-lg bg-gray-50 border border-gray-100 p-3">
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
                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">Leave blank to use the system default.</p>
        </div>
      )}
    </div>
  );
}

export default function NotificationsSettings() {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getNotifications(getAccessToken());
        setGroups(data.groups || []);
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
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Customisable Messages</p>
          <p className="text-sm text-blue-700">
            Toggle each notification on or off, and optionally customise the message text. Use{' '}
            <span className="font-mono">{'{variable}'}</span> placeholders shown below each template. Leave blank to use the system default.
          </p>
        </div>
      </div>

      {groups.map((group, gi) => (
        <Card key={group.key} title={group.label} description={group.description}>
          <div className="divide-y divide-gray-100">
            {group.events.map((ev, ei) => (
              <EventRow key={`${ev.event_key}-${ev.channel}`} ev={ev} onChange={(next) => updateEvent(gi, ei, next)} />
            ))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-4 z-10">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-3">
          <SaveBar onSave={save} saving={saving} label="Save Preferences" />
        </div>
      </div>
    </div>
  );
}
