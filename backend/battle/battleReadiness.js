import * as existing from '../migrations/001-existing-indexes.js';
import * as competitive from '../migrations/019-battle-competitive-policy.js';
import * as coordinator from '../migrations/020-battle-coordinator.js';

// Capture the declared index specifications without invoking a database write.
export async function inspectBattleReadiness(db, now = new Date()) {
  const required = [];
  for (const migration of [existing, competitive, coordinator]) await migration.up({ collection: name => ({
    createIndex: async (key, options = {}) => {
      if (name.startsWith('battle') || name === 'socketIoAdapterEvents' || (migration === competitive && name === 'questions')) required.push({ collection: name, key, options });
      return 'inspection-only';
    },
  }) });
  const indexes = new Map();
  for (const name of new Set(required.map(item => item.collection))) {
    try { indexes.set(name, await db.collection(name).listIndexes({ maxTimeMS: 5000 }).toArray()); }
    catch (error) { if (error.code !== 26) throw error; indexes.set(name, []); }
  }
  const missingIndexes = required.filter(expected => !indexes.get(expected.collection).some(actual =>
    JSON.stringify(actual.key) === JSON.stringify(expected.key)
    && Boolean(actual.unique) === Boolean(expected.options.unique)
    && Boolean(actual.sparse) === Boolean(expected.options.sparse)
    && actual.expireAfterSeconds === expected.options.expireAfterSeconds));
  const backlogBefore = new Date(+now - 60_000);
  const staleRooms = await db.collection('battleRooms').countDocuments({ status: { $in: ['waiting', 'active'] }, expiresAt: { $lte: backlogBefore } }, { maxTimeMS: 5000 });
  const staleTickets = await db.collection('battleMatchmakingQueue').countDocuments({ status: 'waiting', expiresAt: { $lte: backlogBefore } }, { maxTimeMS: 5000 });
  const unsettledRooms = await db.collection('battleRooms').countDocuments({ status: 'finished', resultRecordedAt: { $exists: false }, finishedAt: { $lte: backlogBefore } }, { maxTimeMS: 5000 });
  return { checkedAt: now.toISOString(), passed: !missingIndexes.length && !staleRooms && !staleTickets && !unsettledRooms,
    requiredIndexCount: required.length, missingIndexes, backlog: { staleRooms, staleTickets, unsettledRooms },
    scope: 'Database indexes and backlog only. Backup/restore, deployment, rollout and sustained remote load require separate evidence.' };
}
