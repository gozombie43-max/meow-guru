'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { abortError } from '@/shared/api/policy';
import api, {
  AUTH_TOKEN_CHANGED_EVENT,
  clearLegacyAuthStorage,
  getAccessToken,
  requestTokenRefresh,
  updateAccessToken,
} from '@/lib/axios';
import { disconnectSocket } from '@/lib/socket-lifecycle';
import { discardPreparedSession, restorePreparedSession } from '@/lib/session-bootstrap';

const isAuthError = (err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

interface RecentQuizEntry {
  quizKey: string;
  title: string;
  subject: string;
  slug?: string;
  href: string;
  mode?: string;
  currentIndex?: number;
  questionAnchor?: string;
  sessionFilters?: { exam?: string; concept?: string; letter?: string };
  totalQuestions?: number;
  selectedAnswers?: Record<number, number>;
  submittedQuestions?: number[];
  results?: unknown[];
  status?: 'in-progress' | 'completed';
  updatedAt?: string;
}

interface BookmarkEntry {
  questionId: string;
  quizKey?: string;
  title?: string;
  subject?: string;
  slug?: string;
  href?: string;
  mode?: string;
  questionIndex?: number;
  updatedAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  progress: Record<string, { attempted: number; correct: number }>;
  bookmarks: string[];
  bookmarkEntries?: BookmarkEntry[];
  recentQuizzes?: RecentQuizEntry[];
  studyTime?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: string | null; phone?: string | null }) => Promise<User | null>;
  loading: boolean;
}

interface AuthActionsContextType {
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: string | null; phone?: string | null }) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
const AuthActionsContext = createContext<AuthActionsContextType>({} as AuthActionsContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // start true to avoid flash
  const authEpoch = useRef(0);
  const profileReads = useRef(new Set<AbortController>());
  const cancelProfileReads = useCallback(() => {
    authEpoch.current += 1;
    for (const controller of profileReads.current) controller.abort();
    profileReads.current.clear();
    return authEpoch.current;
  }, []);

  const persistToken = useCallback((t: string | null) => {
    setToken(t);
    updateAccessToken(t);
  }, []);

  const fetchUser = useCallback(async (t?: string, signal?: AbortSignal) => {
    // Transport owns the complete profile recovery budget: two safe-read
    // retries and at most one 401 refresh/replay. No outer retry loop.
    const epoch = authEpoch.current;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    profileReads.current.add(controller);
    try {
      const res = await api.get('/users/me', { signal: controller.signal, apiPolicy: { retries: 2 },
        ...(t ? { headers: { Authorization: `Bearer ${t}` } } : {}) });
      if (controller.signal.aborted || epoch !== authEpoch.current) throw abortError();
      setUser(res.data);
    } finally {
      profileReads.current.delete(controller);
      signal?.removeEventListener('abort', abort);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    cancelProfileReads();
    discardPreparedSession();
    disconnectSocket();
    setToken(null);
    setUser(null);
    setLoading(false);
    updateAccessToken(null);
  }, [cancelProfileReads]);

  const logout = useCallback(async () => {
    /*
     * Disable push registration
     * while our access token is
     * still available.
     */
    try {
      const fid =
        typeof window !== 'undefined'
          ? window.__MEOW_FID__
          : undefined;

      if (fid) {
        await api.post('/api/notifications/unregister', {
          fid,
        });
      }
    } catch (error) {
      /*
       * Push cleanup is best-effort.
       * Never prevent logout because
       * Firebase/network is unavailable.
       */
      console.warn('Push unregister failed', error);
    }

    try {
      await api.post('/auth/logout');
    } catch {
      // Still clear client auth.
    }

    clearAuthState();
  }, [clearAuthState]);

  const login = useCallback(async (t: string) => {
    const epoch = cancelProfileReads();
    setLoading(true);
    setUser(null);
    persistToken(t);
    try {
      await fetchUser(t);
    } catch (err) {
      if (epoch === authEpoch.current && isAuthError(err)) {
        clearAuthState();
      }
      throw err;
    } finally {
      if (epoch === authEpoch.current) setLoading(false);
    }
  }, [clearAuthState, fetchUser, persistToken, cancelProfileReads]);

  const refreshUser = useCallback(async () => {
    const epoch = authEpoch.current;
    const activeToken = token ?? getAccessToken() ?? await requestTokenRefresh();
    if (!activeToken || epoch !== authEpoch.current) return;
    try {
      await fetchUser(activeToken);
    } catch (err) {
      if (epoch !== authEpoch.current) return;
      if (isAuthError(err)) {
        clearAuthState();
      } else {
        console.error('Failed to refresh user:', err);
      }
    }
  }, [clearAuthState, fetchUser, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncToken = (event?: Event) => {
      if (event instanceof CustomEvent) {
        setToken((event.detail as string | null) ?? null);
        return;
      }

      setToken(getAccessToken());
    };

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncToken as EventListener);
    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncToken as EventListener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const epoch = authEpoch.current;

    const bootstrap = async () => {
      if (cancelled) return;

      try {
        setLoading(true);
        clearLegacyAuthStorage();
        const activeToken = await restorePreparedSession();
        if (cancelled || epoch !== authEpoch.current) return;
        if (!activeToken) {
          if (!cancelled) setLoading(false);
          return;
        }
        persistToken(activeToken);
        await fetchUser(activeToken, controller.signal);
        if (!cancelled && epoch === authEpoch.current) setLoading(false);
      } catch (err) {
        if (cancelled || epoch !== authEpoch.current) return;
        if (isAuthError(err)) {
          clearAuthState();
        }

        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      controller.abort();
      cancelProfileReads();
    };
  }, [clearAuthState, fetchUser, persistToken, cancelProfileReads]);

  const updateProfile = useCallback(
    async (data: { name?: string; avatar?: string | null; phone?: string | null }) => {
      try {
        const res = await api.patch('/users/me/profile', data);
        if (res.data?.user) {
          setUser(res.data.user);
          return res.data.user as User;
        }
        await refreshUser();
        return null;
      } catch (err) {
        console.error('Failed to update profile:', err);
        throw err;
      }
    },
    [refreshUser]
  );

  const contextValue = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      refreshUser,
      updateProfile,
      loading,
    }),
    [user, token, login, logout, refreshUser, updateProfile, loading]
  );

  const actionsValue = useMemo(
    () => ({
      login,
      logout,
      refreshUser,
      updateProfile,
    }),
    [login, logout, refreshUser, updateProfile]
  );

  return (
    <AuthActionsContext.Provider value={actionsValue}>
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    </AuthActionsContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const useAuthActions = () => {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used within an AuthProvider');
  return ctx;
};
