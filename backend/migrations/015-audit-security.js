import { noteImageKeys } from '../services/notes/imageKeys.js';
export const id = '015-audit-security';

export async function up(db) {
  await db.collection('notes').createIndex({ imageKeys: 1 });
  await db.collection('noteImages').createIndex({ cleanupAfter: 1, state: 1 });
  await db.collection('tutorSlots').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('tutorDailyUsage').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('tutorObjects').createIndex({ cleanupAfter: 1 });
  // Backfill only missing references; existing saves keep ownership of their keys.
  for await (const note of db.collection('notes').find({ imageKeys: { $exists: false } }, { projection: { body: 1 } })) {
    await db.collection('notes').updateOne({ _id: note._id, imageKeys: { $exists: false } }, { $set: { imageKeys: noteImageKeys(note.body) } });
  }
}
