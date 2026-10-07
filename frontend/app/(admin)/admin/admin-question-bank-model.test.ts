import { describe, expect, it } from "vitest";
import {
  QUIZ_OPTIONS_BY_TOPIC,
  SUBJECT_TOPIC_OPTIONS,
  filterTopicsForSubject,
  isTopicAllowedForSubject,
} from "./admin-question-bank-model";

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

  it("permits all topics when subject is empty", () => {
    expect(isTopicAllowedForSubject("algebra", "")).toBe(true);
    expect(isTopicAllowedForSubject("analogy", "")).toBe(true);
    expect(isTopicAllowedForSubject("synonyms-antonyms", "")).toBe(true);
  });

  it("strictly filters topics for mathematics", () => {
    expect(isTopicAllowedForSubject("algebra", "mathematics")).toBe(true);
    expect(isTopicAllowedForSubject("Algebra", "mathematics")).toBe(true);
    expect(isTopicAllowedForSubject("geometry", "mathematics")).toBe(true);
    expect(isTopicAllowedForSubject("compound-interest", "mathematics")).toBe(true);

    // Reasoning topics must be rejected
    expect(isTopicAllowedForSubject("analogy", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("blood-relations", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("classification-odd-one-out", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("coding-decoding", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("coding_decoding", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("mirror-water-image", "mathematics")).toBe(false);

    // English topics must be rejected
    expect(isTopicAllowedForSubject("synonyms-antonyms", "mathematics")).toBe(false);
    expect(isTopicAllowedForSubject("one-word-substitution", "mathematics")).toBe(false);
  });

  it("filters a list of mixed topics for mathematics", () => {
    const mixed = [
      "algebra",
      "analogy",
      "blood-relations",
      "coding-decoding",
      "geometry",
      "synonyms-antonyms",
      "mensuration",
    ];
    const filtered = filterTopicsForSubject(mixed, "mathematics");
    expect(filtered).toEqual(["algebra", "geometry", "mensuration"]);
  });
});
