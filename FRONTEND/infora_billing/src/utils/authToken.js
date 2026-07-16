import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';

/** Remove every stored auth credential (mirrors AuthContext logout). */
export function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(LEGACY_STORAGE_KEYS.user);
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
  } catch {
    // storage unavailable — nothing to clear
  }
}

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
