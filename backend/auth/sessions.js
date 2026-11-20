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
import { AUTH_VALIDATION_COMMENT } from '../infrastructure/mongoOperationMetrics.js';
import { authRequests, authBurstLatency, observeCacheOperation } from '../infrastructure/metrics.js';
import { invalidateSocketAuthorization } from './socketInvalidation.js';
const disconnectSession = sid => getBattleRealtimeServer()?.in(`session:${sid}`).disconnectSockets(true);

// Stateless refresh tokens issued by the final legacy release live for at most
// 30 days. After this deadline, the compatibility path closes automatically.
const LEGACY_REFRESH_UPGRADE_DEADLINE = new Date('2026-10-11T00:00:00.000Z');

const sessions = () => getMongoDB().collection('authSessions');
const unauthorized = () => Object.assign(new Error('Session expired, please login again'), { statusCode: 401 });
const active = now => ({ revokedAt: { $exists: false }, expiresAt: { $gt: now } });
const payload = user => ({ id: String(user.id), email: user.email, name: user.name, role: user.role || 'student' });

async function activeUser(id, comment) {
  const user = await getUsersCollection().findOne(
    { id: String(id), type: { $ne: 'email_lock' } },
    { projection: { id: 1, name: 1, email: 1, role: 1, status: 1, authRevision: 1 }, timeoutMS: 5000, ...(comment ? { comment } : {}) },
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
const REVOCATION_MARKER_TTL_SECONDS = 25;
const NON_PRIVILEGED_ROLES = new Set(['student', 'user']);
const isNonPrivilegedRole = role => typeof role === 'string' && NON_PRIVILEGED_ROLES.has(role.trim().toLowerCase());

const sessionCache = new LRUCache({ max: 5000, ttl: SESSION_CACHE_TTL_MS });
// Local monotonic revocation tombstones fence in-flight Mongo reads from writing
// stale pre-revocation entries back into L1/Redis, even within the same millisecond.
let localRevocationEpoch = 0;
const sessionTombstones = new LRUCache({ max: 10000, ttl: SESSION_CACHE_TTL_MS + 10_000 });

// Both reads and revocations address the exact same v2 key so evictSessionCache /
// evictUserSessionCache reliably delete live Redis entries on logout or role change.
const sharedSessionKey = (sid, userId) => `auth-session:v2:${createHash('sha256').update(`${sid}:${userId}`).digest('hex')}`;
const revokedSidKey = (sid, userId) => `auth-revoked:v2:sid:${createHash('sha256').update(`${sid}:${userId}`).digest('hex')}`;
const revokedUserKey = userId => `auth-revoked:v2:user:${createHash('sha256').update(String(userId)).digest('hex')}`;

function recordLocalTombstone({ sid, userId }) {
  const epoch = ++localRevocationEpoch;
  if (sid && userId) sessionTombstones.set(`sid:${sid}:${String(userId)}`, epoch);
  else if (userId) sessionTombstones.set(`user:${String(userId)}`, epoch);
  return epoch;
}

function localTombstoneEpoch(sid, userId) {
  const sidEpoch = sessionTombstones.get(`sid:${sid}:${String(userId)}`) ?? 0;
  const userEpoch = sessionTombstones.get(`user:${String(userId)}`) ?? 0;
  return Math.max(sidEpoch, userEpoch);
}

const authorizationGeneration = (session, user) => createHash('sha256').update(
  JSON.stringify([session.revision ?? 0, user.authRevision ?? 0, payload(user)]),
).digest('hex');
async function authorizationState(decoded) {
  const [session, user] = await Promise.all([
    sessions().findOne(
      { _id: decoded.sid, userId: String(decoded.id), ...active(new Date()) },
      { projection: { _id: 1, revision: 1, expiresAt: 1 }, timeoutMS: 5000, comment: AUTH_VALIDATION_COMMENT },
    ),
    activeUser(decoded.id, AUTH_VALIDATION_COMMENT),
  ]);
  if (!session) throw unauthorized();
  return { session, user, generation: authorizationGeneration(session, user) };
}

let invalidationSubscriber;
let invalidationConnecting = null;
let invalidationRetry;
let stoppingInvalidationSubscriber = false;
let subscriberHealthy = false;

export function isSessionInvalidationSubscriberHealthy() {
  return subscriberHealthy;
}

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
    if (!redis) {
      if (process.env.REDIS_URL) {
        subscriberHealthy = false;
        reportRedisFailure();
      }
      return false;
    }
    await redis.publish(redisKey('auth-evictions'), JSON.stringify(message));
    return true;
  } catch {
    subscriberHealthy = false;
    reportRedisFailure();
    return false;
  }
}

