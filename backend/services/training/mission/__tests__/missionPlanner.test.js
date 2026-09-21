import { describe, it, expect, vi } from "vitest";
import { planDailyMission } from "../missionPlanner.js";

vi.mock("../../../trainingEngine.js", () => ({
  selectQuestions: vi.fn((available, mode, count) => {
    return available.slice(0, count);
  }),
}));

describe("missionPlanner", () => {
  it("generates a unified daily mission correctly", () => {
    const pool = Array.from({ length: 100 }, (_, i) => ({
      id: `q-${i}`,
      sourceType: i % 2 === 0 ? "pyq" : "mock",
    }));

    const duePool = Array.from({ length: 10 }, (_, i) => ({
      id: `due-${i}`,
    }));

    const intelligence = {
      topics: [{ topic: "Algebra" }],
      due: duePool.map(q => ({ questionId: q.id })),
    };

    const questions = planDailyMission({
      intelligence,
      pool,
      duePool,
      now: Date.now(),
      exposureRows: [],
    });

    // 10 (adaptive) + 8 (sprint) + 5 (review) + 10 (section) + 9 (adaptive) = 42
    expect(questions.length).toBe(42);

    // Verify first block (Strengthen)
    expect(questions[0].trainingBlock).toBe("Strengthen Algebra");
    expect(questions[0].trainingMode).toBe("adaptive");

    // Verify section block filters for pyq
    const sectionQuestions = questions.filter(q => q.trainingMode === "section");
    expect(sectionQuestions.length).toBe(10);
    expect(sectionQuestions.every(q => q.sourceType === "pyq")).toBe(true);

    // Verify review block uses duePool
    const reviewQuestions = questions.filter(q => q.trainingMode === "review");
    expect(reviewQuestions.length).toBe(5);
    expect(reviewQuestions.every(q => q.id.startsWith("due-"))).toBe(true);
  });
});
