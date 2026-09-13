import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoDB, disconnectMongoDB } from "../../config/mongodb.js";
import { fetchQuestionsMeta } from "../questions/questionMetadataService.js";
import { createQuestion, createQuestionsBulk, modifyQuestion, removeQuestion } from "../questions/questionWriteService.js";
import { invalidateQuestionMetadata, readQuestionMetadata } from "../questions/questionMetadataCache.js";

let server, db;
const params = { topic: "coding", subject: "reasoning", mode: "concept" };
const question = (id, concept, quizName = "Concept Drill") => ({ id, topic: "coding", subject: "reasoning", concept, quizName });

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", server.getUri());
  vi.stubEnv("MONGODB_DB", "metadata_tests");
  vi.stubEnv("QUESTIONS_NORMALIZED_KEYS", "true");
  db = await connectMongoDB();
}, 120000);
beforeEach(async () => {
  await db.collection("questions").deleteMany({});
  await db.collection("questionMetadata").deleteMany({});
});
afterAll(async () => { await disconnectMongoDB(); await server?.stop(); vi.unstubAllEnvs(); });

describe("persisted question metadata", () => {
  it("reuses metadata without reading questions on subsequent visits", async () => {
    const build = vi.fn(async () => ({ concepts: ["Actual concept"] }));
    await readQuestionMetadata(params, build);
    expect(await readQuestionMetadata(params, build)).toEqual({ concepts: ["Actual concept"] });
    expect(build).toHaveBeenCalledTimes(1);
    expect(await db.collection("questionMetadata").countDocuments()).toBe(1);
  });
  it("tracks upload, bulk upload, edit and delete, isolated by quiz mode", async () => {
    await createQuestion(question("a", "Letter Shift"));
    expect((await fetchQuestionsMeta(params)).concepts).toEqual(["letter shift"]);
    await createQuestionsBulk([question("b", "Number Code"), question("c", "Other Mode", "Formula Bank")]);
    const warmed = await db.collection("questionMetadata").findOne({ "params.topic": "coding", "params.mode": "concept" });
    expect(warmed.data.concepts).toEqual(["letter shift", "number code"]);
    expect((await fetchQuestionsMeta(params)).concepts).toEqual(["letter shift", "number code"]);
    await modifyQuestion("b", { concept: "Symbol Code" });
    expect((await fetchQuestionsMeta(params)).concepts).toEqual(["letter shift", "symbol code"]);
    await removeQuestion("a");
    const meta = await fetchQuestionsMeta(params);
    expect(meta.concepts).toEqual(["symbol code"]);
    expect(meta.total).toBe(1);
  });
  it("does not reuse a build invalidated by a concurrent upload", async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let started;
    const entered = new Promise(resolve => { started = resolve; });
    const old = readQuestionMetadata(params, async () => { started(); await gate; return { concepts: ["old"] }; });
    await entered;
    await invalidateQuestionMetadata();
    release();
    await old;
    const build = vi.fn(async () => ({ concepts: ["new"] }));
    expect(await readQuestionMetadata(params, build)).toEqual({ concepts: ["new"] });
    expect(build).toHaveBeenCalledTimes(1);
  });
  it("rebuilds expired metadata to recover from external imports", async () => {
    await readQuestionMetadata(params, async () => ({ concepts: [] }));
    await db.collection("questionMetadata").updateMany({}, { $set: { updatedAt: new Date(0) } });
    const build = vi.fn(async () => ({ concepts: ["Imported"] }));
    expect(await readQuestionMetadata(params, build)).toEqual({ concepts: ["Imported"] });
    expect(build).toHaveBeenCalledTimes(1);
  });
});
