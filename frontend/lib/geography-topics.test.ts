import { describe, expect, it } from "vitest";
import { GEOGRAPHY_TOPICS, getGeographyTopic } from "./geography-topics";

describe("geography topics", () => {
  it("keeps all 30 chapters ranked with unique quiz routes", () => {
    expect(GEOGRAPHY_TOPICS).toHaveLength(30);
    expect(GEOGRAPHY_TOPICS.map((topic) => topic.rank)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1)
    );
    expect(new Set(GEOGRAPHY_TOPICS.map((topic) => topic.slug)).size).toBe(30);
  });

  it("resolves a chapter from its route slug", () => {
    expect(getGeographyTopic("indian-rivers-drainage-system")?.title).toBe(
      "Indian Rivers & Drainage System"
    );
    expect(getGeographyTopic("not-a-real-chapter")).toBeUndefined();
  });
});
