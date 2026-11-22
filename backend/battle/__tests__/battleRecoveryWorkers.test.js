import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roomsCollection = { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() };
const resolveExpiredQuestion = vi.fn();
const advanceQuestion = vi.fn();
const getScores = vi.fn();
const settleBattleResult = vi.fn();
const finishBattle = vi.fn();
const emit = vi.fn();
const io = { to: vi.fn(() => ({ emit })) };
const mockGetRedisClient = vi.fn().mockResolvedValue(null);

vi.mock("../../config/mongodb.js", () => ({
  getBattleRoomsCollection: () => roomsCollection,
}));
vi.mock("../../config/redis.js", () => ({
  getRedisClient: (...args) => mockGetRedisClient(...args),
  redisKey: (key) => `test:${key}`,
  reportRedisFailure: vi.fn(),
}));
vi.mock("../../auth/jwt.js", () => ({
  signBattleRematchToken: () => "mock-rematch-token",
}));
vi.mock("../../services/pushNotificationService.js", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../roomManager.js", () => ({
  resolveExpiredQuestion: (...args) => resolveExpiredQuestion(...args),
  advanceQuestion: (...args) => advanceQuestion(...args),
  getScores: (...args) => getScores(...args),
  buildBattleReveal: room => ({ questionIndex: room.currentIndex, correctIndex: 0, selections: {}, scores: {}, revealEndsAt: null }),
  buildPublicQuestion: room => ({ questionIndex: room.currentIndex, deadline: room.questionDeadline }),
  buildBattleReview: () => ({ summary: "mock-review" }),
  getRoom: vi.fn(), claimBattleReveal: vi.fn(),
}));
vi.mock("../battleRealtime.js", () => ({ getBattleRealtimeServer: () => io }));
vi.mock("../battleCompletion.js", () => ({ finishBattle: (...args) => finishBattle(...args) }));
vi.mock("../battleResultService.js", () => ({ settleBattleResult: (...args) => settleBattleResult(...args) }));

const { runBattleQuestionDeadlineWorkerOnce } = await import("../../services/battleQuestionDeadlineWorker.js");
const { runBattleResultWorkerOnce } = await import("../../services/battleResultWorker.js");
const { runBattlePresenceWorkerOnce } = await import("../../services/battlePresenceWorker.js");

function cursor(items) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(items),
  };
}

