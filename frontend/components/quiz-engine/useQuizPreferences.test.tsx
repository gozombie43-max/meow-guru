// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useQuizPreferences } from "./useQuizPreferences";

describe("useQuizPreferences", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates saved preferences", async () => {
    window.localStorage.setItem("quiz_hide_question_numbers", "true");
    window.localStorage.setItem("quiz_hide_ai_tutor", "true");

    const { result } = renderHook(() => useQuizPreferences());

    await waitFor(() => expect(result.current.hideQuestionNumbers).toBe(true));
    expect(result.current.hideViewSolution).toBe(false);
    expect(result.current.hideAiTutor).toBe(true);
  });

  it("updates individual and combined preferences", () => {
    const { result } = renderHook(() => useQuizPreferences());

    act(() => result.current.toggleHideQuestionNumbers(true));
    expect(result.current.hideQuestionNumbers).toBe(true);
    expect(window.localStorage.getItem("quiz_hide_question_numbers")).toBe("true");

    act(() => result.current.toggleHideBoth(true));
    expect(result.current.hideViewSolution).toBe(true);
    expect(result.current.hideAiTutor).toBe(true);
    expect(window.localStorage.getItem("quiz_hide_view_solution")).toBe("true");
    expect(window.localStorage.getItem("quiz_hide_ai_tutor")).toBe("true");
  });
});
