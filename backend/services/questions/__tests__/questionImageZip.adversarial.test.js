import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import JSZip from 'jszip';
import sharp from 'sharp';

// Hoist mocks for storage infrastructure
const { putObject, deleteObject } = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../../../infrastructure/objectStorage.js', () => ({
  putObject,
  deleteObject,
  stableImageUrl: key => `/api/upload/image/${Buffer.from(key).toString('base64url')}`,
}));

import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../../../config/mongodb.js';
import { processQuestionBankImageZip } from '../questionImageZip.js';
import { assertQuestionExamMode } from '../questionExamMode.js';

let mongo;
let db;

const STAMP_T0 = '2026-10-23T00:00:00.000Z';
const STAMP_T1 = '2026-10-23T01:30:00.000Z';

const sampleQuestions = [
  {
    id: 'ssc_adv_1',
    questionUid: 'q_ssc_0000000000000000000000000011',
    subject: 'mathematics',
    topic: 'trigonometry',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'Evaluate $\\sin^2(30^\\circ) + \\cos^2(30^\\circ)$',
    options: ['0', '1', '1/2', '2'],
    correctAnswer: 1,
    solution: '### Identity\nUsing $\\sin^2\\theta + \\cos^2\\theta = 1$:\n- Here $\\theta = 30^\\circ$\n- Result is 1.',
    translations: {
      bn: {
        question: 'মান নির্ণয় কর: $\\sin^2(30^\\circ) + \\cos^2(30^\\circ)$',
        options: ['০', '১', '১/২', '২'],
        solution: 'ত্রিকোণমিতিক সূত্র অনুযায়ী মান ১।',
      },
    },
    updatedAt: STAMP_T0,
  },
  {
    id: 'ssc_adv_2',
    questionUid: 'q_ssc_0000000000000000000000000012',
    subject: 'reasoning',
    topic: 'coding-decoding',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'If CAT = 24, DOG = 26, then PIG = ?',
    options: ['32', '34', '36', '38'],
    correctAnswer: 0,
    solution: 'Sum of letter positions:\nP(16) + I(9) + G(7) = 32.\n\n![solution](/api/upload/image/old_solution_key_123)',
    solutionImage: '/api/upload/image/old_solution_key_123',
    solutionImageKey: 'question-images/old/sol_old.webp',
    updatedAt: STAMP_T0,
  },
  {
    id: 'ssc_adv_empty_sol',
    questionUid: 'q_ssc_0000000000000000000000000013',
    subject: 'mathematics',
    topic: 'algebra',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'Simplify $x + x$',
    options: ['2x', 'x^2', 'x', '2'],
    correctAnswer: 0,
    solution: '',
    updatedAt: STAMP_T0,
  },
  {
    id: 'COLLIDE_99',
    questionUid: 'q_ssc_0000000000000000000000000099',
    subject: 'mathematics',
    topic: 'percentages',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'SSC Version of Question 99',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    solution: 'SSC solution 99',
    updatedAt: STAMP_T0,
  },
  {
    id: 'COLLIDE_99',
    questionUid: 'q_jam_0000000000000000000000000099',
    subject: 'iit-jam-physics',
    topic: 'jam-mathematical-physics',
    exam: 'IIT JAM Physics',
    questionType: 'MCQ',
    question: 'IIT-JAM Version of Question 99: Divergence of magnetic field',
    options: ['0', 'mu_0', 'rho', 'infinite'],
    correctAnswer: 0,
    solution: 'Maxwell equation div B = 0.',
    updatedAt: STAMP_T0,
  },
  {
    id: 'jam_only_1',
    questionUid: 'q_jam_0000000000000000000000000021',
    subject: 'iit-jam-physics',
    topic: 'jam-mechanics-general-properties',
    exam: 'IIT JAM Physics',
    questionType: 'MCQ',
    question: 'Moment of inertia of solid cylinder',
    options: ['MR^2/2', 'MR^2', '2MR^2/5', 'MR^2/4'],
    correctAnswer: 0,
    solution: 'I = 1/2 M R^2.',
    updatedAt: STAMP_T0,
  },
  {
    id: 'jam_bad_topic',
    questionUid: 'q_jam_0000000000000000000000000088',
    subject: 'iit-jam-physics',
    topic: 'unregistered-topic-slug',
    exam: 'IIT JAM Physics',
    questionType: 'MCQ',
    question: 'Question with topic not in JAM_SECTIONS',
    options: ['A', 'B'],
    correctAnswer: 0,
    solution: 'Sol',
    updatedAt: STAMP_T0,
  },
];

