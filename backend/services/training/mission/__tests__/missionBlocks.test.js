import { describe, it, expect } from "vitest";
import { getDailyMissionBlocks } from "../missionBlocks.js";

describe("missionBlocks", () => {
  it("generates default mission when no weak topics or due reviews exist", () => {
    const blocks = getDailyMissionBlocks({
      topics: [],
      due: [],
    });

    // Should have 3 blocks: adaptive (baseline), sprint, section, adaptive
    // Wait, the code pushes section and adaptive unconditionally.
    expect(blocks.length).toBe(4);
    
    expect(blocks[0].mode).toBe("adaptive");
    expect(blocks[0].label).toBe("Build your skill baseline");
    
    expect(blocks[1].mode).toBe("sprint");
    
    expect(blocks[2].mode).toBe("section");
    
    expect(blocks[3].mode).toBe("adaptive");
    
    // Ensure no review block
    const reviewBlock = blocks.find(b => b.mode === "review");
    expect(reviewBlock).toBeUndefined();
  });

  it("targets the weakest topic if it exists", () => {
    const blocks = getDailyMissionBlocks({
      topics: [{ topic: "Geometry" }],
      due: [],
    });

    expect(blocks[0].mode).toBe("adaptive");
    expect(blocks[0].label).toBe("Strengthen Geometry");
  });

  it("adds a review block with exact count when due is less than 5", () => {
    const blocks = getDailyMissionBlocks({
      topics: [],
      due: [
        { questionId: "q1" },
        { questionId: "q2" },
        { questionId: "q3" },
        { questionId: "q4" },
      ],
    });

    expect(blocks.length).toBe(5);
    const reviewBlock = blocks.find(b => b.mode === "review");
    expect(reviewBlock).toBeDefined();
    expect(reviewBlock.count).toBe(4);
  });

  it("caps the review block at 5 questions even with many due", () => {
    const blocks = getDailyMissionBlocks({
      topics: [],
      due: Array.from({ length: 100 }, (_, i) => ({ questionId: `q${i}` })),
    });

    expect(blocks.length).toBe(5);
    const reviewBlock = blocks.find(b => b.mode === "review");
    expect(reviewBlock).toBeDefined();
    expect(reviewBlock.count).toBe(5);
  });
});
