import React from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useChartTheme, tooltipStyle } from '../../../../lib/chartTheme';
import { formatBytes, formatBytesShort } from '../../../../lib/networkUtils';
import { EmptyState } from '../parts';

/* -------------------------------------------------------------------------
 * Last 24 hours of traffic, down and up.
 *
 * Two series, one axis — both are bytes, so they share a scale and there is
 * nothing to justify a second one. Categorical slots 1 and 2 from the console
 * palette, assigned in fixed order, with a legend because two series always
 * get one.
 * ---------------------------------------------------------------------- */

export default function TrafficChart({ data }) {
  const theme = useChartTheme();
  const tip = tooltipStyle(theme);
  const points = data?.points || [];
  const hasTraffic = points.some((point) => point.down_bytes || point.up_bytes);

  if (!hasTraffic) {
    return (
      <EmptyState
        icon={Activity}
        title="No traffic in the last 24 hours"
        hint="Hourly figures appear once the line carries a session."
        compact
      />
    );
  }

  const [down, up] = theme.palette;

  return (
    <div className="p-5">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sub-traffic-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={down} stopOpacity={0.22} />
              <stop offset="100%" stopColor={down} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="sub-traffic-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up} stopOpacity={0.22} />
              <stop offset="100%" stopColor={up} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            interval={3}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(value) => formatBytesShort(value)}
          />
          <Tooltip
            {...tip}
            formatter={(value, name) => [formatBytes(value), name]}
            labelFormatter={(label) => `${label} — last 24 hours`}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: theme.text, paddingTop: 8 }}
          />
          {/* No mount animation. Recharts draws an area by animating a clip
              rect from zero width, so the first frame is an empty plot — which
              is exactly what a reader sees on a slow tab switch, and what a
              screenshot catches. The data is already loaded by this point;
              there is nothing to reveal. */}
          <Area
            type="monotone" dataKey="down_bytes" name="Download"
            stroke={down} strokeWidth={2} fill="url(#sub-traffic-down)"
            isAnimationActive={false} dot={false}
          />
          <Area
            type="monotone" dataKey="up_bytes" name="Upload"
            stroke={up} strokeWidth={2} fill="url(#sub-traffic-up)"
            isAnimationActive={false} dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatBytes(data.total_down_bytes)}
          </span>{' '}
          down ·{' '}
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatBytes(data.total_up_bytes)}
          </span>{' '}
          up
        </span>
        {data.approximate && (
          <span className="text-slate-400 dark:text-slate-500">
            Spread across each session's duration — RADIUS counts per session, not per hour.
          </span>
        )}
      </div>
    </div>
  );
}
