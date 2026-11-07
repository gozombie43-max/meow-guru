// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { proxy, verifyAccessSessionToken } from './proxy';

const VALID_SESSION_SECRET = 'session-secret-must-be-at-least-32-chars-long-0123456789abcdef';
const ATTACKER_JWT_SECRET = 'jwt-secret-attacker-controlled-or-user-jwt-key-9876543210fedcba';
const TEST_ADMIN_KEY_MATERIAL = 'admin-token-material-for-privileged-api-gate-4567890123456789';

const HEX_CHARS: readonly string[] = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0'),
);

function buildCookieValue(
  codeId: string,
  timestamp: number | string = Date.now(),
  hmacKeyMaterial: string = VALID_SESSION_SECRET,
  customSig?: string
): string {
  const payload = `${timestamp}:${codeId}`;
  if (customSig !== undefined) {
    return `${payload}.${customSig}`;
  }
  const digest = crypto.createHmac('sha256', hmacKeyMaterial).update(payload).digest();
  let sig = '';
  for (let i = 0; i < digest.length; i++) {
    sig += HEX_CHARS[digest[i] & 0xff] ?? '00';
  }
  return `${payload}.${sig}`;
}

describe('Adversarial Challenge: VULN-02 Access-Code Gate & Secret Confusion', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SESSION_SECRET = VALID_SESSION_SECRET;
    process.env.JWT_SECRET = ATTACKER_JWT_SECRET;
    process.env.ADMIN_SECRET = TEST_ADMIN_KEY_MATERIAL;
    delete process.env.ACCESS_CODE_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Forged Tokens with Alternative / Confused Secrets', () => {
    it('ADVERSARIAL: rejects token forged using JWT_SECRET', () => {
      const forged = buildCookieValue('target_code', Date.now(), ATTACKER_JWT_SECRET);
      expect(verifyAccessSessionToken(forged)).toBe(false);

      const req = new NextRequest('http://localhost/play', {
        headers: { cookie: `access_session=${forged}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects token forged using ADMIN_SECRET', () => {
      const forged = buildCookieValue('target_code', Date.now(), TEST_ADMIN_KEY_MATERIAL);
      expect(verifyAccessSessionToken(forged)).toBe(false);

      const req = new NextRequest('http://localhost/play', {
        headers: { cookie: `access_session=${forged}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects token signed with empty/blank secret', () => {
      const forged = buildCookieValue('target_code', Date.now(), '');
      expect(verifyAccessSessionToken(forged)).toBe(false);

      const req = new NextRequest('http://localhost/play', {
        headers: { cookie: `access_session=${forged}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects token signed with arbitrary random key', () => {
      const forged = buildCookieValue('target_code', Date.now(), 'completely-unknown-random-secret-key-xyz');
      expect(verifyAccessSessionToken(forged)).toBe(false);

      const req = new NextRequest('http://localhost/play', {
        headers: { cookie: `access_session=${forged}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects token signed with legacy fallback string', () => {
      const forged = buildCookieValue('target_code', Date.now(), 'access-session-secret-fallback');
      expect(verifyAccessSessionToken(forged)).toBe(false);
    });
  });

  describe('2. Truncated, Extended, and Malformed Signatures', () => {
    it('ADVERSARIAL: rejects truncated 63-character hex signature (off-by-one under)', () => {
      const valid = buildCookieValue('valid_code', Date.now(), VALID_SESSION_SECRET);
      const dotIdx = valid.lastIndexOf('.');
      const payload = valid.slice(0, dotIdx);
      const truncatedSig = valid.slice(dotIdx + 1, -1); // 63 chars
      expect(truncatedSig.length).toBe(63);

      const token = `${payload}.${truncatedSig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects extended 65-character hex signature (off-by-one over)', () => {
      const valid = buildCookieValue('valid_code', Date.now(), VALID_SESSION_SECRET);
      const dotIdx = valid.lastIndexOf('.');
      const payload = valid.slice(0, dotIdx);
      const extendedSig = valid.slice(dotIdx + 1) + 'a'; // 65 chars
      expect(extendedSig.length).toBe(65);

      const token = `${payload}.${extendedSig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects 64-character signature with non-hex characters (g-z)', () => {
      const nonHexSig = 'g'.repeat(64);
      const token = `${Date.now()}:code.${nonHexSig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: rejects 64-character signature containing punctuation/special characters', () => {
      const nonHexSig = 'a'.repeat(30) + '!!@@##$$' + 'b'.repeat(26);
      expect(nonHexSig.length).toBe(64);
      const token = `${Date.now()}:code.${nonHexSig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects signature containing whitespace or control chars', () => {
      const token = `${Date.now()}:code.${'a'.repeat(63)} `;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: accepts valid uppercase hex signature', () => {
      const valid = buildCookieValue('valid_code', Date.now(), VALID_SESSION_SECRET);
      const dotIdx = valid.lastIndexOf('.');
      const payload = valid.slice(0, dotIdx);
      const upperSig = valid.slice(dotIdx + 1).toUpperCase();
      const token = `${payload}.${upperSig}`;
      expect(verifyAccessSessionToken(token)).toBe(true);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });
  });

  describe('3. Malformed Payloads & Boundary Timestamps', () => {
    it('ADVERSARIAL: rejects payload missing colon delimiter entirely', () => {
      const sig = 'a'.repeat(64);
      const token = `123456789code.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects payload with colon at start (:codeId)', () => {
      const sig = 'a'.repeat(64);
      const token = `:valid_code.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects payload with colon at end (timestamp:)', () => {
      const sig = 'a'.repeat(64);
      const token = `${Date.now()}:.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects NaN timestamp string (NaN:code)', () => {
      const sig = 'a'.repeat(64);
      const token = `NaN:code.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects non-numeric timestamp strings (abc:code, undefined:code, Infinity:code)', () => {
      const sig = 'a'.repeat(64);
      expect(verifyAccessSessionToken(`abc:code.${sig}`)).toBe(false);
      expect(verifyAccessSessionToken(`undefined:code.${sig}`)).toBe(false);
      expect(verifyAccessSessionToken(`Infinity:code.${sig}`)).toBe(false);
      expect(verifyAccessSessionToken(`-Infinity:code.${sig}`)).toBe(false);
    });

    it('ADVERSARIAL: rejects negative timestamp (-1000:code)', () => {
      const sig = 'a'.repeat(64);
      const token = `-10000:code.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects zero timestamp (0:code)', () => {
      const sig = 'a'.repeat(64);
      const token = `0:code.${sig}`;
      expect(verifyAccessSessionToken(token)).toBe(false);
    });

    it('ADVERSARIAL: rejects token exactly 24 hours + 1 second old (strict expiration boundary)', () => {
      const expiredMs = Date.now() - (24 * 60 * 60 * 1000 + 1000);
      const expiredToken = buildCookieValue('valid_code', expiredMs, VALID_SESSION_SECRET);
      expect(verifyAccessSessionToken(expiredToken)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${expiredToken}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: accepts token 23 hours and 59 minutes old (unexpired boundary)', () => {
      const unexpiredMs = Date.now() - (23 * 60 * 60 * 1000 + 59 * 60 * 1000);
      const unexpiredToken = buildCookieValue('valid_code', unexpiredMs, VALID_SESSION_SECRET);
      expect(verifyAccessSessionToken(unexpiredToken)).toBe(true);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${unexpiredToken}` } }));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });

    it('ADVERSARIAL: rejects future timestamp past 5-minute clock drift boundary (5m + 1s)', () => {
      const futureMs = Date.now() + (5 * 60 * 1000 + 1000);
      const futureToken = buildCookieValue('valid_code', futureMs, VALID_SESSION_SECRET);
      expect(verifyAccessSessionToken(futureToken)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${futureToken}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: accepts future timestamp within 5-minute clock drift boundary (4 minutes)', () => {
      const futureMs = Date.now() + (4 * 60 * 1000);
      const futureToken = buildCookieValue('valid_code', futureMs, VALID_SESSION_SECRET);
      expect(verifyAccessSessionToken(futureToken)).toBe(true);
    });
  });

  describe('4. Delimiter, Dot, and Type Tampering', () => {
    it('ADVERSARIAL: rejects token with no dot delimiter', () => {
      expect(verifyAccessSessionToken('1700000000000:code_no_dot')).toBe(false);
    });

    it('ADVERSARIAL: rejects token with dot at index 0 (.signature)', () => {
      expect(verifyAccessSessionToken(`.${'a'.repeat(64)}`)).toBe(false);
    });

    it('ADVERSARIAL: rejects token with dot at end (payload.)', () => {
      expect(verifyAccessSessionToken('1700000000000:code.')).toBe(false);
    });

    it('ADVERSARIAL: rejects empty string, null, and undefined safely', () => {
      expect(verifyAccessSessionToken('')).toBe(false);
      expect(verifyAccessSessionToken(null)).toBe(false);
      expect(verifyAccessSessionToken(undefined)).toBe(false);
      // @ts-expect-error Testing non-string runtime types
      expect(verifyAccessSessionToken(12345)).toBe(false);
      // @ts-expect-error Testing non-string runtime types
      expect(verifyAccessSessionToken({})).toBe(false);
    });
  });

  describe('5. URL Encoding & Malformed Encoding Edge Cases', () => {
    it('ADVERSARIAL: accepts valid URL-encoded token (normal client cookie transmission)', () => {
      const valid = buildCookieValue('valid_code', Date.now(), VALID_SESSION_SECRET);
      const encoded = encodeURIComponent(valid);
      expect(verifyAccessSessionToken(encoded)).toBe(true);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${encoded}` } }));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });

    it('ADVERSARIAL: handles token where colon is encoded as %3A', () => {
      const now = Date.now();
      const rawPayload = `${now}:valid_code`;
      const expectedSig = crypto.createHmac('sha256', VALID_SESSION_SECRET).update(rawPayload).digest('hex');
      const token = `${now}%3Avalid_code.${expectedSig}`;
      // When URL-decoded, %3A becomes ':', matching rawPayload
      expect(verifyAccessSessionToken(token)).toBe(true);
    });

    it('ADVERSARIAL: rejects malformed percent encoding without unhandled exceptions or crashes', () => {
      // Malformed URI encoding throws URIError in decodeURIComponent if unhandled
      expect(() => verifyAccessSessionToken('malformed%token')).not.toThrow();
      expect(verifyAccessSessionToken('malformed%token')).toBe(false);

      expect(() => verifyAccessSessionToken('%')).not.toThrow();
      expect(verifyAccessSessionToken('%')).toBe(false);

      expect(() => verifyAccessSessionToken('%ZZ')).not.toThrow();
      expect(verifyAccessSessionToken('%ZZ')).toBe(false);

      // Verify proxy also handles malformed percent encoding safely without throwing
      const req = new NextRequest('http://localhost/play', { headers: { cookie: 'access_session=malformed%token' } });
      let res: ReturnType<typeof proxy> | undefined;
      expect(() => { res = proxy(req); }).not.toThrow();
      expect(res?.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });
  });

  describe('6. Cryptographic Key Isolation Enforcement', () => {
    it('ADVERSARIAL: fails closed if SESSION_SECRET is identical to JWT_SECRET', () => {
      // Misconfiguration scenario: operator set SESSION_SECRET = JWT_SECRET
      process.env.SESSION_SECRET = 'identical-shared-secret-key-32-chars-long';
      process.env.JWT_SECRET = 'identical-shared-secret-key-32-chars-long';

      const token = buildCookieValue('code', Date.now(), 'identical-shared-secret-key-32-chars-long');
      // Must reject due to anti-confusion key isolation check
      expect(verifyAccessSessionToken(token)).toBe(false);

      const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: fails closed in production when SESSION_SECRET is missing', () => {
      const envRecord = process.env as Record<string, string | undefined>;
      const origEnv = envRecord.NODE_ENV;
      try {
        envRecord.NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;
        delete process.env.ACCESS_CODE_SECRET;

        const token = buildCookieValue('code', Date.now(), 'some-secret');
        expect(verifyAccessSessionToken(token)).toBe(false);

        const res = proxy(new NextRequest('http://localhost/play', { headers: { cookie: `access_session=${token}` } }));
        expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
      } finally {
        envRecord.NODE_ENV = origEnv;
      }
    });
  });

  describe('7. Production Posture: Strict Disabling of Test Fixtures in Production', () => {
    it('ADVERSARIAL: strictly rejects "-fixture" token in production environment', () => {
      const envRecord = process.env as Record<string, string | undefined>;
      const origEnv = envRecord.NODE_ENV;
      try {
        envRecord.NODE_ENV = 'production';
        expect(verifyAccessSessionToken('hero-carousel-fixture')).toBe(false);
        expect(verifyAccessSessionToken('test-fixture')).toBe(false);

        const res = proxy(new NextRequest('http://localhost/play', {
          headers: { cookie: 'access_session=hero-carousel-fixture' },
        }));
        expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
      } finally {
        envRecord.NODE_ENV = origEnv;
      }
    });

    it('ADVERSARIAL: strictly rejects "-invite" token in production environment', () => {
      const envRecord = process.env as Record<string, string | undefined>;
      const origEnv = envRecord.NODE_ENV;
      try {
        envRecord.NODE_ENV = 'production';
        expect(verifyAccessSessionToken('special-invite')).toBe(false);

        const res = proxy(new NextRequest('http://localhost/play', {
          headers: { cookie: 'access_session=special-invite' },
        }));
        expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
      } finally {
        envRecord.NODE_ENV = origEnv;
      }
    });

    it('ADVERSARIAL: strictly rejects "local-admin-fixture" in production environment', () => {
      const envRecord = process.env as Record<string, string | undefined>;
      const origEnv = envRecord.NODE_ENV;
      try {
        envRecord.NODE_ENV = 'production';
        expect(verifyAccessSessionToken('local-admin-fixture')).toBe(false);

        const res = proxy(new NextRequest('http://localhost/play', {
          headers: { cookie: 'access_session=local-admin-fixture' },
        }));
        expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
      } finally {
        envRecord.NODE_ENV = origEnv;
      }
    });

    it('ADVERSARIAL: strictly rejects "remaining-performance" fixture in production environment', () => {
      const envRecord = process.env as Record<string, string | undefined>;
      const origEnv = envRecord.NODE_ENV;
      try {
        envRecord.NODE_ENV = 'production';
        expect(verifyAccessSessionToken('remaining-performance')).toBe(false);

        const res = proxy(new NextRequest('http://localhost/play', {
          headers: { cookie: 'access_session=remaining-performance' },
        }));
        expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
      } finally {
        envRecord.NODE_ENV = origEnv;
      }
    });
  });

  describe('8. Admin Access Gate Verification & Non-Privileged User Rejection', () => {
    it('ADVERSARIAL: non-admin bearer token (role: "user") CANNOT bypass access-code gate', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: 'regular_user_1',
          role: 'user', // NOT admin or superadmin
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const sig = crypto.createHmac('sha256', ATTACKER_JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
      const userJwt = `${header}.${payload}.${sig}`;

      const req = new NextRequest('http://localhost/play', {
        headers: { authorization: `Bearer ${userJwt}` },
      });
      const res = proxy(req);
      // User is redirected to access code gate
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: expired admin bearer token CANNOT bypass access-code gate', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: 'admin_user_expired',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 100, // Expired
        })
      ).toString('base64url');
      const sig = crypto.createHmac('sha256', ATTACKER_JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
      const expiredAdminJwt = `${header}.${payload}.${sig}`;

      const req = new NextRequest('http://localhost/play', {
        headers: { authorization: `Bearer ${expiredAdminJwt}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: forged admin bearer token with bad signature CANNOT bypass gate', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: 'fake_admin',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const badSig = crypto.createHmac('sha256', 'wrong-jwt-key').update(`${header}.${payload}`).digest('base64url');
      const forgedJwt = `${header}.${payload}.${badSig}`;

      const req = new NextRequest('http://localhost/play', {
        headers: { authorization: `Bearer ${forgedJwt}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL: incorrect x-admin-key CANNOT bypass access-code gate', () => {
      const req = new NextRequest('http://localhost/play', {
        headers: { 'x-admin-key': 'incorrect-secret-guess' },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL VULNERABILITY: unsigned admin refreshToken allows unauthorized gate bypass', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: 'unauthenticated_attacker',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      // Completely forged/fake signature without knowing JWT_SECRET
      const forgedRefreshToken = `${header}.${payload}.completely_fake_signature`;

      const req = new NextRequest('http://localhost/play', {
        headers: {
          cookie: `refreshToken=${forgedRefreshToken}`,
        },
      });
      const res = proxy(req);
      // If securely implemented, forged refreshToken MUST be rejected and redirected to /access-code
      // But currently proxy.ts accepts it without signature verification!
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });

    it('ADVERSARIAL VULNERABILITY: missing JWT_SECRET allows unverified Bearer admin bypass', () => {
      delete process.env.JWT_SECRET;

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: 'attacker',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const forgedBearer = `${header}.${payload}.unsigned_garbage_sig`;

      const req = new NextRequest('http://localhost/play', {
        headers: {
          authorization: `Bearer ${forgedBearer}`,
        },
      });
      const res = proxy(req);
      // If securely implemented, missing JWT_SECRET must fail closed, redirecting to /access-code
      expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
    });
  });

  describe('9. Protected Route Coverage Under Adversarial Payloads', () => {
    it.each([
      '/',
      '/play',
      '/mathematics',
      '/general-awareness',
      '/english',
      '/reasoning',
      '/mock-test/ssc-cgl',
      '/notifications',
      '/dashboard',
    ])('ADVERSARIAL: strictly enforces gate redirection on protected route %s for tampered tokens', (path) => {
      const req = new NextRequest(`http://localhost${path}`, {
        headers: { cookie: 'access_session=forged-bypass-token' },
      });
      const res = proxy(req);
      const expectedRedirect = path === '/'
        ? 'http://localhost/access-code'
        : `http://localhost/access-code?redirect=${encodeURIComponent(path)}`;
      expect(res.headers.get('location')).toBe(expectedRedirect);
    });
  });
});
