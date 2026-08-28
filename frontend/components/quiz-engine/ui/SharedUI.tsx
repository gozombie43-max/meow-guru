import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { ConceptColour } from '../types';
import { useQuizTheme, useQuizThemeControls } from '../QuizThemeProvider';

export function ThemeToggle() {
  const theme = useQuizTheme();
  const { toggleTheme } = useQuizThemeControls();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${isDark ? "theme-toggle--dark" : "theme-toggle--light"}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Moon className="theme-toggle-icon" aria-hidden="true" />
      ) : (
        <Sun className="theme-toggle-icon" aria-hidden="true" />
      )}
    </button>
  );
}

export function ConceptBadge({
  concept,
}: {
  concept: string;
  colours: Record<string, ConceptColour>;
}) {
  const label = concept
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span style={{ fontSize: "inherit", fontWeight: "inherit" }}>
      {label}
    </span>
  );
}

