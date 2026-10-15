export const id = '019-battle-competitive-policy';
export async function up(db) {
  await db.collection('battleUserLeases').createIndex({ userId: 1 }, { unique: true });
  await db.collection('battleUserLeases').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('battleActionLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('battleQuestionHistory').createIndex({ userId: 1, playedAt: -1 });
  await db.collection('battleQuestionHistory').createIndex({ roomCode: 1, userId: 1, questionUid: 1 }, { unique: true });
  await db.collection('battleRooms').createIndex({ status: 1, questionAdvanceAt: 1 });
  for (const prefix of [{ subjectKey: 1 }, { subjectKey: 1, topicKey: 1 }]) {
    await db.collection('questions').createIndex({ ...prefix, rankedEligible: 1, battleLanguage: 1, battleMedia: 1, battleDifficulty: 1, battleSelectionKey: 1 });
  }
}
