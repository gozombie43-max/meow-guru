// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QuizThemeProvider,
  useQuizThemeControls,
} from "./QuizThemeProvider";

function ThemeProbe() {
  const { theme, toggleTheme } = useQuizThemeControls();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe("QuizThemeProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to dark theme and toggles in memory without saving to localStorage", async () => {
    render(
      <QuizThemeProvider storageKey="mathematics-quiz-theme">
        <ThemeProbe />
      </QuizThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("dark"));
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("light");
    // Does NOT write to localStorage
    expect(window.localStorage.getItem("mathematics-quiz-theme")).toBeNull();
  });

  it("respects preferredTheme when provided without touching localStorage", async () => {
    render(
      <QuizThemeProvider preferredTheme="light" storageKey="english-quiz-theme">
        <ThemeProbe />
      </QuizThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("light"));
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("dark");
    expect(window.localStorage.getItem("english-quiz-theme")).toBeNull();
  });
});
