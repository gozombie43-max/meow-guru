import { describe, expect, it } from "vitest";
import {
  GENERAL_AWARENESS_TOPIC_GROUPS,
  getGeneralAwarenessChapter,
  getGeneralAwarenessChapterParams,
} from "./general-awareness-topic-groups";
import { QUIZ_TREE } from "./quiz-constants";

describe("general awareness ranked topic groups", () => {
  it("replaces History with the three syllabus periods", () => {
    const topics = QUIZ_TREE["general-awareness"].topics;

    expect(topics.history).toBeUndefined();
    expect(topics["ancient-history"]?.label).toBe("Ancient History");
    expect(topics["medieval-history"]?.label).toBe("Medieval History");
    expect(topics["modern-history"]?.label).toBe("Modern History");
  });

  it("splits General Science and promotes Economy and Static GK to ranked groups", () => {
    const topics = QUIZ_TREE["general-awareness"].topics;

    expect(topics["general-science"]).toBeUndefined();
    expect(topics.economics).toBeUndefined();
    expect(topics.physics?.label).toBe("Physics");
    expect(topics.chemistry?.label).toBe("Chemistry");
    expect(topics.biology?.label).toBe("Biology");
    expect(topics.economy?.label).toBe("Economy");
    expect(GENERAL_AWARENESS_TOPIC_GROUPS["static-gk"].topics).toHaveLength(18);
  });

  it("keeps every ranked chapter unique and routable", () => {
    const expected = {
      "ancient-history": { total: 14, Core: 6, High: 5, Medium: 3 },
      "medieval-history": { total: 10, Core: 3, High: 5, Medium: 2 },
      "modern-history": { total: 19, Core: 7, High: 9, Medium: 3 },
    } as const;

    Object.entries(expected).forEach(([slug, counts]) => {
      const topics = GENERAL_AWARENESS_TOPIC_GROUPS[slug].topics;
      expect(topics).toHaveLength(counts.total);
      expect(topics.map(({ rank }) => rank)).toEqual(
        Array.from({ length: counts.total }, (_, index) => index + 1)
      );
      expect(topics.filter(({ priority }) => priority === "Core")).toHaveLength(counts.Core);
      expect(topics.filter(({ priority }) => priority === "High")).toHaveLength(counts.High);
      expect(topics.filter(({ priority }) => priority === "Medium")).toHaveLength(counts.Medium);
    });

    const params = getGeneralAwarenessChapterParams();
    expect(params).toHaveLength(192);
    expect(new Set(params.map(({ topic, chapter }) => `${topic}/${chapter}`)).size).toBe(192);
    expect(getGeneralAwarenessChapter("modern-history", "gandhian-era")?.rank).toBe(1);
  });

  it("preserves the ordered Science, Economy and Static GK syllabus counts", () => {
    const expected = {
      physics: { total: 18, Core: 6, High: 6, Medium: 6 },
      chemistry: { total: 18, Core: 6, High: 6, Medium: 6 },
      biology: { total: 20, Core: 7, High: 7, Medium: 6 },
      economy: { total: 17, Core: 6, High: 6, Medium: 5 },
      "static-gk": { total: 18, Core: 6, High: 6, Medium: 6 },
    } as const;

    Object.entries(expected).forEach(([slug, counts]) => {
      const topics = GENERAL_AWARENESS_TOPIC_GROUPS[slug].topics;
      expect(topics).toHaveLength(counts.total);
      expect(topics.map(({ rank }) => rank)).toEqual(
        Array.from({ length: counts.total }, (_, index) => index + 1)
      );
      expect(topics.filter(({ priority }) => priority === "Core")).toHaveLength(counts.Core);
      expect(topics.filter(({ priority }) => priority === "High")).toHaveLength(counts.High);
      expect(topics.filter(({ priority }) => priority === "Medium")).toHaveLength(counts.Medium);
    });
  });

  it("preserves all Polity chapters and supplied weightage tiers", () => {
    const topics = GENERAL_AWARENESS_TOPIC_GROUPS.polity.topics;

    expect(topics).toHaveLength(28);
    expect(topics.map(({ rank }) => rank)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1)
    );
    expect(topics.filter(({ priority }) => priority === "High")).toHaveLength(10);
    expect(topics.filter(({ priority }) => priority === "Medium")).toHaveLength(8);
    expect(topics.filter(({ priority }) => priority === "Lower")).toHaveLength(10);
    expect(getGeneralAwarenessChapter("polity", "fundamental-rights")?.rank).toBe(1);
  });
});
