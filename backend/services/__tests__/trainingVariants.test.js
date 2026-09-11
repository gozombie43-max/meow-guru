import { describe, it, expect, vi } from "vitest";
import { draftTrainingVariant } from "../trainingVariants.js";
import { normalizeQuestion } from "../trainingEngine.js";
const seed = {
  id: "seed",
  question: "Find the value of 2 + 2.",
  options: ["3", "4"],
  correctAnswer: 1,
  subject: "Mathematics",
  topic: "Arithmetic",
};
const variant = {
  question: "Find the value of 22 + 22.",
  options: ["43", "44"],
  correctAnswer: 1,
  solution: "Adding 22 and 22 gives 44.",
  difficulty: 3,
  concepts: ["Addition"],
};
describe("validated seed to quarantined variant", () => {
  it("retains exam/topic provenance and cannot enter training until reviewed", async () => {
    const draft = await draftTrainingVariant(
      seed,
      "ssc-cgl",
      vi.fn().mockResolvedValue(variant),
    );
    expect(draft.seedId).toBe("seed");
    expect(draft.exam).toBe("ssc-cgl");
    expect(draft.topic).toBe(seed.topic);
    expect(normalizeQuestion(draft)).toBeNull();
    expect(
      normalizeQuestion({ ...draft, validationStatus: "validated" }),
    ).not.toBeNull();
  });
  it("rejects duplicate distractors and invalid seeds", async () => {
    await expect(
      draftTrainingVariant(
        seed,
        "ssc-cgl",
        vi.fn().mockResolvedValue({ ...variant, options: ["44", "44"] }),
      ),
    ).rejects.toThrow();
    const generate = vi.fn();
    await expect(
      draftTrainingVariant(
        { ...seed, correctAnswer: "Z" },
        "ssc-cgl",
        generate,
      ),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });
});
