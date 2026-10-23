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
import { loadSafeZip } from '../../uploads/safeZip.js';

let mongo;

const STAMP_T0 = '2026-10-23T00:00:00.000Z';

const seedQuestions = [
  {
    id: 'challenger_q1',
    questionUid: 'q_ssc_0000000000000000000000000091',
    subject: 'mathematics',
    topic: 'percentages',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'Challenger Question 1',
    options: ['10', '20', '30', '40'],
    correctAnswer: 0,
    solution: 'Solution 1',
    translations: {
      bn: {
        question: 'প্রশ্ন ১',
        options: ['১০', '২০', '৩০', '৪০'],
        solution: 'সমাধান ১',
      },
    },
    updatedAt: STAMP_T0,
  },
  {
    id: 'challenger_q2',
    questionUid: 'q_ssc_0000000000000000000000000092',
    subject: 'reasoning',
    topic: 'series',
    exam: 'SSC CGL',
    questionType: 'MCQ',
    question: 'Challenger Question 2',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 1,
    solution: 'Solution 2',
    updatedAt: STAMP_T0,
  },
];

async function generateValidWebPBuffer() {
  return sharp({
    create: { width: 48, height: 48, channels: 4, background: { r: 59, g: 130, b: 246, alpha: 1 } },
  })
    .webp({ quality: 90 })
    .toBuffer();
}

