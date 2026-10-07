'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearLegacyAuthStorage,
  type AuthSessionPayload,
  type AuthUser,
} from '../lib/auth-storage';
import {
  changePasswordAccount,
  fetchAuthMe,
  loginAccount,
  logoutAccount,
  refreshAccountSession,
  registerAccount,
} from '../lib/commerce-api';
import { SessionKeepAliveModal } from './session-keep-alive-modal';

/** Prompt 30s before the 5-minute access token expires. */
const KEEP_ALIVE_LEAD_MS = 30_000;

type AuthContextValue = {
  user: AuthUser | null;
  /** True when an authenticated session is present (cookie-backed). */
  authenticated: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
  }) => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  keepAlive: () => Promise<void>;
  /** Update in-memory user after profile edits. */
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [keepAliveOpen, setKeepAliveOpen] = useState(false);
  const [keepAliveBusy, setKeepAliveBusy] = useState(false);
  const promptTimerRef = useRef<number | null>(null);
  const expireTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (promptTimerRef.current != null) {
      window.clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    if (expireTimerRef.current != null) {
      window.clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }
  }, []);

  const applySession = useCallback((payload: AuthSessionPayload) => {
    setUser(payload.user);
    const ms = Date.parse(payload.expiresAt);
    setExpiresAtMs(Number.isFinite(ms) ? ms : null);
    setKeepAliveOpen(false);
  }, []);

  const logout = useCallback(async () => {
    clearTimers();
    setKeepAliveOpen(false);
    try {
      await logoutAccount();
    } finally {
      clearLegacyAuthStorage();
      setUser(null);
      setExpiresAtMs(null);
    }
  }, [clearTimers]);

  const scheduleSessionWatchers = useCallback(() => {
    clearTimers();
    if (!expiresAtMs || !user) {
      setKeepAliveOpen(false);
      return;
    }
    const now = Date.now();
    const promptIn = expiresAtMs - KEEP_ALIVE_LEAD_MS - now;
    const expireIn = expiresAtMs - now;

    if (expireIn <= 0) {
      clearTimers();
      setKeepAliveOpen(false);
      void logout();
      return;
    }

    if (promptIn <= 0) {
      setKeepAliveOpen(true);
    } else {
      promptTimerRef.current = window.setTimeout(() => {
        setKeepAliveOpen(true);
      }, promptIn);
    }

    expireTimerRef.current = window.setTimeout(() => {
      void logout();
    }, expireIn);
  }, [clearTimers, expiresAtMs, logout, user]);

  useEffect(() => {
    let cancelled = false;
    clearLegacyAuthStorage();
    fetchAuthMe()
      .then((me) => {
        if (cancelled) {
          return;
        }
        setUser({
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          phone: me.phone,
          emailVerifiedAt: me.emailVerifiedAt,
        });
        const ms = Date.parse(me.expiresAt);
        setExpiresAtMs(Number.isFinite(ms) ? ms : null);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setExpiresAtMs(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    scheduleSessionWatchers();
  }, [ready, scheduleSessionWatchers, expiresAtMs, user]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginAccount({ email, password });
      applySession(result);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
    }) => {
      const result = await registerAccount(input);
      applySession(result);
    },
    [applySession],
  );

  const changePassword = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
    }) => {
      const result = await changePasswordAccount(input);
      applySession(result);
    },
    [applySession],
  );

  const keepAlive = useCallback(async () => {
    setKeepAliveBusy(true);
    try {
      const result = await refreshAccountSession();
      applySession(result);
    } catch {
      await logout();
    } finally {
      setKeepAliveBusy(false);
    }
  }, [applySession, logout]);

  const value = useMemo(
    () => ({
      user,
      authenticated: Boolean(user),
      ready,
      login,
      register,
      changePassword,
      logout,
      keepAlive,
      setUser,
    }),
    [user, ready, login, register, changePassword, logout, keepAlive],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionKeepAliveModal
        open={keepAliveOpen && Boolean(user)}
        busy={keepAliveBusy}
        onKeepAlive={() => {
          void keepAlive();
        }}
        onLogout={() => {
          void logout();
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
