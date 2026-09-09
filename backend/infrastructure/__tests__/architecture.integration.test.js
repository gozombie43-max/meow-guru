import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { migrate, assertMigrations } from '../../migrations/runner.js';
import { backfillQuestionKeys, normalizationUpdate } from '../../services/questions/questionBackfill.js';
import { normalizedQuestionKeys } from '../../services/questions/questionNormalizer.js';
import { claimJob, renewJob, completeJob, failJob } from '../durableQueue.js';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createQuestionsBulk } from '../../services/questions/questionWriteService.js';
import { MongoRateLimitStore } from '../../middleware/mongoRateLimitStore.js';
import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { Server } from 'socket.io';
import { io as connectSocket } from 'socket.io-client';
import { createAdapter } from '@socket.io/mongo-adapter';
import { registerBattleRelay } from '../battleOutbox.js';
import express from 'express';
import { fetchQuestionCursorPage } from '../../services/questions/questionCursorService.js';
import { fetchQuestionCounts } from '../../services/questions/questionMetadataService.js';
import { enqueueTutorJob, getTutorJob, cancelTutorJob } from '../../services/tutorJobs.js';
vi.mock('../objectStorage.js', () => ({ putObject: vi.fn().mockResolvedValue(undefined) }));

let replica, client, db;
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replica.getUri();
  process.env.MONGODB_DB = 'architecture_tests';
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = await connectMongoDB();
  await migrate(db);
}, 180000);
beforeEach(async () => {
  for (const name of ['questions', 'runtimeJobs', 'rateLimits']) await db.collection(name).deleteMany({});
});
afterAll(async () => { await disconnectMongoDB(); await client?.close(); await replica?.stop(); }, 60000);

describe('versioned migrations', () => {
  it('reconciles repeat runs and refuses readiness on an unmigrated database', async () => {
    await migrate(db);
    await expect(assertMigrations(db)).resolves.toBeUndefined();
    await expect(assertMigrations(client.db('empty'))).rejects.toThrow('migrations required');
    expect(await db.collection('schemaMigrations').countDocuments()).toBe(2);
  });
  it('serializes runners and never records a failed migration', async () => {
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const first = migrate(db, [{ id: 'blocking', up: async () => { entered(); await gate; } }]);
    await started;
    await expect(migrate(db, [])).rejects.toThrow('already active');
    release(); await first;
    await expect(migrate(db, [{ id: 'broken', up: async () => { throw new Error('index conflict'); } }])).rejects.toThrow('index conflict');
    expect(await db.collection('schemaMigrations').findOne({ _id: 'broken' })).toBeNull();
    expect(await db.collection('schemaMigrationLocks').countDocuments()).toBe(0);
  });
  it('detects conflicting existing index options even after a version is recorded', async () => {
    const other = client.db('conflicting_indexes');
    await other.collection('questions').createIndex({ ingestionKey: 1 });
    await expect(migrate(other)).rejects.toThrow();
    expect(await other.collection('schemaMigrations').findOne({ _id: '002-runtime' })).toBeNull();
  });
});

