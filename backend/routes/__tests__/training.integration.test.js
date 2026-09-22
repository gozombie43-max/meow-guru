import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import express from "express";
import { once } from "node:events";
import { connectMongoDB, disconnectMongoDB } from "../../config/mongodb.js";
import { createSession } from "../../auth/sessions.js";
import { up } from "../../migrations/005-training.js";
import { up as upHardening } from "../../migrations/007-training-hardening.js";
import router from "../training.js";
import curationRouter from "../trainingCuration.js";
import { invalidateTrainingCatalog } from '../../services/training/catalogCache.js';

import { up as upPerformance } from '../../migrations/008-training-performance.js';
import { up as upExamWideCandidates } from '../../migrations/009-training-exam-wide-candidates.js';
import { up as upLearnerStateMeta } from '../../migrations/010-training-learner-state-meta.js';
import { backfillTrainingMetadata } from '../../services/training/questionMetadataBackfill.js';
import { trainingQuestionPool, trainingExposureData, trainingHistory } from '../../repositories/trainingRepository.js';

let mongo, db, server, base, token;
afterEach(() => vi.unstubAllEnvs());
async function request(path, method = "GET", body, auth = token) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "training_test";
  db = await connectMongoDB();
  await up(db);
  await upHardening(db);
  await upPerformance(db);
  await upExamWideCandidates(db);
  await upLearnerStateMeta(db);
  const app = express();
  app.use(express.json());
  app.use("/curation", curationRouter);
  app.use(router);
  app.use((e, _req, res, _next) => res.status(500).json({ error: e.message }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  invalidateTrainingCatalog();
  await db
    .collection("users")
    .updateOne(
      { id: "student" },
      { $set: { id: "student", status: "active", role: "user" } },
      { upsert: true },
    );
  token = (await createSession({ id: "student" })).token;
  await db.collection("trainingSessions").deleteMany({});
  await db.collection("trainingQuestionVariants").deleteMany({});
  await db.collection("trainingReviewState").deleteMany({});
  await db.collection("trainingQuestionExposure").deleteMany({});
  await db.collection("trainingSkillState").deleteMany({});
  await db.collection('trainingLearnerStateMeta').deleteMany({});
  await db.collection("userSkillProfile").deleteMany({});
  await db.collection("questions").deleteMany({});
  await db.collection("questions").insertMany(
    Array.from({ length: 25 }, (_, i) => ({
      id: `q${i}`,
      exam: "ssc-cgl",
      question: `Question ${i}`,
      options: ["A value", "B value"],
      correctAnswer: i % 2,
      subject: "Mathematics",
      topic: i % 2 ? "Algebra" : "Arithmetic",
      difficulty: "hard",
      expectedTime: 45,
    })),
  );
});
afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectMongoDB();
  if (mongo) await mongo.stop();
});
async function start(mode = "section") {
  const r = await request("/sessions", "POST", {
    mode,
    exam: "ssc-cgl",
    count: 10,
    subject: "Mathematics",
  });
  expect(r.status).toBe(201);
  return r.json();
}
describe("persistent training API", () => {
  it.each([
    "adaptive", "challenge", "sprint", "pressure", "section", "gauntlet", "nightmare", "survival",
  ])("deduplicates subject aliases and preserves their topics and questions for %s", async (mode) => {
    await db.collection("questions").deleteMany({});
    await db.collection("questions").insertMany([
      { id: "r1", subject: "Reasoning", topic: "Analogy" },
      { id: "r2", subject: "reasoning", topic: "Analogy" },
      { id: "r3", subject: " logical reasoning ", topic: "Syllogism" },
      { id: "r4", subject: "Logical-Reasoning", topic: "Analogy" },
      { id: "e1", subject: "english", topic: "Grammar" },
    ].map(q => ({ ...q, exam: "ssc-cgl", question: "Question", options: ["A", "B"], correctAnswer: 0, difficulty: "hard" })));
    const dashboard = await (await request("/dashboard?exam=ssc-cgl")).json();
    expect(dashboard.subjects).toEqual(["english", "reasoning"]);
    expect(dashboard.catalog.filter(pair => pair.subject === "reasoning")).toEqual([
      { subject: "reasoning", topic: "Analogy" },
      { subject: "reasoning", topic: "Syllogism" },
    ]);
    for (const topic of [undefined, "Analogy", "Syllogism"]) {
      const response = await request("/sessions", "POST", {
        mode, exam: "ssc-cgl", subject: "reasoning", topic, count: 10,
      });
      expect(response.status).toBe(201);
      const session = await response.json();
      const stored = await db.collection("trainingSessions").findOne({ id: session.id });
      expect(stored.questions.map(q => q.id).sort()).toEqual(
        topic === "Analogy" ? ["r1", "r2", "r4"] : topic === "Syllogism" ? ["r3"] : ["r1", "r2", "r3", "r4"],
      );
    }
  });

  it.each([
    "adaptive", "challenge", "sprint", "pressure", "section", "gauntlet", "nightmare", "survival",
  ])("includes dated and combined exam labels in filters and %s sessions", async (mode) => {
    await db.collection("questions").deleteMany({});
    await db.collection("questions").insertMany([
      { id: "math", subject: "mathematics", topic: "Algebra", exam: "SSC CGL Tier II (08/08/2022)" },
      { id: "english", subject: "english", questionTopic: "Grammar", examName: "SSC CGL 2024 (1st Shift)" },
      { id: "combined", subject: "reasoning", topic: "Analogy", exams: ["SSC CGL / CHSL"] },
      { id: "ga", subject: "general-awareness", topic: "History", exam: "SSC-CGL" },
      { id: "other", subject: "other", topic: "Excluded", exam: "SSC CPO 2024" },
    ].map(q => ({ ...q, question: "Question", options: ["A", "B"], correctAnswer: 0, difficulty: "hard" })));
    const dashboard = await (await request("/dashboard?exam=ssc-cgl")).json();
    expect(dashboard.subjects).toEqual(["english", "general-awareness", "mathematics", "reasoning"]);
    expect(dashboard.catalogTopics).toEqual(expect.arrayContaining(["Algebra", "Grammar", "Analogy", "History"]));
    const chsl = await (await request("/dashboard?exam=ssc-chsl")).json();
    expect(chsl.subjects).toEqual(["reasoning"]);
    const response = await request("/sessions", "POST", {
      mode, exam: "ssc-cgl", subject: "mathematics", topic: "Algebra", count: 10,
    });
    expect(response.status).toBe(201);
    const session = await response.json();
    const stored = await db.collection("trainingSessions").findOne({ id: session.id });
    expect(stored.questions.map(q => q.id)).toEqual(["math"]);
  });

  it("exposes the authoritative training capability contract", async () => {
    const response = await request("/capabilities");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.exams.map((exam) => exam.id)).toContain("ssc-cgl");
    expect(body.modes.pressure.navigation).toBe("free");
    expect(body.modes.survival.lives).toBe(3);
  });

  it("requires an admin and publishes verified variants transactionally", async () => {
    expect((await request("/curation/variants")).status).toBe(403);
    await db
      .collection("users")
      .updateOne({ id: "student" }, { $set: { role: "admin" } });
    token = (await createSession({ id: "student", role: "admin" })).token;
    await db.collection("trainingQuestionVariants").insertOne({
      id: "draft1",
      seedId: "q0",
      exam: "ssc-cgl",
      subject: "Mathematics",
      topic: "Arithmetic",
      question: "Verified question",
      options: ["A", "B"],
      correctAnswer: 0,
      validationStatus: "pending_review",
      sourceType: "ai-generated",
    });
    const body = {
      decision: "approve",
      verifiedAnswer: 1,
      verificationNotes:
        "Independently calculated the answer and verified both options.",
    };
    expect(
      (await request("/curation/variants/draft1/review", "POST", body)).status,
    ).toBe(200);
    expect(
      (await db.collection("questions").findOne({ id: "draft1" }))
        .correctAnswer,
    ).toBe(1);
    expect(
      (
        await db
          .collection("trainingQuestionVariants")
          .findOne({ id: "draft1" })
      ).validationStatus,
    ).toBe("validated");
    expect(
      (await request("/curation/variants/draft1/review", "POST", body)).status,
    ).toBe(200);
    expect(
      await db.collection("questions").countDocuments({ id: "draft1" }),
    ).toBe(1);
  });
  it("uses configured sectional marking and rejects undersized full sections", async () => {
    const s = await start();
    expect(s.marking).toEqual({ correct: 2, wrong: 0.5 });
    const full = await request("/sessions", "POST", {
      mode: "section",
      exam: "ssc-cgl",
      tier: "2",
      subject: "Mathematics",
      count: "full",
    });
    expect(full.status).toBe(422);
  });
  it("creates a single resumable daily mission under concurrent starts", async () => {
    const replies = await Promise.all(
      [1, 2].map(() =>
        request("/sessions", "POST", { mode: "mission", exam: "ssc-cgl" }),
      ),
    );
    const bodies = await Promise.all(replies.map((r) => r.json()));
    expect(bodies[0].id).toBe(bodies[1].id);
    expect(new Set(bodies[0].questions.map((q) => q.id)).size).toBe(
      bodies[0].questions.length,
    );
  });
  it("requires authentication and isolates session ownership", async () => {
    expect((await request("/dashboard", "GET", undefined, "bad")).status).toBe(
      401,
    );
    const s = await start();
    await db.collection("users").insertOne({ id: "other" });
    const other = (await createSession({ id: "other" })).token;
    expect(
      (await request(`/sessions/${s.id}`, "GET", undefined, other)).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/sessions/${s.id}/actions`,
          "POST",
          { type: "finish", revision: 0 },
          other,
        )
      ).status,
    ).toBe(404);
  });
  it("does not expose solutions and serializes racing submissions", async () => {
    const s = await start();
    expect(s.questions[0]).not.toHaveProperty("correctIndex");
    expect(s.questions[0]).not.toHaveProperty("solution");
    const replies = await Promise.all(
      [0, 1].map((choice) =>
        request(`/sessions/${s.id}/actions`, "POST", {
          type: "answer",
          choice,
          revision: 0,
        }),
      ),
    );
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = await (await request(`/sessions/${s.id}`)).json();
    expect(saved.revision).toBe(1);
    const done = await (
      await request(`/sessions/${s.id}/actions`, "POST", {
        type: "finish",
        revision: 1,
      })
    ).json();
    expect(done.status).toBe("completed");
    expect(done.result.attempted).toBe(1);
    const repeat = await (
      await request(`/sessions/${s.id}/actions`, "POST", {
        type: "finish",
        revision: 1,
      })
    ).json();
    expect(repeat.result).toEqual(done.result);
  });
  it("finalizes expired sessions on reload and ignores late answers", async () => {
    const s = await start();
    await db
      .collection("trainingSessions")
      .updateOne(
        { id: s.id },
        { $set: { deadline: new Date(Date.now() - 1000).toISOString() } },
      );
    const done = await (
      await request(`/sessions/${s.id}/actions`, "POST", {
        type: "answer",
        choice: 1,
        revision: 0,
      })
    ).json();
    expect(done.status).toBe("completed");
    expect(done.result.attempted).toBe(0);
  });
  it("handles empty exams, invalid modes and invalid answer indices", async () => {
    expect(
      (await request("/sessions", "POST", { mode: "legacy", exam: "ssc-cgl" }))
        .status,
    ).toBe(400);
    expect(
      (await request("/sessions", "POST", { mode: "adaptive", exam: "cat" }))
        .status,
    ).toBe(422);
    const s = await start();
    expect(
      (
        await request(`/sessions/${s.id}/actions`, "POST", {
          type: "answer",
          choice: 99,
          revision: 0,
        })
      ).status,
    ).toBe(400);
  });
  it("finalizes expired sessions before returning dashboard resume state", async () => {
    const s = await start();
    const deadline = new Date(Date.now() - 1000).toISOString();
    await db.collection("trainingSessions").updateOne(
      { id: s.id },
      { $set: { deadline } },
    );
    const dashboard = await (await request("/dashboard?exam=ssc-cgl")).json();
    expect(dashboard.active.find((item) => item.id === s.id)).toBeUndefined();
    const stored = await db.collection("trainingSessions").findOne({ id: s.id });
    expect(stored.status).toBe("completed");
    expect(stored.completionReason).toBe("timeout");
    expect(stored.completedAt).toBe(deadline);
  });

  it("abandons without contributing durable learning state", async () => {
    const s = await start();
    const response = await request(`/sessions/${s.id}/actions`, "POST", {
      type: "abandon",
      revision: 0,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("abandoned");
    expect(await db.collection("trainingQuestionExposure").countDocuments({ userId: "student" })).toBe(0);
    expect(await db.collection("trainingSkillState").countDocuments({ userId: "student" })).toBe(0);
  });

  it("persists corrected taxonomy and populates review evidence", async () => {
    const s = await start();
    const correct = (
      await db.collection("questions").findOne({ id: s.questions[0].id })
    ).correctAnswer;
    await request(`/sessions/${s.id}/actions`, "POST", {
      type: "answer",
      choice: 1 - correct,
      confidence: "sure",
      revision: 0,
    });
    await request(`/sessions/${s.id}/actions`, "POST", {
      type: "finish",
      revision: 1,
    });
    const corrected = await request(`/sessions/${s.id}/mistakes`, "PATCH", {
      questionId: s.questions[0].id,
      mistake: "Misread",
    });
    expect(corrected.status).toBe(200);
    const dashboard = await (await request("/dashboard?exam=ssc-cgl")).json();
    expect(dashboard.reviews[0].mistake).toBe("Misread");
    expect(dashboard.reviews[0].reason).toContain("Wrong + Sure");
    expect(dashboard.readiness).toBeNull();
    expect(await db.collection("trainingQuestionExposure").countDocuments({ userId: "student" })).toBe(1);
    expect(await db.collection("trainingSkillState").countDocuments({ userId: "student", level: "topic" })).toBe(1);
    expect(await db.collection("trainingReviewState").countDocuments({ userId: "student" })).toBe(1);
    expect(await db.collection('trainingLearnerStateMeta').findOne({ _id: 'student:ssc-cgl' })).toMatchObject({
      version: 1,
      status: 'ready',
      completionEpoch: 1,
    });
  });

  it("returns 201 for a new daily mission and 200 for an existing one", async () => {
    const firstResponse = await request("/sessions", "POST", { mode: "mission", exam: "ssc-cgl" });
    expect(firstResponse.status).toBe(201);
    const firstBody = await firstResponse.json();
    expect(firstBody).toHaveProperty("id");

    const secondResponse = await request("/sessions", "POST", { mode: "mission", exam: "ssc-cgl" });
    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.id).toBe(firstBody.id);
  });
});


describe('training performance contracts', () => {
  it('persists recovery content once and restores logical order on reads', async () => {
    const initial = await start('gauntlet');
    const stored = await db.collection('trainingSessions').findOne({ id: initial.id });
    const questions = stored.questions.slice(0, 5).map((q, i) => ({ ...q, topic: i < 3 ? 'Block A' : 'Block B', difficulty: 3 }));
    const reserve = [1, 2].map(i => ({ ...questions[0], id: `recovery-${i}`, difficulty: 1 }));
    const answers = Object.fromEntries(questions.slice(0, 2).map(q => [q.id, { choice: 1 - q.correctIndex, seconds: 5, confidence: 'sure' }]));
    await db.collection('trainingSessions').updateOne({ id: initial.id }, { $set: { questions, reserve, answers, current: 2 } });
    const response = await request(`/sessions/${initial.id}/actions?response=delta`, 'POST', { type: 'answer', choice: 1 - questions[2].correctIndex, revision: 0 });
    expect(response.status).toBe(200);
    const delta = await response.json();
    expect(delta.questionUpdates.map(q => q.id)).toEqual(['recovery-1', 'recovery-2']);
    const physical = await db.collection('trainingSessions').findOne({ id: initial.id });
    expect(physical.questions.slice(-2).map(q => q.id)).toEqual(['recovery-1', 'recovery-2']);
    const logical = await (await request(`/sessions/${initial.id}`)).json();
    expect(logical.questions[logical.current].id).toBe('recovery-1');
    expect(logical.questions.map(q => q.id)).toEqual(delta.questionOrder);
    const finish = await request(`/sessions/${initial.id}/actions?response=delta`, 'POST', { type: 'finish', revision: delta.revision });
    const completed = await finish.json();
    expect(completed.result.rows[3].questionId).toBe('recovery-1');
  });

  it.each(['adaptive', 'challenge', 'sprint', 'pressure', 'section', 'gauntlet', 'nightmare', 'survival', 'mission'])('creates valid indexed sessions in %s', async mode => {
    await backfillTrainingMetadata(db.collection('questions'), { apply: true });
    vi.stubEnv('TRAINING_INDEXED_QUESTIONS', 'true');
    const created = await start(mode);
    expect(created.questions.length).toBeGreaterThan(0);
    for (const q of created.questions) {
      expect(q.text).toMatch(/^Question /);
      expect(q.options).toHaveLength(2);
      expect(q).not.toHaveProperty('_trainingDocumentId');
      expect(q).not.toHaveProperty('correctIndex');
    }
  });

  it('does not overwrite concurrent edits during metadata backfill', async () => {
    const collection = db.collection('questions');
    const bulkWrite = collection.bulkWrite.bind(collection);
    vi.spyOn(collection, 'bulkWrite').mockImplementationOnce(async (ops, options) => {
      await collection.updateOne({ id: 'q1' }, { $set: { correctAnswer: 0 } });
      return bulkWrite(ops, options);
    });
    const stats = await backfillTrainingMetadata(collection, { apply: true });
    expect(stats.conflicts).toBe(1);
    const edited = await collection.findOne({ id: 'q1' });
    expect(edited.correctAnswer).toBe(0);
    expect(edited.trainingMetadataVersion).toBeUndefined();
    expect((await backfillTrainingMetadata(collection, { apply: true })).modified).toBe(1);
  });

  it.each(['adaptive', 'challenge', 'sprint', 'pressure', 'section', 'gauntlet', 'nightmare', 'survival', 'mission'])('merges deltas identically to a saved snapshot for %s', async mode => {
    let session = await start(mode);
    for (let i = 0; i < 3 && session.status === 'active'; i++) {
      const response = await request(`/sessions/${session.id}/actions?response=delta`, 'POST', { type: 'answer', choice: 0, confidence: 'sure', revision: session.revision });
      expect(response.status).toBe(200);
      const delta = await response.json();
      if (delta.kind === 'delta') {
        expect(delta.baseRevision).toBe(session.revision);
        expect(delta).not.toHaveProperty('questions');
        const byId = new Map(session.questions.map(q => [q.id, q]));
        for (const q of delta.questionUpdates || []) byId.set(q.id, q);
        const { kind, baseRevision, questionOrder, questionUpdates, ...state } = delta;
        session = { ...session, ...state, answers: { ...session.answers, ...state.answers }, questions: questionOrder ? questionOrder.map(id => byId.get(id)) : session.questions };
      } else session = delta;
      const saved = await (await request(`/sessions/${session.id}`)).json();
      expect({ ...session, serverNow: 0 }).toEqual({ ...saved, serverNow: 0 });
    }
    const response = await request(`/sessions/${session.id}/actions?response=delta`, 'POST', { type: 'finish', revision: session.revision });
    expect(response.status).toBe(200);
    const finished = await response.json();
    expect(finished.status).toBe('completed');
    expect(finished.questions[0]).toHaveProperty('correctIndex');
    const history = await trainingHistory('student', 'ssc-cgl');
    expect(history[0].learningApplied).toBe(true);
    expect(history[0].questions[0]).not.toHaveProperty('text');
    expect(history[0].questions[0]).not.toHaveProperty('options');
    expect(history[0].result.rows[0]).not.toHaveProperty('solution');
    await request('/dashboard?exam=ssc-cgl');
    expect(await db.collection('userSkillProfile').countDocuments({})).toBe(0);
  });

  it('backfills idempotently and hydrates only selected indexed candidates', async () => {
    const questions = db.collection('questions');
    await questions.updateOne({ id: 'q0' }, { $set: { exam: 'SSC CGL / CHSL', subject: 'Logical-Reasoning' } });
    const dry = await backfillTrainingMetadata(questions);
    expect(dry.modified).toBe(0);
    expect(dry.candidates).toBe(25);
    expect((await backfillTrainingMetadata(questions, { apply: true })).modified).toBe(25);
    expect((await backfillTrainingMetadata(questions, { apply: true })).candidates).toBe(0);
    vi.stubEnv('TRAINING_INDEXED_QUESTIONS', 'true');
    const pool = await trainingQuestionPool({ exam: 'ssc-chsl', subject: 'reasoning' }, [], []);
    expect(pool.map(q => q.id)).toEqual(['q0']);
    expect(pool[0]).not.toHaveProperty('question');
    expect(pool[0]).not.toHaveProperty('options');
    const response = await request('/sessions', 'POST', { mode: 'adaptive', exam: 'ssc-chsl', subject: 'reasoning', count: 10 });
    expect(response.status).toBe(201);
    const session = await response.json();
    expect(session.questions[0].text).toBe('Question 0');
    expect(session.questions[0]).not.toHaveProperty('_trainingDocumentId');
    expect(session.questions[0]).not.toHaveProperty('_trainingFingerprint');
    expect(session.questions[0]).not.toHaveProperty('correctIndex');
    const explain = await questions.find({ trainingExamSlugs: 'ssc-chsl', trainingEligible: true, trainingMetadataVersion: 1 }).sort({ updatedAt: -1, _id: 1 }).limit(10).explain('executionStats');
    expect(explain.executionStats.totalDocsExamined).toBe(1);
    expect(JSON.stringify(explain.queryPlanner.winningPlan)).toContain('training_exam_wide_latest');
  });

  it('limits exposure reads to the candidate IDs', async () => {
    await db.collection('trainingQuestionExposure').insertMany(['q1','q2','unrelated'].map(questionId => ({ userId: 'student', exam: 'ssc-cgl', questionId, timesSeen: 1 })));
    expect((await trainingExposureData('student', 'ssc-cgl', ['q2'])).map(row => row.questionId)).toEqual(['q2']);
  });

  it('uses the dashboard mock index without scanning unrelated attempts', async () => {
    await db.collection('mockAttempts').insertMany(Array.from({ length: 200 }, (_, i) => ({ userId: i < 40 ? 'student' : 'other', examSlug: 'ssc-cgl', status: 'completed', submittedAt: new Date(1700000000000 + i) })));
    const explain = await db.collection('mockAttempts').find({ userId: 'student', examSlug: 'ssc-cgl', status: 'completed' }).sort({ submittedAt: -1 }).limit(20).explain('executionStats');
    expect(explain.executionStats.nReturned).toBe(20);
    expect(explain.executionStats.totalDocsExamined).toBe(20);
    expect(JSON.stringify(explain.queryPlanner.winningPlan)).toContain('training_mock_history');
  });
});
