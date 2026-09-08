import { describe, expect, it } from "vitest";
import { battleOutcome, battleReducer, initialBattleState, type BattleSnapshot } from "../battle-state";

const question = {
  question: "2 + 2?",
  options: ["3", "4", "4", "5"],
  questionIndex: 0,
  total: 10,
  deadline: "2026-09-08T10:00:30.000Z",
};

describe("battleReducer", () => {
  it("keeps the selected option by index and applies the authoritative reveal", () => {
    let state = battleReducer({ ...initialBattleState, phase: "waiting" }, { type: "question", question });
    state = battleReducer(state, { type: "select", index: 2 });
    state = battleReducer(state, { type: "accepted", questionIndex: 0, isCorrect: false });
    state = battleReducer(state, {
      type: "reveal",
      userId: "me",
      reveal: { questionIndex: 0, correctIndex: 1, selections: { me: 2, opponent: 1 } },
    });

    expect(state.selectedIndex).toBe(2);
    expect(state.reveal?.correctIndex).toBe(1);
    expect(state.correct).toBe(false);
  });

  it("ignores stale question and answer events", () => {
    const current = { ...question, questionIndex: 2 };
    let state = battleReducer({ ...initialBattleState, phase: "playing", question: current }, { type: "question", question: { ...question, questionIndex: 1 } });
    state = battleReducer(state, { type: "accepted", questionIndex: 1, isCorrect: true });
    expect(state.question?.questionIndex).toBe(2);
    expect(state.answerStatus).toBe("idle");
  });

  it("restores an answered round without allowing a duplicate submission", () => {
    const snapshot: BattleSnapshot = {
      code: "4821", status: "active", subject: "mathematics", topic: "all", questionCount: 10,
      players: [{ userId: "me", name: "Me", connected: true }, { userId: "opponent", name: "Rival", connected: true }],
      scores: {
        me: { name: "Me", score: 10, answered: true, lastCorrect: true },
        opponent: { name: "Rival", score: 0, answered: false },
      },
      myAnswered: true, mySelectedIndex: 1, currentQuestion: question,
      opponentPresence: { connected: true },
    };
    const state = battleReducer(initialBattleState, { type: "resume", snapshot, userId: "me" });
    expect(state.phase).toBe("playing");
    expect(state.answerStatus).toBe("accepted");
    expect(state.selectedIndex).toBe(1);
    expect(state.correct).toBe(true);
  });

  it("keeps a recoverable rejected answer selectable while match state is restored", () => {
    const state = battleReducer(
      { ...initialBattleState, phase: "playing", question },
      { type: "rejected", reason: "server-error", questionIndex: 0 },
    );
    expect(state.answerStatus).toBe("idle");
    expect(state.selectedIndex).toBeNull();
    expect(state.error).toMatch(/temporarily unavailable/i);
  });
});

describe("battleOutcome", () => {
  it("does not treat tied scores as a win", () => {
    const result = { scores: { me: { name: "Me", score: 10, answered: true }, opponent: { name: "Rival", score: 10, answered: true } } };
    expect(battleOutcome(result, "me")).toBe("draw");
  });

  it("awards instant win to the remaining player on forfeit", () => {
    const result = {
      scores: {
        me: { name: "Me", score: 0, answered: false },
        opponent: { name: "Rival", score: 20, answered: true },
      },
      finishReason: "forfeit" as const,
      winnerUserId: "me",
      loserUserId: "opponent",
    };
    expect(battleOutcome(result, "me")).toBe("win");
    expect(battleOutcome(result, "opponent")).toBe("loss");
  });

  it("preserves review items on game end", () => {
    const state = battleReducer(
      { ...initialBattleState, phase: "playing" },
      {
        type: "end",
        result: {
          scores: { me: { name: "Me", score: 10, answered: true } },
          finishReason: "completed",
          review: [
            {
              questionIndex: 0,
              question: "2 + 2?",
              options: ["3", "4"],
              correctIndex: 1,
              myAnswer: { selectedIndex: 1, correct: true },
              opponentAnswer: { selectedIndex: 0, correct: false },
            },
          ],
        },
      }
    );
    expect(state.phase).toBe("finished");
    expect(state.result?.review).toHaveLength(1);
    expect(state.result?.review?.[0].correctIndex).toBe(1);
  });
});
