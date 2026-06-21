import { APP_URL } from '../lib/brand';

const STORAGE_KEY = 'lumen_user';

/** Persist auth session for handoff to the billing app (same key as billing frontend). */
export function saveAuthSession(payload) {
  const userData = {
    id: String(payload.user.id),
    email: payload.user.email,
    first_name: payload.user.first_name,
    last_name: payload.user.last_name,
    role: payload.user.role,
    is_admin: payload.user.is_admin,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  localStorage.setItem('token', payload.access_token);
  if (payload.refresh_token) {
    localStorage.setItem('adminRefreshToken', payload.refresh_token);
  }
  if (userData.is_admin) {
    localStorage.setItem('adminToken', payload.access_token);
  }

  return userData;
}

export function redirectToBillingApp(path = '/') {
  window.location.href = `${APP_URL}${path}`;
}

export function handoffToBillingApp(payload, path = '/') {
  saveAuthSession(payload);
  redirectToBillingApp(path);
}
