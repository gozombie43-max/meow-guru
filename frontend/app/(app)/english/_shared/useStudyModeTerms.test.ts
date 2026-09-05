import { describe,expect,it } from "vitest";
import { normalizeStudyModeTerm } from "./useStudyModeTerms";

describe("normalizeStudyModeTerm", () => {
  it("normalizes API fields and the generic one-word category", () => {
    expect(
      normalizeStudyModeTerm(
        {
          id: "term-1",
          word: "Bibliophile",
          meanings: [
            {
              definition: "A person who loves books",
              translation: "বইপ্রেমী",
            },
          ],
          concept: "One-Word Substitution",
          translation: "গ্রন্থপ্রেমী",
        },
        0
      )
    ).toEqual({
      id: "term-1",
      prompt: "A person who loves books",
      answer: "Bibliophile",
      definitionTranslation: "বইপ্রেমী",
      answerTranslation: "গ্রন্থপ্রেমী",
      label: "General",
    });
  });

  it("rejects entries without both a prompt and answer", () => {
    expect(normalizeStudyModeTerm({ id: "empty" }, 0)).toBeNull();
  });
});
