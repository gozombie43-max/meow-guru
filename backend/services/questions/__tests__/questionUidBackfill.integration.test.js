import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { canonicalQuestionUid } from '../questionIdentity.js';
import {
  backfillMissingQuestionUids,
  ensureQuestionCanonicalIdentityIndex,
  verifyQuestionCanonicalIdentityIndex,
} from '../questionUidBackfill.js';
import * as migration028 from '../../../migrations/028-backfill-question-uids.js';
import { migrate } from '../../../migrations/runner.js';

describe('questionUidBackfill & migration 028', () => {
  let server;
  let client;
  let db;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    client = await new MongoClient(server.getUri()).connect();
    db = client.db('question_uid_backfill_test');
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await db.dropDatabase();
  });

  it('dry-runs without writes, backfills missing/blank UIDs using canonicalQuestionUid, preserves existing IDs, and is idempotent', async () => {
    const questions = db.collection('questions');
    const stagingId = new ObjectId('6a9bf2556b515a22c7f94639');
    const existingId = new ObjectId();
    const customUidId = new ObjectId();
    const nullUidId = new ObjectId();
    const blankUidId = new ObjectId();

    await questions.insertMany([
      {
        _id: stagingId,
        id: 'pinn_numbersystem_45',
        subject: 'mathematics',
        topic: 'number-system',
        selectionKey: 'bab25948cc430abc',
        question: 'Legacy missing questionUid',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
      },
      {
        _id: existingId,
        id: 'modern_1',
        questionUid: 'q_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        subject: 'mathematics',
        topic: 'algebra',
      },
      {
        _id: customUidId,
        id: 'custom_1',
        questionUid: 'custom_existing_uid_01',
        subject: 'mathematics',
        topic: 'geometry',
      },
      {
        _id: nullUidId,
        id: 'legacy_null',
        questionUid: null,
        subject: 'reasoning',
        topic: 'coding',
      },
      {
        _id: blankUidId,
        id: 'legacy_blank',
        questionUid: '   ',
        subject: 'reasoning',
        topic: 'series',
      },
    ]);

    // Dry-run performs zero writes.
    const dryRun = await backfillMissingQuestionUids(questions, { apply: false });
    expect(dryRun).toMatchObject({
      apply: false,
      total: 5,
      existing: 2,
      candidates: 3,
      matched: 0,
      modified: 0,
      skippedConcurrent: 0,
      collisions: [],
    });
    expect(dryRun.index).toMatchObject({ ok: false, exists: false, reason: 'missing_index' });
    expect((await questions.findOne({ _id: stagingId })).questionUid).toBeUndefined();

    // Apply persists exact canonical UIDs and never overwrites existing ones.
    const applied = await backfillMissingQuestionUids(questions, { apply: true });
    expect(applied).toMatchObject({
      apply: true,
      total: 5,
      existing: 2,
      candidates: 3,
      matched: 3,
      modified: 3,
      skippedConcurrent: 0,
      collisions: [],
    });

    const stagingDoc = await questions.findOne({ _id: stagingId });
    expect(stagingDoc.questionUid).toBe('q_9bdff06486fe9b21f07585ab75afeec5');
    expect(stagingDoc.questionUid).toBe(canonicalQuestionUid({ _id: stagingId }));
    expect(stagingDoc.selectionKey).toBe('bab25948cc430abc');
    expect(stagingDoc.id).toBe('pinn_numbersystem_45');

    expect((await questions.findOne({ _id: existingId })).questionUid).toBe(
      'q_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect((await questions.findOne({ _id: customUidId })).questionUid).toBe('custom_existing_uid_01');
    expect((await questions.findOne({ _id: nullUidId })).questionUid).toBe(
      canonicalQuestionUid({ _id: nullUidId }),
    );
    expect((await questions.findOne({ _id: blankUidId })).questionUid).toBe(
      canonicalQuestionUid({ _id: blankUidId }),
    );

    // Second run is a pure no-op.
    const secondRun = await backfillMissingQuestionUids(questions, { apply: true });
    expect(secondRun).toMatchObject({
      apply: true,
      total: 5,
      existing: 5,
      candidates: 0,
      matched: 0,
      modified: 0,
      collisions: [],
    });
  });

  it('aborts with zero writes when a derived canonical UID collides with an existing document', async () => {
    const questions = db.collection('questions');
    const legacyTargetId = new ObjectId('6a9bf2556b515a22c7f94639');
    const collidingUid = canonicalQuestionUid({ _id: legacyTargetId });
    const innocentLegacyId = new ObjectId();

    await questions.insertMany([
      { _id: legacyTargetId, id: 'pinn_numbersystem_45', topic: 'number-system' },
      { _id: new ObjectId(), id: 'already_claimed', questionUid: collidingUid, topic: 'algebra' },
      { _id: innocentLegacyId, id: 'innocent_legacy', topic: 'geometry' },
    ]);

    const dryRun = await backfillMissingQuestionUids(questions, { apply: false });
    expect(dryRun.collisions).toHaveLength(1);
    expect(dryRun.collisions[0]).toMatchObject({
      type: 'existing_collision',
      questionUid: collidingUid,
      candidateDocId: String(legacyTargetId),
    });

    await expect(backfillMissingQuestionUids(questions, { apply: true })).rejects.toMatchObject({
      code: 'QUESTION_UID_COLLISION',
    });

    // Zero writes must have happened — even the non-colliding legacy doc remains untouched.
    expect((await questions.findOne({ _id: legacyTargetId })).questionUid).toBeUndefined();
    expect((await questions.findOne({ _id: innocentLegacyId })).questionUid).toBeUndefined();
  });

  it('verifies and enforces the unique question_canonical_identity index via migration 028 and full migrate()', async () => {
    const questions = db.collection('questions');
    const legacyId = new ObjectId('6a9bf2556b515a22c7f94639');
    await questions.insertOne({
      _id: legacyId,
      id: 'pinn_numbersystem_45',
      subject: 'mathematics',
      topic: 'number-system',
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: '4',
    });

    await migrate(db);

    const doc = await questions.findOne({ _id: legacyId });
    expect(doc.questionUid).toBe('q_9bdff06486fe9b21f07585ab75afeec5');

    const idxReport = await verifyQuestionCanonicalIdentityIndex(questions);
    expect(idxReport).toMatchObject({
      ok: true,
      exists: true,
      name: 'question_canonical_identity',
      unique: true,
      key: { questionUid: 1 },
      partialFilterExpression: { questionUid: { $type: 'string' } },
      matchesExpected: true,
      reason: null,
    });

    // Duplicate questionUid insert is rejected by MongoDB unique index.
    await expect(
      questions.insertOne({ id: 'dup', questionUid: doc.questionUid }),
    ).rejects.toMatchObject({ code: 11000 });

    // Revision bumped because migration 028 modified legacy doc(s).
    const revDoc = await db.collection('questionMetadata').findOne({ _id: 'revision' });
    expect(revDoc?.revision).toBeGreaterThanOrEqual(1);

    // Re-running migration 028 directly is idempotent and does not bump revision again.
    const revBefore = revDoc.revision;
    await migration028.up(db);
    const revAfter = (await db.collection('questionMetadata').findOne({ _id: 'revision' })).revision;
    expect(revAfter).toBe(revBefore);
  });

  it('rejects a pre-existing non-unique questionUid index instead of silently accepting it', async () => {
    const questions = db.collection('questions');
    await questions.createIndex({ questionUid: 1 }, { name: 'broken_non_unique_uid' });

    const check = await verifyQuestionCanonicalIdentityIndex(questions);
    expect(check).toMatchObject({
      ok: false,
      exists: true,
      unique: false,
      reason: 'not_unique',
    });

    await expect(ensureQuestionCanonicalIdentityIndex(questions)).rejects.toMatchObject({
      code: 'INVALID_CANONICAL_IDENTITY_INDEX',
    });
  });
});
