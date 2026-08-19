import React from 'react';
import { Signal } from 'lucide-react';

/**
 * Shared vocabulary for the TR-069 console.
 *
 * The optical bands are the same thresholds the backend classifies on
 * (routes/cpe.py::_optical_health) — kept in sync deliberately so the meter a
 * tech reads and the `optical_health` the API returns can never disagree.
 */
export const OPTICAL_BANDS = [
  { key: 'critical', from: -30, to: -27, label: 'Critical', bar: 'bg-red-500' },
  { key: 'marginal', from: -27, to: -25, label: 'Marginal', bar: 'bg-amber-400' },
  { key: 'good', from: -25, to: -8, label: 'Good', bar: 'bg-emerald-500' },
  { key: 'too_strong', from: -8, to: -5, label: 'Too strong', bar: 'bg-amber-400' },
];

export const OPTICAL_TONE = {
  good: { text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30', stroke: '#10b981' },
  marginal: { text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30', stroke: '#f59e0b' },
  critical: { text: 'text-red-600 dark:text-red-400', chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30', stroke: '#ef4444' },
  too_strong: { text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30', stroke: '#f59e0b' },
};

export const OPTICAL_HELP = {
  good: 'Healthy signal.',
  marginal: 'Signal is weak — schedule a check before it fails.',
  critical: 'Signal is failing. Check the fibre run and clean the connectors.',
  too_strong: 'Signal is too strong — the ONT may be too close to the splitter.',
};

const SCALE_MIN = -30;
const SCALE_MAX = -5;

/** Where a reading sits on the meter, 0–1. */
export function opticalFraction(dbm) {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, dbm));
  return (clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
}

export function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function relativeTime(iso) {
  if (!iso) return 'never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function absoluteTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

/**
 * The console's signature element: receive power as a position on the band
 * scale rather than a bare number, so "is this fibre healthy" is answered
 * without knowing what −26 dBm means.
 */
export function OpticalMeter({ dbm, health, compact = false }) {
  if (dbm === null || dbm === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Signal className="h-3.5 w-3.5" />
        No optical reading
      </div>
    );
  }
  const tone = OPTICAL_TONE[health] || OPTICAL_TONE.good;
  const left = opticalFraction(dbm) * 100;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`font-mono text-sm font-semibold tabular-nums ${tone.text}`}>
          {dbm} dBm
        </span>
        {!compact && (
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}>
            {(OPTICAL_BANDS.find((b) => b.key === health) || {}).label || health}
          </span>
        )}
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {OPTICAL_BANDS.map((band) => (
          <span
            key={band.key}
            className={`absolute inset-y-0 ${band.bar} opacity-30`}
            style={{
              left: `${opticalFraction(band.from) * 100}%`,
              width: `${(opticalFraction(band.to) - opticalFraction(band.from)) * 100}%`,
            }}
          />
        ))}
        <span
          className="absolute -top-0.5 h-2.5 w-1 -translate-x-1/2 rounded-full bg-slate-900 shadow ring-2 ring-white dark:bg-white dark:ring-slate-900"
          style={{ left: `${left}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-400">
          <span>{SCALE_MIN}</span>
          <span>{SCALE_MAX}</span>
        </div>
      )}
    </div>
  );
}

function polar(cx, cy, r, fraction) {
  const angle = Math.PI * (1 - fraction);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arcPath(cx, cy, r, from, to) {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Detail-page version of the meter — same scale, drawn as a gauge. */
export function OpticalGauge({ dbm, health }) {
  const cx = 110;
  const cy = 104;
  const r = 84;
  const tone = OPTICAL_TONE[health] || OPTICAL_TONE.good;
  const hasReading = dbm !== null && dbm !== undefined;
  const needle = hasReading ? polar(cx, cy, r - 4, opticalFraction(dbm)) : null;

  return (
    <svg viewBox="0 0 220 128" className="w-full max-w-[240px]" role="img" aria-label="Optical receive power">
      <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" className="text-slate-100 dark:text-slate-800" />
      {OPTICAL_BANDS.map((band) => (
        <path
          key={band.key}
          d={arcPath(cx, cy, r, opticalFraction(band.from), opticalFraction(band.to))}
          fill="none"
          strokeWidth="16"
          stroke={OPTICAL_TONE[band.key].stroke}
          opacity="0.35"
        />
      ))}
      {hasReading && (
        <>
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={tone.stroke} strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill={tone.stroke} />
        </>
      )}
      <text x={cx - r} y={cy + 18} textAnchor="middle" className="fill-slate-400 text-[10px]">{SCALE_MIN}</text>
      <text x={cx + r} y={cy + 18} textAnchor="middle" className="fill-slate-400 text-[10px]">{SCALE_MAX}</text>
    </svg>
  );
}

/** Live pulse, so an online device reads as live and not merely green. */
export function LiveDot({ online }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
    </span>
  );
}
