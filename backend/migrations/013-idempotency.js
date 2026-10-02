export const id = '013-idempotency';
export async function up(db) {
  await db.collection('idempotencyRecords').createIndex({ expiresAt: 1 }, { name: 'idempotency_expiry', expireAfterSeconds: 0 });
}
