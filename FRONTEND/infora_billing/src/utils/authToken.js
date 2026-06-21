import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';

/** Shared access token for authenticated API calls. */
export function getAccessToken() {
  try {
    const userData =
      localStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(LEGACY_STORAGE_KEYS.user);
    if (userData) {
      const user = JSON.parse(userData);
      if (user?.access_token) {
        return user.access_token;
      }
    }
    return localStorage.getItem('token') || localStorage.getItem('adminToken') || null;
  } catch {
    return localStorage.getItem('token') || null;
  }
}
