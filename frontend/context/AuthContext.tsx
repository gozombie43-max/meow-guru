'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  progress: Record<string, { attempted: number; correct: number }>;
  bookmarks: string[];
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

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout'); // clears refresh token cookie
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  }, []);

  const login = useCallback(async (t: string) => {
    setLoading(true);
    setToken(t);
    localStorage.setItem('token', t);
    try {
      const res = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(res.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('token');
    if (!stored) return;
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
    } catch { /* ignore */ }
  }, []);

  // On app load — try localStorage token, if expired try refresh cookie
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      login(stored);
    } else {
      // No token in localStorage — try refresh cookie (returning user)
      api.post('/auth/refresh')
        .then(({ data }) => login(data.token))
        .catch(() => setLoading(false));
    }
  }, [login]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);