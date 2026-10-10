import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoDB, disconnectMongoDB } from "../../config/mongodb.js";
import { fetchQuestionsMeta } from "../questions/questionMetadataService.js";
import { createQuestion, createQuestionsBulk, modifyQuestion, removeQuestion } from "../questions/questionWriteService.js";
import { invalidateQuestionMetadata, readQuestionMetadata } from "../questions/questionMetadataCache.js";
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { processConceptGroupingJob } from '../conceptGroupingWorker.js';
import { fetchConceptGroupingStatus } from '../questions/conceptGroupService.js';
import { supersedeQueuedConceptGroupings } from '../../repositories/conceptGroupRepository.js';
import { fetchQuestionsSession } from '../questions/questionSessionService.js';
import express from 'express';
import questionRoutes from '../../routes/questionRoutes.js';
import { getReleaseId } from '../../infrastructure/releaseInfo.js';

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
  clearSharedLocalCaches();
  await db.collection("questions").deleteMany({});
  await db.collection("questionMetadata").deleteMany({});
  await db.collection('conceptGroupMetadata').deleteMany({});
});
afterAll(async () => { await disconnectMongoDB(); await server?.stop(); vi.unstubAllEnvs(); });

describe("persisted question metadata", () => {
  it.each(['true', 'false'])('loads and counts an entire concept group with normalized keys %s', async normalized => {
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', normalized);
    const concepts = Array.from({ length: 18 }, (_, i) => `alligation for division of principal ${i}`);
    await createQuestionsBulk(concepts.map((concept, i) => question(`group-${i}`, concept)));
    await createQuestion(question('other', 'unselected concept'));
    const meta = await fetchQuestionsMeta(params);
    const selection = meta.concepts.filter(concept => concept !== 'unselected concept').join(',');
    expect(selection.length).toBeGreaterThan(200);
    const first = await fetchQuestionsSession({ ...params, concept: selection, includeTotal: true, limit: 5 });
    expect(first.totalCount).toBe(18);
    expect(first.questions).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    const next = await fetchQuestionsSession({ ...params, concept: selection, cursor: first.nextCursor, includeTotal: true, limit: 5 });
    expect(next.totalCount).toBe(18);
    expect(next.questions).toHaveLength(5);
    expect(next.questions.map(q => q.id).some(id => first.questions.some(q => q.id === id))).toBe(false);
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
  });

  it('supports read-only POST with large selections and labels containing commas', async () => {
    const concepts = Array.from({ length: 100 }, (_, i) => `principal, rate and time for investment ${i}`);
    await createQuestionsBulk(concepts.map((concept, i) => question(`large-${i}`, concept)));
    await createQuestion(question('partial-label', 'principal'));
    const app = express();
    app.use(express.json());
    app.use('/api/questions', questionRoutes);
    const listener = app.listen(0, '127.0.0.1');
    await new Promise(resolve => listener.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/questions/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, concept: concepts, includeTotal: true, limit: 10 }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const session = await response.json();
      expect(session.totalCount).toBe(100);
      expect(session.questions).toHaveLength(10);
      expect(session.questions.every(q => concepts.includes(q.concept))).toBe(true);
    } finally { await new Promise(resolve => listener.close(resolve)); }
  });
  it('does not supersede other modes, raw topic aliases, newer uploads, or owned work', async () => {
    const scope = { subject: 'reasoning', topic: 'coding', mode: 'concept' };
    const startedAt = new Date(2000);
    const base = { scope, params, version: 1, status: 'queued', createdAt: new Date(1000) };
    await db.collection('conceptGroupMetadata').insertMany([
      { ...base, _id: 'old' }, { ...base, _id: 'current' },
      { ...base, _id: 'new', createdAt: new Date(3000) },
      { ...base, _id: 'owned', status: 'running' },
      { ...base, _id: 'alias', params: { ...params, topic: 'Coding' } },
      { ...base, _id: 'formula', scope: { ...scope, mode: 'formula' } },
    ]);
    await supersedeQueuedConceptGroupings({ ...base, startedAt }, 'current');
    expect((await db.collection('conceptGroupMetadata').find({ status: 'superseded' }).toArray()).map(row => row._id)).toEqual(['old']);
  });
  it('skips partial upload snapshots and generates only current concepts, then regenerates after edits', async () => {
    await createQuestion(question('a', 'Letter Shift'));
    const old = await fetchQuestionsMeta(params);
    await createQuestion(question('b', 'Number Code'));
    const middle = await fetchQuestionsMeta(params);
    await createQuestion(question('c', 'Symbol Code'));
    const current = await fetchQuestionsMeta(params);
    const generate = vi.fn(async (_scope, concepts) => ({ model: 'test', output: { groups: [
      { label: 'Code Transformations', description: 'Decode transformations.', conceptIds: concepts.map((_, id) => id) },
    ] } }));
    expect((await processConceptGroupingJob(generate)).status).toBe('superseded');
    expect(generate).not.toHaveBeenCalled();
    expect(await fetchConceptGroupingStatus(old.groupingFingerprint)).toMatchObject({ metadataChanged: true });
    expect(await fetchConceptGroupingStatus(middle.groupingFingerprint)).toMatchObject({ metadataChanged: true });
    expect((await processConceptGroupingJob(generate)).status).toBe('completed');
    expect((await db.collection('conceptGroupMetadata').findOne({ _id: current.groupingFingerprint })).result.releaseId).toBe(getReleaseId());
    const ready = await fetchConceptGroupingStatus(current.groupingFingerprint);
    expect(ready.groupingStatus).toBe('ready');
    expect(ready.conceptGroups.flatMap(group => group.concepts)).toEqual(current.concepts);
    await removeQuestion('c');
    expect((await fetchQuestionsMeta(params)).groupingFingerprint).toBe(middle.groupingFingerprint);
    expect((await processConceptGroupingJob(generate)).status).toBe('completed');
    expect((await fetchConceptGroupingStatus(middle.groupingFingerprint)).groupingStatus).toBe('ready');
  });
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
    clearSharedLocalCaches();
    const build = vi.fn(async () => ({ concepts: ["Imported"] }));
    expect(await readQuestionMetadata(params, build)).toEqual({ concepts: ["Imported"] });
    expect(build).toHaveBeenCalledTimes(1);
  });
});
