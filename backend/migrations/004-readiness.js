export const id = '004-readiness';
export async function up(db) {
  await db.collection('users').createIndex({ id: 1 }, { name: 'user_identity_lookup' });
  await db.collection('authSessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_session_expiry' });
  await db.collection('authSessions').createIndex({ userId: 1 }, { name: 'auth_session_owner' });
  await db.collection('mockAttempts').createIndex({ userId: 1, startKey: 1 }, {
    unique: true, partialFilterExpression: { startKey: { $type: 'string' } }, name: 'mock_start_idempotency',
  });
  await db.collection('aiLeases').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ai_lease_expiry' });
  await db.collection('mockAttempts').createIndex({ userId: 1, examSlug: 1, testId: 1 }, {
    unique: true, partialFilterExpression: { assessmentMode: 'confidential' }, name: 'confidential_single_attempt',
  });
}