async function generateValidPngBuffer() {
  return sharp({
    create: { width: 48, height: 48, channels: 4, background: { r: 16, g: 185, b: 129, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function buildChallengerZip({ manifest, entries = {} }) {
  const zip = new JSZip();
  if (manifest !== undefined) {
    zip.file('manifest.json', typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  }
  for (const [name, config] of Object.entries(entries)) {
    if (config && typeof config === 'object' && config.isDir) {
      zip.file(name, null, {
        dir: true,
        unixPermissions: config.unixPermissions,
      });
    } else if (config && typeof config === 'object' && config.customEntry) {
      zip.file(name, config.data, {
        unixPermissions: config.unixPermissions,
      });
    } else {
      zip.file(name, config);
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'test_qb_challenger');
  await connectMongoDB();
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

describe('Adversarial Challenge Area 1: Corrupted WebP Payloads inside .png and .jpg files', () => {
  it('1.1 Rejects truncated WebP header disguised as .png with 422 and actionable message', async () => {
    // 12 bytes WebP header (RIFF....WEBP) but incomplete/truncated
    const truncatedWebP = Buffer.from('524946462000000057454250', 'hex'); // 'RIFF \0\0\0WEBP'
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/truncated.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/truncated.png': truncatedWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/truncated\.png: cannot decode image.*Re-export a static PNG\/JPEG\/WebP/i),
    });

    expect(putObject).not.toHaveBeenCalled();
    const doc = await getQuestionsCollection().findOne({ id: 'challenger_q1' });
    expect(doc.updatedAt).toBe(STAMP_T0);
  });

  it('1.2 Rejects truncated WebP header disguised as .jpg with 422 and actionable message', async () => {
    const truncatedWebP = Buffer.from('524946462000000057454250', 'hex');
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/truncated.jpg' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/truncated.jpg': truncatedWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/truncated\.jpg: cannot decode image.*Re-export a static PNG\/JPEG\/WebP/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.3 Rejects corrupted VP8 chunk data inside .png with 422', async () => {
    // Start with real WebP, then corrupt the payload bytes
    const validWebP = await generateValidWebPBuffer();
    const corruptedWebP = Buffer.from(validWebP);
    // Overwrite the VP8 chunk payload with garbage
    corruptedWebP.fill(0xff, 24, Math.min(60, corruptedWebP.length));

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/corrupt_vp8.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/corrupt_vp8.png': corruptedWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.4 Rejects corrupted VP8 chunk data inside .jpg with 422', async () => {
    const validWebP = await generateValidWebPBuffer();
    const corruptedWebP = Buffer.from(validWebP);
    corruptedWebP.fill(0x00, 20, Math.min(50, corruptedWebP.length));

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/corrupt_vp8.jpg' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/corrupt_vp8.jpg': corruptedWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.5 Rejects genuinely valid WebP data inside .png (Extension Mismatch) with 422', async () => {
    const validWebP = await generateValidWebPBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/mismatch.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/mismatch.png': validWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/mismatch\.png: cannot decode image.*extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.6 Rejects genuinely valid WebP data inside .jpg (Extension Mismatch) with 422', async () => {
    const validWebP = await generateValidWebPBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/mismatch.jpg' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/mismatch.jpg': validWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/mismatch\.jpg: cannot decode image.*extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.7 Rejects genuinely valid WebP data inside .jpeg (Extension Mismatch) with 422', async () => {
    const validWebP = await generateValidWebPBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/mismatch.jpeg' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/mismatch.jpeg': validWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/mismatch\.jpeg: cannot decode image.*extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.8 Rejects corrupted WebP in a .webp file with 422', async () => {
    const truncatedWebP = Buffer.from('52494646200000005745425000000000', 'hex');
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/bad.webp' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/bad.webp': truncatedWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/images\/bad\.webp: cannot decode image/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('1.9 Rejects arbitrary binary garbage in .png and .jpg with 422', async () => {
    const garbage = Buffer.from('RANDOM_CORRUPTED_BYTES_WITHOUT_MAGIC_HEADERS_1234567890');
    const manifestPng = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/garbage.png' }],
    };
    const zipPng = await buildChallengerZip({
      manifest: manifestPng,
      entries: { 'images/garbage.png': garbage },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipPng, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });

    const manifestJpg = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/garbage.jpg' }],
    };
    const zipJpg = await buildChallengerZip({
      manifest: manifestJpg,
      entries: { 'images/garbage.jpg': garbage },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipJpg, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });
  });
});

describe('Adversarial Challenge Area 2: Directory entries with traversal characters', () => {
  it('2.1 loadSafeZip directly rejects directory entry with ../ prefix with 413', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    zip.file('../traversal_dir/', null, { dir: true });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(loadSafeZip(buf)).rejects.toMatchObject({
      statusCode: 413,
      message: expect.stringMatching(/unsafe zip entry path/i),
    });
  });

  it('2.2 loadSafeZip directly rejects directory entry with backslash with 413', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    zip.file('images\\evil_dir/', null, { dir: true });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(loadSafeZip(buf)).rejects.toMatchObject({
      statusCode: 413,
      message: expect.stringMatching(/unsafe zip entry path/i),
    });
  });

  it('2.3 loadSafeZip directly rejects directory entry with leading slash with 413', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    zip.file('/absolute_dir/', null, { dir: true });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(loadSafeZip(buf)).rejects.toMatchObject({
      statusCode: 413,
      message: expect.stringMatching(/unsafe zip entry path/i),
    });
  });

  it('2.4 processQuestionBankImageZip rejects directory entry with ../ with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        '../traversal_folder/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      const msgOk = /unsafe zip entry path/i.test(err.message);
      return statusOk && msgOk;
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('2.5 processQuestionBankImageZip rejects directory entry with backslash with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'images\\folder/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      const msgOk = /unsafe zip entry path/i.test(err.message);
      return statusOk && msgOk;
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('2.6 processQuestionBankImageZip rejects deep directory traversal ../../../../etc/ with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        '../../../../etc/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      const msgOk = /unsafe zip entry path/i.test(err.message);
      return statusOk && msgOk;
    });
  });

  it('2.7 processQuestionBankImageZip rejects middle traversal directory images/../evil/ with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'images/../evil_dir/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      const msgOk = /unsafe zip entry path/i.test(err.message);
      return statusOk && msgOk;
    });
  });
});

describe('Adversarial Challenge Area 3: Mode Symlinks and Symlink Payloads', () => {
  it('3.1 Rejects symlink mode permission on a directory entry with 422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    // S_IFLNK is 0o120000. 0o120777 = symlink with rwxrwxrwx
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'images/symlink_dir/': {
          isDir: true,
          unixPermissions: 0o120777,
        },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/symbolic links are forbidden/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('3.2 Rejects symlink mode permission on a file entry with 422', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': {
          customEntry: true,
          data: Buffer.from('other.png'),
          unixPermissions: 0o120777,
        },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/symbolic links are forbidden/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('3.3 Rejects text symlink payload mimicking an image file with 422', async () => {
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    // Text payload without symlink permissions, but targeting another image path
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': 'images/target.png\n',
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/symbolic links are forbidden/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });
});

describe('Adversarial Challenge Area 4: Unexpected Directory Paths and Hierarchy Hygiene', () => {
  it('4.1 Rejects unexpected directory entry (e.g. assets/) with 422 and actionable message', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'assets/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unexpected file: assets\/\. Remove unused files/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.2 Rejects unexpected macOS metadata directory (__MACOSX/) with 422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        '__MACOSX/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unexpected file: __MACOSX\/\. Remove unused files/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.3 Rejects nested directory under images (images/subfolder/) with 422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'images/nested/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unexpected file: images\/nested\/\. Remove unused files/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.4 Rejects directory named manifest.json/ with 422', async () => {
    const png = await generateValidPngBuffer();
    const zip = new JSZip();
    zip.file('manifest.json/', null, { dir: true });
    zip.file('images/q1.png', png);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/missing manifest\.json at zip root/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.5 Rejects case-altered directory (Images/ instead of images/) with 422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/q1.png': png,
        'Images/': { isDir: true },
      },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/unexpected file: Images\/\. Remove unused files/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('4.6 Allows standard valid directory entry images/ and ./ without error', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/': { isDir: true },
        'images/q1.png': png,
      },
    });

    const result = await processQuestionBankImageZip({
      buffer: zipBuffer,
      examMode: 'ssc',
      validateOnly: true,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.questionCount).toBe(1);
    expect(result.summary.fileCount).toBe(1);
    expect(result.summary.targets).toHaveLength(1);
  });
});

