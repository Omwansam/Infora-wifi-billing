import React, { useMemo, useState } from 'react';
import { useChartTheme, rampStep } from '../../../../lib/chartTheme';
import { formatBytes } from '../../../../lib/networkUtils';

/* -------------------------------------------------------------------------
 * A year of connection activity, one cell per day.
 *
 * Sequential, not categorical: the colour says *how much* moved that day, so
 * it is one hue on a lightness ramp. Empty days wear the surface tint rather
 * than the palest ramp step, because "no session" is missing data, not a small
 * amount of it.
 *
 * Hand-rolled SVG rather than a chart library — 365 cells with no axes, no
 * scale and no legend beyond the four-step key is a grid, not a plot, and a
 * responsive chart container would re-measure for nothing.
 * ---------------------------------------------------------------------- */

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ActivityHeatmap({ days = [], activeDays = 0 }) {
  const theme = useChartTheme();
  const [hover, setHover] = useState(null);

  const { weeks, max, monthLabels } = useMemo(() => {
    if (!days.length) return { weeks: [], max: 0, monthLabels: [] };

    // Pad the front so the first column starts on a Sunday and every row is
    // one weekday — without this the grid shears and the month labels lie.
    const first = new Date(`${days[0].date}T00:00:00`);
    const padding = first.getDay();
    const cells = [...Array.from({ length: padding }, () => null), ...days];

    const columns = [];
    for (let index = 0; index < cells.length; index += 7) {
      columns.push(cells.slice(index, index + 7));
    }

    const labels = [];
    let lastMonth = -1;
    columns.forEach((column, columnIndex) => {
      const firstReal = column.find(Boolean);
      if (!firstReal) return;
      const month = new Date(`${firstReal.date}T00:00:00`).getMonth();
      if (month !== lastMonth) {
        labels.push({ x: columnIndex * STEP, label: MONTHS[month] });
        lastMonth = month;
      }
    });

    return {
      weeks: columns,
      max: days.reduce((peak, day) => Math.max(peak, day.bytes || 0), 0),
      monthLabels: labels,
    };
  }, [days]);

  if (!days.length) return null;

  const width = weeks.length * STEP;
  const height = 7 * STEP;

  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">{activeDays}</span>{' '}
          active {activeDays === 1 ? 'day' : 'days'} in the last year
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span>Less</span>
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: theme.sequentialEmpty }}
          />
          {theme.sequential.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={height + 18}
          viewBox={`0 0 ${width} ${height + 18}`}
          role="img"
          aria-label={`Daily connection activity over the last year. ${activeDays} active days.`}
          className="min-w-full"
        >
          {monthLabels.map((month) => (
            <text
              key={`${month.label}-${month.x}`}
              x={month.x}
              y={9}
              fontSize="9"
              fill={theme.muted}
            >
              {month.label}
            </text>
          ))}
          {weeks.map((column, columnIndex) =>
            column.map((day, dayIndex) => {
              if (!day) return null;
              return (
                <rect
                  key={day.date}
                  x={columnIndex * STEP}
                  y={dayIndex * STEP + 16}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={rampStep(day.bytes, max, theme)}
                  onMouseEnter={() => setHover(day)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  <title>
                    {`${day.date} · ${day.sessions} session${day.sessions === 1 ? '' : 's'} · ${formatBytes(day.bytes)}`}
                  </title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>

      {/* A readout rather than a floating tooltip: the cells are 11px, and a
          popover that size fights the pointer more than it helps. */}
      <p className="mt-2 h-4 text-xs text-slate-500 dark:text-slate-400">
        {hover
          ? `${new Date(`${hover.date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })} — ${hover.sessions} session${hover.sessions === 1 ? '' : 's'}, ${formatBytes(hover.bytes)}`
          : activeDays === 0
            ? 'No sessions recorded in the last year.'
            : 'Hover a day for its sessions and traffic.'}
      </p>
    </div>
  );
}
