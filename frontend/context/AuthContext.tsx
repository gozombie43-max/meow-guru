'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      login(stored).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (t: string) => {
    setToken(t);
    localStorage.setItem('token', t);
    try {
      const res = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(res.data);
    } catch {
      logout();
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);