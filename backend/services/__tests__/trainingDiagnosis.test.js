import { describe, it, expect, vi } from "vitest";
import { diagnoseTraining } from "../trainingDiagnosis.js";
const session = {
  questions: [
    {
      id: "q1",
      text: "What is 2 + 2?",
      options: ["3", "4"],
      correctIndex: 1,
      topic: "Arithmetic",
    },
  ],
  result: {
    rows: [
      {
        questionId: "q1",
        attempted: true,
        correct: false,
        choice: 0,
        seconds: 80,
        target: 45,
        confidence: "sure",
      },
    ],
  },
};
describe("AI training diagnostics", () => {
  it("accepts bounded suggestions without changing deterministic results", async () => {
    const original = structuredClone(session);
    const result = await diagnoseTraining(
      session,
      vi
        .fn()
        .mockResolvedValue({
          suggestions: [
            {
              questionId: "q1",
              category: "Calculation Error",
              reason: "A calculation slip is possible; confirm your reasoning.",
            },
          ],
        }),
    );
    expect(result.source).toBe("ai");
    expect(session).toEqual(original);
  });
  it("rejects invented question IDs and categories", async () => {
    await expect(
      diagnoseTraining(
        session,
        vi
          .fn()
          .mockResolvedValue({
            suggestions: [
              { questionId: "other", category: "Misread", reason: "Maybe" },
            ],
          }),
      ),
    ).rejects.toThrow();
    await expect(
      diagnoseTraining(
        session,
        vi
          .fn()
          .mockResolvedValue({
            suggestions: [
              { questionId: "q1", category: "Unintelligent", reason: "Bad" },
            ],
          }),
      ),
    ).rejects.toThrow();
  });
  it("does not contact AI for a session without wrong or guessed answers", async () => {
    const generate = vi.fn();
    expect(
      (await diagnoseTraining({ ...session, result: { rows: [] } }, generate))
        .suggestions,
    ).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
});
