export const id = '014-feed-keysets';
export async function up(db) {
  await db.collection('notificationFeed').createIndex({ audience: 1, userId: 1, createdAt: -1, _id: -1 });
  await db.collection('notificationFeed').createIndex({ createdAt: -1, _id: -1 });
  await db.collection('examUpdates').createIndex({ publishedAt: -1, _id: -1 });
  await db.collection('examUpdates').createIndex({ examSlug: 1, publishedAt: -1, _id: -1 });
}
