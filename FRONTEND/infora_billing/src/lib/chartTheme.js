import { useTheme } from '../contexts/ThemeContext';

// Fixed categorical order (validated with the dataviz palette validator — light &
// dark both PASS). Assign hues in this order, never cycled.
export const CATEGORICAL_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
export const CATEGORICAL_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

/** Theme-aware chart tokens for Recharts (re-renders on theme toggle via context). */
export function useChartTheme() {
  const { isDark } = useTheme();
  return {
    isDark,
    palette: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    primary: isDark ? '#3987e5' : '#2a78d6',
    axis: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#1e293b' : '#e2e8f0',
    surface: isDark ? '#0f172a' : '#ffffff',
    text: isDark ? '#e2e8f0' : '#0f172a',
  };
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