describe('normalized ingestion and backfill', () => {
  it('preserves every mode, explicit null and missing fields and is repeatable', async () => {
    const rows = [
      { topic: 'Vocabulary', questionType: 'study-mode', word: 'abate', meanings: ['reduce'], subject: null },
      { topic: 'Words', letter: 'A' },
      ...['SelectionWay', 'Tier2', 'TopicMix', 'PW', 'CareerWill', 'PYQ'].map(quizName => ({ topic: 'Algebra', quizName })),
    ];
    const collection = db.collection('questions');
    await collection.insertMany(rows);
    expect((await backfillQuestionKeys(collection)).candidates).toBe(rows.length);
    const applied = await backfillQuestionKeys(collection, { apply: true });
    expect(applied.modified).toBe(rows.length);
    expect(applied.conflicted).toBe(0);
    for (const row of await collection.find().toArray()) expect(row).toMatchObject(normalizedQuestionKeys(row));
    expect((await backfillQuestionKeys(collection, { apply: true })).candidates).toBe(0);
  });
  it('does not overwrite classification after concurrent edits', async () => {
    const collection = db.collection('questions');
    const row = { _id: 'concurrent', topic: 'Vocabulary', subject: null, word: 'abate', meanings: ['reduce'] };
    await collection.insertOne(row);
    const op = normalizationUpdate(row);
    await collection.updateOne({ _id: row._id }, { $unset: { subject: '' }, $set: { word: 'new' } });
    expect((await collection.bulkWrite([op])).matchedCount).toBe(0);
  });
  it('imports 10000 rows in bounded batches and retries without duplication', async () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({ topic: 'Algebra', question: `Question ${i}` }));
    const start = performance.now();
    const first = await createQuestionsBulk(rows, { importId: 'repeatable-import' });
    const second = await createQuestionsBulk(rows, { importId: 'repeatable-import' });
    expect(first.every(row => row.status === 'fulfilled')).toBe(true);
    expect(second.every(row => row.status === 'fulfilled')).toBe(true);
    expect(await db.collection('questions').countDocuments()).toBe(10000);
    expect(second[0].value.id).toBe(first[0].value.id);
    const conflicting = await createQuestionsBulk([{ topic: 'Changed' }], { importId: 'repeatable-import' });
    expect(conflicting[0].status).toBe('rejected');
    console.info('10000-row import plus idempotent retry ms', Math.round(performance.now() - start));
  }, 60000);
  it('paginates normalized canonical reads with stable cursors and indexed mode counts', async () => {
    const previous = process.env.QUESTIONS_NORMALIZED_KEYS;
    process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
    try {
      await createQuestionsBulk(Array.from({ length: 123 }, (_, i) => ({ topic: 'Algebra', subject: 'Mathematics', question: `Q${i}` })), { importId: 'cursor-fixture' });
      const first = await fetchQuestionCursorPage({ topic: 'algebra', limit: 50 });
      const second = await fetchQuestionCursorPage({ topic: 'algebra', limit: 50, cursor: first.nextCursor });
      const third = await fetchQuestionCursorPage({ topic: 'algebra', limit: 50, cursor: second.nextCursor });
      expect(new Set([...first.questions, ...second.questions, ...third.questions].map(row => row.id)).size).toBe(123);
      expect(third.hasMore).toBe(false);
      expect(first.total).toBe(123);
      expect((await fetchQuestionCounts({ topic: 'algebra' })).concept).toBe(123);
      await expect(fetchQuestionCursorPage({ cursor: 'bad' })).rejects.toThrow('Invalid question cursor');
      const plan = await db.collection('questions').find({ topicKey: 'algebra', modeKey: 'concept' }).sort({ _id: 1 }).limit(51).explain('executionStats');
      expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(51);
    } finally {
      if (previous === undefined) delete process.env.QUESTIONS_NORMALIZED_KEYS;
      else process.env.QUESTIONS_NORMALIZED_KEYS = previous;
    }
  });
});

describe('durable job leases', () => {
  const now = new Date();
  async function enqueue() {
    await db.collection('runtimeJobs').insertOne({ _id: 'job', kind: 'tutor', status: 'queued', availableAt: now, attempts: 0, expiresAt: new Date(+now + 86400000) });
  }
  it('allows one claimant, recovers expired work, and fences out the previous owner', async () => {
    await enqueue();
    const collection = db.collection('runtimeJobs');
    const claims = await Promise.all([claimJob(collection, 'tutor', now), claimJob(collection, 'tutor', now)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean);
    const later = new Date(+now + 61000);
    const replacement = await claimJob(collection, 'tutor', later);
    expect(replacement.owner).not.toBe(old.owner);
    expect(await completeJob(collection, old, { reply: 'stale' }, later)).toBe(false);
    expect(await renewJob(collection, replacement, later)).toBe(true);
    expect(await completeJob(collection, replacement, { reply: 'done' }, later)).toBe(true);
    expect(await claimJob(collection, 'tutor', later)).toBeNull();
  });
  it('honors cancellation and bounds retries', async () => {
    await enqueue();
    const collection = db.collection('runtimeJobs');
    const job = await claimJob(collection, 'tutor', now);
    await collection.updateOne({ _id: 'job' }, { $set: { status: 'cancelled' } });
    expect(await renewJob(collection, job, now)).toBe(false);
    expect(await completeJob(collection, job, {}, now)).toBe(false);
    await collection.updateOne({ _id: 'job' }, { $set: { status: 'running', owner: job.owner, attempts: 3 } });
    await failJob(collection, { ...job, attempts: 3 }, now);
    expect((await collection.findOne({ _id: 'job' })).status).toBe('failed');
  });
  it('isolates attachment jobs by owner and preserves submission idempotency', async () => {
    const input = { context: 'Maths', message: 'Solve', history: [] };
    const file = { originalname: 'q.png', mimetype: 'image/png', buffer: Buffer.from('fixture') };
    const job = await enqueueTutorJob('a', input, file, 'same-request');
    expect((await enqueueTutorJob('a', input, file, 'same-request'))._id).toBe(job._id);
    await expect(enqueueTutorJob('a', { ...input, message: 'Different' }, file, 'same-request')).rejects.toThrow('different input');
    expect(await getTutorJob('b', job._id)).toBeNull();
    expect(await cancelTutorJob('b', job._id)).toBe(false);
    expect(await cancelTutorJob('a', job._id)).toBe(true);
    expect((await getTutorJob('a', job._id)).status).toBe('cancelled');
  });
});

it('shares atomic rate-limit counts across store instances and resets expired windows', async () => {
  const first = new MongoRateLimitStore('test'), second = new MongoRateLimitStore('test');
  first.init({ windowMs: 60000 }); second.init({ windowMs: 60000 });
  const hits = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? first : second).increment('same-user')));
  expect(hits.map(hit => hit.totalHits).sort((a,b) => a-b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  await db.collection('rateLimits').updateMany({}, { $set: { resetTime: new Date(0) } });
  expect((await first.increment('same-user')).totalHits).toBe(1);
});

