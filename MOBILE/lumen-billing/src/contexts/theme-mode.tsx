/**
 * Theme mode — light, dark, or follow the system.
 *
 * The console has a theme toggle on its sign-in page, so the phone has one too,
 * and a preference nobody has expressed is not a preference: `system` is a real
 * third state rather than "light, until you notice". Only an explicit choice is
 * persisted, which is why the stored value can be absent.
 *
 * NativeWind resolves `dark:` from its own colour-scheme observable, and that
 * observable only accepts a manual value when tailwind is on `darkMode: 'class'`
 * — see tailwind.config.js. With nothing set it still falls through to the
 * system appearance, so the default behaviour is unchanged.
 *
 * Storage goes through `services/secure-storage` for the same reason the
 * session does: expo-secure-store has no web build, so calling it directly
 * rejects on every web request and the preference would never survive a reload.
 */
import { useColorScheme } from 'nativewind';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as storage from '@/services/secure-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'lumen.theme';

interface ThemeModeValue {
  /** What the user asked for. */
  mode: ThemeMode;
  /** What that resolves to right now — never 'system'. */
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  /** Flip to the opposite of what is on screen, pinning it explicitly. */
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restore the saved choice once on boot. A read failure is not worth
  // surfacing — it just means we follow the system, which is the default.
  useEffect(() => {
    let active = true;
    storage.getItem(KEY).then((saved) => {
      if (!active || (saved !== 'light' && saved !== 'dark')) return;
      setModeState(saved);
      setColorScheme(saved);
    });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      if (next === 'system') {
        storage.removeItem(KEY);
      } else {
        storage.setItem(KEY, next);
      }
    },
    [setColorScheme],
  );

  const scheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light';
  const toggle = useCallback(
    () => setMode(scheme === 'dark' ? 'light' : 'dark'),
    [scheme, setMode],
  );

  const value = useMemo(
    () => ({ mode, scheme, setMode, toggle }),
    [mode, scheme, setMode, toggle],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider');
  return ctx;
}