async function makeTestZip({ manifest, files = {} }) {
  const zip = new JSZip();
  if (manifest) {
    zip.file('manifest.json', JSON.stringify(manifest));
  }

  for (const [name, content] of Object.entries(files)) {
    if (content === 'SAMPLE_PNG') {
      const pngBuf = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#10b981' } })
        .png()
        .toBuffer();
      zip.file(name, pngBuf);
    } else if (content === 'SAMPLE_JPEG') {
      const jpegBuf = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ef4444' } })
        .jpeg()
        .toBuffer();
      zip.file(name, jpegBuf);
    } else if (content === 'SAMPLE_WEBP') {
      const webpBuf = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#8b5cf6' } })
        .webp()
        .toBuffer();
      zip.file(name, webpBuf);
    } else {
      zip.file(name, content);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'test_qb_adversarial');
  db = await connectMongoDB();
}, 120000);

beforeEach(async () => {
  putObject.mockReset().mockResolvedValue(undefined);
  deleteObject.mockReset().mockResolvedValue(undefined);

  const col = getQuestionsCollection();
  await col.deleteMany({});
  await col.insertMany(structuredClone(sampleQuestions));
});

afterAll(async () => {
  await disconnectMongoDB();
  if (mongo) await mongo.stop();
  vi.unstubAllEnvs();
});

describe('Adversarial Challenge 1: Concurrency & Mid-Flight Modifications', () => {
  it('1.1 Stale timestamp (T0 vs T1) causes immediate 409, 0 uploads, 0 DB writes', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/q1.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    // Validate returns expected updatedAts at T0
    const preview = await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      validateOnly: true,
    });
    const expected = preview.summary.expectedUpdatedAts;
    expect(expected.ssc_adv_1).toBe(STAMP_T0);

    // Simulate external update before apply
    await getQuestionsCollection().updateOne(
      { id: 'ssc_adv_1' },
      { $set: { updatedAt: STAMP_T1, question: 'Externally modified question' } }
    );

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: expected,
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/ssc_adv_1 changed after validation/i),
    });

    // Zero uploads attempted because step 9 pre-check aborted
    expect(putObject).not.toHaveBeenCalled();

    // Verify DB untouched
    const doc1 = await getQuestionsCollection().findOne({ id: 'ssc_adv_1' });
    const doc2 = await getQuestionsCollection().findOne({ id: 'ssc_adv_2' });
    expect(doc1.questionImage).toBeUndefined();
    expect(doc1.updatedAt).toBe(STAMP_T1);
    expect(doc2.updatedAt).toBe(STAMP_T0);
  });

  it('1.2 Adversarial stress: concurrent mutation to Question 2 during B2 upload exposes partial update vulnerability in performWrites', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/q1.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    const expected = {
      ssc_adv_1: STAMP_T0,
      ssc_adv_2: STAMP_T0,
    };

    // When putObject is called for the 1st image, concurrently mutate ssc_adv_2 in MongoDB!
    putObject.mockImplementationOnce(async () => {
      await getQuestionsCollection().updateOne(
        { id: 'ssc_adv_2' },
        { $set: { updatedAt: STAMP_T1, solution: 'Concurrent solution update' } }
      );
    });

    // The call must be rejected with 409 CONCURRENCY_CONFLICT
    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: expected,
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/ssc_adv_2 changed after validation/i),
    });

    // Rollback of storage objects succeeds
    expect(deleteObject).toHaveBeenCalledTimes(2);

    // CRITICAL OBSERVATION:
    // In standalone / non-transactional fallback, performWrites wrote updates to ssc_adv_1
    // before checking ssc_adv_2!
    // The test documents this empirical finding:
    const doc1 = await getQuestionsCollection().findOne({ id: 'ssc_adv_1' });
    const wasDoc1Mutated = doc1.questionImage !== undefined;

    // This assertion captures the defect: in strict all-or-nothing semantics, doc1 MUST NOT be mutated.
    // If wasDoc1Mutated is true, it empirically proves the partial write vulnerability.
    if (wasDoc1Mutated) {
      console.warn('VULNERABILITY CONFIRMED: ssc_adv_1 was partially updated before ssc_adv_2 failed concurrency!');
    }
    // We assert that the system must NOT partially update doc1:
    // (This will fail on unpatched code, proving the bug exists)
    expect(wasDoc1Mutated).toBe(false);
  });

  it('1.3 Omitted question in expectedUpdatedAts rejects with 409 before writing', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/q1.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    // Provide timestamp only for ssc_adv_1, omit ssc_adv_2
    const partialExpected = { ssc_adv_1: STAMP_T0 };

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: partialExpected,
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/ssc_adv_2 changed after validation/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });
});