async function writeRevocationMarker(key) {
  if (!process.env.REDIS_URL) return true;
  try {
    const stored = await redisSetJson(
      key,
      { token: randomUUID(), revokedAt: Date.now() },
      REVOCATION_MARKER_TTL_SECONDS,
    );
    if (stored === false) {
      subscriberHealthy = false;
      reportRedisFailure();
      return false;
    }
    return true;
  } catch {
    subscriberHealthy = false;
    reportRedisFailure();
    return false;
  }
}

async function readRevocationTokens(sid, userId) {
  if (!process.env.REDIS_URL) return { sidToken: null, userToken: null };
  const [sidMarker, userMarker] = await Promise.all([
    redisGetJson(revokedSidKey(sid, userId)),
    redisGetJson(revokedUserKey(userId)),
  ]);
  return {
    sidToken: typeof sidMarker?.token === 'string' ? sidMarker.token : null,
    userToken: typeof userMarker?.token === 'string' ? userMarker.token : null,
  };
}

export async function startSessionInvalidationSubscriber() {
  if (!process.env.REDIS_URL || invalidationSubscriber || stoppingInvalidationSubscriber) return;
  if (invalidationConnecting) return invalidationConnecting;
  invalidationConnecting = (async () => {
    let client;
    let subscribed = false;
    let needsResubscribe = false;
    const handleEvictionMessage = raw => {
      try {
        const event = JSON.parse(raw);
        if (event.userId || event.sid) invalidateSocketAuthorization(event);
        if (event.userId && event.sid) {
          recordLocalTombstone({ sid: event.sid, userId: event.userId });
          sessionCache.delete(`${event.sid}:${event.userId}`);
        } else if (event.userId) {
          recordLocalTombstone({ userId: event.userId });
          evictLocalUser(event.userId);
        }
      } catch { /* Ignore malformed messages. */ }
    };
    try {
      client = createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 1000, reconnectStrategy: retries => Math.min(1000 * 2 ** retries, 5000) },
      });
      client.on('error', () => {
        subscriberHealthy = false;
        needsResubscribe = true;
        sessionCache.clear();
        invalidateSocketAuthorization({ all: true, revalidate: true });
        reportRedisFailure();
      });
      client.on('reconnecting', () => {
        subscriberHealthy = false;
        needsResubscribe = true;
        sessionCache.clear();
        invalidateSocketAuthorization({ all: true, revalidate: true });
      });
      client.on('ready', () => {
        sessionCache.clear();
        invalidateSocketAuthorization({ all: true, revalidate: true });
        if (!subscribed || stoppingInvalidationSubscriber) {
          subscriberHealthy = false;
          return;
        }
        if (needsResubscribe) {
          subscriberHealthy = false;
          void client.subscribe(redisKey('auth-evictions'), handleEvictionMessage)
            .then(() => {
              if (invalidationSubscriber === client && !stoppingInvalidationSubscriber) {
                needsResubscribe = false;
                subscriberHealthy = true;
              }
            })
            .catch(() => {
              subscriberHealthy = false;
              reportRedisFailure();
            });
          return;
        }
        subscriberHealthy = true;
      });
      client.on('end', () => {
        subscriberHealthy = false;
        needsResubscribe = true;
        sessionCache.clear();
        invalidateSocketAuthorization({ all: true, revalidate: true });
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
      if (stoppingInvalidationSubscriber) {
        client.destroy();
        return;
      }
      await client.subscribe(redisKey('auth-evictions'), handleEvictionMessage);
      if (stoppingInvalidationSubscriber) {
        client.destroy();
        return;
      }
      subscribed = true;
      needsResubscribe = false;
      subscriberHealthy = true;
      invalidationSubscriber = client;
    } catch {
      subscriberHealthy = false;
      reportRedisFailure();
      client?.destroy();
      scheduleInvalidationRetry();
    }
  })();
  try {
    await invalidationConnecting;
  } finally {
    invalidationConnecting = null;
  }
}

