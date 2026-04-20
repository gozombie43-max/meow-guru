'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';

const isAuthError = (err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

const isRetryableError = (err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === undefined) return true; // network error or no response
  return status >= 500;
};

interface RecentQuizEntry {
  quizKey: string;
  title: string;
  subject: string;
  slug?: string;
  href: string;
  mode?: string;
  currentIndex?: number;
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
  progress: Record<string, { attempted: number; correct: number }>;
  bookmarks: string[];
  bookmarkEntries?: BookmarkEntry[];
  recentQuizzes?: RecentQuizEntry[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // start true to avoid flash

  const persistToken = useCallback((t: string | null) => {
    setToken(t);
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('token', t);
      else localStorage.removeItem('token');
    }
  }, []);

  const fetchUser = useCallback(async (t?: string) => {
    const res = await api.get('/users/me', t ? {
      headers: { Authorization: `Bearer ${t}` },
    } : undefined);
    setUser(res.data);
  }, []);

  const clearAuthState = useCallback(() => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout'); // clears refresh token cookie
    } catch { /* ignore */ }
    clearAuthState();
  }, [clearAuthState]);

  const login = useCallback(async (t: string) => {
    setLoading(true);
    persistToken(t);
    try {
      await fetchUser(t);
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthState();
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, fetchUser, persistToken]);

  const refreshUser = useCallback(async () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!stored) return;
    try {
      await fetchUser(stored);
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthState();
      }
    }
  }, [clearAuthState, fetchUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback')) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const bootstrap = async (attempt = 0) => {
      if (cancelled) return;
      const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      try {
        setLoading(true);
        if (stored) {
          persistToken(stored);
          await fetchUser(stored);
        } else {
          const { data } = await api.post('/auth/refresh');
          persistToken(data.token);
          await fetchUser(data.token);
        }
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthState();
          if (!cancelled) setLoading(false);
          return;
        }

        if (isRetryableError(err) && attempt < 3) {
          retryTimer = setTimeout(() => bootstrap(attempt + 1), 1500 * (attempt + 1));
          return;
        }

        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [clearAuthState, fetchUser, persistToken]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);