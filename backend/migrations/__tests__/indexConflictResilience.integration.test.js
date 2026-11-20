import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as migration026 from '../026-mock-pyq-optimization.js';
import * as migration027 from '../027-question-delivery-optimization.js';
import { ensureIndex, listIndexesSafe, sameKeySpec, sameSemanticOptions } from '../indexUtils.js';
import { migrate, migrations } from '../runner.js';

describe('026 & 027 index conflict resilience', () => {
  let mongo;
  let client;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = await new MongoClient(mongo.getUri()).connect();
    db = client.db('migration_026_027_index_conflicts');
  }, 60000);

  beforeEach(async () => {
    await db.dropDatabase();
  });

  afterAll(async () => {
    await client?.close();
    await mongo?.stop();
  });

  it('survives production Atlas pre-existing default/differently-named indexes across full migrate(db) twice', async () => {
    // Reproduce setupProgressIndices.js default-named indexes on production Atlas.
    await db.collection('userTopicProgress').createIndex({ userId: 1, topic: 1 }, { unique: true });
    await db.collection('userQuestionProgress').createIndex({ userId: 1, topic: 1 });

    // Pre-existing differently-named equivalent indexes on collections touched by 026 and 027.
    await db.collection('mockSlots').createIndex({ id: 1 }, { name: 'legacy_mock_slots_id' });
    await db.collection('conceptGroupMetadata').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'legacy_concept_ttl' },
    );
    await db.collection('questions').createIndex(
      { topicKey: 1, year: -1, shift: 1, _id: 1 },
      { name: 'legacy_questions_year_shift' },
    );
    await db.collection('questions').createIndex(
      { examModeKey: 1, topicKey: 1, modeKey: 1, _id: 1 },
      { name: 'legacy_questions_examMode_topic' },
    );
    await db.collection('quizSessions').createIndex(
      { sessionId: 1 },
      { unique: true, name: 'legacy_quiz_session_id' },
    );

    // Run full migration suite twice to prove zero code 85/86 errors and full idempotency.
    await expect(migrate(db)).resolves.toBeUndefined();
    await expect(migrate(db)).resolves.toBeUndefined();

    expect(await db.collection('schemaMigrations').countDocuments({ completedAt: { $type: 'date' } })).toBe(
      migrations.length,
    );
    expect(await db.collection('schemaMigrationLocks').countDocuments({})).toBe(0);

    // Existing semantically equivalent indexes are preserved without rebuilding under a new name.
    const utpIndexes = await db.collection('userTopicProgress').listIndexes().toArray();
    expect(utpIndexes.find(idx => idx.name === 'userId_1_topic_1')).toMatchObject({
      key: { userId: 1, topic: 1 },
      unique: true,
    });
    expect(utpIndexes.find(idx => idx.name === 'user_topic_progress_user_topic')).toBeUndefined();

    const uqpIndexes = await db.collection('userQuestionProgress').listIndexes().toArray();
    expect(uqpIndexes.find(idx => idx.name === 'userId_1_topic_1')).toMatchObject({
      key: { userId: 1, topic: 1 },
    });
    expect(uqpIndexes.find(idx => idx.name === 'userQuestionProgress_user_topic')).toBeUndefined();

    const mockSlotIndexes = await db.collection('mockSlots').listIndexes().toArray();
    expect(mockSlotIndexes.find(idx => idx.name === 'legacy_mock_slots_id')).toMatchObject({ key: { id: 1 } });
    expect(mockSlotIndexes.find(idx => idx.name === 'mock_slots_catalog_lookup')).toBeDefined();
    expect(mockSlotIndexes.find(idx => idx.name === 'mock_slots_exam_order')).toBeDefined();

    const conceptIndexes = await db.collection('conceptGroupMetadata').listIndexes().toArray();
    expect(conceptIndexes.find(idx => idx.name === 'legacy_concept_ttl')).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(conceptIndexes.find(idx => idx.name === 'concept_group_worker_claim')).toBeDefined();
    expect(conceptIndexes.find(idx => idx.name === 'concept_group_scope_status')).toBeDefined();

    const questionIndexes = await db.collection('questions').listIndexes().toArray();
    expect(questionIndexes.find(idx => idx.name === 'legacy_questions_year_shift')).toMatchObject({
      key: { topicKey: 1, year: -1, shift: 1, _id: 1 },
    });
    expect(questionIndexes.find(idx => idx.name === 'legacy_questions_examMode_topic')).toMatchObject({
      key: { examModeKey: 1, topicKey: 1, modeKey: 1, _id: 1 },
    });
    expect(questionIndexes.find(idx => idx.name === 'questions_topic_mode_examKey_id')).toBeDefined();
    expect(questionIndexes.find(idx => idx.name === 'questions_topic_mode_selection_id')).toBeDefined();

    const quizSessionIndexes = await db.collection('quizSessions').listIndexes().toArray();
    expect(quizSessionIndexes.find(idx => idx.name === 'legacy_quiz_session_id')).toMatchObject({
      key: { sessionId: 1 },
      unique: true,
    });
    expect(quizSessionIndexes.find(idx => idx.name === 'quizSessions_user_status_updated')).toBeDefined();
    expect(quizSessionIndexes.find(idx => idx.name === 'quizSessions_expires_ttl')).toMatchObject({
      expireAfterSeconds: 0,
    });
  }, 60000);

  it('handles pre-existing non-unique userId_1_topic_1 on userTopicProgress safely without crashing db:migrate', async () => {
    await db.collection('userTopicProgress').createIndex({ userId: 1, topic: 1 });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(migration026.up(db)).resolves.toBeUndefined();
      await expect(migration027.up(db)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keeping existing index "userId_1_topic_1" on "userTopicProgress"'),
      );
    } finally {
      warnSpy.mockRestore();
    }

    const utpIndexes = await db.collection('userTopicProgress').listIndexes().toArray();
    expect(utpIndexes.some(idx => idx.name === 'userId_1_topic_1' && sameKeySpec(idx.key, { userId: 1, topic: 1 }))).toBe(
      true,
    );
  });

  it('falls back to default index name when desired name already belongs to a different key spec', async () => {
    await db.collection('mockSlots').createIndex({ legacyCode: 1 }, { name: 'mock_slots_id' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(migration026.up(db)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Index name "mock_slots_id" already exists on "mockSlots" with a different key spec'),
      );
    } finally {
      warnSpy.mockRestore();
    }

    const indexes = await db.collection('mockSlots').listIndexes().toArray();
    expect(indexes.some(idx => idx.name === 'mock_slots_id' && sameKeySpec(idx.key, { legacyCode: 1 }))).toBe(true);
    expect(indexes.some(idx => sameKeySpec(idx.key, { id: 1 }))).toBe(true);
  });

  it('compares semantic options accurately and handles NamespaceNotFound, code 85/86 races, and real errors', async () => {
    expect(
      sameSemanticOptions(
        { key: { a: 1 }, unique: true, partialFilterExpression: { x: 1, y: { b: 2, a: 1 } } },
        { unique: true, name: 'other_name', partialFilterExpression: { y: { a: 1, b: 2 }, x: 1 } },
      ),
    ).toBe(true);
    expect(sameSemanticOptions({ key: { a: 1 } }, { unique: true })).toBe(false);
    expect(sameSemanticOptions({ key: { a: 1 }, expireAfterSeconds: 60 }, { expireAfterSeconds: 0 })).toBe(false);
    expect(
      sameSemanticOptions(
        { key: { a: 1 }, collation: { locale: 'en', numericOrdering: true, strength: 2 } },
        { collation: { locale: 'en', numericOrdering: true, strength: 2 } },
      ),
    ).toBe(true);
    expect(
      sameSemanticOptions(
        { key: { a: 1 }, collation: { locale: 'en', numericOrdering: false } },
        { collation: { locale: 'en', numericOrdering: true } },
      ),
    ).toBe(false);

    // NamespaceNotFound (code 26) returns [] cleanly.
    const missingNsCol = {
      collectionName: 'missingNs',
      listIndexes: () => ({
        toArray: async () => {
          throw Object.assign(new Error('ns does not exist'), { code: 26 });
        },
      }),
    };
    await expect(listIndexesSafe(missingNsCol)).resolves.toEqual([]);

    // Concurrent code 85 IndexOptionsConflict is caught cleanly without failing migration.
    let calls = 0;
    const raceCol = {
      collectionName: 'userTopicProgress',
      listIndexes: () => ({
        toArray: async () => {
          calls += 1;
          return calls === 1 ? [] : [{ name: 'userId_1_topic_1', key: { userId: 1, topic: 1 }, unique: true }];
        },
      }),
      createIndex: vi.fn().mockRejectedValue(
        Object.assign(new Error('Index already exists with a different name: userId_1_topic_1'), { code: 85 }),
      ),
    };
    await expect(
      ensureIndex(raceCol, { userId: 1, topic: 1 }, { unique: true, name: 'user_topic_progress_user_topic' }),
    ).resolves.toBe('userId_1_topic_1');

    // Non-conflict errors (e.g. code 13 Unauthorized) are re-thrown.
    const authError = Object.assign(new Error('not authorized'), { code: 13 });
    const failingCol = {
      collectionName: 'questions',
      listIndexes: () => ({ toArray: async () => [] }),
      createIndex: vi.fn().mockRejectedValue(authError),
    };
    await expect(ensureIndex(failingCol, { a: 1 }, { name: 'q_a' })).rejects.toBe(authError);
  });
});
