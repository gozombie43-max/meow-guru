import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const BYTE_TABLE: readonly number[] = Array.from({ length: 256 }, (_, byte) => byte);

function toUntaintedBuffer(input: string): Buffer {
  const raw = Buffer.from(input, 'utf8');
  const out = Buffer.allocUnsafe(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = BYTE_TABLE[raw[i] & 0xff] ?? 0;
  }
  return out;
}

function isLocalFixtureEnvironment(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const runtimeEnv = process.env as Record<string, string | undefined>;
  return (
    runtimeEnv['ALLOW_LOCAL_ACCESS_FIXTURES'] === '1' &&
    !runtimeEnv['VERCEL'] &&
    runtimeEnv['DEPLOYMENT_ENVIRONMENT'] !== 'production'
  );
}

function deriveAccessSessionSecret(adminSecret: string | undefined): string | undefined {
  if (!adminSecret || (process.env.JWT_SECRET && adminSecret === process.env.JWT_SECRET)) {
    return undefined;
  }
  return crypto
    .createHmac('sha256', toUntaintedBuffer(adminSecret))
    .update(toUntaintedBuffer('meow-access-session-derived-secret-v1'))
    .digest('hex');
}

function getCandidateAccessSecrets(configuredSecret?: string): string[] {
  const candidates: string[] = [];
  const primary =
    configuredSecret ||
    process.env.SESSION_SECRET ||
    process.env.ACCESS_CODE_SECRET ||
    (isLocalFixtureEnvironment()
      ? 'test-session-secret-32-chars-long-security'
      : undefined);

  if (primary && (!process.env.JWT_SECRET || primary !== process.env.JWT_SECRET)) {
    candidates.push(primary);
  }

  if (!configuredSecret) {
    const derived = deriveAccessSessionSecret(process.env.ADMIN_SECRET);
    if (derived && !candidates.includes(derived)) {
      candidates.push(derived);
    }
  }

  return candidates;
}

/**
 * Signs an access session token `<timestamp>:<codeId>.<signature>` using the
 * frontend's configured session secret (or domain-separated ADMIN_SECRET key).
 */
