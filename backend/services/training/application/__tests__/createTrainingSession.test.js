import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTrainingSessionCommand } from "../createTrainingSession.js";

vi.mock("../../../../repositories/trainingRepository.js", () => ({
  trainingHistory: vi.fn().mockResolvedValue([]),
  findMission: vi.fn(),
  createTrainingSession: vi.fn(),
  trainingQuestionPool: vi.fn().mockResolvedValue([{ id: "q1", difficulty: 2, tags: [], expectedTime: 60 }, { id: "q2", difficulty: 2, tags: [], expectedTime: 60 }]),
  trainingExposureData: vi.fn().mockResolvedValue([]),
  trainingLearningState: vi.fn().mockResolvedValue({ skillRows: [], reviewRows: [] }),
  hydrateTrainingQuestions: vi.fn(q => q),
  dueTrainingQuestions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../trainingEngine.js", () => ({
  normalizeQuestion: vi.fn(q => q),
  buildIntelligence: vi.fn().mockReturnValue({ topics: [], due: [], reviews: [], attempts: 0 }),
  mergeDurableIntelligence: vi.fn(i => i),
  selectQuestions: vi.fn(pool => pool),
}));

vi.mock("../../mission/missionPlanner.js", () => ({
  planDailyMission: vi.fn().mockReturnValue([{ id: "q1", trainingMode: "adaptive", trainingBlock: "Block 1", expectedTime: 60 }]),
}));

vi.mock("../../../../infrastructure/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  hashId: vi.fn(id => `hashed-${id}`),
}));

import { findMission, createTrainingSession } from "../../../../repositories/trainingRepository.js";

describe("createTrainingSessionCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing mission early if found", async () => {
    findMission.mockResolvedValueOnce({ id: "existing-session", mode: "mission" });
    
    const { session, isNew } = await createTrainingSessionCommand("user-1", { mode: "mission", exam: "cat" }, Date.now());
    
    expect(isNew).toBe(false);
    expect(session.id).toBe("existing-session");
    expect(createTrainingSession).not.toHaveBeenCalled();
  });

  it("handles duplicate key conflict (race condition) and returns existing mission", async () => {
    findMission.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "race-session", mode: "mission" });
    
    const error = new Error("Duplicate key");
    error.code = 11000;
    createTrainingSession.mockRejectedValueOnce(error);
    
    const { session, isNew } = await createTrainingSessionCommand("user-1", { mode: "mission", exam: "cat" }, Date.now());
    
    expect(isNew).toBe(false);
    expect(session.id).toBe("race-session");
    expect(createTrainingSession).toHaveBeenCalledTimes(1);
    expect(findMission).toHaveBeenCalledTimes(2);
  });

  it("creates a new session successfully", async () => {
    createTrainingSession.mockResolvedValueOnce();
    
    const { session, isNew } = await createTrainingSessionCommand("user-1", { mode: "adaptive", exam: "cat", count: 20 }, Date.now());
    
    expect(isNew).toBe(true);
    expect(session).toBeDefined();
    expect(session.questions.length).toBeGreaterThan(0);
    expect(createTrainingSession).toHaveBeenCalledTimes(1);
  });
});
