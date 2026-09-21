import { describe, it, expect } from "vitest";
import {
  normalizeQuestion,
  buildIntelligence,
  selectQuestions,
  adaptiveTargetDifficulty,
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
  it("preserves actual question exam metadata independently of the session exam", () => {
    const q = question("metadata", { examName: "SSC CHSL Tier I 2023", exam: "ssc-cgl" });
    expect(q.examName).toBe("SSC CHSL Tier I 2023");
    expect(q.year).toBe("2023");
    const safe = publicSession(session("adaptive", [q]), now).questions[0];
    expect(safe.examName).toBe(q.examName);
    expect(safe.year).toBe("2023");
    expect(safe).not.toHaveProperty("correctIndex");
    expect(question("array", { exams: ["SSC CGL 2022"], year: 2021 }).year).toBe(2021);
    expect(question("missing").examName).toBeNull();
    expect(question("ambiguous", { exam: "SSC CGL 2022 / 2023" }).year).toBeNull();
  });
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
describe("adaptive difficulty policy", () => {
  it("uses mastery, confidence and pace rather than a fixed plus/minus step", () => {
    const q = question("q1", { difficulty: "medium", expectedTime: 60 });
    expect(
      adaptiveTargetDifficulty({
        question: q,
        answer: { choice: 1, confidence: "sure", seconds: 30 },
        mastery: 0.8,
        mode: "adaptive",
      }),
    ).toBeGreaterThanOrEqual(4);
    expect(
      adaptiveTargetDifficulty({
        question: q,
        answer: { choice: 0, confidence: "sure", seconds: 100 },
        mastery: 0.2,
        mode: "adaptive",
      }),
    ).toBe(1);
    expect(
      adaptiveTargetDifficulty({
        question: q,
        answer: { choice: 0, confidence: "sure", seconds: 100 },
        mastery: 0.2,
        mode: "nightmare",
      }),
    ).toBeGreaterThanOrEqual(3);
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
  it("records deadline as completion time for expired sessions", () => {
    const base = session();
    const s = transition(
      base,
      { type: "finish" },
      now + 700000,
    );
    expect(s.status).toBe("completed");
    expect(s.completionReason).toBe("timeout");
    expect(s.completedAt).toBe(base.deadline);
  });

  it("does not count a slow survival skip as a slow solve", () => {
    let s = session("survival", [question(), question("q2"), question("q3")]);
    s = transition(s, { type: "answer", choice: null }, now + 70000);
    expect(s.lives).toBe(2);
    expect(s.slowStreak || 0).toBe(0);
    s = transition(s, { type: "answer", choice: 1 }, now + 140000);
    expect(s.lives).toBe(2);
  });

  it("keeps mission adaptive ordering inside its block", () => {
    const s = transition(
      session("mission", [
        { ...question("q1", { difficulty: "easy" }), trainingBlock: "A", trainingBlockId: "a", trainingMode: "adaptive" },
        { ...question("q2", { difficulty: "hard" }), trainingBlock: "A", trainingBlockId: "a", trainingMode: "adaptive" },
        { ...question("q3", { difficulty: "easy" }), trainingBlock: "B", trainingBlockId: "b", trainingMode: "sprint" },
      ]),
      { type: "answer", choice: 1, confidence: "sure" },
      now + 10000,
    );
    expect(s.questions[1].id).toBe("q2");
    expect(s.questions[2].trainingBlockId).toBe("b");
    expect(publicSession(s).effectiveMode).toBe("adaptive");
  });

  it("advances a navigable mission block without escaping its policy boundary", () => {
    let s = session("mission", [
      { ...question("q1"), trainingBlock: "Section", trainingBlockId: "a", trainingMode: "section" },
      { ...question("q2"), trainingBlock: "Section", trainingBlockId: "a", trainingMode: "section" },
      { ...question("q3"), trainingBlock: "Next", trainingBlockId: "b", trainingMode: "adaptive" },
    ]);
    s = transition(s, { type: "answer", choice: 1 }, now + 10000);
    expect(s.current).toBe(1);
    expect(publicSession(s).allowedVisitIndices).toEqual([0, 1]);
    s = transition(s, { type: "answer", choice: 1 }, now + 20000);
    expect(s.current).toBe(2);
    expect(publicSession(s).effectiveMode).toBe("adaptive");
  });

  it("abandons without scoring or adding learning evidence", () => {
    const abandoned = transition(session(), { type: "abandon" }, now + 10000);
    expect(abandoned.status).toBe("abandoned");
    expect(abandoned.completionReason).toBe("abandoned");
    expect(abandoned.result).toBeNull();
    expect(transition(abandoned, { type: "answer", choice: 1 }, now + 20000)).toEqual(abandoned);
  });

describe("shared intelligence", () => {
  const difficultyBank = () => Array.from({ length: 25 }, (_, i) =>
    question(`bank${String(i).padStart(2, "0")}`, { difficulty: Math.floor(i / 5) + 1 }),
  );

  it.each(["adaptive", "challenge", "sprint", "pressure", "section", "gauntlet", "nightmare", "survival"])(
    "%s selects unique IDs, respects difficulty floors and leaves the pool unchanged",
    mode => {
      const pool = difficultyBank();
      const snapshot = structuredClone(pool);
      const selected = selectQuestions([...pool, ...pool], mode, 50, buildIntelligence([]), now);
      const floor = mode === "nightmare" ? 3 : mode === "survival" ? 2 : 1;
      expect(selected).toHaveLength(pool.filter(q => q.difficulty >= floor).length);
      expect(new Set(selected.map(q => q.id)).size).toBe(selected.length);
      expect(selected.every(q => q.difficulty >= floor)).toBe(true);
      expect(pool).toEqual(snapshot);
      expect(selectQuestions([...pool, ...pool], mode, 50, buildIntelligence([]), now)).toEqual(selected);
    },
  );

  it.each(["section", "pressure"])("%s supplies a mixed difficulty paper instead of only weak-area drills", mode => {
    const selected = selectQuestions(difficultyBank(), mode, 5, buildIntelligence([]), now);
    expect(selected.map(q => q.difficulty)).toEqual([2, 3, 1, 3, 4]);
  });

  it.each(["challenge", "survival"])("%s builds a difficulty ladder instead of filling the run with the hardest questions", mode => {
    const selected = selectQuestions(difficultyBank(), mode, 6, buildIntelligence([]), now);
    expect(selected[0].difficulty).toBeLessThanOrEqual(3);
    expect(selected.at(-1).difficulty).toBe(5);
    expect(new Set(selected.map(q => q.difficulty)).size).toBeGreaterThanOrEqual(3);
  });

  it("balances subjects even when one subject has many more topics", () => {
    const pool = Array.from({ length: 30 }, (_, i) => question(`math${i}`, { topic: `Math topic ${i}` }));
    pool.push(...Array.from({ length: 10 }, (_, i) => question(`english${i}`, { subject: "english", topic: "Grammar" })));
    const selected = selectQuestions(pool, "section", 10, buildIntelligence([]), now);
    expect(selected.filter(q => q.subject === "english").length).toBeGreaterThanOrEqual(3);
  });

  it("sprint targets known but slow material instead of unfamiliar slow material", () => {
    const profile = buildIntelligence([]);
    profile.topics = [
      { subject: "Mathematics", topic: "Arithmetic", attempts: 20, mastery: 0.9, seconds: 90 },
      { subject: "Mathematics", topic: "Algebra", attempts: 20, mastery: 0.1, seconds: 600 },
    ];
    const selected = selectQuestions([
      question("known", { difficulty: 3 }),
      question("unknown", { topic: "Algebra", difficulty: 3 }),
    ], "sprint", 1, profile, now);
    expect(selected[0].id).toBe("known");
  });

  it("uses alias history and discounts mastery estimates from one attempt", () => {
    const profile = buildIntelligence([]);
    profile.topics = [
      { subject: "Logical Reasoning", topic: "Analogy", attempts: 10, mastery: 0.2, seconds: 60 },
      { subject: "english", topic: "Grammar", attempts: 1, mastery: 0, seconds: 60 },
    ];
    const selected = selectQuestions([
      question("weak", { subject: "reasoning", topic: "Analogy", difficulty: 2 }),
      question("sparse", { subject: "english", topic: "Grammar", difficulty: 2 }),
    ], "adaptive", 1, profile, now);
    expect(selected[0].id).toBe("weak");
    expect(selected[0].targetSource).toBe("personalized");
  });

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
    const exposure = [{ questionId: "q1", timesSeen: 20, lastSeenAt: new Date().toISOString() }];
    expect(selectQuestions(pool, "adaptive", 1, profile, Date.now(), exposure)[0].id).not.toBe("q1");
    const gauntletProfile = buildIntelligence([]);
    gauntletProfile.topics = [
      {
        key: "Mathematics / Algebra",
        subject: "Mathematics",
        topic: "Algebra",
        attempts: 10,
        correct: 9,
        mastery: 0.9,
        seconds: 30,
      },
      {
        key: "Mathematics / Arithmetic",
        subject: "Mathematics",
        topic: "Arithmetic",
        attempts: 10,
        correct: 3,
        mastery: 0.3,
        seconds: 60,
      },
    ];
    const gauntlet = selectQuestions(
      [
        question("a1", { topic: "Algebra", difficulty: "easy" }),
        question("a2", { topic: "Algebra", difficulty: "hard" }),
        question("r1", { topic: "Arithmetic", difficulty: "easy" }),
        question("r2", { topic: "Arithmetic", difficulty: "hard" }),
      ],
      "gauntlet",
      4,
      gauntletProfile,
    );
    expect(gauntlet[0].topic).toBe("Arithmetic");
    expect(gauntlet[1].topic).toBe("Arithmetic");
    profile.due = [{ questionId: "q2" }];
    expect(
      selectQuestions(pool, "review", 20, profile).map((q) => q.id),
    ).toEqual(["q2"]);
  });
});

describe("dynamic mode transitions (reordering)", () => {
  it("adjusts dynamic target according to challenge semantics when in challenge mode", () => {
    // Challenge adjusts difficulty upwards on a correct answer (target becomes harder)
    const q1 = question("q1", { difficulty: 2, expectedTime: 30 });
    const qEasy = question("qEasy", { difficulty: 1 });
    const qHard = question("qHard", { difficulty: 5 }); // This should be selected next!
    
    // mastery = 0.5 (default baseline). targetDifficulty = 2 (q1) + 1 (challenge bump) + ... = around 4-5
    const s = session("challenge", [q1, qEasy, qHard]);
    const updatedSession = transition(s, {
      type: "answer",
      questionId: "q1",
      choice: 1, // correct answer
      confidence: "sure",
      seconds: 15,
    }, now);
    
    // We expect the harder question to be brought to index 1
    expect(updatedSession.questions[updatedSession.current].id).toBe("qHard");
  });

  it("never behaves like normal Adaptive when in Nightmare mode", () => {
    // Nightmare should NOT drop difficulty below 3, even if we get it wrong
    const q1 = question("q1", { difficulty: 4, expectedTime: 30 });
    const qEasy = question("qEasy", { difficulty: 1 });
    const qHard = question("qHard", { difficulty: 4 });
    
    const s = session("nightmare", [q1, qEasy, qHard]);
    const updatedSession = transition(s, {
      type: "answer",
      questionId: "q1",
      choice: 0, // wrong answer -> drops ability
      confidence: "sure",
      seconds: 10,
    }, now);
    
    // If it was "adaptive", target would be 1, so qEasy (diff 1) would be picked.
    // Since it's "nightmare", floor is 3, so target is 3.
    // Distance for qEasy (1) is 2. Distance for qHard (4) is 1. So qHard is closer!
    expect(updatedSession.questions[updatedSession.current].id).toBe("qHard");
  });

  it("retains Nightmare adaptive semantics inside a Mission + Nightmare block", () => {
    const q1 = { ...question("q1", { difficulty: 4 }), trainingBlockId: "blk1", trainingMode: "nightmare" };
    const qEasy = { ...question("qEasy", { difficulty: 1 }), trainingBlockId: "blk1", trainingMode: "nightmare" };
    const qHard = { ...question("qHard", { difficulty: 4 }), trainingBlockId: "blk1", trainingMode: "nightmare" };
    
    const s = session("mission", [q1, qEasy, qHard]);
    const updatedSession = transition(s, {
      type: "answer",
      questionId: "q1",
      choice: 0, // wrong
      confidence: "sure",
      seconds: 10,
    }, now);
    
    // Due to the mode "nightmare", it should not drop to qEasy (diff 1), target is 3.
    expect(updatedSession.questions[updatedSession.current].id).toBe("qHard");
  });

  it("retains Challenge adaptive semantics inside a Mission + Challenge block", () => {
    const q1 = { ...question("q1", { difficulty: 2 }), trainingBlockId: "blk1", trainingMode: "challenge" };
    const qEasy = { ...question("qEasy", { difficulty: 1 }), trainingBlockId: "blk1", trainingMode: "challenge" };
    const qHard = { ...question("qHard", { difficulty: 5 }), trainingBlockId: "blk1", trainingMode: "challenge" };
    
    const s = session("mission", [q1, qEasy, qHard]);
    const updatedSession = transition(s, {
      type: "answer",
      questionId: "q1",
      choice: 1, // correct
      confidence: "sure",
      seconds: 10,
    }, now);
    
    // Due to the mode "challenge", it should ramp up difficulty to qHard.
    expect(updatedSession.questions[updatedSession.current].id).toBe("qHard");
  });
});
