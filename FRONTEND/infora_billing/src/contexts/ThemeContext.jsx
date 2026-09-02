import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../lib/brand';

const ThemeContext = createContext(null);

/* ---------------------------------------------------------------------------
 * Three states, not two.
 *
 * The preference is 'system' | 'light' | 'dark'. Only the last two are choices
 * an operator made; 'system' means "whatever the OS is doing right now", and it
 * is the default.
 *
 * That distinction is the whole point. The previous version read
 * prefers-color-scheme once at startup and then persisted the result on mount,
 * so the very first load wrote an explicit choice the user never made. From then
 * on the saved value always won and the app never consulted the OS again -- it
 * followed the system exactly once, ever. Switching the machine to dark in the
 * evening left the console light until someone found the toggle.
 *
 * So: 'system' is never written as 'light' or 'dark', and while it is in force a
 * matchMedia listener repaints on OS changes live.
 * ------------------------------------------------------------------------- */

const MEDIA = '(prefers-color-scheme: dark)';
const VALID = new Set(['system', 'light', 'dark']);
// Bumped when the meaning of the stored value changes. v2 = 'system' is a value.
const PREFERENCE_VERSION = 'lumen-theme-v2';

/**
 * Clear the value the old provider wrote on every mount.
 *
 * It persisted the *resolved* theme, so every existing install has a stored
 * 'light' or 'dark' that nobody chose — it is just whatever the OS happened to
 * be on first load. Keeping it would pin everyone forever and defeat the whole
 * point of following the system, and a genuine preference is one toggle away.
 * Runs once per browser.
 */
function migrateLegacyPreference() {
  try {
    if (localStorage.getItem(PREFERENCE_VERSION)) return;
    localStorage.removeItem(STORAGE_KEYS.theme);
    localStorage.setItem(PREFERENCE_VERSION, '1');
  } catch {
    // Storage unavailable; nothing to migrate.
  }
}

function readPreference() {
  if (typeof window === 'undefined') return 'system';
  migrateLegacyPreference();
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    return VALID.has(saved) ? saved : 'system';
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null, and a theme preference is never worth a blank page.
    return 'system';
  }
}

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MEDIA).matches;
}

/** The theme actually painted, once 'system' has been resolved against the OS. */
function resolve(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark() ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Tells the browser chrome (mobile address bar, form controls) which way to
  // render, so a dark console does not get a light scrollbar bolted to it.
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow the OS while the preference is 'system'. The listener is always
  // attached rather than conditionally: an operator who switches back to
  // 'system' should get the current OS value, not the one from page load.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia(MEDIA);
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Persist the *preference*, never the resolved theme -- writing 'dark' here
  // when the user only ever accepted the default is what broke OS following.
  useEffect(() => {
    try {
      if (preference === 'system') {
        localStorage.removeItem(STORAGE_KEYS.theme);
      } else {
        localStorage.setItem(STORAGE_KEYS.theme, preference);
      }
    } catch {
      // Storage unavailable: the theme still applies for this session.
    }
  }, [preference]);

  // Toggling is an explicit choice, so it leaves 'system' behind and pins the
  // opposite of what is on screen.
  const toggleTheme = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  const setTheme = useCallback((next) => {
    setPreference(VALID.has(next) ? next : 'system');
  }, []);

  const setLightTheme = useCallback(() => setPreference('light'), []);
  const setDarkTheme = useCallback(() => setPreference('dark'), []);
  const useSystemTheme = useCallback(() => setPreference('system'), []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      isDark: theme === 'dark',
      followsSystem: preference === 'system',
      toggleTheme,
      setTheme,
      setLightTheme,
      setDarkTheme,
      useSystemTheme,
    }),
    [theme, preference, toggleTheme, setTheme, setLightTheme, setDarkTheme, useSystemTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Call once before React mount to avoid a flash of the wrong theme. */
export function initTheme() {
  applyTheme(resolve(readPreference()));
}
