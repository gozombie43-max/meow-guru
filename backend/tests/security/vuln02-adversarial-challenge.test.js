// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import { once } from 'node:events';

const VALID_SESSION_SECRET = 'session-secret-must-be-at-least-32-chars-long-0123456789abcdef';
const ATTACKER_JWT_SECRET = 'jwt-secret-attacker-controlled-or-user-jwt-key-9876543210fedcba';
const ADMIN_SECRET = 'admin-secret-strictly-for-privileged-api-keys-4567890123456789';

// Mock MongoDB collections / repository functions
const { findActiveAccessCodeMock, consumeAccessCodeMock } = vi.hoisted(() => ({
  findActiveAccessCodeMock: vi.fn(),
  consumeAccessCodeMock: vi.fn(),
}));

vi.mock('../../repositories/accessCodeRepository.js', () => ({
  findActiveAccessCode: findActiveAccessCodeMock,
  consumeAccessCode: consumeAccessCodeMock,
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req, _res, next) => next(),
}));

function buildCookieValue(codeId, timestamp, secret) {
  const payload = `${timestamp}:${codeId}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

describe('Adversarial Challenge: Backend Access Code Verification & Endpoints', () => {
  let app;
  let server;
  let baseUrl;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    process.env.SESSION_SECRET = VALID_SESSION_SECRET;
    process.env.JWT_SECRET = ATTACKER_JWT_SECRET;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    delete process.env.ACCESS_CODE_SECRET;

    const { default: accessCodeRoutes } = await import('../../routes/accessCodes.js');

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(['/api/access-code', '/api/access-codes'], accessCodeRoutes);

    // Error handling middleware to catch unhandled errors
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message, type: err.name });
    });

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Direct Unit Adversarial Verification (verifySignedSessionToken)', () => {
    it('ADVERSARIAL: rejects token forged using JWT_SECRET', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const forged = buildCookieValue('test_code', Date.now(), ATTACKER_JWT_SECRET);
      expect(verifySignedSessionToken(forged)).toBe(false);
    });

    it('ADVERSARIAL: rejects token forged using ADMIN_SECRET', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const forged = buildCookieValue('test_code', Date.now(), ADMIN_SECRET);
      expect(verifySignedSessionToken(forged)).toBe(false);
    });

    it('ADVERSARIAL: rejects token signed with empty/blank secret', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const forged = buildCookieValue('test_code', Date.now(), '');
      expect(verifySignedSessionToken(forged)).toBe(false);
    });

    it('ADVERSARIAL: rejects truncated 63-char signature', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const valid = buildCookieValue('code', Date.now(), VALID_SESSION_SECRET);
      const truncated = valid.slice(0, -1);
      expect(verifySignedSessionToken(truncated)).toBe(false);
    });

    it('ADVERSARIAL: rejects extended 65-char signature', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const valid = buildCookieValue('code', Date.now(), VALID_SESSION_SECRET);
      const extended = valid + 'a';
      expect(verifySignedSessionToken(extended)).toBe(false);
    });

    it('ADVERSARIAL: rejects non-hex signature (64 chars of non-hex)', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const token = `${Date.now()}:code.${'z'.repeat(64)}`;
      expect(verifySignedSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects missing colon in payload', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const token = `12345678code.${'a'.repeat(64)}`;
      expect(verifySignedSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects leading or trailing colon in payload', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      expect(verifySignedSessionToken(`:code.${'a'.repeat(64)}`)).toBe(false);
      expect(verifySignedSessionToken(`${Date.now()}:.${'a'.repeat(64)}`)).toBe(false);
    });

    it('ADVERSARIAL: rejects NaN, non-numeric, or negative timestamps', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      expect(verifySignedSessionToken(`NaN:code.${'a'.repeat(64)}`)).toBe(false);
      expect(verifySignedSessionToken(`invalid_time:code.${'a'.repeat(64)}`)).toBe(false);
      expect(verifySignedSessionToken(`-10000:code.${'a'.repeat(64)}`)).toBe(false);
    });

    it('ADVERSARIAL: rejects token expired past 24 hours (24h + 1s)', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const expiredMs = Date.now() - (24 * 60 * 60 * 1000 + 1000);
      const token = buildCookieValue('code', expiredMs, VALID_SESSION_SECRET);
      expect(verifySignedSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects future timestamp past 5-minute drift (5m + 1s)', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const futureMs = Date.now() + (5 * 60 * 1000 + 1000);
      const token = buildCookieValue('code', futureMs, VALID_SESSION_SECRET);
      expect(verifySignedSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: accepts valid URL-encoded token', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      const valid = buildCookieValue('code', Date.now(), VALID_SESSION_SECRET);
      expect(verifySignedSessionToken(encodeURIComponent(valid))).toBe(true);
    });

    it('ADVERSARIAL: handles malformed percent encoding without unhandled exceptions', async () => {
      const { verifySignedSessionToken } = await import('../../routes/accessCodes.js');
      expect(() => verifySignedSessionToken('malformed%token')).not.toThrow();
      expect(verifySignedSessionToken('malformed%token')).toBe(false);
      expect(() => verifySignedSessionToken('%')).not.toThrow();
      expect(verifySignedSessionToken('%')).toBe(false);
      expect(() => verifySignedSessionToken('%ZZ')).not.toThrow();
      expect(verifySignedSessionToken('%ZZ')).toBe(false);
    });
  });

  describe('2. Endpoint Adversarial Testing: GET /api/access-code/check', () => {
    it('returns valid: false for token forged with JWT_SECRET', async () => {
      const forged = buildCookieValue('test_code', Date.now(), ATTACKER_JWT_SECRET);
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${forged}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for token forged with ADMIN_SECRET', async () => {
      const forged = buildCookieValue('test_code', Date.now(), ADMIN_SECRET);
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${forged}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for token signed with blank secret', async () => {
      const forged = buildCookieValue('test_code', Date.now(), '');
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${forged}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for 24h+1s expired token', async () => {
      const expiredMs = Date.now() - (24 * 60 * 60 * 1000 + 1000);
      const expired = buildCookieValue('test_code', expiredMs, VALID_SESSION_SECRET);
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${expired}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('handles malformed percent encoding without 500 crash', async () => {
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: 'access_session=malformed%token' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });
  });

  describe('3. Endpoint Verification: POST /api/access-code/verify Token Cryptography', () => {
    it('issues token cryptographically signed with SESSION_SECRET, NOT JWT_SECRET or ADMIN_SECRET', async () => {
      findActiveAccessCodeMock.mockResolvedValueOnce({
        _id: 'mongo_code_id_adversarial',
        id: 'code_adv_123',
        code: '112233',
        active: true,
        usedCount: 0,
        maxUses: 10,
      });
      consumeAccessCodeMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const res = await fetch(`${baseUrl}/api/access-code/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '112233' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(typeof data.token).toBe('string');

      // Verify token structure
      const parts = data.token.split('.');
      expect(parts.length).toBe(2);
      const [payload, sig] = parts;

      // Verify signature is HMAC-SHA256 with SESSION_SECRET
      const expectedSigSession = crypto.createHmac('sha256', VALID_SESSION_SECRET).update(payload).digest('hex');
      expect(sig).toBe(expectedSigSession);

      // Verify signature is NOT matching JWT_SECRET or ADMIN_SECRET
      const expectedSigJwt = crypto.createHmac('sha256', ATTACKER_JWT_SECRET).update(payload).digest('hex');
      const expectedSigAdmin = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
      expect(sig).not.toBe(expectedSigJwt);
      expect(sig).not.toBe(expectedSigAdmin);
    });
  });
});
