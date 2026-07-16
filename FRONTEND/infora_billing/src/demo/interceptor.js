/**
 * window.fetch interceptor for demo mode.
 *
 * Any request whose path starts with /api/ is answered locally from the
 * demo router — the network is never touched. Everything else (static
 * assets, source maps, …) passes through to the real fetch.
 */
import { DEMO_LATENCY } from './config';
import { dispatchDemoRequest } from './router';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseTarget(input) {
  const raw = typeof input === 'string' ? input : input?.url || String(input);
  try {
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
}

async function parseBody(input, init) {
  const source = init?.body ?? (typeof input !== 'string' ? input?.body : null);
  if (!source) return null;
  try {
    if (typeof source === 'string') return JSON.parse(source);
  } catch {
    return null;
  }
  return null;
}

export function installDemoInterceptor() {
  if (window.__lumenDemoInstalled) return;
  window.__lumenDemoInstalled = true;

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = parseTarget(input);
    if (!url || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }

    const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const body = await parseBody(input, init);

    // Simulated latency so spinners/skeletons behave like production.
    await sleep(DEMO_LATENCY.min + Math.random() * (DEMO_LATENCY.max - DEMO_LATENCY.min));

    let payload;
    try {
      payload = dispatchDemoRequest(method, url.pathname, url.searchParams, body);
    } catch (err) {
      console.error('[lumen-demo] handler error for', method, url.pathname, err);
      payload = { success: true, message: 'Demo mode', data: [] };
    }

    // Script/config downloads are served as plain text.
    if (payload && typeof payload === 'object' && '__text' in payload) {
      return new Response(payload.__text, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response(JSON.stringify(payload ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
