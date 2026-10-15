import express from 'express';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { assertSession, createSession, rotateSession } from '../../auth/sessions.js';
import { verifyToken } from '../../auth/jwt.js';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../firebaseAuth.routes.js', () => ({ default: express.Router() }));
vi.mock('../../auth/passport.js', () => ({ default: { authenticate: () => (_req, _res, next) => next() } }));
vi.mock('../../services/email/emailService.js', () => ({ sendEmail: mocks.send }));

let mongo, db, server, baseUrl, oldPasswordHash;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'password_reset_route_tests');
  vi.stubEnv('REDIS_URL', '');
  db = await connectMongoDB();
  oldPasswordHash = await bcrypt.hash('OldPassword123!', 12);
  const { initAuthRoutes } = await import('../auth.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/auth', initAuthRoutes());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  mocks.send.mockReset().mockResolvedValue({ id: 'local-test-email' });
  await db.collection('users').deleteMany({});
  await db.collection('authSessions').deleteMany({});
  await db.collection('users').insertOne({ id: 'reset-user', name: 'Alice', role: 'student', authProvider: 'local',
    email: 'alice@example.test', emailNormalized: 'alice@example.test', emailVerified: false, passwordHash: oldPasswordHash });
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongoDB();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

const post = (path, body) => fetch(`${baseUrl}/auth/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
async function issueToken() {
  expect((await post('forgot-password', { email: 'Alice@example.test' })).status).toBe(200);
  const email = mocks.send.mock.calls.at(-1)[0];
  return new URL(email.text.slice('Reset your Meow password: '.length)).searchParams.get('token');
}

it('resets through the real routes and revokes all warmed access and refresh sessions', async () => {
  const sessions = await Promise.all([createSession({ id: 'reset-user' }), createSession({ id: 'reset-user' })]);
  for (const session of sessions) await expect(assertSession(verifyToken(session.token))).resolves.toMatchObject({ id: 'reset-user' });
  const token = await issueToken();
  const before = await db.collection('users').findOne({ id: 'reset-user' });
  expect(before.passwordResetTokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(before.passwordResetTokenHash).not.toBe(token);
  // A request during the account cooldown must not send or replace the token.
  await post('forgot-password', { email: 'alice@example.test' });
  expect(mocks.send).toHaveBeenCalledOnce();
  const reset = await post('reset-password', { token, password: 'NewPassword123!' });
  expect(reset.status).toBe(200);
  expect(await reset.json()).toEqual({ message: 'Password changed successfully' });
  expect(reset.headers.get('set-cookie')).toContain('refreshToken=;');
  const user = await db.collection('users').findOne({ id: 'reset-user' });
  expect(await bcrypt.compare('OldPassword123!', user.passwordHash)).toBe(false);
  expect(await bcrypt.compare('NewPassword123!', user.passwordHash)).toBe(true);
  expect(bcrypt.getRounds(user.passwordHash)).toBe(12);
  expect(user.passwordChangedAt).toBeInstanceOf(Date);
  expect(user.emailVerified).toBe(false);
  for (const key of ['passwordResetTokenHash', 'passwordResetExpiresAt', 'passwordResetLastSentAt']) expect(user).not.toHaveProperty(key);
  for (const session of sessions) {
    await expect(assertSession(verifyToken(session.token))).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateSession(session.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  }
  expect(await db.collection('authSessions').countDocuments({ revokeReason: 'password-reset' })).toBe(2);
  const reuse = await post('reset-password', { token, password: 'AnotherPassword123!' });
  expect(reuse.status).toBe(400);
  expect(await reuse.json()).toEqual({
    error: 'Password reset link is invalid or has expired', code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
  });
  expect(await db.collection('users').findOne({ id: 'reset-user' })).toEqual(user);
  expect(await db.collection('authSessions').countDocuments({ revokeReason: 'password-reset' })).toBe(2);
});

it('allows only one winner when two reset requests consume the same token', async () => {
  const token = await issueToken();
  const results = await Promise.all([
    post('reset-password', { token, password: 'FirstPassword123!' }),
    post('reset-password', { token, password: 'SecondPassword123!' }),
  ]);
  expect(results.map(response => response.status).sort()).toEqual([200, 400]);
  const user = await db.collection('users').findOne({ id: 'reset-user' });
  const winner = results[0].status === 200 ? 'FirstPassword123!' : 'SecondPassword123!';
  expect(await bcrypt.compare(winner, user.passwordHash)).toBe(true);
});

it.each(['expired', 'unknown'])('rejects an %s token without changing the password or existing sessions', async state => {
  const session = await createSession({ id: 'reset-user' });
  const token = await issueToken();
  if (state === 'expired') await db.collection('users').updateOne({ id: 'reset-user' }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1) } });
  const before = await db.collection('users').findOne({ id: 'reset-user' });
  const reset = await post('reset-password', { token: state === 'expired' ? token : 'unknown-reset-token', password: 'NewPassword123!' });
  expect(reset.status).toBe(400);
  expect(await reset.json()).toEqual({
    error: 'Password reset link is invalid or has expired', code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
  });
  expect(await db.collection('users').findOne({ id: 'reset-user' })).toEqual(before);
  await expect(assertSession(verifyToken(session.token))).resolves.toMatchObject({ id: 'reset-user' });
  await expect(rotateSession(session.refreshToken)).resolves.toHaveProperty('token');
});

it('returns identical recovery responses for real local, cooldown, OAuth, unknown, and malformed accounts', async () => {
  await db.collection('users').insertMany(['google', 'firebase'].map(authProvider => ({
    id: authProvider, authProvider, email: `${authProvider}@example.test`, emailNormalized: `${authProvider}@example.test`,
  })));
  const expected = { message: 'If an account exists for this email, password reset instructions will be sent.' };
  const bodies = [
    { email: 'alice@example.test' }, // Eligible local user.
    { email: 'alice@example.test' }, // Same account during cooldown.
    { email: 'google@example.test' }, { email: 'firebase@example.test' },
    { email: 'unknown@example.test' }, { email: 'invalid' }, { email: {} }, {},
  ];
  let firstHash;
  for (const body of bodies) {
    const response = await post('forgot-password', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expected);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    const user = await db.collection('users').findOne({ id: 'reset-user' });
    firstHash ??= user.passwordResetTokenHash;
    expect(user.passwordResetTokenHash).toBe(firstHash);
  }
  expect(mocks.send).toHaveBeenCalledOnce();
  expect(await db.collection('users').countDocuments({ authProvider: { $in: ['google', 'firebase'] }, passwordResetTokenHash: { $exists: true } })).toBe(0);
  expect(await db.collection('authSessions').countDocuments({})).toBe(0);
});
