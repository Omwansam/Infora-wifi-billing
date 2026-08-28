/** Authentication service — login / 2FA / verify / logout against /api/auth. */
import { ENDPOINTS, IS_LIVE } from './config';
import { http, publicRequest } from './http';
import { mapUser, type UserDTO } from './mappers';
import { clearSession, getUser, loadSession, saveSession, type AuthUser } from './session';

interface LoginResponse {
  success?: boolean;
  access_token?: string;
  refresh_token?: string;
  user?: UserDTO;
  /** Backend asks for a second factor *before* it issues any token. */
  requires_2fa?: boolean;
  message?: string;
}

/**
 * What the sign-in screen gets back.
 *
 * `requires2fa` is a third outcome, not a failure: the credentials were right
 * and the backend is holding the tokens until it sees a code. Collapsing it
 * into `ok: false` would put "Login failed" in front of someone whose password
 * was perfectly correct.
 */
export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; requires2fa: true }
  | { ok: false; requires2fa?: false; error: string };

const DEMO_USER: AuthUser = {
  id: 1,
  email: 'demo@infora.app',
  firstName: 'Demo',
  lastName: 'Admin',
  name: 'Demo Admin',
  role: 'admin',
  isAdmin: true,
};

/**
 * POST /api/auth/login → persists tokens + returns the user.
 *
 * `remember: false` keeps the session in memory only, so it dies with the app
 * rather than sitting in the keychain — the phone equivalent of the console's
 * "keep me signed in" opt-out.
 */
export async function login(
  email: string,
  password: string,
  otpCode?: string,
  remember = true,
): Promise<LoginResult> {
  if (!IS_LIVE) {
    // Demo mode: accept any credentials and mint a local session.
    const user = { ...DEMO_USER, email: email || DEMO_USER.email };
    await saveSession({ accessToken: 'demo-token', refreshToken: null, user }, remember);
    return { ok: true, user };
  }

  const body: Record<string, string> = { email, password };
  if (otpCode) body.otp_code = otpCode;

  const res = await publicRequest<LoginResponse>(ENDPOINTS.login, { method: 'POST', body });

  // A 2FA challenge comes back 200-OK with no tokens, so it has to be checked
  // before the `success` branch, not after it. The `res.success` guard matters:
  // a *rejected* code is a 401 that also carries `requires_2fa`, and treating
  // that as a fresh challenge would swallow "Invalid verification code" and
  // leave the person staring at an unchanged screen.
  if (res.success && res.data?.requires_2fa) return { ok: false, requires2fa: true };

  if (!res.success) {
    return { ok: false, error: res.error ?? 'Sign in failed. Please try again.' };
  }
  if (!res.data?.access_token || !res.data.user) {
    return { ok: false, error: res.data?.message ?? 'Sign in failed. Please try again.' };
  }

  const user = mapUser(res.data.user);
  await saveSession(
    {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token ?? null,
      user,
    },
    remember,
  );
  return { ok: true, user };
}

/**
 * POST /api/auth/forgot-password.
 *
 * The backend answers identically whether or not the address exists — that is
 * deliberate, so this returns the same message either way rather than trying to
 * infer anything from the response.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const generic = 'If that address has an account, a reset link is on its way.';
  if (!IS_LIVE) return { ok: true, message: generic };

  const res = await publicRequest<{ message?: string }>(ENDPOINTS.forgotPassword, {
    method: 'POST',
    body: { email },
  });
  if (!res.success) {
    return { ok: false, message: res.error ?? 'Could not send the reset link. Try again.' };
  }
  return { ok: true, message: res.data?.message ?? generic };
}

/** Restore a persisted session on app boot. Returns the user or null. */
export async function restoreSession(): Promise<AuthUser | null> {
  const stored = await loadSession();
  if (!stored) return null;
  if (!IS_LIVE) return stored.user;
  // Verify the token is still valid; on failure the http layer clears it.
  try {
    await http.get(ENDPOINTS.verify);
    return getUser();
  } catch {
    await clearSession();
    return null;
  }
}

export async function logout(): Promise<void> {
  if (IS_LIVE) {
    await http.post(ENDPOINTS.logout, {}).catch(() => undefined);
  }
  await clearSession();
}
