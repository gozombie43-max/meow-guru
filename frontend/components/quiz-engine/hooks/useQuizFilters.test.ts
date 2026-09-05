import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { englishConfig } from "../subjects/english";
import { useQuizFilters } from "./useQuizFilters";

vi.mock("@/hooks/useQuizSession", () => ({
  useQuizSession: () => ({
    questions: [
      {
        id: "anto_1",
        letter: "A",
        word: "Abolish",
        options: ["Cancel", "Keep"],
        quizName: "CareerWill",
      },
      {
        id: "anto_2",
        letter: "B",
        word: "Benevolent",
        options: ["Kind", "Cruel"],
        quizName: "CareerWill",
      },
      {
        id: "anto_3",
        letter: "B",
        word: "Bizarre",
        options: ["Strange", "Normal"],
        quizName: "CareerWill",
      },
    ],
    hasMore: false,
    isFetchingMore: false,
    fetchMore: vi.fn(),
  }),
}));

vi.mock("@/hooks/useQuestionsMeta", () => ({
  useQuestionsMeta: () => ({
    meta: { concepts: [], exams: [] },
  }),
}));

describe("useQuizFilters letter filtering", () => {
  it("computes letter counts and filters questions by letter exclusively", () => {
    const { result } = renderHook(() =>
      useQuizFilters({
        subjectConfig: englishConfig,
        slug: "synonyms-antonyms",
        mode: "formula",
        initialLetterParam: null,
      })
    );

    expect(result.current.letterCounts).toEqual({ A: 1, B: 2 });
    expect(result.current.availableLetters).toEqual(["A", "B"]);
    expect(result.current.questions).toHaveLength(3);

    // Toggle letter B
    act(() => {
      result.current.handleToggleLetter("B");
    });

    expect(result.current.selectedLetters.has("B")).toBe(true);
    expect(result.current.selectedLetters.size).toBe(1);
    expect(result.current.questions).toHaveLength(2);
    expect(result.current.questions.every((q) => q.letter === "B")).toBe(true);

    // Toggle letter A (switches to A exclusively)
    act(() => {
      result.current.handleToggleLetter("A");
    });

    expect(result.current.selectedLetters.has("A")).toBe(true);
    expect(result.current.selectedLetters.size).toBe(1);
    expect(result.current.questions).toHaveLength(1);

    // Toggle letter A again (deselects back to All)
    act(() => {
      result.current.handleToggleLetter("A");
    });

    expect(result.current.selectedLetters.size).toBe(0);
    expect(result.current.questions).toHaveLength(3);
  });
});