it('recovers persisted battle events and sends notifications from a separate worker to two API instances', async () => {
  const servers = [createServer(), createServer()];
  const apis = servers.map(server => {
    const io = new Server(server);
    io.adapter(createAdapter(db.collection('socketIoAdapterEvents'), { addCreatedAtField: true }));
    registerBattleRelay(io);
    io.on('connection', socket => socket.join(`user:${socket.handshake.auth.userId}`));
    return io;
  });
  const clients = [];
  let worker;
  const event = (emitter, name) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name} timed out`)), 8000);
    emitter.once(name, value => { clearTimeout(timer); resolve(value); });
  });
  try {
    for (let i = 0; i < servers.length; i++) {
      await new Promise(resolve => servers[i].listen(0, '127.0.0.1', resolve));
      const socket = connectSocket(`http://127.0.0.1:${servers[i].address().port}`, { transports: ['websocket'], auth: { userId: i ? 'b' : 'a' } });
      clients.push(socket);
      await event(socket, 'connect');
    }
    // Simulate a crash after a state transition but before publishing.
    await db.collection('battleRooms').insertOne({ code: 'outbox-test', status: 'active', realtimeVersion: 'revision-1', players: [{ userId: 'a' }, { userId: 'b' }] });
    const received = clients.map(socket => event(socket, 'battle:syncRequired'));
    worker = fork(new URL('./fixtures/realtime-worker.js', import.meta.url), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, execArgv: [], env: { ...process.env, MONGODB_URI: replica.getUri(), MONGODB_DB: 'architecture_tests' } });
    expect(await event(worker, 'message')).toBe('ready');
    const relayed = event(worker, 'message');
    worker.send('relay');
    expect(await relayed).toBe('relayed');
    expect(await Promise.all(received)).toEqual([{ code: 'outbox-test' }, { code: 'outbox-test' }]);
    expect((await db.collection('battleRooms').findOne({ code: 'outbox-test' })).realtimeVersion).toBeUndefined();
    const notification = event(clients[0], 'notification:new');
    worker.send('notify');
    expect(await notification).toEqual({ title: 'worker notification' });
  } finally {
    if (worker && worker.exitCode === null) { const exited = once(worker, 'exit'); worker.send('stop'); const force = setTimeout(() => worker.kill(), 5000); await exited; clearTimeout(force); }
    clients.forEach(socket => socket.close());
    await Promise.all(apis.map(io => new Promise(resolve => io.close(resolve))));
    await db.collection('battleRooms').deleteMany({ code: 'outbox-test' });
  }
}, 30000);

it('keeps canonical question reads within the local load regression budget', async () => {
  await createQuestionsBulk(Array.from({ length: 250 }, (_, i) => ({ topic: 'Algebra', question: `Load fixture ${i}` })));
  const app = express();
  app.get('/questions', async (_req, res) => res.json(await fetchQuestionCursorPage({ topic: 'Algebra', limit: 50 })));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let child;
  try {
    child = fork(new URL('../../scripts/load-api.js', import.meta.url), [], { windowsHide: true, execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, LOAD_BASE_URL: `http://127.0.0.1:${server.address().port}`, LOAD_PATH: '/questions', LOAD_REQUESTS: '100', LOAD_CONCURRENCY: '8', LOAD_P95_MS: '2000' } });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'exit');
    expect(code, output).toBe(0);
    const report = JSON.parse(output.trim());
    expect(report.requests).toBe(100);
    expect(report.errors).toBe(0);
  } finally { child?.kill(); await new Promise(resolve => server.close(resolve)); }
}, 30000);
