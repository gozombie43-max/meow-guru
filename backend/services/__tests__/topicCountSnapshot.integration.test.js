import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { Collection } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoDB, disconnectMongoDB } from "../../config/mongodb.js";
import { fetchTopicCountSnapshot } from "../questions/topicCountSnapshot.js";
import { fetchQuestionCounts } from "../questions/questionMetadataService.js";
import { createQuestion, createQuestionsBulk, modifyQuestion, removeQuestion, removeQuestionsBulk } from "../questions/questionWriteService.js";
import { invalidateQuestionCacheRevision } from "../questions/questionCache.js";

let server, db;
const question = (id, quizName, extra = {}) => ({ id, subject: "mathematics", topic: "percentages", quizName, ...extra });
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", server.getUri());
  vi.stubEnv("MONGODB_DB", "topic_total_tests");
  db = await connectMongoDB();
}, 120000);
beforeEach(async () => {
  await db.collection("questions").deleteMany({});
  await db.collection("questionMetadata").deleteMany({});
  invalidateQuestionCacheRevision();
});
afterAll(async () => { await disconnectMongoDB(); await server?.stop(); vi.unstubAllEnvs(); });

describe("saved mathematics topic totals", () => {
  it.each(["true", "false"])("sums the six modes, excludes study mode, and reuses saved data (normalized=%s)", async normalized => {
    vi.stubEnv("QUESTIONS_NORMALIZED_KEYS", normalized);
    await createQuestionsBulk([
      question("a", "PYQ"), question("b", "CareerWill"), question("c", "PW"),
      question("d", "Selection Way"), question("e", "Topic Mix"), question("f", "Tier 2"),
      question("g", "Study Mode", { questionType: "study-mode" }),
    ]);
    const saved = await db.collection("questionMetadata").findOne({ kind: "topic-counts" });
    expect(saved.data.totals.percentages).toBe(6);
    const modes = await fetchQuestionCounts({ subject: "mathematics", topic: "percentages" });
    expect(saved.data.totals.percentages).toBe(modes.concept + modes.formula + modes.mixed + modes.aiChallenge + modes.easy + modes.hard);
    expect(modes.studyMode).toBe(1);
    const aggregate = vi.spyOn(Collection.prototype, "aggregate");
    const first = await fetchTopicCountSnapshot();
    const second = await fetchTopicCountSnapshot();
    expect(second).toEqual(first);
    expect(first.totals.geometry).toBe(0);
    expect(aggregate).not.toHaveBeenCalled();
    aggregate.mockRestore();
  });
  it("updates saved totals on creation, topic moves, single delete and bulk delete", async () => {
    vi.stubEnv("QUESTIONS_NORMALIZED_KEYS", "true");
    const saved = async () => (await db.collection("questionMetadata").findOne({ kind: "topic-counts" })).data.totals;
    await createQuestion(question("a", "PYQ"));
    expect((await saved()).percentages).toBe(1);
    await modifyQuestion("a", { topic: "geometry" });
    expect(await saved()).toMatchObject({ percentages: 0, geometry: 1 });
    await removeQuestion("a");
    expect((await saved()).geometry).toBe(0);
    await createQuestionsBulk([question("b", "PYQ"), question("c", "PW")]);
    await removeQuestionsBulk(["b", "c"]);
    expect((await saved()).percentages).toBe(0);
  });
  it("does not publish an obsolete total during a concurrent upload", async () => {
    vi.stubEnv("QUESTIONS_NORMALIZED_KEYS", "false");
    await db.collection("questions").insertOne(question("old", "PYQ"));
    const original = Collection.prototype.aggregate;
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const aggregate = vi.spyOn(Collection.prototype, "aggregate").mockImplementationOnce(function (...args) {
      const collection = this;
      return { toArray: async () => { entered(); await gate; return original.apply(collection, args).toArray(); } };
    });
    const reading = fetchTopicCountSnapshot();
    await started;
    await createQuestion(question("new", "PYQ"));
    release();
    expect((await reading).totals.percentages).toBe(2);
    expect((await db.collection("questionMetadata").findOne({ kind: "topic-counts" })).data.totals.percentages).toBe(2);
    aggregate.mockRestore();
  });
  it("initializes existing records once and rejects unbounded subject keys", async () => {
    vi.stubEnv("QUESTIONS_NORMALIZED_KEYS", "false");
    await db.collection("questions").insertOne(question("legacy", "PYQ"));
    expect((await fetchTopicCountSnapshot()).totals.percentages).toBe(1);
    await expect(fetchTopicCountSnapshot("arbitrary")).rejects.toMatchObject({ statusCode: 400 });
  });
});