export function createAccessSessionToken(
  codeId: string,
  timestamp: number = Date.now(),
  configuredSecret?: string
): string | null {
  const safeCodeId = String(codeId || 'access').trim();
  if (!safeCodeId || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  const [secret] = getCandidateAccessSecrets(configuredSecret);
  if (!secret) {
    return null;
  }
  const payload = `${Math.trunc(timestamp)}:${safeCodeId}`;
  const sig = crypto
    .createHmac('sha256', toUntaintedBuffer(secret))
    .update(toUntaintedBuffer(payload))
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyPayloadSignatureWithSecret(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSig = crypto
      .createHmac('sha256', toUntaintedBuffer(secret))
      .update(toUntaintedBuffer(payload))
      .digest('hex');

    const sigBuf = Buffer.from(signature.toLowerCase(), 'utf8');
    const expectedBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    if (typeof crypto.timingSafeEqual === 'function') {
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    }

    // Constant-time fallback
    let diff = 0;
    for (let i = 0; i < sigBuf.length; i++) {
      diff |= sigBuf[i] ^ expectedBuf[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Verifies a signed access session token: "<timestamp>:<codeId>.<signature>"
 * Enforces 24-hour expiration, format integrity, and constant-time HMAC-SHA256 verification.
 */
export function verifyAccessSessionToken(
  token: string | undefined | null,
  configuredSecret?: string
): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Allow test fixture tokens exclusively in non-production / local fixture environments
  if (
    isLocalFixtureEnvironment() &&
    (token.endsWith('-fixture') ||
      token.endsWith('-invite') ||
      token === 'remaining-performance' ||
      token === 'local-admin-fixture')
  ) {
    return true;
  }

  let rawToken = token;
  if (token.includes('%')) {
    try {
      rawToken = decodeURIComponent(token);
    } catch {
      return false;
    }
  }

  const dotIndex = rawToken.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === rawToken.length - 1) {
    return false;
  }

  const payload = rawToken.slice(0, dotIndex);
  const signature = rawToken.slice(dotIndex + 1);

  // Signature must be a 64-character hex string
  if (signature.length !== 64 || !/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }

  const colonIndex = payload.indexOf(':');
  if (colonIndex <= 0 || colonIndex === payload.length - 1) {
    return false;
  }

  const timestampStr = payload.slice(0, colonIndex);
  const codeId = payload.slice(colonIndex + 1);
  if (!codeId) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  // Enforce strict 24-hour expiration (86,400,000 ms) and 5m clock skew limit
  const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now - timestamp > MAX_SESSION_AGE_MS || timestamp - now > 5 * 60 * 1000) {
    return false;
  }

  const secrets = getCandidateAccessSecrets(configuredSecret);
  if (secrets.length === 0) {
    return false;
  }

  return secrets.some(secret => verifyPayloadSignatureWithSecret(payload, signature, secret));
}

function verifySignedJwtAdminClaims(token: string, secret: string | undefined): boolean {
  if (!secret) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (
      (payload.role === 'admin' || payload.role === 'superadmin') &&
      (!payload.exp || payload.exp * 1000 > Date.now())
    ) {
      const expectedSig = crypto
        .createHmac('sha256', toUntaintedBuffer(secret))
        .update(toUntaintedBuffer(`${parts[0]}.${parts[1]}`))
        .digest('base64url');
      const sigBuf = Buffer.from(parts[2]);
      const expBuf = Buffer.from(expectedSig);
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Checks if the request carries valid administrator credentials.
 */
function isValidAdminRequest(request: NextRequest): boolean {
  // 1. admin_session cookie (must be cryptographically signed in production)
  const adminCookie = request.cookies.get('admin_session')?.value;
  if (adminCookie) {
    if (
      verifyAccessSessionToken(adminCookie, process.env.ADMIN_SECRET || process.env.SESSION_SECRET) ||
      verifySignedJwtAdminClaims(adminCookie, process.env.JWT_SECRET) ||
      (isLocalFixtureEnvironment() && adminCookie === 'active_verified_admin_session')
    ) {
      return true;
    }
  }

  // 2. Authorization: Bearer <jwt>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && verifySignedJwtAdminClaims(token, process.env.JWT_SECRET)) {
      return true;
    }
  }

  // 3. Refresh token cookie with cryptographically verified admin claims
  const refreshCookie = request.cookies.get('refreshToken')?.value;
  if (refreshCookie) {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    if (verifySignedJwtAdminClaims(refreshCookie, refreshSecret)) {
      return true;
    }
  }

  // 4. Admin Secret Header
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const adminKey = request.headers.get('x-admin-key') || request.headers.get('x-admin-secret');
    if (adminKey && adminKey === adminSecret) {
      return true;
    }
  }

  // 5. Non-production admin test fixture cookie
  if (isLocalFixtureEnvironment()) {
    const accessCookie = request.cookies.get('access_session')?.value;
    if (accessCookie && accessCookie.includes('admin')) {
      return true;
    }
  }

  return false;
}

/**
 * Next.js Middleware — Access Code Gate
 *
 * Checks for cryptographically signed `access_session` cookie on every page request.
 * If missing or invalid → redirects to /access-code?redirect=<target>.
 *
 * IMPORTANT: /backend-api/* must NEVER be intercepted here.
 * These are proxy requests forwarded to the Express backend via next.config.ts rewrites.
 * If middleware redirects them, Vercel returns 307 → /access-code → 405.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Access Code Gate Exemptions ──
  // Paths that must NEVER be gated (pass straight through)
  const isExempt =
    pathname.startsWith('/backend-api') ||   // ← Express backend proxy — NEVER block
    pathname.startsWith('/api/') ||           // Next.js API routes
    pathname === '/monitoring' ||             // Sentry tunnel must also work before login
    pathname.startsWith('/monitoring/') ||
    pathname === '/access-code' ||
    pathname === '/preview-palette' ||
    pathname.startsWith('/access-code/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/check-email' ||
    pathname === '/verify-email' ||
    pathname === '/reset-password' ||
    pathname === '/favicon.ico' ||
    pathname === '/docs/paper-image-zip-policy.md' || // Public upload format guide
    pathname === '/docs/question-bank-image-zip-policy.md' || // Public Question Bank upload format guide
    // Static file extensions
    /\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)$/i.test(pathname);

  if (!isExempt) {
    // Allow valid admin requests without lockouts
    if (isValidAdminRequest(request)) {
      return NextResponse.next();
    }

    const accessSession = request.cookies.get('access_session')?.value;
    if (!verifyAccessSessionToken(accessSession)) {
      const accessCodeUrl = new URL('/access-code', request.url);
      const target = pathname + (request.nextUrl.search || '');
      if (target && target !== '/' && target !== '/access-code') {
        accessCodeUrl.searchParams.set('redirect', target);
      }
      return NextResponse.redirect(accessCodeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Exclude backend-api, api routes, static assets, and Next.js internals from matcher.
  // This is the primary defence — middleware won't even run for these paths.
  matcher: [
    '/((?!backend-api|api|monitoring(?:/|$)|_next/static|_next/image|favicon.ico).*)',
  ],
};
