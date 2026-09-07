import { describe, expect, it } from "vitest";
import { calculateElo } from "../battleRatingService.js";
describe("battleRatingService", () => {
  it("gives equal players +/-16 for a decisive result", () => { expect(calculateElo({ ratingA: 1200, ratingB: 1200, resultA: 1 })).toMatchObject({ deltaA: 16, deltaB: -16, newRatingA: 1216, newRatingB: 1184 }); });
  it("rewards an upset more than an even win", () => { expect(calculateElo({ ratingA: 1200, ratingB: 1500, resultA: 1 }).deltaA).toBeGreaterThan(16); });
  it("does not change equal ratings for a draw", () => { expect(calculateElo({ ratingA: 1200, ratingB: 1200, resultA: .5 })).toMatchObject({ deltaA: 0, deltaB: 0 }); });
  it("preserves the rating floor", () => { expect(calculateElo({ ratingA: 100, ratingB: 2200, resultA: 0 }).newRatingA).toBeGreaterThanOrEqual(100); });
});
