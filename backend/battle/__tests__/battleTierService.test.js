import { describe, expect, it } from "vitest";
import { getBattleTier } from "../battleTierService.js";

describe("battle tiers", () => {
  it("keeps players unranked through five placement games", () => {
    expect(getBattleTier({ rating: 2000, gamesPlayed: 4 })).toEqual({ name: "Unranked", placementGamesRemaining: 1 });
    expect(getBattleTier({ rating: 1200, gamesPlayed: 5 })).toEqual({ name: "Silver", placementGamesRemaining: 0 });
  });

  it("maps completed-placement ratings to the configured tiers", () => {
    expect(getBattleTier({ rating: 1099, gamesPlayed: 5 }).name).toBe("Bronze");
    expect(getBattleTier({ rating: 1250, gamesPlayed: 5 }).name).toBe("Gold");
    expect(getBattleTier({ rating: 1550, gamesPlayed: 5 }).name).toBe("Diamond");
  });
});
