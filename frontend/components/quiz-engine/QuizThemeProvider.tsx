"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { QuizTheme } from "./types";

type QuizThemeContextValue = {
  theme: QuizTheme;
  setTheme: (theme: QuizTheme) => void;
  toggleTheme: () => void;
};

const QuizThemeContext = createContext<QuizThemeContextValue | null>(null);

type QuizThemeProviderProps = {
  storageKey: string;
  preferredTheme?: QuizTheme;
  children: ReactNode;
};

function detectDefaultQuizTheme(preferredTheme?: QuizTheme): QuizTheme {
  if (preferredTheme) return preferredTheme;
  if (typeof document !== "undefined") {
    const isDark =
      document.documentElement.classList.contains("theme-dark") ||
      document.body?.classList.contains("theme-dark") ||
      document.documentElement.dataset.theme === "dark";
    if (isDark) return "dark";
    const isLight =
      document.documentElement.classList.contains("theme-light") ||
      document.body?.classList.contains("theme-light") ||
      document.documentElement.dataset.theme === "light";
    if (isLight) return "light";
  }
  return "dark";
}

function createQuizThemeStore(storageKey?: string, preferredTheme?: QuizTheme) {
  let currentTheme: QuizTheme = preferredTheme ?? "dark";
  let initialized = false;
  const listeners = new Set<() => void>();

  const getSnapshot = () => {
    if (!initialized && typeof window !== "undefined") {
      initialized = true;
      currentTheme = detectDefaultQuizTheme(preferredTheme);
    }
    return currentTheme;
  };

  const setTheme = (nextTheme: QuizTheme) => {
    if (currentTheme === nextTheme && initialized) return;
    currentTheme = nextTheme;
    initialized = true;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot,
    getServerSnapshot: () => preferredTheme ?? ("dark" as QuizTheme),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setTheme,
    toggleTheme: () => setTheme(getSnapshot() === "dark" ? "light" : "dark"),
  };
}

export function QuizThemeProvider({
  storageKey,
  preferredTheme,
  children,
}: QuizThemeProviderProps) {
  const store = useMemo(
    () => createQuizThemeStore(storageKey, preferredTheme),
    [preferredTheme, storageKey]
  );
  const theme = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  const setTheme = useCallback(
    (nextTheme: QuizTheme) => store.setTheme(nextTheme),
    [store]
  );

  const toggleTheme = useCallback(() => store.toggleTheme(), [store]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme]
  );

  return <QuizThemeContext.Provider value={value}>{children}</QuizThemeContext.Provider>;
}

export function useQuizThemeControls(): QuizThemeContextValue {
  const value = useContext(QuizThemeContext);
  if (!value) {
    throw new Error("Quiz theme controls must be used inside QuizThemeProvider");
  }
  return value;
}

export function useQuizTheme(): QuizTheme {
  return useQuizThemeControls().theme;
}
