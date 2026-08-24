import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Cpu, Loader2, RefreshCw, Table2 } from 'lucide-react';
import deviceService from '../../services/deviceService';
import { getAccessToken } from '../../utils/authToken';
import { useChartTheme, tooltipStyle } from '../../lib/chartTheme';

/* -------------------------------------------------------------------------
 * Resource history.
 *
 * Three measures share one 0-100% axis (CPU, memory, disk) and therefore one
 * chart. Clients and throughput are different units, so they get their own
 * charts rather than a second y-axis — a dual-axis plot invites the reader to
 * compare two scales that have nothing to do with each other.
 *
 * Series colours come from the shared validated palette in fixed slot order.
 * On the light surface the aqua slot sits below 3:1, so every series carries
 * its current value as a visible label in the legend and again in the tiles —
 * identity and magnitude are both readable without relying on the hue.
 * ---------------------------------------------------------------------- */

const SERIES = [
  { key: 'cpu', label: 'CPU', slot: 0 },
  { key: 'memory', label: 'Memory', slot: 1 },
  { key: 'disk', label: 'Disk', slot: 2 },
];

function pct(value) {
  return value == null ? '—' : `${Number(value).toFixed(value >= 10 ? 0 : 1)}%`;
}

function mbps(kbps) {
  if (kbps == null) return '—';
  const value = Number(kbps) / 1000;
  return `${value.toFixed(value >= 100 ? 0 : 1)} Mbps`;
}

/** Axis labels: time-of-day inside a day, day+time once the window spans days. */
function useTickFormatter(range) {
  return useCallback((iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    if (range === '7d') {
      return d.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [range]);
}

function StatTile({ label, stat, format, subFormat, tint }) {
  const has = stat && stat.current != null;
  // The sub-line carries two numbers in the width the headline gives to one, so
  // it gets a more compact formatter where the unit would otherwise repeat.
  const sub = subFormat || format;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint }} aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
        {has ? format(stat.current) : '—'}
      </p>
      {has && (
        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          avg {sub(stat.avg)} · peak {sub(stat.peak)}
        </p>
      )}
    </div>
  );
}

/** Legend doubles as the direct-label channel required on the light surface. */
function SeriesLegend({ palette, summary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs">
          <span
            className="h-0.5 w-4 shrink-0 rounded-full"
            style={{ background: palette[s.slot] }}
            aria-hidden="true"
          />
          <span className="font-medium text-slate-600 dark:text-slate-300">{s.label}</span>
          <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
            {pct(summary?.[s.key]?.current)}
          </span>
        </span>
      ))}
    </div>
  );
}

function EmptyState({ pollInterval, lastSynced }) {
  const monitoring = pollInterval > 0;
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Cpu className="h-10 w-10 text-slate-300 dark:text-slate-700" />
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        No readings in this window
      </p>
      <p className="mt-1 max-w-md text-xs text-slate-400 dark:text-slate-500">
        {monitoring
          ? `The router is polled every ${Math.round(pollInterval / 60)} minutes. The first point appears after the next successful poll${lastSynced ? '' : ' — this device has never been reached'}.`
          : 'Background polling is switched off (DEVICE_POLL_INTERVAL=0), so readings are only recorded when someone syncs this router.'}
      </p>
    </div>
  );
}

