import { createHash, randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { LRUCache } from 'lru-cache';
import { getMongoDB, getUsersCollection } from '../config/mongodb.js';
import { getRedisClient, redisDelete, redisGetJson, redisKey, redisSetJson, reportRedisFailure } from '../config/redis.js';
import {
  signToken,
  signRefreshToken,
  signSessionRefreshToken,
  verifyRefreshToken,
  verifyLegacyRefreshToken,
} from './jwt.js';
import { getBattleRealtimeServer } from '../battle/battleRealtime.js';
import { createSingleFlight } from '../infrastructure/singleFlight.js';
const disconnectSession = sid => getBattleRealtimeServer()?.in(`session:${sid}`).disconnectSockets(true);

// Stateless refresh tokens issued by the final legacy release live for at most
// 30 days. After this deadline, the compatibility path closes automatically.
const LEGACY_REFRESH_UPGRADE_DEADLINE = new Date('2026-10-11T00:00:00.000Z');

const sessions = () => getMongoDB().collection('authSessions');
const unauthorized = () => Object.assign(new Error('Session expired, please login again'), { statusCode: 401 });
const active = now => ({ revokedAt: { $exists: false }, expiresAt: { $gt: now } });
const payload = user => ({ id: String(user.id), email: user.email, name: user.name, role: user.role || 'student' });

async function activeUser(id) {
  const user = await getUsersCollection().findOne(
    { id: String(id), type: { $ne: 'email_lock' } },
    { projection: { id: 1, name: 1, email: 1, role: 1, status: 1, authRevision: 1 }, timeoutMS: 5000 },
  );
  if (!user || ['suspended', 'banned'].includes(user.status)) throw unauthorized();
  return user;
}

export async function createSession(user) {
  const currentUser = await activeUser(user.id);
  const sid = randomUUID();
  const refreshToken = signRefreshToken({ id: String(user.id), sid });
  const decoded = verifyRefreshToken(refreshToken);
  await sessions().insertOne({
    _id: sid, userId: String(user.id), refreshJti: decoded.jti, revision: 0,
    refreshIssuedAt: decoded.iat, expiresAt: new Date(decoded.exp * 1000), createdAt: new Date(),
  });
  return { token: signToken({ ...payload(currentUser), sid }), refreshToken };
}

const SESSION_CACHE_TTL_MS = 15_000;
const sessionCache = new LRUCache({ max: 5000, ttl: SESSION_CACHE_TTL_MS });
const sharedSessionKey = (sid, userId) => `auth-session:${createHash('sha256').update(`${sid}:${userId}`).digest('hex')}`;
const authorizationGeneration = (session, user) => createHash('sha256').update(
  JSON.stringify([session.revision ?? 0, user.authRevision ?? 0, payload(user)]),
).digest('hex');
const revisionedSessionKey = (sid, userId, generation) => `auth-session:v2:${createHash('sha256').update(JSON.stringify([sid, String(userId), generation])).digest('hex')}`;
async function authorizationState(decoded) {
  const [session, user] = await Promise.all([
    sessions().findOne(
      { _id: decoded.sid, userId: String(decoded.id), ...active(new Date()) },
      { projection: { _id: 1, revision: 1, expiresAt: 1 }, timeoutMS: 5000 },
    ),
    activeUser(decoded.id),
  ]);
  if (!session) throw unauthorized();
  return { session, user, generation: authorizationGeneration(session, user) };
}

let invalidationSubscriber;
let invalidationRetry;
let stoppingInvalidationSubscriber = false;

function scheduleInvalidationRetry() {
  if (stoppingInvalidationSubscriber || invalidationRetry || !process.env.REDIS_URL) return;
  invalidationRetry = setTimeout(() => {
    invalidationRetry = null;
    void startSessionInvalidationSubscriber();
  }, 30_000);
  invalidationRetry.unref();
}

function evictLocalUser(userId) {
  const suffix = `:${String(userId)}`;
  for (const key of sessionCache.keys()) {
    if (key.endsWith(suffix)) sessionCache.delete(key);
  }
}

async function publishSessionEviction(message) {
  try {
    const redis = await getRedisClient();
    if (redis) await redis.publish(redisKey('auth-evictions'), JSON.stringify(message));
  } catch { reportRedisFailure(); }
}

export async function startSessionInvalidationSubscriber() {
  if (!process.env.REDIS_URL || invalidationSubscriber || stoppingInvalidationSubscriber) return;
  let client;
  try {
    client = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 1000, reconnectStrategy: retries => Math.min(1000 * 2 ** retries, 5000) },
    });
    client.on('error', () => { sessionCache.clear(); reportRedisFailure(); });
    client.on('ready', () => sessionCache.clear());
    client.on('end', () => {
      sessionCache.clear();
      if (invalidationSubscriber === client) invalidationSubscriber = null;
      scheduleInvalidationRetry();
    });
    let timer;
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Redis subscriber connection timed out')), 3000); }),
      ]);
    } finally { clearTimeout(timer); }
    await client.subscribe(redisKey('auth-evictions'), raw => {
      try {
        const event = JSON.parse(raw);
        if (event.userId && event.sid) sessionCache.delete(`${event.sid}:${event.userId}`);
        else if (event.userId) evictLocalUser(event.userId);
      } catch { /* Ignore malformed messages. */ }
    });
    invalidationSubscriber = client;
  } catch {
    reportRedisFailure();
    client?.destroy();
    scheduleInvalidationRetry();
  }
}

