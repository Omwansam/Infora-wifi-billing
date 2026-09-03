import { useCallback, useEffect, useState } from 'react';

const KEY = 'lumen-docs-theme';

/** The theme actually in force, resolving "system" against the OS setting. */
function resolve(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    // Private windows and blocked site data throw on access, not on read.
    return 'system';
  }
}

/**
 * Class-based dark mode for the docs only.
 *
 * The marketing site is light-only and hardcodes `bg-white` on the app root, so
 * the class goes on <html> and every docs surface paints its own background.
 * Nothing outside /docs reads it.
 */
export function useTheme() {
  const [preference, setPreference] = useState(readStored);
  const [resolved, setResolved] = useState(() =>
    typeof window === 'undefined' ? 'light' : resolve(readStored()),
  );

  useEffect(() => {
    const apply = () => {
      const next = resolve(preference);
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
    };
    apply();

    // Only a "system" preference should follow the OS as it changes.
    if (preference !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  // The class is scoped to the docs: leaving it set would tint the marketing
  // pages, which have no dark variants at all.
  useEffect(() => () => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  }, []);

  const toggle = useCallback(() => {
    setPreference((current) => {
      const next = resolve(current) === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* not fatal */ }
      return next;
    });
  }, []);

  return { theme: resolved, toggle };
}
