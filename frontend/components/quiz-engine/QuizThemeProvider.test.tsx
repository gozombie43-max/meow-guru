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
  });

  it("loads and updates the theme for its own subject key", async () => {
    window.localStorage.setItem("mathematics-quiz-theme", "dark");

    render(
      <QuizThemeProvider storageKey="mathematics-quiz-theme">
        <ThemeProbe />
      </QuizThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("dark"));
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("light");
    expect(window.localStorage.getItem("mathematics-quiz-theme")).toBe("light");
  });

  it("keeps subject themes isolated when the provider changes", async () => {
    window.localStorage.setItem("mathematics-quiz-theme", "dark");

    const { rerender } = render(
      <QuizThemeProvider key="math" storageKey="mathematics-quiz-theme">
        <ThemeProbe />
      </QuizThemeProvider>
    );
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("dark"));

    rerender(
      <QuizThemeProvider key="english" storageKey="english-quiz-theme">
        <ThemeProbe />
      </QuizThemeProvider>
    );
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("light"));

    expect(window.localStorage.getItem("mathematics-quiz-theme")).toBe("dark");
    expect(window.localStorage.getItem("english-quiz-theme")).toBeNull();
  });
});
