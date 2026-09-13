import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { englishConfig } from "../subjects/english";
import { useQuizFilters } from "./useQuizFilters";

const mockUseQuizSession = vi.fn((..._args: unknown[]) => ({
  questions: [],
  hasMore: false,
  isFetchingMore: false,
  fetchMore: vi.fn(),
  totalCount: 3,
}));

vi.mock("@/hooks/useQuizSession", () => ({
  useQuizSession: (...args: unknown[]) => mockUseQuizSession(...args),
}));

const mockMeta = vi.hoisted(() => ({ concepts: [] as string[], exams: [], letters: { A: 1, B: 2 } }));
vi.mock("@/hooks/useQuestionsMeta", () => ({
  useQuestionsMeta: () => ({ meta: mockMeta }),
}));
beforeEach(() => { mockMeta.concepts = []; });

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


describe("question-derived concepts", () => {
  it("does not invent concepts when metadata is empty", () => {
    const { result } = renderHook(() => useQuizFilters({ subjectConfig: englishConfig, slug: "synonyms-antonyms", mode: "concept", initialLetterParam: null }));
    expect(result.current.conceptOptions).toEqual([]);
    expect(result.current.classificationGroups).toEqual([]);
  });
  it("uses only stored concepts and updates when metadata changes", () => {
    mockMeta.concepts = ["Stored concept", "Stored concept"];
    const { result, rerender } = renderHook(() => useQuizFilters({ subjectConfig: englishConfig, slug: "synonyms-antonyms", mode: "concept", initialLetterParam: null }));
    expect(result.current.conceptOptions).toEqual(["Stored concept"]);
    mockMeta.concepts = ["Stored concept", "Newly uploaded concept"];
    rerender();
    expect(result.current.conceptOptions).toEqual(mockMeta.concepts);
  });
});
