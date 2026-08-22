/**
 * Forgot / reset password.
 *
 * Returns `{ ok, data, error }` rather than throwing, in the same shape as
 * onboardingService — `apiCall` never throws, and a call site that checks only
 * `success` silently does nothing on failure. On a password form that means a
 * dead button, which is the one place people cannot afford to be guessing.
 */
import { API_ENDPOINTS } from '../config/api';

const GENERIC = 'Something went wrong. Please try again.';

async function send(url, options) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      return { ok: false, data, error: (data && (data.error || data.message)) || GENERIC };
    }
    return { ok: true, data: data || {}, error: null };
  } catch {
    return { ok: false, data: null, error: 'Network error. Check your connection.' };
  }
}

/** Always resolves ok — the backend answers identically for unknown addresses. */
export const requestReset = (email) =>
  send(API_ENDPOINTS.FORGOT_PASSWORD, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const checkResetToken = (token) =>
  send(API_ENDPOINTS.resetPasswordCheck(token), { method: 'GET' });

export const submitReset = (token, password, confirmPassword) =>
  send(API_ENDPOINTS.RESET_PASSWORD, {
    method: 'POST',
    body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
  });
