import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, ShieldCheck, WifiOff,
} from 'lucide-react';
import deviceService from '../../services/deviceService';
import { getAccessToken } from '../../utils/authToken';
import { formatDuration } from '../../lib/networkUtils';

/** "720h 0m" is technically right and unreadable; past a day, say days. */
function spanLabel(minutes) {
  if (!minutes) return '0m';
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.round((minutes % 1440) / 60);
    return hours ? `${days}d ${hours}h` : `${days} day${days === 1 ? '' : 's'}`;
  }
  return formatDuration(minutes * 60);
}

/* -------------------------------------------------------------------------
 * Downtime history.
 *
 * The headline is availability, because that is the number an operator is held
 * to. Underneath it, a day-by-day strip answers "when" at a glance and the log
 * answers "what happened" in detail.
 *
 * The strip uses the reserved status palette, so per the colour rules every
 * cell carries a text label in its tooltip and the legend spells the bands out
 * — the hue is a second channel, never the only one.
 * ---------------------------------------------------------------------- */

const STATUS = {
  clear: { color: '#0ca30c', label: 'No downtime' },
  warning: { color: '#fab219', label: 'Under 5 minutes' },
  serious: { color: '#ec835a', label: '5 minutes to an hour' },
  critical: { color: '#d03b3b', label: 'Over an hour' },
};

const RANGES = [
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
];

function bandFor(minutes) {
  if (minutes <= 0) return 'clear';
  if (minutes < 5) return 'warning';
  if (minutes < 60) return 'serious';
  return 'critical';
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Downtime per calendar day, in the viewer's own timezone.
 *
 * Each outage is clipped to each day it touches rather than counted against
 * the day it began — an outage that runs from 23:50 to 02:10 belongs partly to
 * both days, and attributing all of it to the first would misreport them both.
 */
function buildDays(outages, days, until, measuredFrom) {
  const end = new Date(until);
  const cells = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dayStart = startOfDay(new Date(end.getTime() - i * 86400000));
    const dayEnd = new Date(Math.min(dayStart.getTime() + 86400000, end.getTime()));
    let minutes = 0;
    for (const outage of outages) {
      const oStart = new Date(outage.started_at);
      const oEnd = outage.ended_at ? new Date(outage.ended_at) : end;
      const overlapStart = Math.max(oStart.getTime(), dayStart.getTime());
      const overlapEnd = Math.min(oEnd.getTime(), dayEnd.getTime());
      if (overlapEnd > overlapStart) {
        minutes += Math.round((overlapEnd - overlapStart) / 60000);
      }
    }
    // Days before the device existed are unknown, not clean — colouring them
    // green would claim uptime nobody measured.
    const unmonitored = measuredFrom && dayEnd.getTime() <= new Date(measuredFrom).getTime();
    cells.push({ date: dayStart, minutes, band: bandFor(minutes), unmonitored });
  }
  return cells;
}

function Tile({ icon: Icon, label, value, sub, tone = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DeviceDowntimeHistory({ deviceId }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await deviceService.getOutages(getAccessToken(), deviceId, days);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load downtime history');
    } finally {
      setLoading(false);
    }
  }, [deviceId, days]);

  useEffect(() => { load(); }, [load]);

  const outages = data?.outages || [];
  const cells = useMemo(
    () => (data ? buildDays(outages, days, data.until, data.measured_from) : []),
    [outages, days, data],
  );

  const longest = useMemo(
    () => outages.reduce((max, o) => Math.max(max, o.minutes || 0), 0),
    [outages],
  );

  const uptime = data?.uptime_percent;
  const uptimeTone = uptime == null ? 'text-slate-400'
    : uptime >= 99.9 ? 'text-emerald-600 dark:text-emerald-400'
      : uptime >= 99 ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Downtime History</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last {days} days
            {data?.measured_from && new Date(data.measured_from) > new Date(data.since)
              ? ` · monitored since ${new Date(data.measured_from).toLocaleDateString()}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setDays(r.key)}
                aria-pressed={days === r.key}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  days === r.key
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            title="Refresh"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />Loading downtime…
        </div>
      ) : (
        <>
          {data?.currently_down && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-950/30">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium text-rose-700 dark:text-rose-300">
                This router is offline right now — the current outage is still open.
              </span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={ShieldCheck}
              label="Availability"
              value={uptime == null ? '—' : `${uptime.toFixed(uptime >= 99.9 ? 3 : 2)}%`}
              sub={data ? `over ${spanLabel(data.measured_minutes || 0)} monitored` : null}
              tone={uptimeTone}
            />
            <Tile
              icon={WifiOff}
              label="Outages"
              value={data?.total_outages ?? 0}
              sub={`in the last ${days} days`}
            />
            <Tile
              icon={Clock}
              label="Total downtime"
              value={data?.total_minutes ? formatDuration(data.total_minutes * 60) : 'None'}
              tone={data?.total_minutes ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}
            />
            <Tile
              icon={AlertTriangle}
              label="Longest outage"
              value={longest ? formatDuration(longest * 60) : 'None'}
            />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Daily availability</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {Object.entries(STATUS).map(([key, meta]) => (
                  <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} aria-hidden="true" />
                    {meta.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1" role="list" aria-label={`Daily downtime for the last ${days} days`}>
              {cells.map((cell) => {
                const meta = STATUS[cell.band];
                const dateLabel = cell.date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const text = cell.unmonitored
                  ? `${dateLabel}: not monitored`
                  : `${dateLabel}: ${cell.minutes ? formatDuration(cell.minutes * 60) + ' down' : meta.label}`;
                return (
                  <span
                    key={cell.date.toISOString()}
                    role="listitem"
                    title={text}
                    aria-label={text}
                    className="h-6 w-2.5 rounded-sm ring-1 ring-inset ring-black/5 dark:ring-white/10"
                    style={{ background: cell.unmonitored ? 'transparent' : meta.color }}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Outage log</p>
            {outages.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-800">
                <CheckCircle2 className="h-9 w-9 text-emerald-500/70" />
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  No outages in the last {days} days
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-400 dark:text-slate-500">
                  {data?.monitoring_enabled
                    ? 'The router has answered every poll in this window.'
                    : 'Background polling is off, so an outage is only recorded if someone syncs the router while it is down.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Started</th>
                      <th className="px-4 py-2.5 font-semibold">Ended</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Duration</th>
                      <th className="px-4 py-2.5 font-semibold">Subscriber credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {outages.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-900 dark:text-white">
                          {new Date(o.started_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {o.open ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Still down
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">
                              {new Date(o.ended_at).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatDuration((o.minutes || 0) * 60)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {o.compensated_at ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {o.compensated_customers} subscriber{o.compensated_customers === 1 ? '' : 's'}
                              {' · '}{formatDuration((o.compensated_minutes || 0) * 60)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
