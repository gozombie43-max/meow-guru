import { describe, expect, it } from "vitest";
import { planQuestionTranslation } from "./question-translation";

describe("question translation protection", () => {
  const question = "In a certain code language, 'spin fast slow' is written as 'mm nn oo' and 'fast skid slip' is coded as 'nn rr tt' and 'slip slow jump' is coded as 'rr mm zz'. How is 'jump' coded in the given language?";
  const options = ["IT", "ZZ", "mm", "nn"];

  it("protects every word/code in the screenshot and retains exact option case", () => {
    const plan = planQuestionTranslation({ question, options });
    expect(plan.texts).toHaveLength(1);
    expect(plan.texts[0]).not.toContain("spin fast slow");
    expect(plan.texts[0]).not.toContain("mm nn oo");
    const translated = plan.texts[0].replace("In a certain code language", "একটি নির্দিষ্ট কোড ভাষায়");
    const result = plan.restore([translated]);
    expect(result[0]).toContain("একটি নির্দিষ্ট কোড ভাষায়");
    for (const literal of ["'spin fast slow'", "'mm nn oo'", "'fast skid slip'", "'nn rr tt'", "'slip slow jump'", "'rr mm zz'", "'jump'"]) {
      expect(result[0]).toContain(literal);
    }
    expect(result.slice(1)).toEqual(options);
  });

  it("uses topic context for mixed-case and spaced code answers", () => {
    const plan = planQuestionTranslation({ question: "Choose the correct answer.", options: ["aB", "Ab", "ab", "mM nN"] }, "coding-decoding");
    expect(plan.restore(["সঠিক উত্তরটি বেছে নিন।"]).slice(1)).toEqual(["aB", "Ab", "ab", "mM nN"]);
  });

  it("translates normal prose options rather than treating all answers as codes", () => {
    const plan = planQuestionTranslation({ question: "Which colour is the sky?", options: ["Blue", "Green"] }, "general-awareness");
    expect(plan.texts).toEqual(["Which colour is the sky?", "Blue", "Green"]);
    expect(plan.restore(["আকাশের রং কী?", "নীল", "সবুজ"])).toEqual(["আকাশের রং কী?", "নীল", "সবুজ"]);
  });

  it("retains formulas, numbers, curly quotes and repeated literals", () => {
    const text = "If ‘aB’ becomes “Ab”, find ‘aB’ after 12 steps using $x^2 + 1$.";
    const plan = planQuestionTranslation({ question: text }, "letter series");
    expect(plan.restore(plan.texts)).toEqual([text]);
    expect(plan.texts[0]).not.toContain("$x^2 + 1$");
  });

  it("falls back if the service drops, changes or duplicates a marker", () => {
    const plan = planQuestionTranslation({ question, options });
    for (const bad of [plan.texts[0].replace("QZXKEEP0XZQ", ""), plan.texts[0].replace("QZXKEEP0XZQ", "changed"), `${plan.texts[0]} QZXKEEP0XZQ`]) {
      expect(plan.restore([bad])).toEqual([question, ...options]);
    }
  });
});
