export const id = '003-production-hardening';

export async function up(db) {
  await db.collection('questions').createIndex({ id: 1 }, { name: 'question_id_lookup' });
  await db.collection('mockSlots').createIndex(
    { examSlug: 1, id: 1 },
    { unique: true, name: 'mock_slot_identity' },
  );
  await db.collection('mockAttempts').createIndex(
    { id: 1 },
    { unique: true, name: 'mock_attempt_identity' },
  );
  await db.collection('mockAttempts').createIndex(
    { userId: 1, examSlug: 1, testId: 1, startedAt: -1 },
    { name: 'mock_attempt_history' },
  );
  await db.collection('mockAttempts').createIndex(
    { examSlug: 1, testId: 1, status: 1, 'result.totalScore': 1 },
    { name: 'mock_attempt_percentile' },
  );
  await db.collection('mockAttempts').createIndex(
    { status: 1, deadlineAt: 1 },
    { name: 'mock_attempt_deadline' },
  );
  await db.collection('adaptiveQuizSessions').createIndex(
    { userId: 1, status: 1, createdAt: -1 },
    { name: 'adaptive_session_owner' },
  );
  await db.collection('adaptiveQuizSessions').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'adaptive_session_expiry' },
  );
  await db.collection('registrationLocks').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 900, name: 'registration_lock_expiry' },
  );
}