describe('Adversarial Challenge 2: Partial Failure Simulation & Storage Rollback', () => {
  it('2.1 Storage failure on 3rd upload: deletes 1st and 2nd keys, 0 DB modifications', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/f1.png' },
        { questionId: 'ssc_adv_1', target: 'option', option: 'A', language: 'en', file: 'images/f2.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/f3.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/f1.png': 'SAMPLE_PNG',
        'images/f2.png': 'SAMPLE_PNG',
        'images/f3.png': 'SAMPLE_PNG',
      },
    });

    // 1st and 2nd upload succeed, 3rd upload fails
    putObject
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('B2 Connection Reset By Peer'));

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: { ssc_adv_1: STAMP_T0, ssc_adv_2: STAMP_T0 },
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/B2 upload failed\. No question changes were saved/i),
    });

    // putObject was called 3 times
    expect(putObject).toHaveBeenCalledTimes(3);

    // Rollback: deleteObject must be called for key1 and key2 only
    expect(deleteObject).toHaveBeenCalledTimes(2);
    const key1 = putObject.mock.calls[0][0];
    const key2 = putObject.mock.calls[1][0];
    expect(deleteObject).toHaveBeenCalledWith(key1);
    expect(deleteObject).toHaveBeenCalledWith(key2);

    // DB Verification: Absolutely ZERO writes to MongoDB
    const doc1 = await getQuestionsCollection().findOne({ id: 'ssc_adv_1' });
    const doc2 = await getQuestionsCollection().findOne({ id: 'ssc_adv_2' });
    expect(doc1.updatedAt).toBe(STAMP_T0);
    expect(doc2.updatedAt).toBe(STAMP_T0);
    expect(doc1.questionImage).toBeUndefined();
    expect(doc1.options[0]).toBe('0'); // not overwritten by markdown
    expect(doc2.solutionImage).toBe('/api/upload/image/old_solution_key_123'); // old value intact
  });

  it('2.2 Cleanup failure resilience: if deleteObject rejects, process still throws 503 and logs', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/f1.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/f2.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/f1.png': 'SAMPLE_PNG',
        'images/f2.png': 'SAMPLE_PNG',
      },
    });

    putObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('S3 500 Internal Error'));

    // deleteObject fails during cleanup
    deleteObject.mockRejectedValueOnce(new Error('Delete permission denied'));

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: { ssc_adv_1: STAMP_T0, ssc_adv_2: STAMP_T0 },
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/B2 upload failed/i),
    });

    expect(deleteObject).toHaveBeenCalledTimes(1);
    const doc1 = await getQuestionsCollection().findOne({ id: 'ssc_adv_1' });
    expect(doc1.updatedAt).toBe(STAMP_T0);
  });
});

describe('Adversarial Challenge 3: Dry-Run Invariants', () => {
  it('3.1 Validate-only execution makes exactly ZERO storage calls and ZERO DB writes', async () => {
    const col = getQuestionsCollection();
    const updateOneSpy = vi.spyOn(col, 'updateOne');
    const updateManySpy = vi.spyOn(col, 'updateMany');
    const bulkWriteSpy = vi.spyOn(col, 'bulkWrite');
    const insertOneSpy = vi.spyOn(col, 'insertOne');
    const insertManySpy = vi.spyOn(col, 'insertMany');
    const deleteOneSpy = vi.spyOn(col, 'deleteOne');
    const deleteManySpy = vi.spyOn(col, 'deleteMany');

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/q1.png' },
        { questionId: 'ssc_adv_1', target: 'solution', file: 'images/sol1.png' },
        { questionId: 'ssc_adv_1', target: 'option', option: 'A', language: 'en', file: 'images/opt1a.png' },
        { questionId: 'ssc_adv_1', target: 'option', option: 'B', language: 'bn', file: 'images/opt1b.png' },
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol1.png': 'SAMPLE_PNG',
        'images/opt1a.png': 'SAMPLE_PNG',
        'images/opt1b.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    const result = await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      validateOnly: true,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.questionCount).toBe(2);
    expect(result.summary.fileCount).toBe(5);
    expect(result.summary.targetCount).toBe(5);

    // Assert ZERO storage calls
    expect(putObject).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();

    // Assert ZERO database modification calls
    expect(updateOneSpy).not.toHaveBeenCalled();
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(bulkWriteSpy).not.toHaveBeenCalled();
    expect(insertOneSpy).not.toHaveBeenCalled();
    expect(insertManySpy).not.toHaveBeenCalled();
    expect(deleteOneSpy).not.toHaveBeenCalled();
    expect(deleteManySpy).not.toHaveBeenCalled();

    // Check targets preview replacement flags
    const targets = result.summary.targets;
    const sol2Target = targets.find(t => t.questionId === 'ssc_adv_2' && t.target === 'solution');
    expect(sol2Target.replacesExisting).toBe(true);
    expect(sol2Target.status).toContain('replace solution image');

    const q1Target = targets.find(t => t.questionId === 'ssc_adv_1' && t.target === 'question');
    expect(q1Target.replacesExisting).toBe(false);
    expect(q1Target.status).toContain('New image');

    updateOneSpy.mockRestore();
    updateManySpy.mockRestore();
    bulkWriteSpy.mockRestore();
    insertOneSpy.mockRestore();
    insertManySpy.mockRestore();
    deleteOneSpy.mockRestore();
    deleteManySpy.mockRestore();
  });
});

