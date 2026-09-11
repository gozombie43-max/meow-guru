import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import express from "express";
import { once } from "node:events";
import { connectMongoDB, disconnectMongoDB } from "../../config/mongodb.js";
import { createSession } from "../../auth/sessions.js";
import { up } from "../../migrations/005-training.js";
import router from "../training.js";
import curationRouter from "../trainingCuration.js";

let mongo, db, server, base, token;
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
  });
});
