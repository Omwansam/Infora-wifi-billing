/**
 * The sign-in / sign-up palette.
 *
 * These two screens own their colours rather than reading the console tokens in
 * lib/theme.ts, which is exactly what the web build does: `.auth` and `.onb`
 * declare their own `--auth-*` / `--onb-*` variables so the entrance can look
 * like nothing else in the product without shifting a single existing screen.
 *
 * Values are the ones from FRONTEND/infora_billing/src/components/auth/login.css
 * and components/onboarding/onboarding.css, so the phone and the browser cannot
 * drift apart. Sign-in is emerald on near-black; the signup wizard is amber, and
 * that difference is deliberate — it tells you which of the two you are in
 * before you have read a word.
 *
 * Consumed as `style={{...}}` rather than through tailwind because it is one
 * self-contained scope. Adding twenty single-use colours to tailwind.config
 * would put them in reach of every other screen, which is the thing the web
 * build deliberately avoided.
 */
import { Platform } from 'react-native';

export interface AuthPalette {
  scheme: 'light' | 'dark';
  /** Page background. */
  bg: string;
  /** Raised card surface. */
  card: string;
  /** Inset surface — inputs, code fields, read-only chips. */
  inset: string;
  line: string;
  lineSoft: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentHi: string;
  /** Translucent accent for badges and icon tiles. */
  accentSoft: string;
  /** Text/icon colour that reads on top of a solid `accent` fill. */
  onAccent: string;
  ok: string;
  err: string;
  /** Backdrop tuning — dot matrix and the arc/run/node strokes. */
  dot: string;
  glow: string;
}

/* --- Sign in: emerald on near-black ------------------------------------- */

const signInDark: AuthPalette = {
  scheme: 'dark',
  bg: '#0b0d0c',
  card: '#111413',
  inset: '#0b0d0c',
  line: '#232826',
  lineSoft: '#1a1e1c',
  text: '#f2f5f4',
  textDim: '#9aa5a1',
  textFaint: '#6b7570',
  accent: '#10b981',
  accentHi: '#34d399',
  accentSoft: 'rgba(16, 185, 129, 0.14)',
  onAccent: '#04150f',
  ok: '#34d399',
  err: '#f43f5e',
  dot: '#2b312e',
  glow: 'rgba(16, 185, 129, 0.10)',
};

const signInLight: AuthPalette = {
  scheme: 'light',
  bg: '#f7f8f8',
  card: '#ffffff',
  inset: '#f7f8f8',
  line: '#e3e7e6',
  lineSoft: '#eef1f0',
  text: '#10201a',
  textDim: '#52625c',
  textFaint: '#94a29c',
  accent: '#059669',
  accentHi: '#10b981',
  accentSoft: 'rgba(16, 185, 129, 0.12)',
  onAccent: '#ffffff',
  ok: '#059669',
  err: '#e11d48',
  dot: '#cfd8d4',
  glow: 'rgba(16, 185, 129, 0.10)',
};

/* --- Signup wizard: amber on near-black --------------------------------- */

const signUpDark: AuthPalette = {
  scheme: 'dark',
  bg: '#0c0c0d',
  card: '#111113',
  inset: '#141416',
  line: '#2a2a2e',
  lineSoft: '#1e1e21',
  text: '#f5f5f6',
  textDim: '#a1a1aa',
  textFaint: '#6b6b73',
  accent: '#f5920b',
  accentHi: '#ff9f1a',
  accentSoft: 'rgba(245, 146, 11, 0.14)',
  onAccent: '#1a1103',
  ok: '#22c55e',
  err: '#ef4444',
  dot: '#2a2a2e',
  glow: 'rgba(245, 146, 11, 0.12)',
};

const signUpLight: AuthPalette = {
  scheme: 'light',
  bg: '#fafaf9',
  card: '#ffffff',
  inset: '#ffffff',
  line: '#e4e4e7',
  lineSoft: '#efeff1',
  text: '#18181b',
  textDim: '#52525b',
  textFaint: '#a1a1aa',
  accent: '#ea7c05',
  accentHi: '#f5920b',
  accentSoft: 'rgba(234, 124, 5, 0.12)',
  onAccent: '#ffffff',
  ok: '#16a34a',
  err: '#dc2626',
  dot: '#dcdcdf',
  glow: 'rgba(234, 124, 5, 0.10)',
};

export type AuthScope = 'signin' | 'signup';

const PALETTES: Record<AuthScope, Record<'light' | 'dark', AuthPalette>> = {
  signin: { light: signInLight, dark: signInDark },
  signup: { light: signUpLight, dark: signUpDark },
};

export function authPalette(scope: AuthScope, scheme: 'light' | 'dark'): AuthPalette {
  return PALETTES[scope][scheme];
}

/**
 * Uppercase monospace is how both pages mark machine-issued values — the
 * account address, the OTP, the copyright line. `ui-monospace` is a web-only
 * keyword, so each platform names the face it actually ships.
 */
export const mono = Platform.select({
  ios: { fontFamily: 'Menlo' },
  android: { fontFamily: 'monospace' },
  default: { fontFamily: 'ui-monospace' },
}) as { fontFamily: string };
