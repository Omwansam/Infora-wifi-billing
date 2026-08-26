import React, { useId, useMemo } from 'react';
import { useChartTheme } from '../../lib/chartTheme';

/* -------------------------------------------------------------------------
 * A trend line small enough to live inside a stat tile or a device card.
 *
 * Deliberately hand-rolled SVG rather than a chart library: at this size there
 * are no axes, no grid, no legend and no tooltip to justify the weight, and a
 * responsive container per card would re-measure on every render of a list.
 *
 * The line sits in a de-emphasised step and only the current point wears the
 * accent, so a row of these reads as texture with one live value on each —
 * which is the job of a sparkline, as opposed to a chart you read numbers off.
 *
 * Nulls are breaks. An interval where the router said nothing is a hole in the
 * record, and drawing through it would invent a measurement.
 * ---------------------------------------------------------------------- */

export default function Sparkline({
  values = [],
  width = 160,
  height = 40,
  strokeWidth = 2,
  /** Fill under the line. Off for the smallest placements. */
  area = true,
  /** Dot on the most recent real reading. */
  marker = true,
  color,
  /** Show the "no data yet" caption when the series is empty. Off in tight
   *  placements like a table cell, where the caption is wider than the slot. */
  placeholder = true,
  className = '',
  ariaLabel,
}) {
  const t = useChartTheme();
  const gradientId = useId();
  const stroke = color || t.primary;

  const { segments, lastPoint, hasData } = useMemo(() => {
    const nums = values.map((v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v)));
    const present = nums.filter((v) => v !== null);
    if (present.length === 0) return { segments: [], lastPoint: null, hasData: false };

    const min = Math.min(...present);
    const max = Math.max(...present);
    // A flat series would divide by zero and, worse, render as a line pinned to
    // the top of the box; centring it says "steady" instead.
    const range = max - min || 1;
    const pad = strokeWidth;
    const usable = height - pad * 2;
    const stepX = nums.length > 1 ? width / (nums.length - 1) : 0;

    const toPoint = (v, i) => ({
      x: i * stepX,
      y: max === min ? height / 2 : pad + usable - ((v - min) / range) * usable,
    });

    const runs = [];
    let run = [];
    nums.forEach((v, i) => {
      if (v === null) {
        if (run.length) runs.push(run);
        run = [];
        return;
      }
      run.push(toPoint(v, i));
    });
    if (run.length) runs.push(run);

    const last = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null;
    return { segments: runs, lastPoint: last, hasData: true };
  }, [values, width, height, strokeWidth]);

  if (!hasData) {
    if (!placeholder) return null;
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
        aria-label={ariaLabel || 'No trend data yet'}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-600">
          No data yet
        </span>
      </div>
    );
  }

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={ariaLabel || 'Trend'}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {area && segments.map((pts, i) => (
        pts.length > 1 ? (
          <path
            key={`a${i}`}
            d={`${toPath(pts)} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`}
            fill={`url(#${gradientId})`}
          />
        ) : null
      ))}

      {segments.map((pts, i) => (
        pts.length > 1 ? (
          <path
            key={`l${i}`}
            d={toPath(pts)}
            fill="none"
            stroke={stroke}
            strokeOpacity="0.55"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          // A lone reading between two gaps still deserves to be visible.
          <circle key={`p${i}`} cx={pts[0].x} cy={pts[0].y} r={strokeWidth} fill={stroke} fillOpacity="0.55" />
        )
      ))}

      {marker && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={strokeWidth + 0.5}
          fill={stroke}
          stroke={t.surface}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
