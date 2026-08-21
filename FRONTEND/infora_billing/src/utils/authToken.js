import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../lib/brand';

/**
 * Where the session is kept.
 *
 * "Keep me signed in" chooses between localStorage (survives closing the
 * browser) and sessionStorage (gone when the tab is). Reads check session
 * first so an opted-out login cannot be shadowed by a stale remembered one.
 */
export function readStoredUser() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEYS.user) || store.getItem(LEGACY_STORAGE_KEYS.user);
      if (raw) return raw;
    } catch {
      /* storage unavailable — try the next one */
    }
  }
  return null;
}

export function writeStoredUser(json, remember = true) {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  try {
    other.removeItem(STORAGE_KEYS.user);
  } catch { /* nothing to clear */ }
  try {
    target.setItem(STORAGE_KEYS.user, json);
  } catch { /* private mode — the session lives in memory for this tab only */ }
}

/** Remove every stored auth credential (mirrors AuthContext logout). */
export function clearStoredAuth() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.user);
    sessionStorage.removeItem(LEGACY_STORAGE_KEYS.user);
  } catch { /* storage unavailable */ }
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
    const userData = readStoredUser();
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
