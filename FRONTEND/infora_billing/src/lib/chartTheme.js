import { useTheme } from '../contexts/ThemeContext';

/* -------------------------------------------------------------------------
 * The console's chart palette. One palette, used everywhere — the subscriber
 * detail page, every Reports page, the device history charts and the sparkline
 * all read from here, so a series colour means the same thing across the app.
 *
 * Led by the console's own accent rather than a generic chart blue: emerald is
 * the accent, indigo and sky the secondary tints, exactly as the page chrome
 * uses them. Slots are assigned in this fixed order and never cycled — the
 * order is what makes the palette colourblind-safe, so a sixth series folds
 * into "Other" instead of getting a generated hue.
 *
 * Validated with the dataviz palette validator: light (surface #ffffff) and
 * dark (surface #0f172a) both PASS all six checks — lightness band, chroma
 * floor, CVD separation, normal-vision floor and contrast. The two modes are
 * separately chosen steps, not one flipped into the other; only the indigo
 * slot differs, because indigo-600 falls out of the dark lightness band.
 *
 * Caveat worth knowing: on an *all-pairs* test (scatter, bubble, choropleth,
 * small multiples — where any two marks can end up adjacent) emerald↔amber
 * lands at ΔE 7.9, inside the 6–8 floor band. Every chart in this console is a
 * line, area, bar or stack, where only neighbours touch, so the adjacent test
 * is the right one. If a scatter is ever added, cap it at three series or
 * facet it rather than reaching for more slots.
 * ---------------------------------------------------------------------- */
export const CATEGORICAL_LIGHT = ['#059669', '#4f46e5', '#d97706', '#0284c7', '#db2777'];
export const CATEGORICAL_DARK = ['#059669', '#6366f1', '#d97706', '#0284c7', '#db2777'];

/* Sequential ramp — for magnitude, not identity: the activity calendar and the
 * peak-hours grid, where a cell's colour says *how much*, never *which*. One
 * hue (the accent's), monotone lightness, and the pale end still clears the
 * surface. Checked with the validator's ordinal mode; both modes PASS.
 *
 * Dark is a chosen ramp, not an inversion of light: it runs dark→light so the
 * heaviest cell is the brightest against a dark surface, which is the same
 * "more ink = more data" reading the light ramp gives.
 *
 * The empty step is not part of the ramp. A day with no session is an absence
 * of data, not a low value, so it wears a surface tint and never the palest
 * green — otherwise "nothing happened" and "a little happened" look alike.
 */
export const SEQUENTIAL_LIGHT = ['#3fca9a', '#12a074', '#0b7a58', '#065f46'];
export const SEQUENTIAL_DARK = ['#065f46', '#047857', '#059669', '#34d399'];
export const SEQUENTIAL_EMPTY_LIGHT = '#eef2f7';
export const SEQUENTIAL_EMPTY_DARK = '#1e293b';

/** Theme-aware chart tokens for Recharts (re-renders on theme toggle via context). */
export function useChartTheme() {
  const { isDark } = useTheme();
  return {
    isDark,
    palette: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    // Slot 1 is the accent, and emerald-600 clears 3:1 against both surfaces —
    // so unlike the other tokens this one needs no per-mode step.
    primary: CATEGORICAL_LIGHT[0],
    axis: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#1e293b' : '#e2e8f0',
    surface: isDark ? '#0f172a' : '#ffffff',
    text: isDark ? '#e2e8f0' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    sequential: isDark ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT,
    sequentialEmpty: isDark ? SEQUENTIAL_EMPTY_DARK : SEQUENTIAL_EMPTY_LIGHT,
  };
}

/**
 * Pick a ramp step for `value` against `max`.
 *
 * Zero returns the empty tint, never step 0 — see the ramp comment above.
 * Buckets are on a square root so a single heavy day does not flatten a whole
 * year of ordinary ones into the palest step, which is the failure mode of a
 * linear scale on traffic data.
 */
export function rampStep(value, max, theme) {
  if (!value || value <= 0 || !max) return theme.sequentialEmpty;
  const steps = theme.sequential;
  const ratio = Math.sqrt(value / max);
  const index = Math.min(steps.length - 1, Math.floor(ratio * steps.length));
  return steps[index];
}

/** Shared tooltip style for a consistent look across report charts. */
export function tooltipStyle(t) {
  return {
    contentStyle: {
      background: t.isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${t.grid}`,
      borderRadius: 12,
      fontSize: 12,
      color: t.text,
    },
    labelStyle: { color: t.text, fontWeight: 600 },
    itemStyle: { color: t.text },
    cursor: { fill: t.isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' },
  };
}