describe("Battle recovery workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(null);
    // The reveal path compares resolution and poll timestamps exactly.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("advances a durably resolved expired question and broadcasts the next deadline", async () => {
    const now = new Date();
    const candidate = { code: "4821", currentIndex: 0 };
    roomsCollection.find.mockReturnValueOnce(cursor([candidate]));
    resolveExpiredQuestion.mockResolvedValueOnce({
      resolved: true,
      readyToAdvance: true,
      room: { ...candidate, questionResolvedAt: now, questions: [{ correctAnswer: 0 }], players: [] },
    });
    advanceQuestion.mockResolvedValueOnce({
      advanced: true,
      finished: false,
      room: {
        code: "4821", currentIndex: 1,
        questionDeadline: new Date(now.getTime() + 30_000),
        questions: [{}, { question: "Next?", options: ["A", "B"] }],
      },
    });
    getScores.mockResolvedValueOnce({});

    await runBattleQuestionDeadlineWorkerOnce();

    expect(advanceQuestion).toHaveBeenCalledWith("4821", 0);
    expect(emit).not.toHaveBeenCalledWith("game:scores", expect.anything());
    expect(emit).toHaveBeenCalledWith("game:reveal", {
      questionIndex: 0, correctIndex: 0, selections: {}, scores: {}, revealEndsAt: null,
    });
    expect(emit).toHaveBeenCalledWith("game:question", expect.objectContaining({
      questionIndex: 1,
      deadline: expect.any(Date),
    }));
  });

  it("settles every finished room that lacks a durable result marker", async () => {
    const rooms = [{ code: "1111", status: "finished" }, { code: "2222", status: "finished" }];
    roomsCollection.find.mockReturnValueOnce(cursor(rooms));
    settleBattleResult.mockResolvedValue({ alreadyRecorded: false });

    await runBattleResultWorkerOnce();

    expect(roomsCollection.find).toHaveBeenCalledWith({
      status: "finished",
      resultRecordedAt: { $exists: false },
    });
    expect(settleBattleResult).toHaveBeenCalledTimes(2);
  });

  it("hands a timeout-finished room to the same settlement and end-event path", async () => {
    const candidate = { code: "4821", currentIndex: 9 };
    const finished = { code: "4821", status: "finished", players: [] };
    roomsCollection.find.mockReturnValueOnce(cursor([candidate]));
    resolveExpiredQuestion.mockResolvedValueOnce({
      resolved: true,
      readyToAdvance: true,
      room: { ...candidate, players: [], questions: [] },
    });
    advanceQuestion.mockResolvedValueOnce({ advanced: true, finished: true, room: finished });

    await runBattleQuestionDeadlineWorkerOnce();

    expect(finishBattle).toHaveBeenCalledWith(io, finished);
  });

  it("skips worker tick when another instance holds the Redis distributed lease", async () => {
    const redisMock = {
      set: vi.fn().mockResolvedValue(null),
      eval: vi.fn(),
    };
    mockGetRedisClient.mockResolvedValue(redisMock);

    await runBattleQuestionDeadlineWorkerOnce();
    await runBattleResultWorkerOnce();
    await runBattlePresenceWorkerOnce();

    expect(redisMock.set).toHaveBeenCalledTimes(3);
    expect(roomsCollection.find).not.toHaveBeenCalled();
  });

  it("drains multiple batches (>100 rooms) in a single tick up to the batch ceiling", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, idx) => ({
      code: `R${1000 + idx}`,
      status: "finished",
    }));
    const secondBatch = Array.from({ length: 25 }, (_, idx) => ({
      code: `R${2000 + idx}`,
      status: "finished",
    }));
    roomsCollection.find
      .mockReturnValueOnce(cursor(firstBatch))
      .mockReturnValueOnce(cursor(secondBatch));
    settleBattleResult.mockResolvedValue({ alreadyRecorded: false });

    await runBattleResultWorkerOnce();

    expect(roomsCollection.find).toHaveBeenCalledTimes(2);
    expect(settleBattleResult).toHaveBeenCalledTimes(125);
  });

  it("emits game:end to user:<userId> with full rating and matchStats parity on forfeit", async () => {
    const now = new Date();
    const expiredDeadline = new Date(now.getTime() - 5_000);
    const activeRoom = {
      _id: "room-forfeit-1",
      code: "7777",
      status: "active",
      subject: "Quant",
      topic: "Percentages",
      questionCount: 5,
      updatedAt: new Date(now.getTime() - 10_000),
      players: [
        { userId: "u-winner", name: "Winner", score: 20, connected: true, answered: true, socketId: "sock-1" },
        { userId: "u-loser", name: "Loser", score: 10, connected: false, reconnectDeadline: expiredDeadline, socketId: "sock-2" },
      ],
    };
    const finishedRoom = {
      ...activeRoom,
      status: "finished",
      finishReason: "forfeit",
      winnerUserId: "u-winner",
      loserUserId: "u-loser",
    };

    roomsCollection.find.mockReturnValueOnce(cursor([activeRoom]));
    roomsCollection.findOne.mockResolvedValueOnce(activeRoom);
    roomsCollection.findOneAndUpdate.mockResolvedValueOnce(finishedRoom);
    settleBattleResult.mockResolvedValueOnce({
      match: {
        rated: true,
        players: [
          {
            userId: "u-winner",
            ratingBefore: 1200,
            ratingAfter: 1216,
            ratingDelta: 16,
            seasonRatingBefore: 1100,
            seasonRatingAfter: 1118,
            seasonRatingDelta: 18,
            seasonTierBefore: "Silver",
            seasonTierAfter: "Gold",
            answerLog: [{ correct: true, timedOut: false, responseTimeMs: 4200 }],
          },
          {
            userId: "u-loser",
            ratingBefore: 1200,
            ratingAfter: 1184,
            ratingDelta: -16,
            seasonRatingBefore: 1100,
            seasonRatingAfter: 1082,
            seasonRatingDelta: -18,
            seasonTierBefore: "Silver",
            seasonTierAfter: "Silver",
            answerLog: [{ correct: false, timedOut: true, responseTimeMs: null }],
          },
        ],
      },
    });

    await runBattlePresenceWorkerOnce();

    expect(io.to).toHaveBeenCalledWith("user:u-winner");
    expect(io.to).toHaveBeenCalledWith("user:u-loser");
    expect(emit).toHaveBeenCalledWith(
      "game:end",
      expect.objectContaining({
        finishReason: "forfeit",
        winnerUserId: "u-winner",
        loserUserId: "u-loser",
        rematchToken: "mock-rematch-token",
        matchStats: {
          me: { correct: 1, total: 1, accuracy: 100, averageResponseMs: 4200, timedOut: 0 },
          opponent: { correct: 0, total: 1, accuracy: 0, averageResponseMs: null, timedOut: 1 },
        },
        rating: {
          lifetime: { before: 1200, after: 1216, delta: 16 },
          season: {
            before: 1100,
            after: 1118,
            delta: 18,
            tierBefore: "Silver",
            tierAfter: "Gold",
          },
        },
        review: { summary: "mock-review" },
      }),
    );
  });
});
