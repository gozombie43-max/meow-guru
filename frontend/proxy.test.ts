// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy, verifyAccessSessionToken } from './proxy';

const TEST_SESSION_SECRET = 'session-secret-must-be-at-least-32-chars-long-0123456789abcdef';
const DIFFERENT_JWT_SECRET = 'jwt-secret-must-be-completely-separate-key-0123456789abcdef';

/**
 * Creates signed session token matching the backend format:
 * "<timestamp>:<codeId>.<signature>"
 */
function createSignedSessionToken(
  codeId: string,
  timestamp: number = Date.now(),
  secret: string = TEST_SESSION_SECRET
): string {
  const payload = `${timestamp}:${codeId}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
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
    const expiredToken = createSignedSessionToken('code_valid_123', expiredTimestamp, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${expiredToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects future skewed tokens (> 5 minutes ahead)', () => {
    const futureTimestamp = Date.now() + 10 * 60 * 1000;
    const futureToken = createSignedSessionToken('code_valid_123', futureTimestamp, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${futureToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  // ── 3. Secret Isolation / Key Confusion ──

  it('EXPLOIT REPRODUCTION: rejects tokens signed with JWT_SECRET instead of dedicated SESSION_SECRET', () => {
    const jwtSignedToken = createSignedSessionToken('code_valid_123', Date.now(), DIFFERENT_JWT_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${jwtSignedToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects tokens signed with static insecure fallback string', () => {
    const fallbackToken = createSignedSessionToken('code_valid_123', Date.now(), 'access-session-secret-fallback');
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${fallbackToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  it('rejects tokens with tampered/modified signature bytes', () => {
    const validToken = createSignedSessionToken('code_valid_123', Date.now(), TEST_SESSION_SECRET);
    const tampered = validToken.slice(0, -2) + (validToken.endsWith('00') ? 'ff' : '00');
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${tampered}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBe('http://localhost/access-code?redirect=%2Fplay');
  });

  // ── 4. Valid Token Pass-Through ──

  it('allows access with a cryptographically valid, unexpired token signed with SESSION_SECRET', () => {
    const validToken = createSignedSessionToken('code_valid_123', Date.now() - 3600_000, TEST_SESSION_SECRET);
    const req = new NextRequest('http://localhost/play', {
      headers: { cookie: `access_session=${validToken}` },
    });
    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('handles URL-encoded cookie values seamlessly', () => {
    const validToken = createSignedSessionToken('code_valid_123', Date.now() - 3600_000, TEST_SESSION_SECRET);
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
});