describe('Adversarial Challenge 4: Cross-Exam-Mode Scoping & Collision Targeting', () => {
  it('4.1 Identical question ID in SSC and IIT-JAM: SSC mode updates ONLY the SSC question', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'COLLIDE_99', target: 'question', file: 'images/ssc99.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/ssc99.png': 'SAMPLE_PNG' },
    });

    const result = await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { COLLIDE_99: STAMP_T0 },
      validateOnly: false,
    });

    expect(result.success).toBe(true);
    expect(putObject).toHaveBeenCalledTimes(1);

    // Verify SSC question was updated
    const sscDoc = await getQuestionsCollection().findOne({
      id: 'COLLIDE_99',
      subject: 'mathematics',
    });
    expect(sscDoc.questionImage).toMatch(/^\/api\/upload\/image\//);
    expect(sscDoc.updatedAt).not.toBe(STAMP_T0);

    // Verify IIT-JAM question was untouched
    const jamDoc = await getQuestionsCollection().findOne({
      id: 'COLLIDE_99',
      subject: 'iit-jam-physics',
    });
    expect(jamDoc.questionImage).toBeUndefined();
    expect(jamDoc.updatedAt).toBe(STAMP_T0);
  });

  it('4.2 Identical question ID in SSC and IIT-JAM: IIT-JAM mode updates ONLY the IIT-JAM question', async () => {
    const manifest = {
      version: 1,
      examMode: 'iit-jam',
      images: [
        { questionId: 'COLLIDE_99', target: 'question', file: 'images/jam99.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/jam99.png': 'SAMPLE_PNG' },
    });

    const result = await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'iit-jam',
      expectedUpdatedAts: { COLLIDE_99: STAMP_T0 },
      validateOnly: false,
    });

    expect(result.success).toBe(true);
    expect(putObject).toHaveBeenCalledTimes(1);

    // Verify IIT-JAM question was updated
    const jamDoc = await getQuestionsCollection().findOne({
      id: 'COLLIDE_99',
      subject: 'iit-jam-physics',
    });
    expect(jamDoc.questionImage).toMatch(/^\/api\/upload\/image\//);
    expect(jamDoc.updatedAt).not.toBe(STAMP_T0);

    // Verify SSC question was untouched
    const sscDoc = await getQuestionsCollection().findOne({
      id: 'COLLIDE_99',
      subject: 'mathematics',
    });
    expect(sscDoc.questionImage).toBeUndefined();
    expect(sscDoc.updatedAt).toBe(STAMP_T0);
  });

  it('4.3 Targeting IIT-JAM question while in SSC mode rejects with 422 exam mode mismatch', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'jam_only_1', target: 'question', file: 'images/jam1.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/jam1.png': 'SAMPLE_PNG' },
    });

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'ssc',
        validateOnly: true,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/belongs to a different exam mode/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.4 Targeting SSC question while in IIT-JAM mode rejects with 422 exam mode mismatch', async () => {
    const manifest = {
      version: 1,
      examMode: 'iit-jam',
      images: [
        { questionId: 'ssc_adv_1', target: 'question', file: 'images/ssc1.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/ssc1.png': 'SAMPLE_PNG' },
    });

    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'iit-jam',
        validateOnly: true,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/belongs to a different exam mode/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.5 Adversarial finding: question with invalid topic bypassed assertQuestionExamMode check', async () => {
    // assertQuestionExamMode directly throws on jam_bad_topic
    const badDoc = await getQuestionsCollection().findOne({ id: 'jam_bad_topic' });
    expect(() => assertQuestionExamMode(badDoc, 'iit-jam')).toThrow(
      /Select an IIT JAM Physics subject and section/
    );

    // But processQuestionBankImageZip fails to call assertQuestionExamMode, so it allows the question!
    const manifest = {
      version: 1,
      examMode: 'iit-jam',
      images: [
        { questionId: 'jam_bad_topic', target: 'question', file: 'images/bad_topic.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/bad_topic.png': 'SAMPLE_PNG' },
    });

    // In accordance with PROJECT.md architecture R1:
    // "Question lookup, exam mode scoping (assertQuestionExamMode)..."
    // Targeting jam_bad_topic MUST be rejected because it fails assertQuestionExamMode!
    // This assertion tests for compliance with PROJECT.md:
    await expect(
      processQuestionBankImageZip({
        buffer: zip,
        examMode: 'iit-jam',
        validateOnly: true,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Select an IIT JAM Physics subject and section|different exam mode|invalid/i),
    });
  });
});

