import { describe, expect, it } from "vitest";
import { QUIZ_OPTIONS_BY_TOPIC, SUBJECT_TOPIC_OPTIONS } from "./admin-question-bank-model";

describe("admin question-bank model", () => {
  it("keeps human-readable labels for route topic slugs", () => {
    expect(SUBJECT_TOPIC_OPTIONS.english).toContainEqual({
      value: "active-passive-voice",
      label: "Active & Passive Voice",
    });
  });

  it("exposes study mode only for supported vocabulary topics", () => {
    expect(QUIZ_OPTIONS_BY_TOPIC["synonyms-antonyms"]).toContain("Study Mode");
    expect(QUIZ_OPTIONS_BY_TOPIC.mensuration).not.toContain("Study Mode");
  });
});
