import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession, rotateSession, assertSession, revokeSession } from '../sessions.js';
import { verifyToken, signToken } from '../jwt.js';
import { acquireAiLease } from '../../middleware/aiAdmission.js';
let mongo, db;
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
it('enforces suspension, current role and rejects legacy stateless tokens', async () => {
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
