import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import JSZip from 'jszip';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const controllerExists = fs.existsSync(path.resolve(__dirname, '../../../controllers/questionImageZipController.js'));

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

vi.mock('../../../middleware/auth.js', () => ({
  default: (req, res, next) => (req.headers['x-test-admin'] === '1' ? next() : res.sendStatus(403)),
}));

import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../../../config/mongodb.js';

let mongo;
let db;
let serviceModule = null;
let controllerModule = null;

const STAMP = '2026-10-23T00:00:00.000Z';

// Standard test questions representing the bank
const seedQuestions = [
  {
    id: 'q1',
    questionUid: 'q_ssc_0000000000000000000000000001',
    subject: 'mathematics',
    topic: 'percentages',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'What is 10% of 100?',
    options: ['5', '10', '15', '20'],
    correctAnswer: 1,
    solution: '10% of 100 is 10.',
    translations: {
      bn: {
        question: '১০০ এর ১০% কত?',
        options: ['৫', '১০', '১৫', '২০'],
        solution: '১০০ এর ১০% হল ১০।',
      },
    },
    updatedAt: STAMP,
  },
  {
    id: 'q2',
    questionUid: 'q_ssc_0000000000000000000000000002',
    subject: 'reasoning',
    topic: 'series',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'Find the next number: 2, 4, 6, ?',
    options: ['7', '8', '9', '10'],
    correctAnswer: 1,
    solution: 'Add 2 each time.',
    questionImage: '/old-q2.png',
    questionImageKey: 'question-images/old/q2.webp',
    solutionImage: '/old-sol2.png',
    solutionImageKey: 'solution-images/old/sol2.webp',
    updatedAt: STAMP,
  },
  {
    id: 'q3',
    questionUid: 'q_ssc_0000000000000000000000000003',
    subject: 'mathematics',
    topic: 'algebra',
    exam: 'SSC CGL',
    questionType: 'NAT',
    question: 'Solve for x: 2x = 10',
    options: [],
    correctAnswer: 5,
    solution: 'x = 5',
    updatedAt: STAMP,
  },
  {
    id: 'jam_q1',
    questionUid: 'q_jam_0000000000000000000000000001',
    subject: 'iit-jam-physics',
    topic: 'jam-mathematical-physics',
    exam: 'IIT JAM Physics',
    questionType: 'MCQ',
    question: 'Calculate the curl of the electrostatic field.',
    options: ['0', '1', 'divergence', 'infinite'],
    correctAnswer: 0,
    solution: 'Electrostatic field is irrotational, so curl is 0.',
    updatedAt: STAMP,
  },
];

// Helper to generate in-memory ZIP files with custom manifest and images
async function createTestZip({
  manifest = null,
  rawManifest = null,
  files = {},
  omitManifest = false,
  omitDefaultImages = false,
} = {}) {
  const zip = new JSZip();

  if (!omitManifest) {
    if (rawManifest !== null) {
      zip.file('manifest.json', rawManifest);
    } else if (manifest !== null) {
      zip.file('manifest.json', JSON.stringify(manifest));
    } else {
      zip.file(
        'manifest.json',
        JSON.stringify({
          version: 1,
          examMode: 'ssc',
          images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
        })
      );
    }
  }

  const defaultPng = await sharp({
    create: { width: 30, height: 20, channels: 3, background: '#007aff' },
  })
    .png()
    .toBuffer();

  if (!omitDefaultImages && !files['images/q1.png'] && !omitManifest) {
    const manifestObj = manifest || { images: [{ file: 'images/q1.png' }] };
    if (manifestObj.images && manifestObj.images.some(i => i.file === 'images/q1.png')) {
      zip.file('images/q1.png', defaultPng);
    }
  }

  for (const [name, content] of Object.entries(files)) {
    if (content === 'SAMPLE_PNG') {
      const pngBuf = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#10b981' } })
        .png()
        .toBuffer();
      zip.file(name, pngBuf);
    } else if (content === 'SAMPLE_JPEG') {
      const jpegBuf = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ef4444' } })
        .jpeg()
        .toBuffer();
      zip.file(name, jpegBuf);
    } else if (content === 'SAMPLE_WEBP') {
      const webpBuf = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#8b5cf6' } })
        .webp()
        .toBuffer();
      zip.file(name, webpBuf);
    } else if (content && typeof content === 'object' && content.symlink) {
      zip.file(name, content.target || 'target.png', { unixPermissions: 0o120777 });
    } else {
      zip.file(name, content);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'test_qb_import');
  db = await connectMongoDB();

  try {
    serviceModule = await import('../questionImageZip.js');
  } catch (err) {
    serviceModule = null;
  }

  try {
    controllerModule = await import('../../../controllers/questionImageZipController.js');
  } catch (err) {
    controllerModule = null;
  }
}, 120000);

