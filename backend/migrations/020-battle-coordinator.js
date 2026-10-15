export const id = '020-battle-coordinator';
export async function up(db) {
  await db.collection('battleMatchmakingLocks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'battle_matchmaking_lease_ttl' });
}
