/**
 * Demo mode bootstrap — call setupDemo() before React renders.
 *
 * 1. Patches window.fetch so every /api/* call is served from fixtures.
 * 2. Pre-seeds auth storage so visitors land straight on the dashboard
 *    (no login wall). Logging out and back in with ANY credentials works
 *    too — the mock login always succeeds as the demo admin.
 */
import { STORAGE_KEYS } from '../lib/brand';
import { DEMO_MODE, DEMO_TOKEN, DEMO_REFRESH_TOKEN, DEMO_USER } from './config';
import { installDemoInterceptor } from './interceptor';

export { DEMO_MODE } from './config';
export { default as DemoBanner } from './DemoBanner';

function seedDemoAuth() {
  const stored = {
    id: String(DEMO_USER.id),
    email: DEMO_USER.email,
    first_name: DEMO_USER.first_name,
    last_name: DEMO_USER.last_name,
    role: DEMO_USER.role,
    is_admin: DEMO_USER.is_admin,
    access_token: DEMO_TOKEN,
    refresh_token: DEMO_REFRESH_TOKEN,
  };
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(stored));
  localStorage.setItem('token', DEMO_TOKEN);
  localStorage.setItem('adminToken', DEMO_TOKEN);
  localStorage.setItem('adminRefreshToken', DEMO_REFRESH_TOKEN);
}

export function setupDemo() {
  if (!DEMO_MODE) return;
  installDemoInterceptor();
  seedDemoAuth();
  // eslint-disable-next-line no-console
  console.info(
    '%c Lumen demo mode ',
    'background:#7c3aed;color:#fff;border-radius:4px',
    '— all API calls are simulated in-browser; data resets on reload.'
  );
}
