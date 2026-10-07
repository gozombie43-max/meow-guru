import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: null, session: null, values: new Map(), gate: null }));
vi.mock('redis', () => ({ createClient: vi.fn() }));
vi.mock('../../config/redis.js', () => ({
  redisGetJson: vi.fn(async key => state.values.get(key) ?? null),
  redisSetJson: vi.fn(async (key, value) => { state.values.set(key, value); }),
  redisDelete: vi.fn(async (...keys) => { keys.forEach(key => state.values.delete(key)); }),
  getRedisClient: vi.fn(async () => null), redisKey: key => key, reportRedisFailure: vi.fn(),
}));
vi.mock('../../battle/battleRealtime.js', () => ({ getBattleRealtimeServer: () => null }));
vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    findOne: async () => {
      const user = { ...state.user };
      if (state.gate) { const gate = state.gate; state.gate = null; await gate; }
      return user;
    },
    updateOne: async () => { state.user.authRevision++; return { modifiedCount: 1 }; },
  }),
  getMongoDB: () => ({ collection: () => ({
    findOne: async () => state.session.revokedAt || state.session.expiresAt <= new Date() ? null : { ...state.session },
    updateOne: async (_filter, update) => {
      Object.assign(state.session, update.$set); state.session.revision++; return { modifiedCount: 1 };
    },
    updateMany: async (_filter, update) => {
      Object.assign(state.session, update.$set); state.session.revision++; return { modifiedCount: 1 };
    },
    find: () => ({ toArray: async () => [{ ...state.session }] }),
  }) }),
}));
const decoded = { sid: 'session', id: 'learner', role: 'admin' };
import { redisGetJson } from '../../config/redis.js';
let sessions;
beforeEach(async () => {
  vi.resetModules();
  state.user = { id: 'learner', role: 'admin', authRevision: 0 };
  state.session = { _id: 'session', revision: 0, expiresAt: new Date(Date.now() + 60000) };
  state.values.clear(); state.gate = null;
  sessions = await import('../sessions.js');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('rejects an auth read that finishes after logout and never accepts its old cache entry', async () => {
  let release;
  state.gate = new Promise(resolve => { release = resolve; });
  const pending = sessions.assertSession(decoded);
  await vi.waitFor(() => expect(state.gate).toBeNull());
  await sessions.revokeSession(decoded);
  release();
  await expect(pending).rejects.toMatchObject({ statusCode: 401 });
  await expect(sessions.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.values.size).toBe(0);
  expect(state.session.revision).toBe(1);
});

it('rechecks privileges after a role removal overlaps an auth read', async () => {
  let release;
  state.gate = new Promise(resolve => { release = resolve; });
  const pending = sessions.assertSession(decoded);
  await vi.waitFor(() => expect(state.gate).toBeNull());
  state.user.role = 'student';
  await sessions.evictUserSessionCache('learner');
  release();
  expect((await pending).role).toBe('student');
  expect((await sessions.assertSession(decoded)).role).toBe('student');
});

it('rejects revocation and suspension on another instance without Pub/Sub delivery', async () => {
  await sessions.assertSession(decoded);
  vi.resetModules();
  const other = await import('../sessions.js');
  await other.assertSession(decoded);
  await sessions.revokeUserSessions('learner', 'password-reset');
  await expect(other.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
  delete state.session.revokedAt;
  state.user.status = 'suspended';
  await expect(other.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
});

it('uses the current role even when a remote instance misses its eviction message', async () => {
  await sessions.assertSession(decoded);
  state.user.role = 'student'; state.user.authRevision++;
  expect((await sessions.assertSession(decoded)).role).toBe('student');
});

it('coalesces concurrent authorization reads while preserving each request claim', async () => {
  vi.mocked(redisGetJson).mockClear();
  const results = await Promise.all(Array.from({ length: 100 }, (_, request) => sessions.assertSession({ ...decoded, request })));
  expect(redisGetJson).toHaveBeenCalledTimes(1);
  expect(results.map(result => result.request)).toEqual(Array.from({ length: 100 }, (_, index) => index));
  expect(results.every(result => result.role === 'admin')).toBe(true);
});

it('preserves the original freshness deadline when a second instance reads Redis', async () => {
  vi.useFakeTimers();
  await sessions.assertSession(decoded);
  const originalDeadline = [...state.values.values()][0].validUntil;
  vi.resetModules();
  const other = await import('../sessions.js');
  await vi.advanceTimersByTimeAsync(14000);
  await other.assertSession(decoded);
  expect([...state.values.values()][0].validUntil).toBe(originalDeadline);
  await vi.advanceTimersByTimeAsync(1001);
  await other.assertSession(decoded);
  expect([...state.values.values()][0].validUntil).toBeGreaterThan(originalDeadline);
});
