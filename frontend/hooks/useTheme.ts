'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ui-theme';
const DEFAULT_THEME: ThemeMode = 'light';
const listeners = new Set<() => void>();
let currentTheme: ThemeMode = DEFAULT_THEME;
let initialized = false;

const isDesktopViewport = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return Boolean(window.matchMedia('(min-width: 768px)')?.matches);
};

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  if (isDesktopViewport()) return 'light';

  const bootstrappedTheme = document.documentElement.dataset.theme;
  if (bootstrappedTheme === 'dark' || bootstrappedTheme === 'light') {
    return bootstrappedTheme;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

const applyThemeToDom = (theme: ThemeMode) => {
  if (typeof window === 'undefined') return;
  const effectiveTheme: ThemeMode = isDesktopViewport() ? 'light' : theme;
  const body = document.body;
  const root = document.documentElement;
  body.classList.toggle('theme-dark', effectiveTheme === 'dark');
  body.classList.toggle('theme-light', effectiveTheme === 'light');
  root.classList.toggle('theme-dark', effectiveTheme === 'dark');
  root.classList.toggle('theme-light', effectiveTheme === 'light');
  body.dataset.theme = effectiveTheme;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;
  body.style.colorScheme = effectiveTheme;
  if (!isDesktopViewport()) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }
};

const setThemeInternal = (nextTheme: ThemeMode) => {
  const resolved: ThemeMode = isDesktopViewport() ? 'light' : nextTheme;
  currentTheme = resolved;
  applyThemeToDom(resolved);
  listeners.forEach((listener) => listener());
};

const initTheme = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  currentTheme = getPreferredTheme();
  applyThemeToDom(currentTheme);

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(min-width: 768px)');
    mql?.addEventListener?.('change', (e) => {
      if (e.matches && currentTheme !== 'light') {
        setThemeInternal('light');
      }
    });
  }
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

  return useMemo(
    () => ({ theme, setThemeMode, toggleThemeMode }),
    [theme, setThemeMode, toggleThemeMode]
  );
}
