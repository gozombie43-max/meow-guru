import { describe, expect, it } from "vitest";
import { normalizeExamLabel } from "./quiz-index";

describe("normalizeExamLabel", () => {
  it.each([
    ["SSC CGL 2024 Shift 2", "SSC CGL"],
    ["SSC CGL Tier II 2022", "SSC CGL Tier II"],
    ["SSC CHSL 2023 Morning", "SSC CHSL"],
    ["Railway Set 12", "Railway"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeExamLabel(input)).toBe(expected);
  });
});
