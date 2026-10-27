import { describe, expect, it } from "vitest";
import {
  QUIZ_OPTIONS_BY_TOPIC,
  SUBJECT_TOPIC_OPTIONS,
  filterTopicsForSubject,
  getGeneralAwarenessChaptersForTopic,
  isTopicAllowedForSubject,
  resolveGeneralAwarenessQuestionTaxonomy,
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

  it("exposes the 11 canonical General Awareness topics and their ranked chapters", () => {
    expect(SUBJECT_TOPIC_OPTIONS["general-awareness"].map((t) => t.value)).toEqual([
      "ancient-history",
      "medieval-history",
      "modern-history",
      "polity",
      "geography",
      "physics",
      "chemistry",
      "biology",
      "economy",
      "current-affairs",
      "static-gk",
    ]);

    const chemistryChapters = getGeneralAwarenessChaptersForTopic("chemistry");
    expect(chemistryChapters.map((c) => c.value)).toContain("Acids, Bases and Salts");
    expect(chemistryChapters[0]).toMatchObject({
      value: "Matter and Its Properties",
      label: "Matter and Its Properties",
      rank: 1,
    });

    // GA chapter names must not leak into top-level topics for any subject
    expect(isTopicAllowedForSubject("Acids, Bases and Salts", "general-awareness")).toBe(false);
    expect(isTopicAllowedForSubject("chemistry", "general-awareness")).toBe(true);
    expect(isTopicAllowedForSubject("Acids, Bases and Salts", "mathematics")).toBe(false);

    expect(
      resolveGeneralAwarenessQuestionTaxonomy({
        topic: "Acids, Bases and Salts",
        chapter: "Acids, Bases and Salts",
      })
    ).toEqual({
      topicSlug: "chemistry",
      topicLabel: "Chemistry",
      chapterTitle: "Acids, Bases and Salts",
    });
  });
});
