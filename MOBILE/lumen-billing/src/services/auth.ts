/** Authentication service — login/verify/logout against /api/auth. */
import { ENDPOINTS, IS_LIVE } from './config';
import { ApiError, http } from './http';
import { mapUser, type UserDTO } from './mappers';
import { clearSession, getUser, loadSession, saveSession, type AuthUser } from './session';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserDTO;
}

const DEMO_USER: AuthUser = {
  id: 1,
  email: 'demo@infora.app',
  firstName: 'Demo',
  lastName: 'Admin',
  name: 'Demo Admin',
  role: 'admin',
  isAdmin: true,
};

/** POST /api/auth/login → persists tokens + returns the user. */
export async function login(email: string, password: string): Promise<AuthUser> {
  if (!IS_LIVE) {
    // Demo mode: accept any credentials and mint a local session.
    const user = { ...DEMO_USER, email: email || DEMO_USER.email };
    await saveSession({ accessToken: 'demo-token', refreshToken: null, user });
    return user;
  }
  const res = await http.post<LoginResponse>(ENDPOINTS.login, { email, password }, false);
  if (!res.access_token) throw new ApiError('Login failed', 401);
  const user = mapUser(res.user);
  await saveSession({
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? null,
    user,
  });
  return user;
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