export async function closeSessionInvalidationSubscriber() {
  stoppingInvalidationSubscriber = true;
  subscriberHealthy = false;
  clearTimeout(invalidationRetry);
  invalidationRetry = null;
  const client = invalidationSubscriber;
  invalidationSubscriber = null;
  if (client) client.destroy();
  if (invalidationConnecting) await invalidationConnecting;
}

const authorizationReads = createSingleFlight();
export async function assertSession(decoded, { forceFresh = false } = {}) {
  if (!decoded?.sid || !decoded?.id) throw unauthorized();
  authRequests.inc();
  const currentPayload = await authorizationReads(
    JSON.stringify([decoded.sid, String(decoded.id), Boolean(forceFresh)]),
    () => readAuthorization(decoded, { forceFresh }),
  );
  return { ...decoded, ...currentPayload };
}

async function readAuthorization(decoded, options = {}) {
  const started = performance.now();
  let cache = 'none', outcome = 'error';
  try {
    const result = await readAuthorizationPayload(decoded, value => { cache = value; }, options);
    outcome = 'success';
    return result;
  } finally {
    authBurstLatency.observe({ cache, outcome }, (performance.now() - started) / 1000);
  }
}

export function isFreshTrustedEntry(entry, nowMs = Date.now()) {
  return Boolean(
    entry &&
    entry.payload &&
    typeof entry.validUntil === 'number' &&
    Number.isFinite(entry.validUntil) &&
    entry.validUntil > nowMs &&
    typeof entry.sessionExpiresAt === 'number' &&
    Number.isFinite(entry.sessionExpiresAt) &&
    entry.sessionExpiresAt > nowMs,
  );
}

