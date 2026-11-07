// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import { once } from 'node:events';

const TEST_SESSION_SECRET = 'session-secret-must-be-at-least-32-chars-long-0123456789abcdef';
const DIFFERENT_JWT_SECRET = 'jwt-secret-must-be-completely-separate-key-0123456789abcdef';

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

function createTokenWithSecret(codeId, timestamp, secret) {
  const payload = `${timestamp}:${codeId}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

describe('VULN-02 Regression: Access Code Secret Isolation & Verification', () => {
  let app;
  let server;
  let baseUrl;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    process.env.JWT_SECRET = DIFFERENT_JWT_SECRET;
    delete process.env.ACCESS_CODE_SECRET;

    // Dynamically import router after setting env
    const { default: accessCodeRoutes } = await import('../../routes/accessCodes.js');

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(['/api/access-code', '/api/access-codes'], accessCodeRoutes);

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

  describe('Direct Unit & Secret Isolation (routes/accessCodes.js exports)', () => {
    it('uses dedicated SESSION_SECRET and provides createSignedSessionToken and verifySignedSessionToken', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      expect(typeof accessCodesModule.createSignedSessionToken).toBe('function');
      expect(typeof accessCodesModule.verifySignedSessionToken).toBe('function');

      const token = accessCodesModule.createSignedSessionToken('test_code_123');
      expect(typeof token).toBe('string');
      expect(accessCodesModule.verifySignedSessionToken(token)).toBe(true);
    });

    it('REJECTS tokens signed with JWT_SECRET (cross-protocol key confusion)', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      const forgedJwtToken = createTokenWithSecret('test_code_admin', Date.now(), DIFFERENT_JWT_SECRET);
      expect(accessCodesModule.verifySignedSessionToken(forgedJwtToken)).toBe(false);
    });

    it('REJECTS tokens signed with hardcoded fallback string', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      const fallbackToken = createTokenWithSecret('test_code_1', Date.now(), 'access-session-secret-fallback');
      expect(accessCodesModule.verifySignedSessionToken(fallbackToken)).toBe(false);
    });

    it('rejects tokens expired past 24 hours', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      const expiredToken = createTokenWithSecret('code_expired', expiredTimestamp, TEST_SESSION_SECRET);
      expect(accessCodesModule.verifySignedSessionToken(expiredToken)).toBe(false);
    });

    it('rejects tokens with future timestamps (> 5 minutes ahead)', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      const futureTimestamp = Date.now() + (10 * 60 * 1000);
      const futureToken = createTokenWithSecret('code_future', futureTimestamp, TEST_SESSION_SECRET);
      expect(accessCodesModule.verifySignedSessionToken(futureToken)).toBe(false);
    });

    it('rejects dummy cookie values such as "1" or "bypass"', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      expect(accessCodesModule.verifySignedSessionToken('1')).toBe(false);
      expect(accessCodesModule.verifySignedSessionToken('bypass')).toBe(false);
      expect(accessCodesModule.verifySignedSessionToken('invalid')).toBe(false);
    });

    it('handles URL-encoded tokens safely', async () => {
      const accessCodesModule = await import('../../routes/accessCodes.js');
      const validToken = createTokenWithSecret('code_valid', Date.now(), TEST_SESSION_SECRET);
      const encodedToken = encodeURIComponent(validToken);
      expect(accessCodesModule.verifySignedSessionToken(encodedToken)).toBe(true);
    });
  });

  describe('GET /api/access-code/check (Session Token Validation)', () => {
    it('returns valid: false when access_session cookie is missing', async () => {
      const res = await fetch(`${baseUrl}/api/access-code/check`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for dummy cookie (access_session=1)', async () => {
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: 'access_session=1' },
      });
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for dummy cookie (access_session=bypass)', async () => {
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: 'access_session=bypass' },
      });
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for token signed with JWT_SECRET', async () => {
      const jwtSignedToken = createTokenWithSecret('test_code_1', Date.now(), DIFFERENT_JWT_SECRET);
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${jwtSignedToken}` },
      });
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: false for token signed with hardcoded fallback secret', async () => {
      const fallbackToken = createTokenWithSecret('test_code_1', Date.now(), 'access-session-secret-fallback');
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${fallbackToken}` },
      });
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('returns valid: true for unexpired token signed with SESSION_SECRET', async () => {
      const validToken = createTokenWithSecret('test_code_1', Date.now() - 3600_000, TEST_SESSION_SECRET);
      const res = await fetch(`${baseUrl}/api/access-code/check`, {
        headers: { cookie: `access_session=${validToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
    });

    it('is also accessible via plural /api/access-codes/check', async () => {
      const validToken = createTokenWithSecret('test_code_1', Date.now() - 3600_000, TEST_SESSION_SECRET);
      const res = await fetch(`${baseUrl}/api/access-codes/check`, {
        headers: { cookie: `access_session=${validToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
    });
  });

  describe('POST /api/access-code/verify and /api/access-codes/verify', () => {
    it('returns signed session token in response body on successful verification', async () => {
      findActiveAccessCodeMock.mockResolvedValueOnce({
        _id: 'mongo_code_id_1',
        id: 'code_test_123',
        code: '4321',
        active: true,
        usedCount: 0,
        maxUses: 10,
      });
      consumeAccessCodeMock.mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const res = await fetch(`${baseUrl}/api/access-code/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '4321' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      // Hardening contract: Returns the cryptographically signed token to caller
      expect(typeof data.token).toBe('string');
      expect(data.token).toContain(':');
      expect(data.token).toContain('.');

      // Verify token is signed with SESSION_SECRET
      const accessCodesModule = await import('../../routes/accessCodes.js');
      expect(accessCodesModule.verifySignedSessionToken(data.token)).toBe(true);

      // Verify Set-Cookie header is also emitted for direct backend access
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain('access_session=');
    });

    it('supports POST /api/access-codes/verify with identical behavior', async () => {
      findActiveAccessCodeMock.mockResolvedValueOnce({
        _id: 'mongo_code_id_2',
        id: 'code_test_456',
        code: '9876',
        active: true,
        usedCount: 1,
        maxUses: 5,
      });
      consumeAccessCodeMock.mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const res = await fetch(`${baseUrl}/api/access-codes/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '9876' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(typeof data.token).toBe('string');
      expect(data.token).toContain(':');
      expect(data.token).toContain('.');
    });
  });
});
