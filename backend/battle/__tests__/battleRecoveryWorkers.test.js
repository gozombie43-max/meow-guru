import { beforeEach, describe, expect, it, vi } from "vitest";

const roomsCollection = { find: vi.fn() };
const resolveExpiredQuestion = vi.fn();
const advanceQuestion = vi.fn();
const getScores = vi.fn();
const settleBattleResult = vi.fn();
const finishBattle = vi.fn();
const emit = vi.fn();
const io = { to: vi.fn(() => ({ emit })) };

vi.mock("../../config/mongodb.js", () => ({
  getBattleRoomsCollection: () => roomsCollection,
}));
vi.mock("../roomManager.js", () => ({
  resolveExpiredQuestion: (...args) => resolveExpiredQuestion(...args),
  advanceQuestion: (...args) => advanceQuestion(...args),
  getScores: (...args) => getScores(...args),
}));
vi.mock("../battleRealtime.js", () => ({ getBattleRealtimeServer: () => io }));
vi.mock("../battleCompletion.js", () => ({ finishBattle: (...args) => finishBattle(...args) }));
vi.mock("../battleResultService.js", () => ({ settleBattleResult: (...args) => settleBattleResult(...args) }));

const { runBattleQuestionDeadlineWorkerOnce } = await import("../../services/battleQuestionDeadlineWorker.js");
const { runBattleResultWorkerOnce } = await import("../../services/battleResultWorker.js");

function cursor(items) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(items),
  };
}

describe("Battle recovery workers", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
