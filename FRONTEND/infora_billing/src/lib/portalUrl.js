/**
 * Resolve the URL to open the captive portal in the browser.
 *
 * In local dev the API runs on :5000 but the portal SPA is on Vite (:5173).
 * The backend should return PORTAL_BASE_URL, but this helper rewrites API-origin
 * links when the admin UI is already on the Vite dev server.
 */
export function resolvePortalOpenUrl(apiUrl, ispId) {
  const fallback = `${window.location.origin}/portal${
    ispId != null ? `?isp_id=${encodeURIComponent(ispId)}` : ''
  }`;

  if (!apiUrl) return fallback;

  try {
    const target = new URL(apiUrl, window.location.origin);
    const here = window.location;
    const apiPorts = new Set(['5000', '5080', '8000']);
    const onViteDev = here.port === '5173' || here.port === '5174';
    const pointsAtApi =
      apiPorts.has(target.port) ||
      (target.hostname === here.hostname && target.port && target.port !== here.port);

    if (onViteDev && pointsAtApi) {
      return `${here.origin}${target.pathname}${target.search}`;
    }
    return target.href;
  } catch {
    return fallback;
  }
}
