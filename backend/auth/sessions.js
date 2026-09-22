import { randomUUID } from 'node:crypto';
import { getMongoDB, getUsersCollection } from '../config/mongodb.js';
import {
  signToken,
  signRefreshToken,
  signSessionRefreshToken,
  verifyRefreshToken,
  verifyLegacyRefreshToken,
} from './jwt.js';
import { getBattleRealtimeServer } from '../battle/battleRealtime.js';
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
    { projection: { id: 1, name: 1, email: 1, role: 1, status: 1 }, timeoutMS: 5000 },
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
    _id: sid, userId: String(user.id), refreshJti: decoded.jti,
    refreshIssuedAt: decoded.iat, expiresAt: new Date(decoded.exp * 1000), createdAt: new Date(),
  });
  return { token: signToken({ ...payload(currentUser), sid }), refreshToken };
}

import { LRUCache } from 'lru-cache';

const sessionCache = new LRUCache({ max: 5000, ttl: 60 * 1000 * 5 }); // 5 minutes

export async function assertSession(decoded) {
  if (!decoded?.sid || !decoded?.id) throw unauthorized();
  const cacheKey = `${decoded.sid}:${decoded.id}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return { ...decoded, ...cached };
  
  const session = await sessions().findOne(
    { _id: decoded.sid, userId: String(decoded.id), ...active(new Date()) },
    { projection: { _id: 1 }, timeoutMS: 5000 },
  );
  if (!session) throw unauthorized();
  
  const userPayload = payload(await activeUser(decoded.id));
  sessionCache.set(cacheKey, userPayload);
  return { ...decoded, ...userPayload };
}

export function evictSessionCache(sid, userId) {
  sessionCache.delete(`${sid}:${userId}`);
}

export function evictUserSessionCache(userId) {
  const suffix = `:${String(userId)}`;
  for (const key of sessionCache.keys()) {
    if (key.endsWith(suffix)) sessionCache.delete(key);
  }
}

export async function revokeUserSessions(userId, reason = 'admin-action') {
  const normalizedUserId = String(userId);
  const activeSessions = await sessions()
    .find({ userId: normalizedUserId, ...active(new Date()) }, { projection: { _id: 1 } })
    .toArray();
  await sessions().updateMany(
    { userId: normalizedUserId, ...active(new Date()) },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
  );
  evictUserSessionCache(normalizedUserId);
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
        await sessions().updateOne(filter, { $set: { revokedAt: now, revokeReason: 'refresh-reuse' } });
        evictSessionCache(decoded.sid, decoded.id);
        disconnectSession(decoded.sid);
      }
      throw unauthorized();
    }
  }
  return { token: signToken({ ...payload(user), sid: session._id }), refreshToken: signSessionRefreshToken(session) };
}

export async function revokeSession(decoded) {
  if (!decoded?.sid || !decoded?.id) return;
  await sessions().updateOne({ _id: decoded.sid, userId: String(decoded.id) }, { $set: { revokedAt: new Date(), revokeReason: 'logout' } });
  evictSessionCache(decoded.sid, decoded.id);
  disconnectSession(decoded.sid);
}
