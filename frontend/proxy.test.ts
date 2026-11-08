// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy, verifyAccessSessionToken, createAccessSessionToken } from './proxy';

const TEST_SESSION_SECRET = 'session-secret-must-be-at-least-32-chars-long-0123456789abcdef';
const DIFFERENT_JWT_SECRET = 'jwt-secret-must-be-completely-separate-key-0123456789abcdef';

const HEX_CHARS: readonly string[] = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0'),
);

/**
 * Creates signed session token matching the backend format:
 * "<timestamp>:<codeId>.<signature>"
 */
function buildCookieValue(
  codeId: string,
  timestamp: number = Date.now(),
  hmacKeyMaterial: string = TEST_SESSION_SECRET
): string {
  const payload = `${timestamp}:${codeId}`;
  const digest = crypto.createHmac('sha256', hmacKeyMaterial).update(payload).digest();
  let sig = '';
  for (let i = 0; i < digest.length; i++) {
    sig += HEX_CHARS[digest[i] & 0xff] ?? '00';
  }
  return `${payload}.${sig}`;
}

describe('monitoring access through the proxy', () => {
  it.each(['/monitoring', '/monitoring/', '/monitoring?o=1&p=2'])('allows unauthenticated tunnel requests to %s', (path) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(false);
    const response = proxy(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/check-email', '/verify-email?token=test-token', '/reset-password?token=test-token'])(
    'allows email verification pages without an access cookie: %s',
    (path) => {
      const response = proxy(new NextRequest(`http://localhost${path}`));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  );

  it.each(['/play', '/monitoring-other', '/check-email-other', '/verify-email-other', '/reset-password-other'])(
    'retains the access gate on %s with target preservation redirect',
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
      expect(proxy(new NextRequest(`http://localhost${path}`)).headers.get('location')).toBe(
        `http://localhost/access-code?redirect=${encodeURIComponent(path)}`
      );
    }
  );

  it('redirects root path / to /access-code without redundant redirect query param', () => {
    const res = proxy(new NextRequest('http://localhost/'));
    expect(res.headers.get('location')).toBe('http://localhost/access-code');
  });
});

describe('VULN-02 Regression: Access-code gate cryptographic verification & exploit reproduction', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    process.env.JWT_SECRET = DIFFERENT_JWT_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── 1. Exploit Reproduction: Dummy / Unverified Cookies MUST Be Rejected ──

  it('rejects access when access_session cookie is absent and redirects to /access-code?redirect=%2Fplay', () => {
    const req = new NextRequest('http://localhost/play');
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('EXPLOIT REPRODUCTION: rejects legacy dummy cookie value (access_session=1) and redirects to /access-code', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: 'access_session=1' },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('EXPLOIT REPRODUCTION: rejects arbitrary dummy cookie value (access_session=bypass) and redirects to /access-code', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: 'access_session=bypass' },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('EXPLOIT REPRODUCTION: rejects dummy cookie value (access_session=invalid) and redirects to /access-code', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: 'access_session=invalid' },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects malformed token lacking signature part', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${Date.now()}:code_only` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects token with invalid non-numeric timestamp', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: 'access_session=notanumber:code.deadbeef' },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  // ── 2. Expiration Verification ──

  it('EXPLOIT REPRODUCTION: rejects expired signed session token (> 24 hours old)', () => {
    const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const expiredToken = buildCookieValue('code_valid_123', expiredTimestamp, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${expiredToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects future skewed tokens (> 5 minutes ahead)', () => {
    const futureTimestamp = Date.now() + 10 * 60 * 1000;
    const futureToken = buildCookieValue('code_valid_123', futureTimestamp, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${futureToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  // ── 3. Secret Isolation / Key Confusion ──

  it('EXPLOIT REPRODUCTION: rejects tokens signed with JWT_SECRET instead of dedicated SESSION_SECRET', () => {
    const jwtSignedToken = buildCookieValue('code_valid_123', Date.now(), DIFFERENT_JWT_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${jwtSignedToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects tokens signed with static insecure fallback string', () => {
    const fallbackToken = buildCookieValue('code_valid_123', Date.now(), 'access-session-secret-fallback');
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${fallbackToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects tokens with tampered/modified signature bytes', () => {
    const validToken = buildCookieValue('code_valid_123', Date.now(), TEST_SESSION_SECRET);
    const tampered = validToken.slice(0, -2) + (validToken.endsWith('00') ? 'ff' : '00');
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${tampered}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  // ── 4. Valid Token Pass-Through ──

  it('allows access with a cryptographically valid, unexpired token signed with SESSION_SECRET', () => {
    const validToken = buildCookieValue('code_valid_123', Date.now() - 3600_000, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${validToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('handles URL-encoded cookie values seamlessly', () => {
    const validToken = buildCookieValue('code_valid_123', Date.now() - 3600_000, TEST_SESSION_SECRET);
    const encoded = encodeURIComponent(validToken);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${encoded}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  // ── 5. Admin & Privileged Access Preservation ──

  it('preserves valid admin sessions via admin_session cookie without requiring an access_session cookie', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: {
        cookie: 'admin_session=active_verified_admin_session',
      },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('preserves valid admin sessions via verified Bearer JWT authorization header', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        id: 'admin_user_1',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', DIFFERENT_JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    const adminJwt = `${header}.${payload}.${sig}`;

    const req = new NextRequest('http://localhost/play', {
      headers: {
        authorization: `Bearer ${adminJwt}`,
      },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('preserves valid admin sessions via admin refreshToken cookie', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        id: 'admin_user_2',
        role: 'superadmin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', DIFFERENT_JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    const adminRefreshToken = `${header}.${payload}.${sig}`;

    const req = new NextRequest('http://localhost/play', {
      headers: {
        cookie: `refreshToken=${adminRefreshToken}`,
      },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('preserves non-production test fixtures like local-admin-fixture', () => {
    const req = new NextRequest('http://localhost/play', {
      headers: {
        cookie: 'access_session=local-admin-fixture',
      },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('exports verifyAccessSessionToken for external callers', () => {
    expect(typeof verifyAccessSessionToken).toBe('function');
  });

  it('signs and verifies access session tokens via derived ADMIN_SECRET key when SESSION_SECRET is unset in production (Vercel)', () => {
    const envRecord = process.env as Record<string, string | undefined>;
    const origNodeEnv = envRecord.NODE_ENV;
    try {
      envRecord.NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;
      delete process.env.ACCESS_CODE_SECRET;
      process.env.ADMIN_SECRET = 'vercel-admin-secret-at-least-32-chars-long';

      const token = createAccessSessionToken('8481');
      expect(typeof token).toBe('string');
      expect(verifyAccessSessionToken(token)).toBe(true);

      const req = new NextRequest('http://localhost/', {
        headers: { cookie: `access_session=${encodeURIComponent(token!)}` },
      });
      const res = proxy(req);
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');

      // Tokens forged with raw ADMIN_SECRET must still be rejected
      const rawAdminForged = buildCookieValue('8481', Date.now(), process.env.ADMIN_SECRET);
      expect(verifyAccessSessionToken(rawAdminForged)).toBe(false);

      // Stale/invalid access_session cookies are deleted on redirect so HttpOnly cookies do not block re-verification
      const staleReq = new NextRequest('http://localhost/', {
        headers: { cookie: `access_session=${encodeURIComponent(rawAdminForged)}` },
      });
      const staleRes = proxy(staleReq);
      expect(staleRes.status).toBe(307);
      expect(staleRes.headers.get('set-cookie')).toContain('access_session=;');
    } finally {
      envRecord.NODE_ENV = origNodeEnv;
    }
  });

  it('FINDING-05: rejects admin JWT lacking exp claim or using non-HS256 alg header', () => {
    // 1. Valid HMAC signature, but missing exp claim
    const hs256Header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const noExpPayload = Buffer.from(JSON.stringify({ id: 'admin_1', role: 'admin' })).toString('base64url');
    const noExpSig = crypto
      .createHmac('sha256', DIFFERENT_JWT_SECRET)
      .update(`${hs256Header}.${noExpPayload}`)
      .digest('base64url');
    const noExpToken = `${hs256Header}.${noExpPayload}.${noExpSig}`;

    const resNoExp = proxy(
      new NextRequest('http://localhost/play', {
        headers: { authorization: `Bearer ${noExpToken}` },
      })
    );
    expect(resNoExp.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');

    // 2. Valid HMAC signature and valid exp, but header alg is not HS256
    const badAlgHeader = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
    const validExpPayload = Buffer.from(
      JSON.stringify({ id: 'admin_1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url');
    const badAlgSig = crypto
      .createHmac('sha256', DIFFERENT_JWT_SECRET)
      .update(`${badAlgHeader}.${validExpPayload}`)
      .digest('base64url');
    const badAlgToken = `${badAlgHeader}.${validExpPayload}.${badAlgSig}`;

    const resBadAlg = proxy(
      new NextRequest('http://localhost/play', {
        headers: { authorization: `Bearer ${badAlgToken}` },
      })
    );
    expect(resBadAlg.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });
});
