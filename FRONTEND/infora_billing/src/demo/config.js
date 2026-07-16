/**
 * Demo mode configuration.
 *
 * The demo build (demo.ruirufactorymabati.com) ships with VITE_DEMO_MODE=true.
 * All /api/* requests are intercepted in the browser and served from seeded
 * in-memory fixtures — no backend is contacted and nothing persists, so the
 * demo resets itself on every page reload.
 */
export const DEMO_MODE =
  String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

export const MARKETING_URL =
  import.meta.env.VITE_MARKETING_URL || 'https://ruirufactorymabati.com';

export const DEMO_TOKEN = 'demo-access-token';
export const DEMO_REFRESH_TOKEN = 'demo-refresh-token';

export const DEMO_USER = {
  id: 1,
  email: 'demo@lumen.app',
  first_name: 'Demo',
  last_name: 'Admin',
  role: 'admin',
  is_admin: true,
};

/**
 * Credentials shown pre-filled on the demo login page. The mock login
 * accepts anything — these just make the flow feel like a real sign-in.
 */
export const DEMO_CREDENTIALS = {
  email: DEMO_USER.email,
  password: 'demo1234',
};

/** Simulated network latency range (ms) so the UI feels like a real API. */
export const DEMO_LATENCY = { min: 90, max: 320 };
