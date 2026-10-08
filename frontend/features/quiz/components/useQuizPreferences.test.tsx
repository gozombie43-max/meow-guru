// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useQuizPreferences } from "@/features/quiz/components/useQuizPreferences";

describe("useQuizPreferences", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to medium text and a hidden strip", () => {
    const { result } = renderHook(() => useQuizPreferences());
    expect(result.current.textSize).toBe("md");
    expect(result.current.hideQuestionNumbers).toBe(true);
    expect(result.current.textWeight).toBe("medium");
  });

  it("restores explicit strip visibility and text weight", async () => {
    localStorage.setItem("quiz_hide_question_numbers", "false");
    localStorage.setItem("quiz_text_weight", "high");
    const { result } = renderHook(() => useQuizPreferences());
    await waitFor(() => expect(result.current.textWeight).toBe("high"));
    expect(result.current.hideQuestionNumbers).toBe(false);
    act(() => result.current.setTextWeight("medium"));
    expect(localStorage.getItem("quiz_text_weight")).toBe("medium");
  });

  it("hydrates saved preferences", async () => {
    window.localStorage.setItem("quiz_hide_question_numbers", "true");
    window.localStorage.setItem("quiz_hide_ai_tutor", "true");
    window.localStorage.setItem("quiz_text_size", "lg");
    window.localStorage.setItem("quiz_spacing", "compact");

    const { result } = renderHook(() => useQuizPreferences());

    await waitFor(() => expect(result.current.textSize).toBe("lg"));
    expect(result.current.hideQuestionNumbers).toBe(true);
    expect(result.current.hideViewSolution).toBe(false);
    expect(result.current.hideAiTutor).toBe(true);
    expect(result.current.textSize).toBe("lg");
    expect(result.current.spacing).toBe("compact");
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

    act(() => result.current.setTextSize("sm"));
    expect(result.current.textSize).toBe("sm");
    expect(window.localStorage.getItem("quiz_text_size")).toBe("sm");

    act(() => result.current.setSpacing("compact"));
    expect(result.current.spacing).toBe("compact");
    expect(window.localStorage.getItem("quiz_spacing")).toBe("compact");
  });

  it("persists custom text sizes and restores them after remounting", async () => {
    const first = renderHook(() => useQuizPreferences());
    act(() => first.result.current.setTextSize(22));
    expect(localStorage.getItem("quiz_text_size")).toBe("22");
    first.unmount();
    const restored = renderHook(() => useQuizPreferences());
    await waitFor(() => expect(restored.result.current.textSize).toBe(22));
    act(() => restored.result.current.setTextSize("sm"));
    expect(localStorage.getItem("quiz_text_size")).toBe("sm");
  });

  it.each([[14, 16], [32, 24], [16, 16], [24, 24]])("restores saved size %s within the range as %s", async (saved, expected) => {
    localStorage.setItem("quiz_text_size", String(saved));
    const { result } = renderHook(() => useQuizPreferences());
    await waitFor(() => expect(result.current.textSize).toBe(expected));
    expect(localStorage.getItem("quiz_text_size")).toBe(String(expected));
  });

  it.each([15, 25])("rejects changes outside the limits: %s", (size) => {
    const { result } = renderHook(() => useQuizPreferences());
    act(() => result.current.setTextSize(size));
    expect(result.current.textSize).toBe("md");
    expect(localStorage.getItem("quiz_text_size")).toBeNull();
  });

  it.each([0, -1, 20.5, NaN, Infinity])("rejects invalid custom size %s", async (size) => {
    localStorage.setItem("quiz_text_size", String(size));
    const { result } = renderHook(() => useQuizPreferences());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(result.current.textSize).toBe("md");
    act(() => result.current.setTextSize(size));
    expect(result.current.textSize).toBe("md");
    expect(localStorage.getItem("quiz_text_size")).toBe(String(size));
  });
});
