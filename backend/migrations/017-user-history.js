export const id = '017-user-history';
export async function up(db) {
  for (const [name, field] of [['userQuizHistory', 'quizKey'], ['aiConversations', 'id'], ['userBookmarks', 'questionId']]) {
    await db.collection(name).createIndex({ userId: 1, [field]: 1 }, { unique: true });
    await db.collection(name).createIndex({ userId: 1, updatedAt: -1, _id: -1 });
  }
  await db.collection('aiMessages').createIndex({ userId: 1, conversationId: 1, position: 1 }, { unique: true });
  await db.collection('userAnalytics').createIndex({ userId: 1 }, { unique: true });
}
