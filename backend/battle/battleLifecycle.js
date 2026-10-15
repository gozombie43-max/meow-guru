import { getMongoDB } from '../config/mongodb.js';

export class BattleBusyError extends Error {
  constructor() { super('Finish or leave your current battle before starting another.'); this.code = 'BATTLE_BUSY'; }
}
export const battleFailureMessage = (error, fallback) => ['BATTLE_BUSY', 'BATTLE_RATE_LIMIT', 'BATTLE_INVITATION', 'BATTLE_QUESTION_POOL'].includes(error?.code) ? error.message : fallback;

// _id is the authenticated user ID: MongoDB enforces exclusion across
// processes, tabs and devices. Callers hold the same transaction as the room
// or matchmaking-ticket mutation; a failed mutation cannot strand a lease.
export async function claimBattleLease({ userId, kind, resourceId, expiresAt, session, now = new Date() }) {
  const db = getMongoDB(), leases = db.collection('battleUserLeases'), id = String(userId);
  const existing = await leases.findOne({ _id: id }, { session });
  if (existing && new Date(existing.expiresAt) > now && (existing.kind !== kind || existing.resourceId !== resourceId)) {
    const occupied = existing.kind === 'room'
      ? await db.collection('battleRooms').findOne({ code: existing.resourceId, status: { $in: ['waiting', 'active'] }, expiresAt: { $gt: now } }, { session, projection: { _id: 1 } })
      : await db.collection('battleMatchmakingQueue').findOne({ userId: id, status: 'waiting', expiresAt: { $gt: now } }, { session, projection: { _id: 1 } });
    if (occupied) throw new BattleBusyError();
  }
  // Also fence rooms/tickets written by the previous release before leases
  // existed. Expired documents are ignored without depending on TTL timing.
  const oldRoom = await db.collection('battleRooms').findOne({ 'players.userId': id, status: { $in: ['waiting', 'active'] }, expiresAt: { $gt: now }, ...(kind === 'room' ? { code: { $ne: resourceId } } : {}) }, { session, projection: { code: 1 } });
  const oldTicket = await db.collection('battleMatchmakingQueue').findOne({ userId: id, status: 'waiting', expiresAt: { $gt: now } }, { session, projection: { userId: 1 } });
  if (oldRoom || (oldTicket && kind !== 'queue')) throw new BattleBusyError();
  await leases.updateOne({ _id: id }, { $set: { userId: id, kind, resourceId, expiresAt, updatedAt: now } }, { upsert: true, session });
}

export async function transferBattleLease({ userId, fromKind, fromResource, resourceId, expiresAt, session }) {
  const lease = await getMongoDB().collection('battleUserLeases').findOne({ _id: String(userId) }, { session });
  if (!lease) await claimBattleLease({ userId, kind: fromKind, resourceId: fromResource, expiresAt, session });
  const result = await getMongoDB().collection('battleUserLeases').updateOne({ _id: String(userId), kind: fromKind, resourceId: fromResource, expiresAt: { $gt: new Date() } }, { $set: { kind: 'room', resourceId, expiresAt, updatedAt: new Date() } }, { session });
  if (result.matchedCount !== 1) throw new BattleBusyError();
}

export async function releaseBattleLeases(kind, resourceId, { session } = {}) {
  await getMongoDB().collection('battleUserLeases').deleteMany({ kind, resourceId }, { session });
}

// Per-account durable rate limits cannot be reset by reconnecting or moving
// to a different application instance. Expiry only bounds storage usage.
export async function allowBattleAction(userId, action, limit, windowMs) {
  const now = Date.now(), bucket = Math.floor(now / windowMs);
  const collection = getMongoDB().collection('battleActionLimits');
  let record;
  try { record = await collection.findOneAndUpdate({ _id: `${String(userId)}:${action}:${bucket}` }, {
    $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
  }, { upsert: true, returnDocument: 'after' }); }
  catch (error) {
    if (error?.code !== 11000) throw error;
    record = await collection.findOneAndUpdate({ _id: `${String(userId)}:${action}:${bucket}` }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  }
  return record.count <= limit;
}
