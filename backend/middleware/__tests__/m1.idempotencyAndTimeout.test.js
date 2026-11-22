import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { idempotency } from '../idempotency.js';
import { requestTimeout, resolveRequestTimeoutMs } from '../requestTimeout.js';
import { getHttpTimeoutConfig, listenServer } from '../../infrastructure/httpListen.js';
import { checkReadiness, resetReadinessCache } from '../../infrastructure/readiness.js';
import { migrations } from '../../migrations/runner.js';

describe('M1 Idempotency Disconnect Safety, HTTP Request Timeouts & Cached Readiness', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'm1_idempotency_timeout_tests');
    db = await connectMongoDB();
    await db.collection('schemaMigrations').insertMany(
      migrations.map((m) => ({ _id: m.id, completedAt: new Date() })),
    );
  }, 60_000);

  beforeEach(async () => {
    resetReadinessCache();
    await db.collection('idempotencyRecords').deleteMany({});
  });

  afterAll(async () => {
    await disconnectMongoDB();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  it('retains pending idempotency lock when client disconnects mid-write and releases lock on 400 validation errors', async () => {
    let releaseHandler;
    let enteredHandler;
    const handlerEntered = new Promise((r) => {
      enteredHandler = r;
    });
    const handlerGate = new Promise((r) => {
      releaseHandler = r;
    });
    let executions = 0;

    const app = express();
    app.use(express.json());
    app.use(rateLimit({ windowMs: 60_000, max: 1000 }));
    app.use((req, _res, next) => {
      req.user = { id: 'user-idem-1' };
      next();
    });
    app.post('/mutate', idempotency('test.disconnect'), async (req, res) => {
      if (req.body?.invalid) {
        return res.status(400).json({ error: 'Invalid input' });
      }
      executions++;
      enteredHandler();
      await handlerGate;
      return res.status(201).json({ executions });
    });

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      // 1. 400 response must delete pending record so the same key can be retried with valid input
      const badRes = await fetch(`${baseUrl}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-400-release-01' },
        body: JSON.stringify({ invalid: true }),
      });
      expect(badRes.status).toBe(400);
      expect(await db.collection('idempotencyRecords').countDocuments({})).toBe(0);

      // 2. Client aborts mid-flight while mutation is running
      const abortController = new AbortController();
      const firstPromise = fetch(`${baseUrl}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-disconnect-001' },
        body: JSON.stringify({ ok: true }),
        signal: abortController.signal,
      }).catch(() => null);

      await handlerEntered;
      abortController.abort();
      await firstPromise;
      // Wait briefly for server to observe socket close
      await new Promise((r) => setTimeout(r, 40));

      // Pending record MUST still exist while the in-flight mutation has not finished!
      const pendingDoc = await db.collection('idempotencyRecords').findOne({ status: 'pending' });
      expect(pendingDoc).toBeTruthy();

      // Concurrent retry with same key while first mutation is still in-flight must get 409 IDEMPOTENCY_PENDING
      const retryWhileInFlight = await fetch(`${baseUrl}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-disconnect-001' },
        body: JSON.stringify({ ok: true }),
      });
      expect(retryWhileInFlight.status).toBe(409);
      expect(executions).toBe(1);

      // Finish the in-flight mutation -> record transitions to completed and subsequent retry replays 201
      releaseHandler();
      await vi.waitFor(async () => {
        const doc = await db.collection('idempotencyRecords').findOne({ status: 'completed' });
        expect(doc).toBeTruthy();
      });

      const replayAfterCommit = await fetch(`${baseUrl}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-disconnect-001' },
        body: JSON.stringify({ ok: true }),
      });
      expect(replayAfterCommit.status).toBe(201);
      expect(replayAfterCommit.headers.get('idempotency-replayed')).toBe('true');
      expect(executions).toBe(1);
    } finally {
      releaseHandler?.();
      await new Promise((r) => server.close(r));
    }
  });

  it('attaches AbortSignal, returns 504 on route timeout, and configures server.requestTimeout in httpListen', async () => {
    const cfg = getHttpTimeoutConfig({
      HTTP_KEEP_ALIVE_TIMEOUT_MS: '65000',
      HTTP_HEADERS_TIMEOUT_MS: '66000',
      HTTP_REQUEST_TIMEOUT_MS: '45000',
    });
    expect(cfg).toEqual({
      keepAliveTimeout: 65000,
      headersTimeout: 66000,
      requestTimeout: 45000,
    });

    expect(resolveRequestTimeoutMs({ originalUrl: '/api/questions' })).toBe(30_000);
    expect(resolveRequestTimeoutMs({ originalUrl: '/api/ai/tutor-chat' })).toBe(60_000);
    expect(resolveRequestTimeoutMs({ originalUrl: '/api/upload/image-question' })).toBe(60_000);

    let observedSignal = null;
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'req-timeout-test-1';
      next();
    });
    app.use(requestTimeout({ standardTimeoutMs: 60, extendedTimeoutMs: 120 }));
    app.get('/slow', (req, res) => {
      observedSignal = req.abortSignal;
      setTimeout(() => {
        if (!res.headersSent) res.json({ ok: true });
      }, 250);
    });

    const server = http.createServer(app);
    await listenServer(server, 0, '127.0.0.1');
    expect(server.requestTimeout).toBe(60_000);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const res = await fetch(`${baseUrl}/slow`);
      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({
        error: 'Request timed out',
        code: 'REQUEST_TIMEOUT',
        requestId: 'req-timeout-test-1',
      });
      expect(observedSignal).toBeTruthy();
      expect(observedSignal.aborted).toBe(true);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('coalesces and caches checkReadiness() for 3s and assertMigrations() for 60s to prevent /health DB amplification', async () => {
    const commandSpy = vi.spyOn(db, 'command');
    const migrationsCol = db.collection('schemaMigrations');
    const findSpy = vi.spyOn(migrationsCol, 'find');
    const origCollection = db.collection.bind(db);
    const colSpy = vi
      .spyOn(db, 'collection')
      .mockImplementation((name, ...rest) =>
        name === 'schemaMigrations' ? migrationsCol : origCollection(name, ...rest),
      );

    try {
      // Fire 20 concurrent checkReadiness calls
      await Promise.all(Array.from({ length: 20 }, () => checkReadiness()));
      expect(commandSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledTimes(1);

      // Subsequent calls within 3s hit cache (0 additional Mongo pings or migration queries)
      await checkReadiness();
      await checkReadiness();
      expect(commandSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledTimes(1);

      // Force probe bypasses cache
      await checkReadiness({ force: true });
      expect(commandSpy).toHaveBeenCalledTimes(2);
      expect(findSpy).toHaveBeenCalledTimes(2);
    } finally {
      commandSpy.mockRestore();
      findSpy.mockRestore();
      colSpy.mockRestore();
    }
  });
});
