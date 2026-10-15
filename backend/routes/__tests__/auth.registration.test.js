import express from 'express';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), find: vi.fn(), lock: vi.fn(), unlock: vi.fn(),
  send: vi.fn(), session: vi.fn(), log: vi.fn(), verify: vi.fn(), replace: vi.fn(), authResult: null,
}));
vi.mock('../firebaseAuth.routes.js', () => ({ default: express.Router() }));
vi.mock('../../auth/passport.js', () => ({ default: { authenticate: (_strategy, _options, callback) => (_req, _res, next) => callback ? callback(...mocks.authResult) : next() } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('password-hash') } }));
vi.mock('../../auth/jwt.js', () => ({
  verifyToken: vi.fn(), verifyRefreshToken: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }),
}));
vi.mock('../../auth/sessions.js', () => ({
  createSession: mocks.session, rotateSession: vi.fn(), revokeSession: vi.fn(),
}));
vi.mock('../../repositories/authRegistrationRepository.js', () => ({
  insertRegisteredUser: mocks.insert, findUserByEmail: mocks.find,
  acquireRegistrationLock: mocks.lock, releaseRegistrationLock: mocks.unlock,
  verifyLocalUserEmailByTokenHash: mocks.verify,
  replaceEmailVerificationToken: mocks.replace,
}));
vi.mock('../../services/email/emailService.js', () => ({ sendEmail: mocks.send }));
vi.mock('../../infrastructure/runtimeLog.js', () => ({ runtimeLog: { error: mocks.log, warn: vi.fn() } }));

let server;
let baseUrl;
beforeAll(async () => {
  const { initAuthRoutes } = await import('../auth.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/auth', initAuthRoutes());
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(null);
  mocks.send.mockResolvedValue({ id: 'email-id' });
  mocks.session.mockResolvedValue({ token: 'access-token', refreshToken: 'refresh-token' });
  mocks.verify.mockResolvedValue({ modifiedCount: 1 });
  mocks.replace.mockResolvedValue(null);
  mocks.authResult = [null, false, { message: 'Invalid email or password' }];
});

const register = () => fetch(`${baseUrl}/auth/register`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '<b>Alice</b>', email: 'Alice@example.test', password: 'SecurePassword123!' }),
});

it('stores only the verification hash and emails the raw token without issuing a session', async () => {
  const before = Date.now();
  const response = await register();
  expect(response.status).toBe(201);
  const user = mocks.insert.mock.calls[0][0];
  const email = mocks.send.mock.calls[0][0];
  const link = new URL(email.text.split(': ').slice(1).join(': '));
  const rawToken = link.searchParams.get('token');
  expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
  expect(user.emailVerificationTokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
  expect(user.emailVerified).toBe(false);
  expect(user.emailVerificationLastSentAt).toBeInstanceOf(Date);
  expect(user.emailVerificationExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 1800000);
  expect(user.emailVerificationExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1800000);
  expect(JSON.stringify(user)).not.toContain(rawToken);
  expect(email.to).toBe('alice@example.test');
  expect(link.pathname).toBe('/verify-email');
  expect(email.html).toContain('&lt;b&gt;Alice&lt;/b&gt;');
  expect(email.html).not.toContain('<b>Alice</b>');
  expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  const body = await response.json();
  expect(body.verificationRequired).toBe(true);
  expect(body).not.toHaveProperty('token');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(mocks.session).not.toHaveBeenCalled();
  expect(JSON.stringify(body)).not.toContain(rawToken);
  expect(JSON.stringify(body)).not.toContain(user.emailVerificationTokenHash);
  expect(mocks.unlock).toHaveBeenCalledWith('alice@example.test');
});

it('keeps the account unverified without issuing a session when email sending fails', async () => {
  mocks.send.mockRejectedValue(new Error('provider error containing a secret link'));
  const response = await register();
  expect(response.status).toBe(201);
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.insert.mock.calls[0][0].emailVerified).toBe(false);
  expect(mocks.log).toHaveBeenCalledWith('Verification email failed');
});

it('does not generate or send verification mail for an existing account', async () => {
  mocks.find.mockResolvedValue({ id: 'existing' });
  const response = await register();
  expect(response.status).toBe(409);
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.session).not.toHaveBeenCalled();
});

