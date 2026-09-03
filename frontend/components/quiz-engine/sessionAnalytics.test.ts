import { describe, expect, it } from "vitest";
import { buildSessionAnalytics } from "./sessionAnalytics";
import type { SessionResult } from "./types";

function result(overrides: Partial<SessionResult>): SessionResult {
  return {
    questionId: 1,
    questionIndex: 0,
    selected: 0,
    correct: 0,
    isCorrect: true,
    timeTaken: 10,
    concept: "Analogy",
    difficulty: "medium",
    ...overrides,
  };
}

describe("buildSessionAnalytics", () => {
  it("calculates session totals and weak concepts", () => {
    const analytics = buildSessionAnalytics([
      result({ isCorrect: false, selected: 1, timeTaken: 10 }),
      result({ questionId: 2, questionIndex: 1, isCorrect: false, selected: 2, timeTaken: 20 }),
      result({ questionId: 3, questionIndex: 2, concept: "Series", timeTaken: 15 }),
    ]);

    expect(analytics.stats).toEqual({
      correct: 1,
      wrong: 2,
      accuracy: 33,
      avgTime: 15,
    });
    expect(analytics.weakConcepts).toEqual([
      { concept: "Analogy", accuracy: 0 },
    ]);
  });

  it("returns zeroed analytics for an empty session", () => {
    expect(buildSessionAnalytics([])).toEqual({
      stats: { correct: 0, wrong: 0, accuracy: 0, avgTime: 0 },
      weakConcepts: [],
    });
  });
});
