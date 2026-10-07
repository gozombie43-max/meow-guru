import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Queue } from 'bullmq';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession } from '../../auth/sessions.js';
import { migrate } from '../../migrations/runner.js';
import { queueConnection, startMaintenanceQueue, enqueueMaintenance, maintenanceQueueHealth } from '../maintenanceQueue.js';
import { disposableRedis, freePort, ownedProcess, stopOwned, until, probeRedis } from './fixtures/redisFaultRuntime.js';

// This suite NEVER kills REDIS_URL/REDIS_TEST_URL or a provider process. Its
// fault target must be a locally spawned executable in an owned temp directory.
describe.skipIf(!process.env.REDIS_FAULT_TEST_BIN)('operational Redis faults on disposable services', () => {
  let mongo, db, cache, queueRedis, token, logoutToken, adminToken, first, second;
  const children = [], queues = [], probes = [];
  const namespace = `meow:staging:fault-${randomUUID()}`;
  const backend = fileURLToPath(new URL('../../', import.meta.url));
  let environment;
  const uid = index => `q_${index.toString(16).padStart(32, '0')}`;
  async function api(overrides = {}, expectReady = true) {
    const port = await freePort();
    const child = ownedProcess(process.execPath, ['index.js'], { cwd: backend, env: { ...environment, PORT: String(port), ...overrides } });
    children.push(child);
    const base = `http://127.0.0.1:${port}`;
    if (expectReady) await until(async () => {
      if (child.exitCode !== null || child.failure) throw Object.assign(new Error(`API fixture failed: ${child.diagnostic()}`), { fatal: true });
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    }, 40000);
    return { child, base };
  }
  async function request(instance, path, { auth = token, method = 'GET', body, idempotency } = {}) {
    const response = await fetch(`${instance.base}${path}`, {
      method, signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${auth}`, Origin: 'http://127.0.0.1', 'Content-Type': 'application/json', ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  const progress = instance => request(instance, '/api/progress/topics?subject=mathematics');
  beforeAll(async () => {
    vi.stubEnv('REDIS_URL', '');
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'redis_fault_test');
    db = await connectMongoDB(); await migrate(db);
    await db.collection('users').insertMany([{ id: 'learner', role: 'student' }, { id: 'logout-user', role: 'student' }, { id: 'admin-user', role: 'admin' }]);
    token = (await createSession({ id: 'learner' })).token;
    logoutToken = (await createSession({ id: 'logout-user' })).token;
    adminToken = (await createSession({ id: 'admin-user' })).token;
    await db.collection('questions').insertMany(Array.from({ length: 451 }, (_, index) => ({ id: `q${index}`, questionUid: uid(index), subject: 'mathematics', topic: 'percentages', exam: 'ssc-cgl', quizName: 'PYQ', question: `Question ${index}`, options: ['A', 'B'], correctAnswer: 0 })));
    cache = await disposableRedis(); queueRedis = await disposableRedis('noeviction');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    environment = {
      ...process.env, DOTENV_CONFIG_PATH: join(tmpdir(), `missing-fault-env-${randomUUID()}`),
      NODE_ENV: 'production', DEPLOYMENT_ENVIRONMENT: 'staging', PROCESS_ROLE: 'api', QUIZ_ONLY_MODE: 'true',
      MONGODB_URI: mongo.getUri(), MONGODB_DB: 'redis_fault_test', REDIS_URL: cache.url, REDIS_NAMESPACE: namespace,
      QUEUE_REDIS_URL: '', QUEUE_REDIS_NAMESPACE: `${namespace}:queue`, QUEUE_REDIS_ALLOW_SHARED: 'false', USE_DURABLE_QUEUE: 'false', RUN_EMBEDDED_WORKERS: 'false',
      BATTLE_REDIS_ADAPTER: 'false', BATTLE_REDIS_CRITICAL: 'false', EMBEDDED_WORKERS_CRITICAL: 'false',
      FRONTEND_URL: 'http://127.0.0.1', LOG_LEVEL: 'warn',
      GOOGLE_CLIENT_ID: 'isolated-fixture-client', GOOGLE_CLIENT_SECRET: 'isolated-fixture-secret', GOOGLE_CALLBACK_URL: 'http://127.0.0.1/auth/google/callback',
      FIREBASE_PROJECT_ID: 'isolated-fault-fixture', FIREBASE_CLIENT_EMAIL: 'fixture@isolated-fault-fixture.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: privateKey,
    };
    [first, second] = await Promise.all([api(), api()]);
  }, 120000);
  afterAll(async () => {
    await Promise.all(children.map(stopOwned));
    probes.forEach(client => { if (client.isOpen) client.destroy(); });
    await Promise.all(queues.map(queue => queue.close()));
    await Promise.all([cache?.stop(), queueRedis?.stop()]);
    await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs();
  }, 60000);

  it('keeps quiz writes correct across two APIs, lost invalidations and a restored stale Redis snapshot', async () => {
    expect((await progress(first)).status).toBe(200);
    expect((await progress(second)).body.userProgress).toEqual({});
    expect((await request(first, '/api/training/dashboard?exam=ssc-cgl')).status).toBe(200);
    expect((await request(second, '/api/training/dashboard?exam=ssc-cgl')).status).toBe(200);
    expect((await request(second, '/api/training/capabilities', { auth: logoutToken })).status).toBe(200);
    expect((await request(second, '/api/training/capabilities', { auth: adminToken })).status).toBe(200);
    const snapshot = await probeRedis(cache.url);
    const staleKeys = await snapshot.keys(`${namespace}:v1:tiered:v2:topic-progress:v2:*`);
    expect(staleKeys.length).toBeGreaterThan(0);
    // Keep the old generation alive throughout recovery, so TTL expiry cannot
    // accidentally make this pass. Only durable version reconciliation may win.
    for (const key of staleKeys) {
      const entry = JSON.parse(await snapshot.get(key));
      await snapshot.set(key, JSON.stringify({ ...entry, freshUntil: Date.now() + 120000, staleUntil: Date.now() + 120000 }), { EX: 120 });
    }
    await snapshot.sendCommand(['SAVE']); snapshot.destroy();
    await cache.stop();
    const submission = randomUUID();
    const answer = { method: 'POST', body: { answer: 0, questionUid: uid(0), topic: 'percentages', submissionId: submission }, idempotency: submission };
    expect(await request(first, '/api/questions/q0/answer', answer)).toMatchObject({ status: 200, body: { isFirstTime: true } });
    expect((await progress(second)).body.userProgress.percentages.userSolved).toBe(1);
    expect((await request(second, '/api/training/dashboard?exam=ssc-cgl')).status).toBe(200);
    // Another process retries the same HTTP mutation while Redis is absent.
    expect((await request(second, '/api/questions/q0/answer', answer)).status).toBe(200);
    expect(await db.collection('userQuestionProgress').countDocuments({ userId: 'learner' })).toBe(1);
    expect((await request(first, '/auth/logout', { auth: logoutToken, method: 'POST' })).status).toBe(200);
    expect((await request(second, '/api/training/capabilities', { auth: logoutToken })).status).toBe(401);
    await db.collection('users').updateOne({ id: 'admin-user' }, { $set: { role: 'student' }, $inc: { authRevision: 1 } });
    for (const instance of [first, second]) expect((await request(instance, '/api/questions/q0', { auth: adminToken, method: 'PUT', body: { question: 'Unauthorized' } })).status).toBe(403);
    const resumed = await request(second, '/api/questions/session?topic=percentages&resumeIndex=240&limit=100');
    expect(resumed.status).toBe(200); expect(resumed.body.startIndex).toBe(200);
    expect(resumed.body.questions).toHaveLength(100); expect(resumed.body.questions[40]).toMatchObject({ id: 'q240', questionUid: uid(240), sessionAnchor: expect.any(String) });
    await cache.start();
    const restored = await probeRedis(cache.url); probes.push(restored);
    expect(JSON.parse(await restored.get(staleKeys[0])).value).toEqual([]);
    expect(await restored.pTTL(staleKeys[0])).toBeGreaterThan(0);
    const cold = await api();
    expect((await progress(cold)).body.userProgress.percentages.userSolved).toBe(1);
    await until(async () => {
      const result = await progress(second);
      expect(result.body.userProgress.percentages.userSolved).toBe(1);
      const health = await request(second, '/health');
      return health.body.dependencies.redis === 'healthy';
    }, 25000);
    for (const instance of [first, second]) {
      expect((await progress(instance)).body.userProgress.percentages.userSolved).toBe(1);
      expect((await request(instance, '/api/training/capabilities', { auth: logoutToken })).status).toBe(401);
    }
    expect(await db.collection('runtimeCacheRevisions').countDocuments({ expiresAt: { $exists: true } })).toBe(0);
    expect(await db.collection('runtimeCacheRevisions').countDocuments({ counter: { $gte: 1 } })).toBeGreaterThan(0);
    const probe = await probeRedis(cache.url); probes.push(probe);
    const clients = await probe.sendCommand(['CLIENT', 'LIST', 'TYPE', 'PUBSUB']);
    const subscriber = clients.split('\n').find(line => line.includes(`name=${namespace}:v1:cache-invalidation-subscriber `));
    expect(subscriber).toBeTruthy();
    const initialIds = new Set(clients.split('\n').filter(line => line.includes(`name=${namespace}:v1:cache-invalidation-subscriber `)).map(line => line.match(/(?:^| )id=(\d+)/)[1]));
    await probe.sendCommand(['CLIENT', 'KILL', 'ID', subscriber.match(/(?:^| )id=(\d+)/)[1]]);
    await until(async () => (await probe.sendCommand(['CLIENT', 'LIST', 'TYPE', 'PUBSUB'])).split('\n').some(line => line.includes(`name=${namespace}:v1:cache-invalidation-subscriber `) && !initialIds.has(line.match(/(?:^| )id=(\d+)/)[1])));
    // Eviction or a completely empty cache cannot roll Mongo progress backwards.
    await probe.flushDb();
    expect((await progress(second)).body.userProgress.percentages.userSolved).toBe(1);
  }, 90000);

  it('starts a healthy Mongo quiz API when Battle and embedded durable Redis are offline, unless explicitly critical', async () => {
    const offlineCache = `redis://127.0.0.1:${await freePort()}`, offlineQueue = `redis://127.0.0.1:${await freePort()}`;
    const overrides = { QUIZ_ONLY_MODE: 'false', REDIS_URL: offlineCache, QUEUE_REDIS_URL: offlineQueue, USE_DURABLE_QUEUE: 'true', RUN_EMBEDDED_WORKERS: 'true', BATTLE_REDIS_ADAPTER: 'true' };
    const instance = await api(overrides);
    await until(async () => {
      const health = await request(instance, '/health');
      return health.status === 200 && health.body.dependencies.optionalServices.battle === 'unavailable' && health.body.dependencies.optionalServices.workers === 'unavailable';
    }, 25000);
    expect((await request(instance, '/api/questions/session?topic=percentages&limit=10')).status).toBe(200);
    expect((await request(instance, '/api/battle')).status).toBe(503);
    const critical = await api({ ...overrides, BATTLE_REDIS_CRITICAL: 'true' }, false);
    await until(() => critical.child.exitCode !== null, 30000);
    expect(critical.child.exitCode).toBe(1);
    const criticalWorkers = await api({ ...overrides, EMBEDDED_WORKERS_CRITICAL: 'true' }, false);
    await until(() => criticalWorkers.child.exitCode !== null, 30000);
    expect(criticalWorkers.child.exitCode).toBe(1);
    await stopOwned(instance.child);
  }, 80000);

  it('isolates runtime Battle degradation, respects explicit critical readiness and reconnects', async () => {
    const options = { QUIZ_ONLY_MODE: 'false', BATTLE_REDIS_ADAPTER: 'true' };
    const optional = await api(options);
    const critical = await api({ ...options, BATTLE_REDIS_CRITICAL: 'true' });
    await until(async () => (await request(optional, '/health')).body.dependencies.battle === 'healthy');
    await cache.stop();
    await until(async () => (await request(optional, '/health')).body.dependencies.battle === 'degraded');
    expect((await request(optional, '/health')).status).toBe(200);
    expect(await request(critical, '/health')).toMatchObject({ status: 503, body: { dependencies: { mongo: 'healthy', battle: 'degraded' } } });
    expect((await request(optional, '/api/questions/session?topic=percentages&limit=10')).status).toBe(200);
    expect((await request(optional, '/api/battle')).status).toBe(503);
    await cache.start();
    await until(async () => {
      const health = await request(critical, '/health');
      return health.status === 200 && health.body.dependencies.battle === 'healthy';
    });
    await Promise.all([stopOwned(optional.child), stopOwned(critical.child)]);
  }, 60000);

  it('recovers a killed BullMQ worker after its Mongo effect committed without applying the effect twice', async () => {
    const prefix = `crash-test-${randomUUID()}`;
    const queue = new Queue('maintenance', { connection: queueConnection(queueRedis.url), prefix }); queues.push(queue); queue.on('error', () => {});
    await queue.waitUntilReady();
    function worker(hold) {
      const child = ownedProcess(process.execPath, [fileURLToPath(new URL('./fixtures/maintenanceCrashWorker.js', import.meta.url))], {
        cwd: backend, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...environment, FAULT_MONGO_URI: mongo.getUri(), FAULT_QUEUE_URL: queueRedis.url, FAULT_QUEUE_PREFIX: prefix, FAULT_HOLD: String(hold) },
      });
      child.ready = false; child.committed = false;
      child.on('message', message => { if (message.type === 'ready') child.ready = true; if (message.type === 'committed') child.committed = true; });
      children.push(child); return child;
    }
    const original = worker(true); await until(() => original.ready);
    const job = await queue.add('probe', {}, { jobId: randomUUID(), attempts: 3 });
    await until(() => original.committed); await stopOwned(original);
    const replacement = worker(false); await until(() => replacement.ready);
    await until(async () => (await job.getState()) === 'completed');
    const mongoClient = (await import('mongodb')).MongoClient;
    const client = new mongoClient(mongo.getUri()); await client.connect();
    try {
      const fixture = client.db('worker_crash');
      expect(await fixture.collection('effects').findOne({ _id: job.id })).toEqual({ _id: job.id, effect: 1 });
      expect(await fixture.collection('effects').countDocuments({ _id: job.id })).toBe(1);
      expect(await fixture.collection('attempts').countDocuments({ jobId: job.id })).toBeGreaterThanOrEqual(2);
    } finally { await client.close(); await stopOwned(replacement); }
  }, 60000);

  it('fails queue admission promptly offline and revalidates durability and queue metadata after reconnect', async () => {
    vi.stubEnv('QUEUE_REDIS_URL', queueRedis.url); vi.stubEnv('USE_DURABLE_QUEUE', 'true');
    vi.stubEnv('QUEUE_REDIS_NAMESPACE', `${namespace}:reconnect`);
    let runtime, offline = false;
    try {
      runtime = await startMaintenanceQueue([{ name: 'probe', run: async () => 'ok' }, { name: 'scheduled', intervalMs: 60000, run: async () => 'scheduled' }]);
      // Snapshot from before queue creation: reconnect must restore its metadata.
      await queueRedis.stop(); offline = true;
      await until(() => !runtime.isDurable());
      expect(maintenanceQueueHealth()).toBe('degraded');
      const started = Date.now();
      await expect(enqueueMaintenance('probe', 'offline')).rejects.toMatchObject({ statusCode: 503 });
      expect(Date.now() - started).toBeLessThan(2500);
      await queueRedis.start(); offline = false;
      await until(() => runtime.isDurable() && runtime.producer.status === 'ready');
      expect(await runtime.queue.getGlobalConcurrency()).toBe(2);
      expect((await runtime.queue.getJobSchedulers()).map(scheduler => scheduler.key)).toContain('scheduled');
      const job = await enqueueMaintenance('probe', 'reconnected');
      await until(async () => (await job.getState()) === 'completed');
    } finally {
      if (offline) await queueRedis.start();
      await runtime?.queue.obliterate({ force: true }); await runtime?.close();
      vi.stubEnv('USE_DURABLE_QUEUE', 'false');
    }
  }, 60000);
});
