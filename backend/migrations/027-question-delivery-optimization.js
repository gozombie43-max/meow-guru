import { buildNormalizedQuestionFields } from '../services/questions/questionNormalizer.js';

export const id = '027-question-delivery-optimization';

const BACKFILL_BATCH_SIZE = 500;

const BACKFILL_PROJECTION = {
  _id: 1,
  id: 1,
  questionUid: 1,
  ingestionKey: 1,
  topic: 1,
  subject: 1,
  quizSubject: 1,
  quizTopic: 1,
  quizName: 1,
  quizId: 1,
  source: 1,
  questionType: 1,
  word: 1,
  meanings: 1,
  letter: 1,
  exam: 1,
  concept: 1,
  chapter: 1,
  chapterSlug: 1,
  topicGroup: 1,
  subjectId: 1,
  topicId: 1,
  year: 1,
  shift: 1,
};

const MISSING_NORMALIZED_FILTER = {
  $or: [
    { examKey: { $exists: false } },
    { conceptKey: { $exists: false } },
    { chapterKey: { $exists: false } },
    { topicGroupKey: { $exists: false } },
    { examModeKey: { $exists: false } },
    { yearInt: { $exists: false } },
    { shiftInt: { $exists: false } },
    { selectionKey: { $exists: false } },
    { topicKey: { $exists: false } },
    { subjectKey: { $exists: false } },
    { modeKey: { $exists: false } },
  ],
};

export function sameKeySpec(a, b) {
  if (!a || !b) return false;
  const entriesA = Object.entries(a);
  const entriesB = Object.entries(b);
  if (entriesA.length !== entriesB.length) return false;
  return entriesA.every(([k, v], idx) => entriesB[idx][0] === k && entriesB[idx][1] === v);
}

export const DROPPED_INDEXES_BY_COLLECTION = Object.freeze({
  questions: Object.freeze([
    // Strict prefixes of existing compound indexes from 001.
    { key: { topic: 1 } },
    { key: { subject: 1 } },
    // Superseded by questions_topic_mode_examKey_id / conceptKey / topicGroupKey.
    { name: 'question_topic_exam_mode', key: { topicKey: 1, exam: 1, modeKey: 1 } },
    { name: 'questions_topic_mode_exam_id', key: { topicKey: 1, modeKey: 1, exam: 1, _id: 1 } },
    { name: 'questions_topic_mode_concept_id', key: { topicKey: 1, modeKey: 1, concept: 1, _id: 1 } },
    { name: 'questions_topic_group_mode_id', key: { topicGroup: 1, modeKey: 1, _id: 1 } },
    // Legacy 005/007 training indexes superseded by 008/009 trainingExamSlugs indexes.
    { key: { exam: 1, subject: 1, topic: 1, updatedAt: -1 } },
    { key: { examName: 1, subject: 1, topic: 1, updatedAt: -1 } },
    { key: { exams: 1, subject: 1, topic: 1, updatedAt: -1 } },
    { name: 'training_quality_candidates', key: { exam: 1, subject: 1, difficulty: -1, discrimination: -1, updatedAt: -1 } },
    { name: 'training_topic_candidates', key: { exam: 1, topic: 1, difficulty: -1, updatedAt: -1 } },
  ]),
  adaptiveQuizSessions: Object.freeze([
    { name: 'adaptive_session_owner', key: { userId: 1, status: 1, createdAt: -1 } },
    { name: 'adaptive_session_expiry', key: { expiresAt: 1 } },
  ]),
});

export function isRetiredIndexCreate(collectionName, key, options = {}) {
  const specs = DROPPED_INDEXES_BY_COLLECTION[collectionName];
  if (!specs) return false;
  return specs.some(
    spec => (spec.name && options?.name === spec.name) || (spec.key && sameKeySpec(key, spec.key)),
  );
}

async function listIndexesSafe(collection) {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || /ns does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}

