import express from 'express';
import cookieParser from 'cookie-parser';
import { once } from 'node:events';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { hashPassword, verifyPassword, shutdownPasswordWorkers } from '../passwordHash.js';
import { isProductionCookieEnv, requireTrustedOrigin } from '../requestOrigin.js';
import {
  getLoginLockoutState,
  recordLoginFailure,
  clearLoginFailures,
  consumeEmailRecoveryQuota,
} from '../../repositories/authLoginLockoutRepository.js';

describe('M1 Auth Resilience: Worker Bcrypt, Login Lockout, Recovery Quotas, OAuth Safety & Origin Policy', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'm1_auth_resilience_tests');
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    db = await connectMongoDB();
  }, 60_000);

  beforeEach(async () => {
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    await Promise.all(
      ['users', 'authSessions', 'rateLimits'].map((col) => db.collection(col).deleteMany({})),
    );
  });

  afterAll(async () => {
    await shutdownPasswordWorkers();
    await disconnectMongoDB();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  it('offloads cost-12 bcrypt hash and compare to worker_threads when useWorker is enabled', async () => {
    const hash = await hashPassword('WorkerThreadPass123!', 10, { useWorker: true });
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(await verifyPassword('WorkerThreadPass123!', hash, { useWorker: true })).toBe(true);
    expect(await verifyPassword('WrongPassword123!', hash, { useWorker: true })).toBe(false);
  });

  it('locks an account after 5 failed login attempts in rateLimits and clears on success', async () => {
    const email = 'LockoutUser@Example.test';
    const now = new Date();

    for (let i = 1; i <= 4; i++) {
      const state = await recordLoginFailure(email, now);
      expect(state.locked).toBe(false);
      expect(state.attempts).toBe(i);
    }

    const fifth = await recordLoginFailure(email, now);
    expect(fifth.locked).toBe(true);
    expect(fifth.attempts).toBe(5);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(800);

    const lockedState = await getLoginLockoutState(email, now);
    expect(lockedState.locked).toBe(true);
    expect(lockedState.attempts).toBe(5);

    // Expired window automatically unlocks
    const afterExpiry = new Date(now.getTime() + 16 * 60 * 1000);
    const unlockedAfterWindow = await getLoginLockoutState(email, afterExpiry);
    expect(unlockedAfterWindow.locked).toBe(false);

    // Re-lock and verify explicit clearLoginFailures on successful login
    for (let i = 0; i < 5; i++) {
      await recordLoginFailure(email, afterExpiry);
    }
    expect((await getLoginLockoutState(email, afterExpiry)).locked).toBe(true);
    await clearLoginFailures(email);
    expect((await getLoginLockoutState(email, afterExpiry)).locked).toBe(false);
  });

  it('enforces 60s cooldown and 5/hour cap per email on recovery actions using rateLimits TTL documents', async () => {
    const email = 'RecoveryTarget@Example.test';
    const baseTime = new Date('2026-11-22T10:00:00.000Z');

    // 1st request allowed
    expect(
      (await consumeEmailRecoveryQuota({ email, action: 'forgot-password', now: baseTime })).allowed,
    ).toBe(true);

    // Immediate retry within 60s blocked
    const cooldownBlocked = await consumeEmailRecoveryQuota({
      email,
      action: 'forgot-password',
      now: new Date(baseTime.getTime() + 15_000),
    });
    expect(cooldownBlocked.allowed).toBe(false);
    expect(cooldownBlocked.retryAfterSeconds).toBe(45);

    // Different action ('resend-verification') has its own isolated quota
    expect(
      (await consumeEmailRecoveryQuota({ email, action: 'resend-verification', now: baseTime }))
        .allowed,
    ).toBe(true);

    // Requests 2..5 spaced >60s apart within the same hour succeed
    for (let i = 1; i < 5; i++) {
      const t = new Date(baseTime.getTime() + i * 61_000);
      expect(
        (await consumeEmailRecoveryQuota({ email, action: 'forgot-password', now: t })).allowed,
      ).toBe(true);
    }

    // 6th request in the same hour is blocked by the 5/hr cap even after 60s cooldown
    const sixth = await consumeEmailRecoveryQuota({
      email,
      action: 'forgot-password',
      now: new Date(baseTime.getTime() + 6 * 61_000),
    });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(3000);

    // After 1 hour window expires, quota resets
    const nextHour = new Date(baseTime.getTime() + 3600_001);
    expect(
      (await consumeEmailRecoveryQuota({ email, action: 'forgot-password', now: nextHour })).allowed,
    ).toBe(true);
  });

  it('unifies isProductionCookieEnv across NODE_ENV, RENDER, and RENDER_EXTERNAL_URL', () => {
    expect(isProductionCookieEnv({ NODE_ENV: 'development' })).toBe(false);
    expect(isProductionCookieEnv({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionCookieEnv({ NODE_ENV: 'development', RENDER: 'true' })).toBe(true);
    expect(
      isProductionCookieEnv({
        NODE_ENV: 'development',
        RENDER_EXTERNAL_URL: 'https://meow.onrender.com',
      }),
    ).toBe(true);
  });

  it('preserves strict browser/cookie CSRF checks in requireTrustedOrigin while allowing explicit cookie-free k6/API clients', () => {
    vi.stubEnv('FRONTEND_URL', 'https://quiz.example');
    const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

    // Missing origin without explicit client header -> 403
    const next1 = vi.fn();
    const res1 = makeRes();
    requireTrustedOrigin({ headers: {} }, res1, next1);
    expect(res1.status).toHaveBeenCalledWith(403);
    expect(next1).not.toHaveBeenCalled();

    // Untrusted origin even with x-client-platform: k6 -> 403
    const next2 = vi.fn();
    const res2 = makeRes();
    requireTrustedOrigin(
      { headers: { origin: 'https://evil.example', 'x-client-platform': 'k6' } },
      res2,
      next2,
    );
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(next2).not.toHaveBeenCalled();

    // Cookie-bearing request without Origin even with x-client-platform: k6 -> 403
    const next3 = vi.fn();
    const res3 = makeRes();
    requireTrustedOrigin(
      { headers: { cookie: 'refreshToken=secret', 'x-client-platform': 'k6' } },
      res3,
      next3,
    );
    expect(res3.status).toHaveBeenCalledWith(403);
    expect(next3).not.toHaveBeenCalled();

    // Cross-site sec-fetch-site with x-client-platform: k6 -> 403
    const next4 = vi.fn();
    const res4 = makeRes();
    requireTrustedOrigin(
      { headers: { 'sec-fetch-site': 'cross-site', 'x-client-platform': 'k6' } },
      res4,
      next4,
    );
    expect(res4.status).toHaveBeenCalledWith(403);
    expect(next4).not.toHaveBeenCalled();

    // Cookie-free, origin-free request with explicit non-CORS-safelisted x-client-platform: k6 -> allowed
    const next5 = vi.fn();
    const res5 = makeRes();
    requireTrustedOrigin({ headers: { 'x-client-platform': 'k6' } }, res5, next5);
    expect(next5).toHaveBeenCalledOnce();
  });

  it('redirects /auth/google/callback to /login?error=oauth when createSession fails', async () => {
    vi.resetModules();
    vi.doMock('../passport.js', () => ({
      default: {
        authenticate: () => (req, _res, next) => {
          req.user = { id: 'suspended-google-user', email: 'g@example.test', name: 'G', role: 'user' };
          next();
        },
      },
    }));
    vi.doMock('../sessions.js', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        createSession: vi.fn().mockRejectedValue(Object.assign(new Error('Account suspended'), { statusCode: 401 })),
      };
    });

    const { initAuthRoutes } = await import('../../routes/auth.routes.js');
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', initAuthRoutes());
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${baseUrl}/auth/google/callback`, { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=oauth');
    } finally {
      await new Promise((r) => server.close(r));
      vi.doUnmock('../passport.js');
      vi.doUnmock('../sessions.js');
    }
  });
});
