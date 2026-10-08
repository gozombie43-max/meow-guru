import { MOCK_TEST_SLOTS } from '../config/exam-config.js';

export const id = '018-default-mock-slots';
export async function up(db) {
  // The runner reconciles indexes on every deployment. Seed data only once so
  // later intentional deletions do not reappear during ordinary deployments.
  if (await db.collection('schemaMigrations').findOne({ _id: id, completedAt: { $exists: true } })) return;
  const now = new Date().toISOString();
  for (let offset = 0; offset < MOCK_TEST_SLOTS.length; offset += 100) {
    await db.collection('mockSlots').bulkWrite(MOCK_TEST_SLOTS.slice(offset, offset + 100).map(slot => ({
      updateOne: {
        filter: { id: slot.id, examSlug: slot.examSlug },
        update: { $setOnInsert: { ...slot, type: slot.type || 'mock', createdAt: now, updatedAt: now } },
        upsert: true,
      },
    })), { ordered: false });
  }
}
