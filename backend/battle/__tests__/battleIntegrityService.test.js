import { describe, expect, it } from "vitest";
import { analyzeAnswerLog } from "../battleIntegrityService.js";

describe("battle integrity answer timing metrics", () => {
  it("does not treat an isolated fast answer as a pattern", () => {
    expect(analyzeAnswerLog([{ correct: true, responseTimeMs: 620, timedOut: false }])).toMatchObject({ attempts: 1, correct: 1, fastCorrect: 1, extremeCorrect: 0 });
  });

  it("counts only answered, finite response times", () => {
    const result = analyzeAnswerLog([
      { correct: true, responseTimeMs: 120, timedOut: false },
      { correct: true, responseTimeMs: 160, timedOut: false },
      { correct: true, responseTimeMs: 180, timedOut: false },
      { correct: false, timedOut: true },
      { correct: true, responseTimeMs: "bad", timedOut: false },
    ]);
    expect(result).toMatchObject({ attempts: 3, correct: 3, extremeCorrect: 3, fastCorrect: 3, averageResponseMs: 153 });
  });
});