async function dropIndexesMatching(collection, specsToDrop) {
  const existing = await listIndexesSafe(collection);
  if (!existing.length) return 0;
  let dropped = 0;
  for (const index of existing) {
    if (index.name === '_id_') continue;
    const matched = specsToDrop.some(
      spec => (spec.name && index.name === spec.name) || (spec.key && sameKeySpec(index.key, spec.key)),
    );
    if (!matched) continue;
    try {
      await collection.dropIndex(index.name);
      dropped++;
    } catch (error) {
      if (error?.code === 27 || error?.code === 26 || /index not found|ns does not exist/i.test(error?.message || '')) {
        continue;
      }
      throw error;
    }
  }
  return dropped;
}

async function ensureIndex(collection, key, options = {}) {
  const existing = await listIndexesSafe(collection);
  if (options.name && existing.some(index => index.name === options.name)) return;
  if (existing.some(index => sameKeySpec(index.key, key))) return;
  try {
    await collection.createIndex(key, options);
  } catch (error) {
    if (error?.code === 85 || error?.code === 86 || /already exists/i.test(error?.message || '')) return;
    throw error;
  }
}

async function backfillNormalizedFields(questions) {
  let batch = [];
  let updated = 0;

  const flush = async () => {
    if (!batch.length) return;
    const ops = batch;
    batch = [];
    const result = await questions.bulkWrite(ops, { ordered: false });
    updated += result.modifiedCount || 0;
  };

  const cursor = questions
    .find(MISSING_NORMALIZED_FILTER, { projection: BACKFILL_PROJECTION })
    .batchSize(BACKFILL_BATCH_SIZE);

  for await (const doc of cursor) {
    const fields = buildNormalizedQuestionFields(doc);
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: fields },
      },
    });
    if (batch.length >= BACKFILL_BATCH_SIZE) {
      await flush();
    }
  }
  await flush();
  return updated;
}

export async function up(db) {
  const questions = db.collection('questions');

  // 1. Backfill exact-match normalized keys & selectionKey in bounded batches.
  await backfillNormalizedFields(questions);

  // 2. Drop redundant/obsolete indexes on `questions` and retired `adaptiveQuizSessions`.
  await dropIndexesMatching(questions, DROPPED_INDEXES_BY_COLLECTION.questions);
  await dropIndexesMatching(db.collection('adaptiveQuizSessions'), DROPPED_INDEXES_BY_COLLECTION.adaptiveQuizSessions);

  // 3. Create validated compound indexes on `questions`.
  const questionIndexes = [
    { key: { examModeKey: 1, topicKey: 1, modeKey: 1, _id: 1 }, name: 'questions_examMode_topic_mode_id' },
    { key: { topicKey: 1, modeKey: 1, examKey: 1, _id: 1 }, name: 'questions_topic_mode_examKey_id' },
    { key: { topicKey: 1, modeKey: 1, conceptKey: 1, _id: 1 }, name: 'questions_topic_mode_conceptKey_id' },
    { key: { topicKey: 1, modeKey: 1, selectionKey: 1, _id: 1 }, name: 'questions_topic_mode_selection_id' },
    { key: { examModeKey: 1, subjectKey: 1, modeKey: 1, selectionKey: 1, _id: 1 }, name: 'questions_examMode_subject_mode_selection_id' },
    { key: { topicKey: 1, chapterKey: 1, modeKey: 1, _id: 1 }, name: 'questions_topic_chapterKey_mode_id' },
    { key: { topicGroupKey: 1, modeKey: 1, _id: 1 }, name: 'questions_topicGroupKey_mode_id' },
  ];
  for (const { key, name } of questionIndexes) {
    await ensureIndex(questions, key, { name });
  }

  // 4. Register userQuestionProgress topic lookup index in migrations.
  await ensureIndex(
    db.collection('userQuestionProgress'),
    { userId: 1, topic: 1 },
    { name: 'userQuestionProgress_user_topic' },
  );

  // 5. Indexes for durable server-side quizSessions (Phase 4/6).
  const quizSessions = db.collection('quizSessions');
  await ensureIndex(quizSessions, { sessionId: 1 }, { unique: true, name: 'quizSessions_session_id' });
  await ensureIndex(quizSessions, { userId: 1, status: 1, updatedAt: -1 }, { name: 'quizSessions_user_status_updated' });
  await ensureIndex(quizSessions, { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'quizSessions_expires_ttl' });
}
