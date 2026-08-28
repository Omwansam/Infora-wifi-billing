/**
 * Key/value storage for the session, per platform.
 *
 * `expo-secure-store` has no web implementation at all — its web build is
 * literally `export default {}`, so every call is `undefined is not a function`
 * rather than a rejected promise a caller could catch. That is what took out
 * sign-out: `clearSession` threw before it could clear anything.
 *
 * So the platform choice is made once, here:
 *   · native → the OS keychain / keystore, via expo-secure-store;
 *   · web    → `localStorage`, which is where the console keeps the same tokens
 *              (see AuthContext / STORAGE_KEYS). Not a keychain, and not
 *              pretending to be one — the web target is a dev convenience, and
 *              this puts it on exactly the footing the browser console is
 *              already on.
 *
 * Every method resolves rather than throws. Storage being unavailable — a
 * locked device, a private window, a browser with site data blocked — is a
 * reason not to *remember* a session, never a reason to fail the operation the
 * user actually asked for. `setItem` reports whether the write landed so the
 * caller can tell the difference.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

/** The browser store, or null when it is unreachable (SSR, blocked cookies). */
function webStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isWeb) return webStore()?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/** @returns true when the value is actually stored. */
export async function setItem(key: string, value: string): Promise<boolean> {
  try {
    if (isWeb) {
      const store = webStore();
      if (!store) return false;
      store.setItem(key, value);
      return true;
    }
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch {
    return false;
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (isWeb) {
      webStore()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to do: the value is either gone or unreachable, and both mean the
    // caller's "forget this" has been honoured as far as it can be.
  }
}
