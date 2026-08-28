/**
 * HTTP client for the Infora API. Mirrors the web app's `authenticatedApiCall`
 * envelope ({ success, status, data, error }) and adds a mobile-friendly
 * timeout + one-shot token refresh on 401.
 */
import { api, API_BASE_URL, ENDPOINTS, REQUEST_TIMEOUT } from './config';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from './session';

export interface ApiResult<T> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  /** Extra query params. */
  params?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const url = api(path);
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function rawRequest<T>(path: string, opts: RequestOptions): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const token = opts.auth === false ? null : getAccessToken();

  try {
    const res = await fetch(buildUrl(path, opts.params), {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal ?? controller.signal,
    });

    const contentType = res.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && (data.error || data.message)) ||
        `Request failed (${res.status})`;
      // Keep the body on a failure, not just its message. The signup wizard
      // reacts to flags the backend sends *alongside* an error — `resend_in`,
      // `attempts_left`, `suggestion`, `email_in_use` — and dropping them here
      // turns "3 attempts left" into a dead end.
      return { success: false, status: res.status, error: String(message), data: data as T };
    }
    return { success: true, status: res.status, data: data as T };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      status: 0,
      error: aborted
        ? 'Request timed out. Check your connection and the API URL.'
        : 'Cannot reach the server. Is the backend running?',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempt a token refresh; returns true on success.
 *
 * Flask-JWT reads the refresh token from the Authorization header, not the
 * body, so this cannot go through `rawRequest` — that one always attaches the
 * *access* token.
 */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(api(ENDPOINTS.refresh), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { access_token?: string } | null;
    if (!body?.access_token) return false;
    await updateAccessToken(body.access_token);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Core request with automatic 401 refresh-and-retry. Throws ApiError on failure. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('No API URL configured (running in demo mode).', 0);
  }
  let res = await rawRequest<T>(path, opts);

  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest<T>(path, opts);
    } else {
      await clearSession();
    }
  }

  if (!res.success) throw new ApiError(res.error ?? 'Request failed', res.status);
  return res.data as T;
}

/**
 * Public request that resolves to the `{ success, status, data, error }`
 * envelope instead of throwing.
 *
 * Sign-in and the signup wizard need the *body* of a failure — `requires_2fa`,
 * `resend_in`, `attempts_left`, `suggestion` — not just its message, and they
 * need to put every error in front of a person rather than swallowing it. A
 * thrown ApiError loses all of that.
 */
export async function publicRequest<T>(
  path: string,
  opts: Omit<RequestOptions, 'auth'> = {},
): Promise<ApiResult<T>> {
  if (!API_BASE_URL) {
    return { success: false, status: 0, error: 'No API URL configured (running in demo mode).' };
  }
  return rawRequest<T>(path, { ...opts, auth: false });
}

export const http = {
  get: <T>(path: string, params?: RequestOptions['params']) => request<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body, auth }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
