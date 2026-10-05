export const id = '016-database-remediation';

export async function up(db) {
  await db.collection('questions').createIndex({ questionUid: 1 }, { unique: true, partialFilterExpression: { questionUid: { $type: 'string' } }, name: 'question_canonical_identity' });
  await db.collection('userQuestionProgress').createIndex({ userId: 1, questionUid: 1 }, { unique: true, partialFilterExpression: { questionUid: { $type: 'string' } }, name: 'canonical_user_question_progress' });
  // Legacy unique progress keys would still merge two different canonical questions.
  for (const index of await db.collection('userQuestionProgress').listIndexes().toArray()) {
    if (index.unique && JSON.stringify(index.key) === JSON.stringify({ userId: 1, questionId: 1 })) await db.collection('userQuestionProgress').dropIndex(index.name);
  }
  await db.collection('users').createIndex({ id: 1 }, { unique: true, partialFilterExpression: { accountRecord: true }, name: 'account_identity' });
  await db.collection('users').createIndex({ emailNormalized: 1 }, { unique: true, partialFilterExpression: { accountRecord: true, emailNormalized: { $type: 'string' } }, name: 'account_email_identity' });
  await db.collection('trainingSkillState').createIndex({ userId: 1, exam: 1, mastery: -1 }, { name: 'training_mastery_order' });
  await db.collection('mockAttempts').createIndex({ userId: 1, examSlug: 1, startedAt: -1, _id: -1 }, { name: 'mock_history_order' });
  await db.collection('battleProfiles').createIndex({ rating: -1, wins: -1, gamesPlayed: -1 }, { name: 'battle_ranking_order' });
  await db.collection('notes').createIndex({ id: 1 }, { unique: true, name: 'note_identity' });
  await db.collection('notes').createIndex({ updatedAt: -1, _id: -1 }, { name: 'note_listing' });
  for (const prefix of [{}, { subjectKey: 1 }, { topicKey: 1 }, { subjectKey: 1, topicKey: 1 }]) {
    await db.collection('questions').createIndex({ ...prefix, battleEligible: 1, battleSelectionKey: 1 });
  }
}
