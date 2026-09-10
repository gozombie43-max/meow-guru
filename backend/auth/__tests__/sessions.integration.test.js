import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession, rotateSession, assertSession, revokeSession } from '../sessions.js';
import { verifyToken, verifyRefreshToken, signToken, signRefreshToken } from '../jwt.js';
import { acquireAiLease } from '../../middleware/aiAdmission.js';
let mongo, db;
const legacyRefreshToken = () => jwt.sign(
  { id: 'user', email: 'old@example.com', role: 'admin', jti: 'legacy-refresh-jti' },
  process.env.REFRESH_TOKEN_SECRET || 'dev-fallback-refresh-secret-key-change-in-prod',
  { expiresIn: '30d' },
);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri(); process.env.MONGODB_DB = 'session_tests';
  db = await connectMongoDB();
}, 60000);
beforeEach(async () => {
  await db.collection('authSessions').deleteMany({}); await db.collection('users').deleteMany({});
  await db.collection('users').insertOne({ id: 'user', role: 'student' });
  await db.collection('aiLeases').deleteMany({});
});
afterAll(async () => { await disconnectMongoDB(); await mongo?.stop(); });
it('persists across connection restart and revokes access and refresh on logout', async () => {
  const tokens = await createSession({ id: 'user' });
  await disconnectMongoDB(); db = await connectMongoDB();
  await expect(assertSession(verifyToken(tokens.token))).resolves.toMatchObject({ id: 'user' });
  await revokeSession(verifyToken(tokens.token));
  await expect(assertSession(verifyToken(tokens.token))).rejects.toMatchObject({ statusCode: 401 });
  await expect(rotateSession(tokens.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
});
it('returns the same rotated cookie to simultaneous refreshes and detects later replay', async () => {
  const tokens = await createSession({ id: 'user' });
  const now = new Date();
  const refreshed = await Promise.all(Array.from({ length: 6 }, () => rotateSession(tokens.refreshToken, now)));
  expect(new Set(refreshed.map(value => value.refreshToken)).size).toBe(1);
  await expect(rotateSession(tokens.refreshToken, new Date(+now + 11000))).rejects.toMatchObject({ statusCode: 401 });
  await expect(assertSession(verifyToken(refreshed[0].token))).rejects.toMatchObject({ statusCode: 401 });
});
it('upgrades a valid legacy refresh token into a persisted session', async () => {
  const refreshed = await rotateSession(legacyRefreshToken(), new Date('2026-09-10T00:00:00.000Z'));
  const access = verifyToken(refreshed.token);
  const refresh = verifyRefreshToken(refreshed.refreshToken);

  expect(access).toMatchObject({ id: 'user', role: 'student', sid: refresh.sid });
  expect(refresh).toMatchObject({ id: 'user', type: 'refresh' });
  expect(await db.collection('authSessions').findOne({ _id: refresh.sid })).toMatchObject({
    userId: 'user',
    refreshJti: refresh.jti,
  });
});
it('rejects legacy refresh upgrades after the compatibility deadline', async () => {
  await expect(rotateSession(legacyRefreshToken(), new Date('2026-10-11T00:00:00.001Z')))
    .rejects.toMatchObject({ statusCode: 401 });
  expect(await db.collection('authSessions').countDocuments()).toBe(0);
});
it('does not treat a current stateless refresh token as legacy', async () => {
  await expect(rotateSession(signRefreshToken({ id: 'user' })))
    .rejects.toMatchObject({ statusCode: 401 });
  expect(await db.collection('authSessions').countDocuments()).toBe(0);
});
it('enforces suspension, current role and rejects stateless access tokens', async () => {
  const tokens = await createSession({ id: 'user' });
  await db.collection('users').updateOne({ id: 'user' }, { $set: { role: 'admin' } });
  expect((await assertSession(verifyToken(tokens.token))).role).toBe('admin');
  await db.collection('users').updateOne({ id: 'user' }, { $set: { status: 'suspended' } });
  await expect(assertSession(verifyToken(tokens.token))).rejects.toMatchObject({ statusCode: 401 });
  await expect(rotateSession(tokens.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  await expect(assertSession(verifyToken(signToken({ id: 'user' })))).rejects.toMatchObject({ statusCode: 401 });
});
it('limits concurrent AI work across instances and fences expired lease owners', async () => {
  const now = new Date();
  const first = await acquireAiLease('user', now);
  const second = await acquireAiLease('user', now);
  await expect(acquireAiLease('user', now)).rejects.toMatchObject({ statusCode: 429 });
  const recovered = await acquireAiLease('user', new Date(+now + 120001));
  await first();
  expect(await db.collection('aiLeases').countDocuments()).toBe(2);
  await recovered(); await second();
  expect(await db.collection('aiLeases').countDocuments()).toBe(0);
});
