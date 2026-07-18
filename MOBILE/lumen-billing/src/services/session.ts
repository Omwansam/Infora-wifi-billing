/**
 * Session storage — persists the JWT pair + user in the device keychain
 * (expo-secure-store) with an in-memory cache for synchronous token reads.
 */
import * as SecureStore from 'expo-secure-store';

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

/** Load the persisted session into the in-memory cache (call once on boot). */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cache = raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export async function saveSession(session: StoredSession): Promise<void> {
  cache = session;
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cache = null;
  await SecureStore.deleteItemAsync(KEY);
}

/** Update just the access token (used after a refresh) without a round-trip. */
export async function updateAccessToken(accessToken: string): Promise<void> {
  if (!cache) return;
  cache = { ...cache, accessToken };
  await SecureStore.setItemAsync(KEY, JSON.stringify(cache));
}

/** Synchronous cache accessors. */
export const getAccessToken = () => cache?.accessToken ?? null;
export const getRefreshToken = () => cache?.refreshToken ?? null;
export const getUser = () => cache?.user ?? null;
