import { ensureIndex } from './indexUtils.js';

export const id = '026-mock-pyq-optimization';

export async function up(db) {
  // 1. Mock slots lookup & catalog pagination indexes (eliminates COLLSCAN & blocking sorts).
  const mockSlots = db.collection('mockSlots');
  await ensureIndex(mockSlots, { id: 1 }, { name: 'mock_slots_id' });
  await ensureIndex(
    mockSlots,
    { examSlug: 1, type: 1, tier: 1, year: -1, order: 1, id: 1 },
    { name: 'mock_slots_catalog_lookup' },
  );
  await ensureIndex(
    mockSlots,
    { examSlug: 1, order: 1, id: 1 },
    { name: 'mock_slots_exam_order' },
  );

  // 2. User topic progress unique index (eliminates COLLSCAN & duplicate concurrent upserts).
  await ensureIndex(
    db.collection('userTopicProgress'),
    { userId: 1, topic: 1 },
    { unique: true, name: 'user_topic_progress_user_topic' },
  );

  // 3. Concept group worker & TTL indexes (eliminates 5s polling SORT <- COLLSCAN).
  const conceptMeta = db.collection('conceptGroupMetadata');
  await ensureIndex(
    conceptMeta,
    { kind: 1, status: 1, availableAt: 1, leaseUntil: 1 },
    { name: 'concept_group_worker_claim' },
  );
  await ensureIndex(
    conceptMeta,
    { 'scope.subject': 1, 'scope.topic': 1, 'scope.mode': 1, status: 1 },
    { name: 'concept_group_scope_status' },
  );
  await ensureIndex(
    conceptMeta,
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'concept_group_expires_ttl' },
  );

  // 4. PYQ Finder compound indexes on `questions` for 100k+ question scale.
  const questions = db.collection('questions');
  await ensureIndex(
    questions,
    { topicKey: 1, modeKey: 1, exam: 1, _id: 1 },
    { name: 'questions_topic_mode_exam_id' },
  );
  await ensureIndex(
    questions,
    { topicKey: 1, modeKey: 1, concept: 1, _id: 1 },
    { name: 'questions_topic_mode_concept_id' },
  );
  await ensureIndex(
    questions,
    { topicKey: 1, modeKey: 1, letter: 1, _id: 1 },
    { name: 'questions_topic_mode_letter_id' },
  );
  await ensureIndex(
    questions,
    { topicKey: 1, year: -1, shift: 1, _id: 1 },
    { name: 'questions_topic_year_shift_id' },
  );
  await ensureIndex(
    questions,
    { topicGroup: 1, modeKey: 1, _id: 1 },
    { name: 'questions_topic_group_mode_id' },
  );
}
