import React from 'react';
import { Clock } from 'lucide-react';
import { useChartTheme, rampStep } from '../../../../lib/chartTheme';
import { formatBytes } from '../../../../lib/networkUtils';
import { EmptyState } from '../parts';

/* -------------------------------------------------------------------------
 * When this subscriber actually uses the line — 24 cells, one per hour of day,
 * averaged over the trailing 30 days.
 *
 * Sequential ramp again: magnitude, one hue. The busiest hour is called out in
 * words underneath, because the whole point of the strip is that single fact
 * and reading it off colour alone would be guesswork.
 * ---------------------------------------------------------------------- */

export default function PeakHours({ data }) {
  const theme = useChartTheme();
  const hours = data?.hours || [];

  if (!data?.has_data) {
    return (
      <EmptyState
        icon={Clock}
        title="Not enough session history yet"
        hint="A usage pattern appears once the line has been up across a few different times of day."
        compact
      />
    );
  }

  const max = hours.reduce((peak, hour) => Math.max(peak, hour.avg_bytes || 0), 0);
  const busiest = hours.find((hour) => hour.hour === data.busiest_hour);

  return (
    <div className="p-5">
      <div className="flex gap-[3px]">
        {hours.map((hour) => (
          <div
            key={hour.hour}
            className="group relative h-10 flex-1 rounded-md transition-transform hover:scale-y-110"
            style={{ background: rampStep(hour.avg_bytes, max, theme) }}
            title={`${hour.label} — ${formatBytes(hour.avg_bytes)} average`}
          >
            <span className="sr-only">{`${hour.label}: ${formatBytes(hour.avg_bytes)} average`}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>

      {busiest && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Busiest around{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{busiest.label}</span>
          {' — '}
          {formatBytes(busiest.avg_bytes)} on an average day.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Averaged over the last {data.window_days} days. Traffic is spread across each
        session's duration, so the shape is indicative rather than exact.
      </p>
    </div>
  );
}