async function readAuthorizationPayload(decoded, recordCache, { forceFresh = false } = {}) {
  const userId = String(decoded.id);
  const cacheKey = `${decoded.sid}:${userId}`;
  const key = sharedSessionKey(decoded.sid, userId);

  // Fast path is strictly restricted to non-privileged roles when the auth-evictions
  // Pub/Sub subscriber is healthy. Privileged roles (admin/superadmin/moderator/editor)
  // always verify live state against MongoDB to enforce zero-window RBAC revocation.
  if (!forceFresh && subscriberHealthy && isNonPrivilegedRole(decoded.role)) {
    const nowMs = Date.now();
    const cached = sessionCache.get(cacheKey);
    if (
      isFreshTrustedEntry(cached, nowMs) &&
      isNonPrivilegedRole(cached.payload?.role) &&
      !(localTombstoneEpoch(decoded.sid, userId) > (cached.localEpoch ?? -1))
    ) {
      observeCacheOperation({ cache: 'auth-session', layer: 'l1', outcome: 'hit' });
      recordCache('local');
      return cached.payload;
    }
    const fastStartEpoch = localRevocationEpoch;
    const [shared, tokens] = await Promise.all([
      redisGetJson(key),
      readRevocationTokens(decoded.sid, userId),
    ]);
    const checkNow = Date.now();
    const tokenClean = (shared?.sidRevokeToken ?? null) === tokens.sidToken
      && (shared?.userRevokeToken ?? null) === tokens.userToken;
    if (
      isFreshTrustedEntry(shared, checkNow) &&
      isNonPrivilegedRole(shared.payload?.role) &&
      tokenClean &&
      !(localTombstoneEpoch(decoded.sid, userId) > fastStartEpoch)
    ) {
      const remaining = Math.min(shared.validUntil, shared.sessionExpiresAt) - checkNow;
      if (remaining > 0) {
        sessionCache.set(cacheKey, { ...shared, localEpoch: fastStartEpoch }, { ttl: remaining });
        observeCacheOperation({ cache: 'auth-session', layer: 'redis', outcome: 'hit' });
        recordCache('shared');
        return shared.payload;
      }
    }
    observeCacheOperation({ cache: 'auth-session', layer: 'redis', outcome: 'miss' });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const startEpoch = localRevocationEpoch;
    const tokensBefore = await readRevocationTokens(decoded.sid, userId);
    // Fallback / cold miss / privileged role / unhealthy subscriber: verify directly against MongoDB.
    const current = await authorizationState(decoded);
    const valid = entry => entry?.generation === current.generation && entry.validUntil > Date.now();
    if (!forceFresh) {
      const cached = sessionCache.get(cacheKey);
      if (valid(cached) && !(localTombstoneEpoch(decoded.sid, userId) > (cached.localEpoch ?? -1))) {
        observeCacheOperation({ cache: 'auth-session', layer: 'l1', outcome: 'hit' });
        recordCache('local');
        return cached.payload;
      }
    }
    const shared = forceFresh ? null : await redisGetJson(key);
    // Protect reads that were already in flight when logout/role removal committed.
    const after = await authorizationState(decoded);
    if (after.generation !== current.generation) continue;

    // Fence in-flight Mongo reads against concurrent local or cross-instance revocations
    // before writing anything back into L1 or Redis.
    if (localTombstoneEpoch(decoded.sid, userId) > startEpoch) continue;
    const tokensAfter = await readRevocationTokens(decoded.sid, userId);
    if (tokensAfter.sidToken !== tokensBefore.sidToken || tokensAfter.userToken !== tokensBefore.userToken) {
      continue;
    }

    const sessionExpiresAt = new Date(current.session.expiresAt).getTime();
    if (!Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now()) throw unauthorized();
    const sharedUsable = valid(shared)
      && isFreshTrustedEntry(shared, Date.now())
      && (shared.sidRevokeToken ?? null) === tokensAfter.sidToken
      && (shared.userRevokeToken ?? null) === tokensAfter.userToken;
    const entry = sharedUsable ? shared : {
      generation: current.generation,
      payload: payload(current.user),
      validUntil: Math.min(Date.now() + SESSION_CACHE_TTL_MS, sessionExpiresAt),
      sessionExpiresAt,
      ...(process.env.REDIS_URL ? { sidRevokeToken: tokensAfter.sidToken, userRevokeToken: tokensAfter.userToken } : {}),
    };
    const remaining = entry.validUntil - Date.now();
    if (remaining <= 0) throw unauthorized();
    if (localTombstoneEpoch(decoded.sid, userId) > startEpoch) continue;
    sessionCache.set(cacheKey, { ...entry, localEpoch: startEpoch }, { ttl: remaining });
    if (!sharedUsable) await redisSetJson(key, entry, Math.max(1, Math.ceil(remaining / 1000)));
    observeCacheOperation({ cache: 'auth-session', layer: sharedUsable ? 'redis' : 'source', outcome: sharedUsable ? 'hit' : 'miss' });
    recordCache(sharedUsable ? 'shared' : 'fresh');
    return entry.payload;
  }
  throw unauthorized();
}

export async function evictSessionCache(sid, userId) {
  const normalizedUserId = String(userId);
  recordLocalTombstone({ sid, userId: normalizedUserId });
  invalidateSocketAuthorization({ sid, userId: normalizedUserId });
  sessionCache.delete(`${sid}:${normalizedUserId}`);
  await writeRevocationMarker(revokedSidKey(sid, normalizedUserId));
  try {
    await redisDelete(sharedSessionKey(sid, normalizedUserId));
  } catch {
    subscriberHealthy = false;
    reportRedisFailure();
  }
  await publishSessionEviction({ sid, userId: normalizedUserId });
}

export async function evictUserSessionCache(userId) {
  const normalizedUserId = String(userId);
  recordLocalTombstone({ userId: normalizedUserId });
  // Also fences asynchronous readers when Redis is offline or delivery is lost.
  await getUsersCollection().updateOne({ id: normalizedUserId }, { $inc: { authRevision: 1 } });
  evictLocalUser(normalizedUserId);
  invalidateSocketAuthorization({ userId: normalizedUserId });
  getBattleRealtimeServer()?.in(`user:${normalizedUserId}`).disconnectSockets(true);
  if (!process.env.REDIS_URL) return;
  await writeRevocationMarker(revokedUserKey(normalizedUserId));
  const rows = await sessions().find({ userId: normalizedUserId }, { projection: { _id: 1 } }).toArray();
  try {
    await redisDelete(...rows.map(row => sharedSessionKey(row._id, normalizedUserId)));
  } catch {
    subscriberHealthy = false;
    reportRedisFailure();
  }
  await publishSessionEviction({ userId: normalizedUserId });
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