describe('Adversarial Challenge Area 5: Advanced Payload & Directory Stress Tests', () => {
  it('5.1 Rejects animated WebP disguised as .png with 422', async () => {
    // 2-frame animated WebP
    const animWebPBase64 =
      'UklGRlYAAABXRUJQVlA4IEoAAADQAwCdASoBAAEAPuFsoUynpCQioAgB4CcJaQAA329u38AA/v7+4WihTKekJCKgCAHgJvP///7///7///7///8AAABJRU5ErkJggg==';
    const animWebP = Buffer.from(animWebPBase64, 'base64');

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/anim.png' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/anim.png': animWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*static|extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('5.2 Rejects animated WebP disguised as .jpg with 422', async () => {
    const animWebPBase64 =
      'UklGRlYAAABXRUJQVlA4IEoAAADQAwCdASoBAAEAPuFsoUynpCQioAgB4CcJaQAA329u38AA/v7+4WihTKekJCKgCAHgJvP///7///7///7///8AAABJRU5ErkJggg==';
    const animWebP = Buffer.from(animWebPBase64, 'base64');

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/anim.jpg' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/anim.jpg': animWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*static|extension matches its content/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('5.3 Rejects pixel bomb WebP (25 million pixels > 16M limit) with 422', async () => {
    const hugeWebP = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' },
    })
      .webp()
      .toBuffer();

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/bomb.webp' }],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: { 'images/bomb.webp': hugeWebP },
    });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image.*16 million pixels/i),
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('5.4 Rejects archive with directory entry bomb (1005 folder entries) with 413', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    }));
    for (let i = 0; i < 1005; i++) {
      zip.file(`folder_${i}/`, null, { dir: true });
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      const msgOk = /too many entries|limit/i.test(err.message);
      return statusOk && msgOk;
    });

    expect(putObject).not.toHaveBeenCalled();
  });

  it('5.5 In apply mode with mixed batch (1 valid PNG + 1 corrupt WebP in .jpg), 0 uploads and 0 DB writes happen', async () => {
    const validPng = await generateValidPngBuffer();
    const truncatedWebP = Buffer.from('RIFF\x20\x00\x00\x00WEBP');

    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [
        { questionId: 'challenger_q1', target: 'question', file: 'images/good.png' },
        { questionId: 'challenger_q2', target: 'question', file: 'images/bad.jpg' },
      ],
    };
    const zipBuffer = await buildChallengerZip({
      manifest,
      entries: {
        'images/good.png': validPng,
        'images/bad.jpg': truncatedWebP,
      },
    });

    await expect(
      processQuestionBankImageZip({
        buffer: zipBuffer,
        examMode: 'ssc',
        expectedUpdatedAts: { challenger_q1: STAMP_T0, challenger_q2: STAMP_T0 },
        validateOnly: false,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/cannot decode image/i),
    });

    // Zero storage uploads attempted
    expect(putObject).not.toHaveBeenCalled();

    // Zero database mutations
    const doc1 = await getQuestionsCollection().findOne({ id: 'challenger_q1' });
    const doc2 = await getQuestionsCollection().findOne({ id: 'challenger_q2' });
    expect(doc1.updatedAt).toBe(STAMP_T0);
    expect(doc2.updatedAt).toBe(STAMP_T0);
    expect(doc1.questionImage).toBeUndefined();
    expect(doc2.questionImage).toBeUndefined();
  });

  it('5.6 Rejects directory with double slash traversal //evil_dir/ with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('images/q1.png', png);
    zip.file('//evil_dir/', null, { dir: true });
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      return statusOk;
    });
  });

  it('5.7 Rejects directory with Windows-style trailing backslash images\\\\ with 413/422', async () => {
    const png = await generateValidPngBuffer();
    const manifest = {
      version: 1,
      examMode: 'ssc',
      images: [{ questionId: 'challenger_q1', target: 'question', file: 'images/q1.png' }],
    };
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('images/q1.png', png);
    zip.file('images\\', null, { dir: true });
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });

    await expect(
      processQuestionBankImageZip({ buffer: zipBuffer, examMode: 'ssc', validateOnly: true })
    ).rejects.toSatisfy(err => {
      const statusOk = err.statusCode === 413 || err.statusCode === 422;
      return statusOk && /unsafe/i.test(err.message);
    });
  });
});