export default function DeviceResourceHistory({ deviceId }) {
  const t = useChartTheme();
  const tip = tooltipStyle(t);
  const [range, setRange] = useState('6h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const tickFormatter = useTickFormatter(range);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await deviceService.getResourceHistory(getAccessToken(), deviceId, range);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load resource history');
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  useEffect(() => { load(); }, [load]);

  // Keep the chart current while the tab is open, on the same cadence the
  // server polls at — refreshing faster than new data arrives is just noise.
  useEffect(() => {
    const seconds = Math.max(60, data?.poll_interval_seconds || 300);
    const timer = setInterval(() => load(true), seconds * 1000);
    return () => clearInterval(timer);
  }, [load, data?.poll_interval_seconds]);

  const points = data?.points || [];
  const summary = data?.summary;
  const windows = data?.windows || [
    { key: '1h', label: 'Last hour' }, { key: '6h', label: 'Last 6 hours' },
    { key: '24h', label: 'Last 24 hours' }, { key: '7d', label: 'Last 7 days' },
  ];

  const hasClients = useMemo(() => points.some((p) => p.clients != null), [points]);
  const hasBandwidth = useMemo(() => points.some((p) => p.bandwidth_kbps != null), [points]);

  const axis = { tick: { fill: t.axis, fontSize: 11 }, tickLine: false };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Resource History</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data?.label || 'Last 6 hours'}
              {data?.bucket_minutes ? ` · ${data.bucket_minutes}-minute averages` : ''}
              {data?.sample_count ? ` · ${data.sample_count.toLocaleString()} readings` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
              {windows.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setRange(w.key)}
                  aria-pressed={range === w.key}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    range === w.key
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {w.key}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              title="Show the readings as a table"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Table2 className="h-4 w-4" />
            </button>
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
            <Loader2 className="h-5 w-5 animate-spin" />Loading readings…
          </div>
        ) : !data?.sample_count ? (
          <EmptyState pollInterval={data?.poll_interval_seconds || 0} lastSynced={data?.last_synced} />
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="CPU" stat={summary?.cpu} format={pct} tint={t.palette[0]} />
              <StatTile label="Memory" stat={summary?.memory} format={pct} tint={t.palette[1]} />
              <StatTile label="Disk" stat={summary?.disk} format={pct} tint={t.palette[2]} />
              <StatTile label="Clients" stat={summary?.clients} format={(v) => Math.round(v)} tint={t.axis} />
              <StatTile
                label="Throughput"
                stat={summary?.bandwidth_kbps}
                format={mbps}
                subFormat={(v) => (Number(v) / 1000).toFixed(1)}
                tint={t.axis}
              />
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Utilisation</p>
                <SeriesLegend palette={t.palette} summary={summary} />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                  <XAxis dataKey="t" tickFormatter={tickFormatter} minTickGap={40}
                         axisLine={{ stroke: t.grid }} {...axis} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={46}
                         axisLine={false} {...axis} />
                  <Tooltip
                    {...tip}
                    labelFormatter={(iso) => new Date(iso).toLocaleString()}
                    formatter={(v, name) => [pct(v), name]}
                  />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={t.palette[s.slot]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface }}
                      // A gap means the router was unreachable. Joining across it
                      // would draw a confident line through unmeasured time.
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {hasClients && (
                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Connected clients
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`clientsFill-${deviceId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.palette[0]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={t.palette[0]} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                      <XAxis dataKey="t" tickFormatter={tickFormatter} minTickGap={48}
                             axisLine={{ stroke: t.grid }} {...axis} />
                      <YAxis allowDecimals={false} width={36} axisLine={false} {...axis} />
                      <Tooltip
                        {...tip}
                        labelFormatter={(iso) => new Date(iso).toLocaleString()}
                        formatter={(v) => [Math.round(v), 'Clients']}
                      />
                      <Area type="monotone" dataKey="clients" stroke={t.palette[0]} strokeWidth={2}
                            fill={`url(#clientsFill-${deviceId})`} connectNulls={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {hasBandwidth && (
                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Uplink throughput <span className="font-normal text-slate-400 dark:text-slate-500">(Mbps)</span>
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`bwFill-${deviceId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.palette[1]} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={t.palette[1]} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                      <XAxis dataKey="t" tickFormatter={tickFormatter} minTickGap={48}
                             axisLine={{ stroke: t.grid }} {...axis} />
                      <YAxis width={34} axisLine={false}
                             tickFormatter={(v) => (v / 1000).toFixed(0)} {...axis} />
                      <Tooltip
                        {...tip}
                        labelFormatter={(iso) => new Date(iso).toLocaleString()}
                        formatter={(v) => [mbps(v), 'Throughput']}
                      />
                      <Area type="monotone" dataKey="bandwidth_kbps" stroke={t.palette[1]} strokeWidth={2}
                            fill={`url(#bwFill-${deviceId})`} connectNulls={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {showTable && (
              <div className="mt-6 max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Time</th>
                      <th className="px-3 py-2 text-right font-semibold">CPU</th>
                      <th className="px-3 py-2 text-right font-semibold">Memory</th>
                      <th className="px-3 py-2 text-right font-semibold">Disk</th>
                      <th className="px-3 py-2 text-right font-semibold">Clients</th>
                      <th className="px-3 py-2 text-right font-semibold">Throughput</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800">
                    {[...points].reverse().filter((p) => p.samples > 0).map((p) => (
                      <tr key={p.t} className="text-slate-700 dark:text-slate-300">
                        <td className="px-3 py-1.5 whitespace-nowrap">{new Date(p.t).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right">{pct(p.cpu)}</td>
                        <td className="px-3 py-1.5 text-right">{pct(p.memory)}</td>
                        <td className="px-3 py-1.5 text-right">{pct(p.disk)}</td>
                        <td className="px-3 py-1.5 text-right">{p.clients == null ? '—' : Math.round(p.clients)}</td>
                        <td className="px-3 py-1.5 text-right">{mbps(p.bandwidth_kbps)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <Activity className="h-3 w-3" />
              {data?.poll_interval_seconds
                ? `Polled every ${Math.round(data.poll_interval_seconds / 60)} minutes · gaps mean the router was unreachable`
                : 'Recorded on each manual sync · gaps mean the router was unreachable'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
