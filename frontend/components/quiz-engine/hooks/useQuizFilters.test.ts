import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { englishConfig } from "../subjects/english";
import { useQuizFilters } from "./useQuizFilters";

const mockUseQuizSession = vi.fn(() => ({
  questions: [],
  hasMore: false,
  isFetchingMore: false,
  fetchMore: vi.fn(),
  totalCount: 3,
}));

vi.mock("@/hooks/useQuizSession", () => ({
  useQuizSession: (...args: any[]) => (mockUseQuizSession as any)(...args),
}));

vi.mock("@/hooks/useQuestionsMeta", () => ({
  useQuestionsMeta: () => ({
    meta: { concepts: [], exams: [], letters: { A: 1, B: 2 } },
  }),
}));

describe("useQuizFilters letter filtering", () => {
  it("computes letter counts and delegates filtering to session api", () => {
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

    expect(mockUseQuizSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ letter: undefined })
    );

    // Toggle letter B
    act(() => {
      result.current.handleToggleLetter("B");
    });

    expect(result.current.selectedLetters.has("B")).toBe(true);
    expect(result.current.selectedLetters.size).toBe(1);

    expect(mockUseQuizSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ letter: "B" })
    );

    // Toggle letter A
    act(() => {
      result.current.handleToggleLetter("A");
    });

    expect(result.current.selectedLetters.has("A")).toBe(true);
    expect(result.current.selectedLetters.size).toBe(1);

    expect(mockUseQuizSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ letter: "A" })
    );

    // Toggle letter A again (deselects)
    act(() => {
      result.current.handleToggleLetter("A");
    });

    expect(result.current.selectedLetters.size).toBe(0);
    expect(mockUseQuizSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ letter: undefined })
    );
  });
});

