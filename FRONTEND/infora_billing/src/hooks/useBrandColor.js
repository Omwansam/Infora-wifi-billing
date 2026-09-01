import { useEffect } from 'react';
import { applyBrandColor, DEFAULT_BRAND } from '../lib/brandColor';
import settingsService from '../services/settingsService';
import { getAccessToken } from '../utils/authToken';

const CACHE_KEY = 'lumen-brand-color';

/**
 * Apply the tenant's brand colour to the console.
 *
 * The cached value is applied synchronously on mount so a reload does not flash
 * the previous colour while /api/settings/general is in flight; the response
 * then overwrites it. A failed fetch is deliberately silent — a colour is not
 * worth an error toast, and the cached (or default) value still renders a
 * correct-looking page.
 */
export default function useBrandColor() {
  useEffect(() => {
    let cancelled = false;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) applyBrandColor(cached);
    } catch {
      /* private mode / storage disabled — the CSS defaults still apply */
    }

    const token = getAccessToken();
    if (!token) return undefined;

    (async () => {
      try {
        const res = await settingsService.getGeneral(token);
        const color = res?.theme_color || DEFAULT_BRAND;
        if (cancelled) return;
        applyBrandColor(color);
        try {
          localStorage.setItem(CACHE_KEY, color);
        } catch {
          /* ignore */
        }
      } catch {
        /* keep whatever is already applied */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
