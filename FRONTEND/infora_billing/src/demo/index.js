/**
 * Demo mode bootstrap — call setupDemo() before React renders.
 *
 * 1. Patches window.fetch so every /api/* call is served from fixtures.
 * 2. Clears any stored auth so every visit starts at the demo landing
 *    page → pre-filled login → dashboard, like a real first sign-in.
 *    The mock login always succeeds as the demo admin, whatever the
 *    credentials.
 */
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';
import { DEMO_MODE } from './config';
import { installDemoInterceptor } from './interceptor';

export { DEMO_MODE } from './config';
export { default as DemoBanner } from './DemoBanner';
export { default as DemoLanding } from './DemoLanding';

function resetDemoAuth() {
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(LEGACY_STORAGE_KEYS.user);
  localStorage.removeItem('token');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminRefreshToken');
}

export function setupDemo() {
  if (!DEMO_MODE) return;
  installDemoInterceptor();
  resetDemoAuth();
  // eslint-disable-next-line no-console
  console.info(
    '%c Lumen demo mode ',
    'background:#7c3aed;color:#fff;border-radius:4px',
    '— all API calls are simulated in-browser; data resets on reload.'
  );
}