export async function closeSessionInvalidationSubscriber() {
  stoppingInvalidationSubscriber = true;
  clearTimeout(invalidationRetry);
  invalidationRetry = null;
  const client = invalidationSubscriber;
  invalidationSubscriber = null;
  if (client) client.destroy();
}

const authorizationReads = createSingleFlight();
export async function assertSession(decoded) {
  if (!decoded?.sid || !decoded?.id) throw unauthorized();
  const currentPayload = await authorizationReads(JSON.stringify([decoded.sid, String(decoded.id)]), () => readAuthorization(decoded));
  return { ...decoded, ...currentPayload };
}

async function readAuthorization(decoded) {
  const cacheKey = `${decoded.sid}:${decoded.id}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Redis is never the authority for revocation or current account privileges.
    const current = await authorizationState(decoded);
    const valid = entry => entry?.generation === current.generation && entry.validUntil > Date.now();
    const cached = sessionCache.get(cacheKey);
    if (valid(cached)) return cached.payload;
    const key = revisionedSessionKey(decoded.sid, decoded.id, current.generation);
    const shared = await redisGetJson(key);
    // Protect reads that were already in flight when logout/role removal committed.
    const after = await authorizationState(decoded);
    if (after.generation !== current.generation) continue;
    const entry = valid(shared) ? shared : {
      generation: current.generation,
      payload: payload(current.user),
      validUntil: Math.min(Date.now() + SESSION_CACHE_TTL_MS, new Date(current.session.expiresAt).getTime()),
    };
    const remaining = entry.validUntil - Date.now();
    if (remaining <= 0) throw unauthorized();
    sessionCache.set(cacheKey, entry, { ttl: remaining });
    if (!valid(shared)) await redisSetJson(key, entry, Math.max(1, Math.ceil(remaining / 1000)));
    return entry.payload;
  }
  throw unauthorized();
}

export async function evictSessionCache(sid, userId) {
  sessionCache.delete(`${sid}:${userId}`);
  await redisDelete(sharedSessionKey(sid, userId));
  await publishSessionEviction({ sid, userId: String(userId) });
}

export async function evictUserSessionCache(userId) {
  // Also fences asynchronous readers when Redis is offline or delivery is lost.
  await getUsersCollection().updateOne({ id: String(userId) }, { $inc: { authRevision: 1 } });
  evictLocalUser(userId);
  if (!process.env.REDIS_URL) return;
  const rows = await sessions().find({ userId: String(userId) }, { projection: { _id: 1 } }).toArray();
  await redisDelete(...rows.map(row => sharedSessionKey(row._id, userId)));
  await publishSessionEviction({ userId: String(userId) });
}

export async function revokeUserSessions(userId, reason = 'admin-action') {
  const normalizedUserId = String(userId);
  const activeSessions = await sessions()
    .find({ userId: normalizedUserId, ...active(new Date()) }, { projection: { _id: 1 } })
    .toArray();
  await sessions().updateMany(
    { userId: normalizedUserId, ...active(new Date()) },
    { $set: { revokedAt: new Date(), revokeReason: reason }, $inc: { revision: 1 } },
  );
  await evictUserSessionCache(normalizedUserId);
  for (const session of activeSessions) disconnectSession(session._id);
}

export async function rotateSession(refreshToken, now = new Date()) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    if (error.message !== 'Invalid refresh token purpose' || now > LEGACY_REFRESH_UPGRADE_DEADLINE) throw error;
    const legacy = verifyLegacyRefreshToken(refreshToken);
    return createSession({ id: legacy.id });
  }
  if (!decoded.sid || !decoded.id) throw unauthorized();
  const user = await activeUser(decoded.id);
  const filter = { _id: decoded.sid, userId: String(decoded.id), ...active(now) };
  let session = await sessions().findOneAndUpdate(
    { ...filter, refreshJti: decoded.jti },
    { $set: { previousJti: decoded.jti, previousValidUntil: new Date(+now + 10_000), refreshJti: randomUUID(), refreshIssuedAt: Math.floor(+now / 1000) } },
    { returnDocument: 'after' },
  );
  if (!session) {
    session = await sessions().findOne(filter);
    // A short grace window returns exactly the same rotated cookie, accommodating
    // parallel tabs or a lost response. It never extends session lifetime.
    if (!session || session.previousJti !== decoded.jti || session.previousValidUntil <= now) {
      if (session) {
        await sessions().updateOne(filter, { $set: { revokedAt: now, revokeReason: 'refresh-reuse' }, $inc: { revision: 1 } });
        await evictSessionCache(decoded.sid, decoded.id);
        disconnectSession(decoded.sid);
      }
      throw unauthorized();
    }
  }
  return { token: signToken({ ...payload(user), sid: session._id }), refreshToken: signSessionRefreshToken(session) };
}

export async function revokeSession(decoded) {
  if (!decoded?.sid || !decoded?.id) return;
  await sessions().updateOne({ _id: decoded.sid, userId: String(decoded.id) }, { $set: { revokedAt: new Date(), revokeReason: 'logout' }, $inc: { revision: 1 } });
  await evictSessionCache(decoded.sid, decoded.id);
  disconnectSession(decoded.sid);
}
