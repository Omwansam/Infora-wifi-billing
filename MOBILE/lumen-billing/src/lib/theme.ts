/**
 * Design tokens for the Infora mobile app.
 *
 * NativeWind `className` handles most styling. This file exposes the same
 * palette as raw values for the places className can't reach — icon tint
 * colors, chart fills, gradients, native tab bars, status bars.
 *
 * Palette mirrors the Infora web admin (primary blue #2563EB, slate neutrals).
 */
import { useColorScheme } from 'nativewind';

export const palette = {
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  violet: '#6366f1',
  magenta: '#a855f7',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  white: '#ffffff',
} as const;

export interface AppTheme {
  scheme: 'light' | 'dark';
  bg: string; // app background
  card: string; // raised card surface
  raised: string; // secondary surface (chips, inputs)
  border: string;
  text: string; // primary text
  textMuted: string; // secondary text
  textFaint: string; // tertiary text
  tint: string; // brand tint
  icon: string; // default icon color
}

const light: AppTheme = {
  scheme: 'light',
  bg: palette.slate[50],
  card: palette.white,
  raised: palette.slate[100],
  border: palette.slate[200],
  text: palette.slate[900],
  textMuted: palette.slate[500],
  textFaint: palette.slate[400],
  tint: palette.brand[600],
  icon: palette.slate[500],
};

const dark: AppTheme = {
  scheme: 'dark',
  bg: palette.slate[950],
  card: palette.slate[900],
  raised: palette.slate[800],
  border: palette.slate[800],
  text: palette.slate[50],
  textMuted: palette.slate[400],
  textFaint: palette.slate[500],
  tint: palette.brand[500],
  icon: palette.slate[400],
};

/** Resolve the active theme tokens for the current color scheme. */
export function useAppTheme(): AppTheme {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? dark : light;
}

/** Semantic colors for entity statuses shared across the app. */
export const statusColor: Record<string, string> = {
  active: palette.success,
  online: palette.success,
  completed: palette.success,
  paid: palette.success,
  verified: palette.success,
  resolved: palette.success,
  won: palette.success,
  used: palette.slate[400],
  pending: palette.warning,
  in_progress: palette.info,
  draft: palette.slate[400],
  suspended: palette.warning,
  overdue: palette.danger,
  failed: palette.danger,
  rejected: palette.danger,
  expired: palette.danger,
  offline: palette.danger,
  open: palette.info,
  closed: palette.slate[400],
};
