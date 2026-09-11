import { describe, it, expect } from "vitest";
import {
  normalizeQuestion,
  buildIntelligence,
  selectQuestions,
  transition,
  publicSession,
} from "../trainingEngine.js";

const now = Date.parse("2026-09-11T00:00:00Z");
const question = (id = "q1", extra = {}) =>
  normalizeQuestion({
    id,
    question: "2 + 2?",
    options: ["3", "4"],
    correctAnswer: 1,
    subject: "Mathematics",
    topic: "Arithmetic",
    expectedTime: 45,
    ...extra,
  });
const session = (
  mode = "adaptive",
  questions = [question(), question("q2")],
) => ({
  id: "s1",
  userId: "u1",
  mode,
  exam: "ssc-cgl",
  questions,
  answers: {},
  events: [],
  current: 0,
  revision: 0,
  lives: mode === "survival" ? 3 : 999,
  startedAt: new Date(now).toISOString(),
  lastEventAt: now,
  deadline: new Date(now + 600000).toISOString(),
  duration: 600,
  status: "active",
  marking: { correct: 1, wrong: 0.25 },
});

describe("training question validation", () => {
  it("normalizes letter, index, text and object IDs without revealing keys", () => {
    for (const correctAnswer of [1, "B", "4"])
      expect(question("q1", { correctAnswer }).correctIndex).toBe(1);
    expect(
      question("q1", {
        options: [
          { id: "a", text: "3" },
          { id: "b", text: "4" },
        ],
        correctAnswer: "b",
      }).correctIndex,
    ).toBe(1);
    const safe = publicSession(session(), now);
    expect(safe.questions[0]).not.toHaveProperty("correctIndex");
    expect(safe.questions[0]).not.toHaveProperty("solution");
    expect(safe).not.toHaveProperty("userId");
  });
  it("rejects invalid keys, malformed options, unsafe IDs and unvalidated AI variants", () => {
    expect(question("q1", { correctAnswer: "Z" })).toBeNull();
    expect(question("q1", { options: "bad" })).toBeNull();
    expect(question("__proto__")).toBeNull();
    expect(question("q1", { sourceType: "ai-generated" })).toBeNull();
    expect(
      question("q1", {
        sourceType: "ai-generated",
        validationStatus: "validated",
      }),
    ).not.toBeNull();
  });
});
describe("authoritative session transitions", () => {
  it("inserts a bounded easier recovery block after a weak gauntlet block", () => {
    let s = {
      ...session("gauntlet", [
        question(),
        question("q2"),
        question("q3"),
        question("q4", { topic: "Geometry" }),
      ]),
      reserve: [
        question("r1", { difficulty: "easy" }),
        question("r2", { difficulty: "easy" }),
      ],
    };
    for (let i = 1; i <= 3; i++)
      s = transition(s, { type: "answer", choice: 0 }, now + i * 10000);
    expect(s.questions[s.current].trainingBlock).toBe("Recovery: Arithmetic");
    expect(s.questions).toHaveLength(6);
    expect(publicSession(s)).not.toHaveProperty("reserve");
  });
  it("scores zero-index answers and leaves blank questions unpenalized", () => {
    let s = session("section", [
      question("q1", { correctAnswer: 0 }),
      question("q2"),
      question("q3"),
    ]);
    s = transition(
      s,
      { type: "answer", choice: 0, confidence: "sure" },
      now + 10000,
    );
    s = transition(s, { type: "visit", index: 1 }, now + 11000);
    s = transition(s, { type: "answer", choice: 0 }, now + 21000);
    s = transition(s, { type: "finish" }, now + 22000);
    expect(s.result.score).toBe(0.75);
    expect(s.result.attempted).toBe(2);
    expect(s.result.negativeLoss).toBe(0.25);
  });
  it("ignores late answers and caps elapsed time at the deadline", () => {
    const s = transition(
      session(),
      { type: "answer", choice: 1 },
      now + 700000,
    );
    expect(s.status).toBe("completed");
    expect(s.result.attempted).toBe(0);
    expect(s.answers.q1.seconds).toBe(600);
    expect(transition(s, { type: "answer", choice: 1 }, now + 800000)).toEqual(
      s,
    );
  });
  it("ends survival after three wrong answers without early reveal", () => {
    let s = session("survival", [
      question(),
      question("q2"),
      question("q3"),
      question("q4"),
    ]);
    for (let i = 1; i <= 3; i++)
      s = transition(s, { type: "answer", choice: 0 }, now + i * 10000);
    expect(s.lives).toBe(0);
    expect(s.status).toBe("completed");
    expect(publicSession(s).questions[0].correctIndex).toBe(1);
  });
  it("penalizes consecutive slow survival solves and disallows backtracking", () => {
    let s = session("survival", [question(), question("q2"), question("q3")]);
    s = transition(s, { type: "answer", choice: 1 }, now + 70000);
    s = transition(s, { type: "answer", choice: 1 }, now + 140000);
    expect(s.lives).toBe(2);
    expect(() =>
      transition(s, { type: "visit", index: 0 }, now + 141000),
    ).toThrow();
  });
  it("adapts the next difficulty without changing answer keys", () => {
    const s = transition(
      session("adaptive", [
        question(),
        question("q2", { difficulty: "easy" }),
        question("q3", { difficulty: "hard" }),
      ]),
      { type: "answer", choice: 1, confidence: "sure" },
      now + 10000,
    );
    expect(s.questions[s.current].id).toBe("q3");
    expect(s.questions[s.current].correctIndex).toBe(1);
  });
  it("records revisits and server-measured accumulated time", () => {
    let s = session("pressure");
    s = transition(s, { type: "visit", index: 1 }, now + 10000);
    s = transition(s, { type: "visit", index: 0 }, now + 30000);
    s = transition(s, { type: "answer", choice: 0 }, now + 80000);
    s = transition(s, { type: "finish" }, now + 80000);
    expect(s.answers.q1.seconds).toBe(60);
    expect(s.answers.q2.seconds).toBe(20);
    expect(s.result.findings.join(" ")).toContain("Q1: 60s");
  });
});
describe("shared intelligence", () => {
  it("correct guesses are not mastery and enter the review queue", () => {
    const s = transition(
      session("adaptive", [question()]),
      { type: "answer", choice: 1, confidence: "guess" },
      now + 10000,
    );
    const profile = buildIntelligence([s], now + 86400000 + 10000);
    expect(profile.topics[0].mastery).toBeLessThan(0.5);
    expect(profile.due).toHaveLength(1);
    expect(profile.readiness).toBeNull();
  });
  it("advances spaced intervals and resets on failure", () => {
    const first = transition(
      session("adaptive", [question()]),
      { type: "answer", choice: 0 },
      now + 10000,
    );
    const second = transition(
      {
        ...session("review", [question()]),
        startedAt: new Date(now + 86400000).toISOString(),
        deadline: new Date(now + 2 * 86400000).toISOString(),
        lastEventAt: now + 86400000,
      },
      { type: "answer", choice: 1, confidence: "sure" },
      now + 86400000 + 10000,
    );
    const profile = buildIntelligence([first, second], now + 2 * 86400000);
    expect(profile.reviews[0].stage).toBe(1);
    expect(profile.due).toHaveLength(0);
    expect(new Date(profile.reviews[0].dueAt).getTime()).toBe(
      new Date(second.completedAt).getTime() + 3 * 86400000,
    );
  });
  it("selects unique balanced questions and limits review to due IDs", () => {
    const profile = buildIntelligence([]);
    const pool = [
      question(),
      question("q2"),
      question("q3", { topic: "Algebra" }),
    ];
    expect(
      selectQuestions(pool, "adaptive", 2, profile).map((q) => q.topic),
    ).toEqual(["Arithmetic", "Algebra"]);
    profile.due = [{ questionId: "q2" }];
    expect(
      selectQuestions(pool, "review", 20, profile).map((q) => q.id),
    ).toEqual(["q2"]);
  });
});