describe('Adversarial Challenge 5: Solution Image Rendering & Markdown Preservation', () => {
  it('5.1 Preserves LaTeX formulas, headings, and lists while appending solution image markdown', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_1', target: 'solution', file: 'images/sol1.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/sol1.png': 'SAMPLE_PNG' },
    });

    await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { ssc_adv_1: STAMP_T0 },
      validateOnly: false,
    });

    const updated = await getQuestionsCollection().findOne({ id: 'ssc_adv_1' });
    expect(updated.solutionImage).toMatch(/^\/api\/upload\/image\//);
    expect(updated.solutionImageKey).toMatch(/^question-images\/bank-imports\//);
    expect(typeof updated.solutionImageWidth).toBe('number');
    expect(typeof updated.solutionImageHeight).toBe('number');

    // Verify existing Markdown structure preserved
    expect(updated.solution).toContain('### Identity');
    expect(updated.solution).toContain('Using $\\sin^2\\theta + \\cos^2\\theta = 1$:');
    expect(updated.solution).toContain('- Here $\\theta = 30^\\circ$');
    expect(updated.solution).toContain('- Result is 1.');

    // Verify exactly one image markdown tag added at end
    expect(updated.solution).toContain(`![solution](${updated.solutionImage})`);
    const matches = updated.solution.match(/!\[solution\]\([^)]+\)/g);
    expect(matches).toHaveLength(1);
  });

  it('5.2 Replaces existing solution image without duplicating tags or losing surrounding text', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_2', target: 'solution', file: 'images/sol2_new.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/sol2_new.png': 'SAMPLE_PNG' },
    });

    await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { ssc_adv_2: STAMP_T0 },
      validateOnly: false,
    });

    const updated = await getQuestionsCollection().findOne({ id: 'ssc_adv_2' });
    expect(updated.solutionImage).toMatch(/^\/api\/upload\/image\//);
    expect(updated.solutionImage).not.toBe('/api/upload/image/old_solution_key_123');

    // Existing text preserved
    expect(updated.solution).toContain('Sum of letter positions:');
    expect(updated.solution).toContain('P(16) + I(9) + G(7) = 32.');

    // Old image markdown replaced, exactly 1 solution image markdown in text
    expect(updated.solution).not.toContain('old_solution_key_123');
    expect(updated.solution).toContain(`![solution](${updated.solutionImage})`);
    const matches = updated.solution.match(/!\[solution\]\([^)]+\)/g);
    expect(matches).toHaveLength(1);
  });

  it('5.3 Empty initial solution sets clean ![solution](url) markdown', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'ssc_adv_empty_sol', target: 'solution', file: 'images/sol_empty.png' },
      ],
    };
    const zip = await makeTestZip({
      manifest,
      files: { 'images/sol_empty.png': 'SAMPLE_PNG' },
    });

    await processQuestionBankImageZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { ssc_adv_empty_sol: STAMP_T0 },
      validateOnly: false,
    });

    const updated = await getQuestionsCollection().findOne({ id: 'ssc_adv_empty_sol' });
    expect(updated.solution).toBe(`![solution](${updated.solutionImage})`);
  });
});
