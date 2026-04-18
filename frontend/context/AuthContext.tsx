'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';

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
    setToken(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', t);
    }
    try {
      const res = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(res.data);
    } catch (err) {
      clearAuthState();
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearAuthState]);

  const refreshUser = useCallback(async () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!stored) return;
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback')) {
      setLoading(false);
      return;
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (stored) {
      login(stored).catch(() => {
        api.post('/auth/refresh')
          .then(({ data }) => login(data.token))
          .catch(() => {
            clearAuthState();
            setLoading(false);
          });
      });
    } else {
      api.post('/auth/refresh')
        .then(({ data }) => login(data.token))
        .catch(() => {
          clearAuthState();
          setLoading(false);
        });
    }
  }, [login, clearAuthState]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);