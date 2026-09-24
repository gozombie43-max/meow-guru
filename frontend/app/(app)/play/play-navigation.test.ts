import { describe, expect, it } from "vitest";
import { playHref, playTab } from "./play-navigation";

describe("Play URLs", () => {
  it("resolves direct destinations and falls back for invalid values", () => {
    expect(playTab("review")).toBe("Review");
    expect(playTab("insights")).toBe("Analytics");
    expect(playTab("toString")).toBe("Play");
    expect(playTab(null)).toBe("Play");
  });
  it("preserves exam and unrelated parameters while switching views", () => {
    expect(playHref("exam=cat&source=home", "Review")).toBe("/play?exam=cat&source=home&view=review");
    expect(playHref("view=mission&source=home", "Play", "ssc-chsl")).toBe("/play?source=home&exam=ssc-chsl");
  });
});