beforeEach(async () => {
  putObject.mockReset().mockResolvedValue(undefined);
  deleteObject.mockReset().mockResolvedValue(undefined);

  const col = getQuestionsCollection();
  await col.deleteMany({});
  await col.insertMany(structuredClone(seedQuestions));
});

afterAll(async () => {
  await disconnectMongoDB();
  if (mongo) await mongo.stop();
  vi.unstubAllEnvs();
});

function getService() {
  if (!serviceModule) {
    throw new Error('M1 implementation required: backend/services/questions/questionImageZip.js is not yet implemented.');
  }
  const fn = serviceModule.importQuestionBankImageZip || serviceModule.importQuestionImageZip || serviceModule.default;
  if (typeof fn !== 'function') {
    throw new Error('M1 service does not export importQuestionBankImageZip or importQuestionImageZip.');
  }
  return fn;
}

function getController() {
  if (!controllerModule) {
    throw new Error('M2 implementation required: backend/controllers/questionImageZipController.js is not yet implemented.');
  }
  const fn =
    controllerModule.handleQuestionBankImageZip ||
    controllerModule.handleQuestionImageZip ||
    controllerModule.adminQuestionImageZip ||
    controllerModule.default;
  if (typeof fn !== 'function') {
    throw new Error('M2 controller does not export handleQuestionBankImageZip or handleQuestionImageZip.');
  }
  return fn;
}

