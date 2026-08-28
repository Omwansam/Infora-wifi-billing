/**
 * Session storage — persists the JWT pair + user through `secure-storage`
 * (the device keychain on native, localStorage on web) with an in-memory cache
 * for synchronous token reads.
 */
import * as storage from './secure-storage';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  isAdmin: boolean;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser;
}

const KEY = 'infora.session';

let cache: StoredSession | null = null;

/**
 * Whether the cached session is also on disk.
 *
 * "Keep me signed in: off" has to mean something on a borrowed phone, and the
 * only thing it can mean is that the tokens never reach the keychain. That flag
 * has to survive a token refresh too — otherwise the first refresh quietly
 * writes out a session the user asked us not to keep.
 */
let persisted = true;

/** Load the persisted session into the in-memory cache (call once on boot). */
export async function loadSession(): Promise<StoredSession | null> {
  const raw = await storage.getItem(KEY);
  try {
    cache = raw ? (JSON.parse(raw) as StoredSession) : null;
    persisted = true;
  } catch {
    // Corrupt JSON — drop it rather than wedging every boot from here on.
    cache = null;
    await storage.removeItem(KEY);
  }
  return cache;
}

/**
 * Cache the session, and persist it unless the user opted out.
 *
 * A non-persisted session still clears anything already on disk — signing in
 * with "keep me signed in" off must not leave the *previous* session behind.
 */
export async function saveSession(session: StoredSession, persist = true): Promise<void> {
  cache = session;
  if (!persist) {
    persisted = false;
    await storage.removeItem(KEY);
    return;
  }
  // A store that refuses the write is a reason not to *remember* the session,
  // not a reason to refuse the sign-in that just succeeded: the tokens are
  // already in memory and work for this run.
  persisted = await storage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cache = null;
  persisted = true;
  await storage.removeItem(KEY);
}

/** Update just the access token (used after a refresh) without a round-trip. */
export async function updateAccessToken(accessToken: string): Promise<void> {
  if (!cache) return;
  cache = { ...cache, accessToken };
  if (persisted) await storage.setItem(KEY, JSON.stringify(cache));
}

/** Synchronous cache accessors. */
export const getAccessToken = () => cache?.accessToken ?? null;
export const getRefreshToken = () => cache?.refreshToken ?? null;
export const getUser = () => cache?.user ?? null;
