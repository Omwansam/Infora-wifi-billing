import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useChartTheme, tooltipStyle } from '../../../../lib/chartTheme';
import { formatBytes, formatBytesShort } from '../../../../lib/networkUtils';
import { EmptyState } from '../parts';

/* -------------------------------------------------------------------------
 * Daily traffic for the current month, stacked down-over-up.
 *
 * Stacked because the pair sums to something meaningful — the day's total —
 * and the 2px surface gap between the segments is what keeps them readable
 * without a stroke around either.
 * ---------------------------------------------------------------------- */

export default function UsageBars({ data }) {
  const theme = useChartTheme();
  const tip = tooltipStyle(theme);
  const points = data?.points || [];

  if (!data?.total_bytes) {
    return (
      <EmptyState
        icon={Activity}
        title="No usage recorded yet this month"
        hint="Daily bars fill in as sessions are accounted."
        compact
      />
    );
  }

  const [down, up] = theme.palette;

  return (
    <div className="p-5">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            interval={points.length > 20 ? 3 : 1}
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
            labelFormatter={(label) => `Day ${label}`}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {/* stackId + a surface-coloured stroke gives the gap that keeps the
              two segments apart without drawing a border around either.
              Animation off: recharts renders a bar's <path> only once the mount
              animation has produced a height, so the plot is empty until it
              finishes — and replays that on every re-render. */}
          <Bar
            dataKey="down_bytes" name="Download" stackId="usage"
            fill={down} maxBarSize={22} stroke={theme.surface} strokeWidth={1}
            isAnimationActive={false}
          />
          <Bar
            dataKey="up_bytes" name="Upload" stackId="usage"
            fill={up} maxBarSize={22} radius={[4, 4, 0, 0]}
            stroke={theme.surface} strokeWidth={1}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800">
        <Figure label="This month" value={formatBytes(data.total_bytes)} />
        <Figure
          label="Peak day"
          value={data.peak_day
            ? new Date(`${data.peak_day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
            : '—'}
          sub={data.peak_bytes ? formatBytes(data.peak_bytes) : null}
        />
        <Figure label="Average / day" value={formatBytes(data.avg_per_day_bytes)} />
        <Figure label="Lifetime" value={formatBytes(data.lifetime_bytes)} />
      </dl>
    </div>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
      {sub && <dd className="text-xs text-slate-400 dark:text-slate-500">{sub}</dd>}
    </div>
  );
}
