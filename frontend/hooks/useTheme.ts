'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ui-theme';
const DEFAULT_THEME: ThemeMode = 'light';
const listeners = new Set<() => void>();
let currentTheme: ThemeMode = DEFAULT_THEME;
let initialized = false;

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return DEFAULT_THEME;
  }
};

const applyThemeToDom = (theme: ThemeMode) => {
  if (typeof window === 'undefined') return;
  const body = document.body;
  const root = document.documentElement;
  body.classList.toggle('theme-dark', theme === 'dark');
  body.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
  root.classList.toggle('theme-light', theme === 'light');
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
};

const setThemeInternal = (nextTheme: ThemeMode) => {
  currentTheme = nextTheme;
  applyThemeToDom(nextTheme);
  listeners.forEach((listener) => listener());
};

const initTheme = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  currentTheme = getPreferredTheme();
  applyThemeToDom(currentTheme);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ThemeMode => {
  if (typeof window !== 'undefined' && !initialized) {
    initTheme();
  }
  return currentTheme;
};

const getServerSnapshot = (): ThemeMode => {
  return DEFAULT_THEME;
};

export function useThemeMode() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setThemeMode = useCallback((nextTheme: ThemeMode) => {
    initTheme();
    if (currentTheme === nextTheme) return;
    setThemeInternal(nextTheme);
  }, []);

  const toggleThemeMode = useCallback(() => {
    initTheme();
    setThemeInternal(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, setThemeMode, toggleThemeMode };
}