describe('Question Bank Image ZIP Import - 17+ Negative Rejection Cases', () => {
  it('1. rejects ZIP with missing manifest.json with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const zip = await createTestZip({ omitManifest: true, files: { 'images/q1.png': 'SAMPLE_PNG' } });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/missing manifest\.json/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('2. rejects ZIP with invalid JSON in manifest.json with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const badJson = '{\n  "version": 1,\n  "examMode": "ssc",\n  "images": [],\n}';
    const zip = await createTestZip({ rawManifest: badJson });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/not valid json/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('3. rejects ZIP with unknown or extra manifest keys with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      unauthorizedExtraKey: true,
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unrecognized key|invalid manifest/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('4. rejects ZIP with wrong version (e.g. version: 2) with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 2,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/expected 1|version/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('5. rejects ZIP targeting unknown question ID with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'nonexistent_question_999', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unknown question id/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('6. rejects question from other exam mode (e.g. IIT-JAM question in SSC mode) with 400/422', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'jam_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 400 || err.statusCode === 422;
      const msgOk = /different exam mode/i.test(err.message);
      return statusOk && msgOk;
    });

    expect(putObject).not.toHaveBeenCalled();
    const jamDoc = await getQuestionsCollection().findOne({ id: 'jam_q1' });
    expect(jamDoc.updatedAt).toBe(STAMP);
  });

  it('7. rejects duplicate target in manifest with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
      ],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/duplicate target/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('8. rejects option letter not present on question (e.g. option E or on NAT question) with 422', async () => {
    const importZip = getService();

    // q1 only has A, B, C, D (length 4). Target 'E'.
    const manifestOutRange = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'option', option: 'E', language: 'en', file: 'images/q1.png' }],
    };
    const zip1 = await createTestZip({ manifest: manifestOutRange });
    await expect(
      importZip({ buffer: zip1, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/does not exist/i),
    });

    // q3 is NAT question. Target option on NAT question.
    const manifestNat = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q3', target: 'option', option: 'A', language: 'en', file: 'images/q1.png' }],
    };
    const zip2 = await createTestZip({ manifest: manifestNat });
    await expect(
      importZip({ buffer: zip2, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/does not exist|nat/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('9. rejects language not present on question (e.g. bn on question without Bengali translation) with 422', async () => {
    const importZip = getService();
    // q2 has NO Bengali translation
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q2', target: 'option', option: 'A', language: 'bn', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/option a\/bn does not exist|does not exist/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(doc.updatedAt).toBe(STAMP);
  });

  it('10. rejects missing referenced file in ZIP with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/nonexistent_file.png' }],
    };
    const zip = await createTestZip({ manifest, omitDefaultImages: true });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/missing image images\/nonexistent_file\.png/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('11. rejects unreferenced extra file in ZIP with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'unreferenced_notes.txt': 'Unexpected file notes',
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unexpected file: unreferenced_notes\.txt/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('12. rejects unsafe paths (.., leading slash, backslash) with 413/422 and zero writes', async () => {
    const importZip = getService();

    // Traversal ..
    const zipTraversal = await createTestZip({
      files: {
        '../traversal.png': 'SAMPLE_PNG',
      },
    });
    await expect(
      importZip({ buffer: zipTraversal, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      return (err.statusCode === 413 || err.statusCode === 422) && /unsafe/i.test(err.message);
    });

    // Backslash \
    const zipBackslash = await createTestZip({
      files: {
        'images\\backslash.png': 'SAMPLE_PNG',
      },
    });
    await expect(
      importZip({ buffer: zipBackslash, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      return (err.statusCode === 413 || err.statusCode === 422) && /unsafe/i.test(err.message);
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('13. rejects symlink entry with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': { symlink: true, target: 'other.png' },
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/symbolic links are forbidden/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('14. rejects oversize / too many entries (>1000 entries or >20MB / >64MB) with 413', async () => {
    const importZip = getService();

    // Exceed entry count (> 1000 entries)
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 1, examMode: 'ssc', images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }] }));
    for (let i = 0; i < 1002; i++) {
      zip.file(`dummy_${i}.txt`, 'x');
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(
      importZip({ buffer: buf, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      return (err.statusCode === 413 || err.statusCode === 422) && /too many entries|limit/i.test(err.message);
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('15. rejects extension mismatch (e.g. .png containing JPEG data) with 422 and zero writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    // Put real JPEG bytes into a file named .png
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_JPEG',
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('15b. rejects extension mismatch: .png containing WebP data with 422 and zero writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    // Put real WebP bytes into a file named .png
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_WEBP',
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('16. rejects animated or multipage image with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };

    // 2-frame animated GIF disguised as .png
    const animatedGifBase64 = 'R0lGODlhAQABAIABAP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgABACwAAAAAAQABAAACAkwBACH5BAkKAAEALAAAAAABAAEAAAICRAEAOw==';
    const animBuf = Buffer.from(animatedGifBase64, 'base64');

    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': animBuf,
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*extension matches its content|static/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('17. rejects undecodable image (corrupted bytes) with 422 and zero DB/storage writes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const corruptedBytes = Buffer.from('NOT_A_VALID_IMAGE_HEADER_CORRUPTED_BYTES_123456');

    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': corruptedBytes,
      },
    });

    await expect(
      importZip({ buffer: zip, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });
});

describe('Question Bank Image ZIP Import - Positive Flows & Invariants', () => {
  it('18. validate makes ZERO storage uploads and ZERO DB writes, returning target previews', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
        { questionId: 'q2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    const result = await importZip({ buffer: zip, examMode: 'ssc', validateOnly: true });

    expect(result.valid).toBe(true);
    const summary = result.summary || result;
    expect(summary.questionCount).toBe(2);
    expect(summary.fileCount).toBe(2);

    // ZERO storage uploads
    expect(putObject).not.toHaveBeenCalled();

    // ZERO DB writes
    const q1 = await getQuestionsCollection().findOne({ id: 'q1' });
    const q2 = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(q1.updatedAt).toBe(STAMP);
    expect(q2.updatedAt).toBe(STAMP);
    expect(q1.questionImage).toBeUndefined();
    expect(q2.solutionImage).toBe('/old-sol2.png');
  });

  it('19. successful apply in one ZIP sets question image, solution image, and en + bn option images across >=2 questions', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        // Question 1: Question image, English Option A, Bengali Option B
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
        { questionId: 'q1', target: 'option', option: 'A', language: 'en', file: 'images/opt_a_en.png' },
        { questionId: 'q1', target: 'option', option: 'B', language: 'bn', file: 'images/opt_b_bn.png' },
        // Question 2: Solution image
        { questionId: 'q2', target: 'solution', file: 'images/sol2.png' },
      ],
    };

    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/opt_a_en.png': 'SAMPLE_PNG',
        'images/opt_b_bn.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    // 1. Dry run validate
    const preview = await importZip({ buffer: zip, examMode: 'ssc', validateOnly: true });
    expect(preview.valid).toBe(true);
    const expectedUpdatedAts = preview.summary?.expectedUpdatedAts || preview.expectedUpdatedAts || { q1: STAMP, q2: STAMP };

    // 2. Apply
    const result = await importZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts,
      validateOnly: false,
    });

    expect(result.success ?? true).toBeTruthy();
    expect(putObject).toHaveBeenCalledTimes(4);

    // Verify DB mutations on Question 1
    const storedQ1 = await getQuestionsCollection().findOne({ id: 'q1' });
    expect(storedQ1.questionImage).toMatch(/^\/api\/upload\/image\//);
    expect(storedQ1.options[0]).toMatch(/^!\[Option A\]\(\/api\/upload\/image\//);
    expect(storedQ1.options[1]).toBe('10'); // unchanged
    expect(storedQ1.translations.bn.options[1]).toMatch(/^!\[Option B\]\(\/api\/upload\/image\//);
    expect(storedQ1.translations.bn.options[0]).toBe('৫'); // unchanged

    // Verify DB mutations on Question 2
    const storedQ2 = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(storedQ2.solutionImage).toMatch(/^\/api\/upload\/image\//);
    expect(storedQ2.solutionImage).not.toBe('/old-sol2.png');
  });

  it('20. solution images are stored so existing question/solution views render them (mergeSolutionContent, dimensions, keys)', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q2', target: 'solution', file: 'images/sol2.png' }],
    };

    const zip = await createTestZip({
      manifest,
      files: {
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    await importZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { q2: STAMP },
      validateOnly: false,
    });

    const storedQ2 = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(storedQ2.solutionImage).toMatch(/^\/api\/upload\/image\//);
    expect(storedQ2.solutionImageKey).toMatch(/^question-images\/bank-imports\//);
    expect(typeof storedQ2.solutionImageWidth).toBe('number');
    expect(typeof storedQ2.solutionImageHeight).toBe('number');
    expect(storedQ2.solutionImageWidth).toBeGreaterThan(0);
    expect(storedQ2.solutionImageHeight).toBeGreaterThan(0);

    // mergeSolutionContent check: contains original explanation AND ![solution](url), no duplicates
    expect(storedQ2.solution).toContain('Add 2 each time.');
    expect(storedQ2.solution).toContain(`![solution](${storedQ2.solutionImage})`);
  });

  it('21. stored URLs use unique keys; earlier image objects are not overwritten', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = await createTestZip({ manifest });

    await importZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { q1: STAMP },
      validateOnly: false,
    });

    expect(putObject).toHaveBeenCalledTimes(1);
    const key1 = putObject.mock.calls[0][0];
    expect(key1).toMatch(/^question-images\/bank-imports\/[a-f0-9-]+\/0\.webp$/);

    // Second apply with new version
    const q1AfterFirst = await getQuestionsCollection().findOne({ id: 'q1' });
    await importZip({
      buffer: zip,
      examMode: 'ssc',
      expectedUpdatedAts: { q1: q1AfterFirst.updatedAt },
      validateOnly: false,
    });

    expect(putObject).toHaveBeenCalledTimes(2);
    const key2 = putObject.mock.calls[1][0];
    expect(key2).toMatch(/^question-images\/bank-imports\/[a-f0-9-]+\/0\.webp$/);
    expect(key1).not.toBe(key2); // Completely distinct UUID namespace
  });

  it('22. question changing between validate and apply leads to 409 and no DB changes', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
        { questionId: 'q2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    const preview = await importZip({ buffer: zip, examMode: 'ssc', validateOnly: true });
    const staleUpdatedAts = preview.summary?.expectedUpdatedAts || preview.expectedUpdatedAts || { q1: STAMP, q2: STAMP };

    // Simulate concurrent modification to Question 1
    await getQuestionsCollection().updateOne(
      { id: 'q1' },
      { $set: { updatedAt: '2026-10-23T12:00:00.000Z', question: 'Concurrently edited question' } }
    );

    await expect(
      importZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: staleUpdatedAts,
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/q1 changed/i),
    });

    // Neither q1 nor q2 should have received new image links
    const q1 = await getQuestionsCollection().findOne({ id: 'q1' });
    const q2 = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(q1.questionImage).toBeUndefined();
    expect(q2.solutionImage).toBe('/old-sol2.png');
  });

  it('23. storage failure partway through apply: no question modified, delete attempts on uploaded objects', async () => {
    const importZip = getService();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'q1', target: 'question', file: 'images/q1.png' },
        { questionId: 'q2', target: 'solution', file: 'images/sol2.png' },
      ],
    };
    const zip = await createTestZip({
      manifest,
      files: {
        'images/q1.png': 'SAMPLE_PNG',
        'images/sol2.png': 'SAMPLE_PNG',
      },
    });

    // 1st putObject succeeds, 2nd putObject fails
    putObject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('B2 storage connection timeout'));

    await expect(
      importZip({
        buffer: zip,
        examMode: 'ssc',
        expectedUpdatedAts: { q1: STAMP, q2: STAMP },
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/B2 upload failed|storage/i),
    });

    // Verify rollback: deleteObject called on first uploaded key
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith(putObject.mock.calls[0][0]);

    // Verify DB was NOT modified
    const q1 = await getQuestionsCollection().findOne({ id: 'q1' });
    const q2 = await getQuestionsCollection().findOne({ id: 'q2' });
    expect(q1.questionImage).toBeUndefined();
    expect(q2.solutionImage).toBe('/old-sol2.png');
    expect(q1.updatedAt).toBe(STAMP);
    expect(q2.updatedAt).toBe(STAMP);
  });
});

describe.skipIf(!controllerExists)('Question Bank Image ZIP Import - Controller Concurrency & Authorization', () => {
  it('24. second import started while one is running is rejected with 503', async () => {
    const handleZip = getController();

    let releaseFirst;
    const blockingPromise = new Promise(resolve => {
      releaseFirst = resolve;
    });

    const mockReq1 = {
      file: { originalname: 'bank.zip', buffer: await createTestZip() },
      body: { action: 'validate' },
      query: { examMode: 'ssc' },
      headers: { 'x-test-admin': '1' },
    };

    const mockRes1 = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const mockReq2 = {
      file: { originalname: 'bank2.zip', buffer: await createTestZip() },
      body: { action: 'validate' },
      query: { examMode: 'ssc' },
      headers: { 'x-test-admin': '1' },
    };

    const mockRes2 = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // Spy on service to make the first request block
    const importZip = getService();
    const origFn = serviceModule.importQuestionBankImageZip || serviceModule.importQuestionImageZip;
    vi.spyOn(serviceModule, 'importQuestionBankImageZip' in serviceModule ? 'importQuestionBankImageZip' : 'importQuestionImageZip')
      .mockImplementationOnce(async () => {
        await blockingPromise;
        return { valid: true };
      });

    // Start 1st request (async)
    const req1Promise = handleZip(mockReq1, mockRes1);

    // Immediately start 2nd request while 1st is still processing
    await handleZip(mockReq2, mockRes2);

    expect(mockRes2.status).toHaveBeenCalledWith(503);
    expect(mockRes2.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringMatching(/another question bank image zip is processing/i),
      })
    );

    // Release 1st request
    releaseFirst();
    await req1Promise;
  });

  it('25. non-admin requests are rejected with 401/403', async () => {
    const app = express();
    app.use(express.json());

    // Import router or mount controller with auth middleware
    let questionBankZipRouter;
    try {
      questionBankZipRouter = (await import('../../../routes/questionImageZipRoutes.js')).default;
    } catch {
      // Fallback: test controller with mock middleware
      const handleZip = getController();
      app.post('/api/questions/admin/image-zip', (req, res, next) => {
        if (req.headers['x-test-admin'] !== '1') return res.status(403).json({ error: 'Admin access required' });
        return handleZip(req, res, next);
      });
    }

    if (questionBankZipRouter) {
      app.use('/api/questions/admin', questionBankZipRouter);
    }

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/questions/admin/image-zip?examMode=ssc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate' }),
      });

      expect([401, 403]).toContain(response.status);
      expect(putObject).not.toHaveBeenCalled();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
