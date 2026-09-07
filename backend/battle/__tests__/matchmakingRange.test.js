import { describe, expect, it } from "vitest";
import { getAllowedRatingRange } from "../matchmakingService.js";
describe("matchmaking rating expansion", () => { const queuedAt = new Date("2026-01-01T00:00:00Z"); it.each([[0,100],[14999,100],[15000,150],[30000,200],[45000,250],[120000,400]])("%ims wait gives +/-%i", (waited, expected) => expect(getAllowedRatingRange(queuedAt, new Date(+queuedAt + waited))).toBe(expected)); });
