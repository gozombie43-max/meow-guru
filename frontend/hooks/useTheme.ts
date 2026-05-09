'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ui-theme';
const listeners = new Set<(theme: ThemeMode) => void>();
let currentTheme: ThemeMode = 'light';
let initialized = false;

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const applyThemeToDom = (theme: ThemeMode) => {
  if (typeof window === 'undefined') return;
  const body = document.body;
  const root = document.documentElement;
  body.classList.toggle('theme-dark', theme === 'dark');
  body.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
  root.classList.toggle('theme-light', theme === 'light');
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

const setThemeInternal = (nextTheme: ThemeMode) => {
  currentTheme = nextTheme;
  applyThemeToDom(nextTheme);
  listeners.forEach((listener) => listener(nextTheme));
};

const initTheme = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  setThemeInternal(getPreferredTheme());
};

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);

  useEffect(() => {
    initTheme();
    setTheme(currentTheme);

    const handleTheme = (nextTheme: ThemeMode) => setTheme(nextTheme);
    listeners.add(handleTheme);
    return () => listeners.delete(handleTheme);
  }, []);

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
