export const id = '002-runtime';
export async function up(db) {
  await db.collection('battleRooms').createIndex({ realtimeVersion: 1 }, { sparse: true });
  await db.collection('questions').createIndex({ ingestionKey: 1 }, { unique: true, sparse: true });
  await db.collection('questions').createIndex({ subjectKey: 1, modeKey: 1, _id: 1 });
  await db.collection('questions').createIndex({ topicKey: 1, modeKey: 1, _id: 1 });
  await db.collection('runtimeJobs').createIndex({ kind: 1, status: 1, availableAt: 1, leaseUntil: 1 });
  await db.collection('runtimeJobs').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('runtimeJobs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('rateLimits').createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 });
  await db.collection('runtimeHealth').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