const verify = (body) => fetch(`${baseUrl}/auth/verify-email`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

it('hashes the trimmed verification token and returns success without creating a session', async () => {
  const response = await verify({ token: '  secret-token  ' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: 'Email verified successfully', emailVerified: true });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.verify).toHaveBeenCalledWith(createHash('sha256').update('secret-token').digest('hex'));
  expect(mocks.session).not.toHaveBeenCalled();
});

it.each([{}, { token: '' }, { token: '   ' }, { token: 123 }, { token: {} }, { token: 'a'.repeat(257) }])(
  'rejects malformed verification input %j before querying persistence', async (body) => {
    const response = await verify(body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_VERIFICATION_TOKEN');
    expect(mocks.verify).not.toHaveBeenCalled();
  }
);

it('rejects expired, reused, or unknown verification tokens', async () => {
  mocks.verify.mockResolvedValue({ modifiedCount: 0 });
  const response = await verify({ token: 'expired-token' });
  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
});

it('handles repository failures without leaking verification secrets', async () => {
  mocks.verify.mockRejectedValue(new Error('sensitive query details'));
  const response = await verify({ token: 'secret-token' });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Unable to verify email' });
  expect(mocks.log).toHaveBeenCalledWith('Email verification error');
});

it('does not mutate verification state through GET', async () => {
  const response = await fetch(`${baseUrl}/auth/verify-email?token=secret-token`);
  expect(response.status).toBe(404);
  expect(mocks.verify).not.toHaveBeenCalled();
});

const login = () => fetch(`${baseUrl}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alice@example.test', password: 'SecurePassword123!' }),
});

it('returns 403 for an unverified local login without tokens or cookies', async () => {
  mocks.authResult = [null, false, { code: 'EMAIL_NOT_VERIFIED' }];
  const response = await login();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Please verify your email before signing in', code: 'EMAIL_NOT_VERIFIED' });
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(mocks.session).not.toHaveBeenCalled();
});

it('keeps invalid credentials generic', async () => {
  const response = await login();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Invalid email or password' });
  expect(mocks.session).not.toHaveBeenCalled();
});

it('still issues a session after successful authentication', async () => {
  mocks.authResult = [null, { id: 'verified', name: 'Alice', email: 'alice@example.test' }];
  const response = await login();
  expect(response.status).toBe(200);
  expect((await response.json()).token).toBe('access-token');
  expect(response.headers.get('set-cookie')).toContain('refreshToken=');
  expect(mocks.session).toHaveBeenCalledOnce();
});

const genericResendMessage = { message: 'If an unverified account exists for this email, a verification link will be sent.' };
const resend = (body) => fetch(`${baseUrl}/auth/resend-verification`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

it('rotates the hash and sends only the new raw token with a generic response', async () => {
  mocks.replace.mockResolvedValue({ id: 'alice', name: '<b>Alice</b>', email: 'alice@example.test' });
  const response = await resend({ email: ' Alice@Example.test ' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(genericResendMessage);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const email = mocks.send.mock.calls[0][0];
  const rawToken = new URL(email.text.slice('Verify your Meow account: '.length)).searchParams.get('token');
  expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.replace).toHaveBeenCalledWith({
    email: 'alice@example.test',
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: expect.any(Date),
  });
  expect(email.html).toContain('&lt;b&gt;Alice&lt;/b&gt;');
  expect(mocks.session).not.toHaveBeenCalled();
  expect(response.headers.get('set-cookie')).toBeNull();
});

it('returns the same response without sending for unknown, verified, OAuth, or cooldown accounts', async () => {
  const response = await resend({ email: 'someone@example.test' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(genericResendMessage);
  expect(mocks.send).not.toHaveBeenCalled();
});

it.each([{}, { email: 123 }, { email: {} }, { email: '' }, { email: 'invalid' }, { email: 'a'.repeat(255) }])(
  'returns the same response for invalid input %j without a database query', async (body) => {
    const response = await resend(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(genericResendMessage);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  }
);

it.each(['database', 'provider'])('hides %s failures and does not log secrets', async (failure) => {
  if (failure === 'database') mocks.replace.mockRejectedValue(new Error('secret query'));
  else {
    mocks.replace.mockResolvedValue({ email: 'alice@example.test' });
    mocks.send.mockRejectedValue(new Error('secret link'));
  }
  const response = await resend({ email: 'alice@example.test' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(genericResendMessage);
  expect(mocks.log).toHaveBeenCalledWith('Resend verification email failed');
});
