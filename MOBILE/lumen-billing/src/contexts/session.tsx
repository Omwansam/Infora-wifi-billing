import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authService from '@/services/auth';
import type { AuthUser } from '@/services/session';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  user: AuthUser | null;
  status: Status;
  /**
   * Sign in, optionally with a second-factor code.
   *
   * Resolves rather than throws for every outcome the sign-in screen has to
   * render differently: `requires2fa` means the password was accepted and the
   * backend is holding the tokens until it sees a code.
   */
  signIn: (
    email: string,
    password: string,
    otpCode?: string,
    remember?: boolean,
  ) => Promise<{ ok: boolean; requires2fa: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    authService
      .restoreSession()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!active) return;
        setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, otpCode?: string, remember = true) => {
      const result = await authService.login(email, password, otpCode, remember);
      if (!result.ok) {
        return {
          ok: false,
          requires2fa: result.requires2fa === true,
          error: 'error' in result ? result.error : undefined,
        };
      }
      setUser(result.user);
      setStatus('authenticated');
      return { ok: true, requires2fa: false };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signOut }),
    [user, status, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
