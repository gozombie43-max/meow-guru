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

function createQuizThemeStore(storageKey: string, preferredTheme?: QuizTheme) {
  let currentTheme: QuizTheme = preferredTheme ?? "light";
  let initialized = preferredTheme !== undefined;
  const listeners = new Set<() => void>();

  const getSnapshot = () => {
    if (!initialized && typeof window !== "undefined") {
      initialized = true;
      try {
        currentTheme = window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
      } catch {
        currentTheme = "light";
      }
    }
    return currentTheme;
  };

  const setTheme = (nextTheme: QuizTheme) => {
    if (currentTheme === nextTheme && initialized) return;
    currentTheme = nextTheme;
    initialized = true;
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot,
    getServerSnapshot: () => preferredTheme ?? "light" as QuizTheme,
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
