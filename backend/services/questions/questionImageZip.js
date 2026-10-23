import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import { loadSafeZip, ZIP_LIMITS, IMAGE_INPUT_OPTIONS } from '../uploads/safeZip.js';
import { putObject, deleteObject, stableImageUrl } from '../../infrastructure/objectStorage.js';
import { logger } from '../../infrastructure/logger.js';
import { getQuestionsCollection, withMongoTransaction } from '../../config/mongodb.js';
import { resolveQuestion } from './questionIdentity.js';
import {
  scopedQuestionFilter,
  parseQuestionExamMode,
  assertQuestionExamMode,
} from './questionExamMode.js';
import { mergeQuestionContent, mergeSolutionContent } from '../../repositories/questionImageRepository.js';
import { invalidateQuestionMetadata } from './questionMetadataCache.js';

export const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });

const IMAGE_PATH_REGEX = /^images\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/;

export const imageMappingSchema = z
  .object({
    questionId: z.string().min(1, 'Question ID cannot be empty'),
    file: z
      .string()
      .regex(
        IMAGE_PATH_REGEX,
        'File must be located in images/ directory and use alphanumeric, hyphen, or underscore characters with a .png, .jpg, .jpeg, or .webp extension'
      ),
    target: z.enum(['question', 'solution', 'option']),
    option: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).optional(),
    language: z.enum(['en', 'bn']).optional(),
  })
  .strict()
  .superRefine((row, context) => {
    if (row.target === 'option') {
      if (!row.option || !row.language) {
        context.addIssue({
          code: 'custom',
          message: 'Option images require option and language',
        });
      }
    }
    if (row.target === 'question') {
      if (row.option || row.language) {
        context.addIssue({
          code: 'custom',
          message: 'Question images are shared across languages; omit option and language',
        });
      }
    }
    if (row.target === 'solution') {
      if (row.option || row.language) {
        context.addIssue({
          code: 'custom',
          message: 'Solution images are shared across languages; omit option and language',
        });
      }
    }
  });

export const manifestSchema = z
  .object({
    version: z.literal(1),
    examMode: z.enum(['ssc', 'iit-jam']).optional(),
    images: z.array(imageMappingSchema).min(1).max(500),
  })
  .strict();

function normalizeUpdatedAt(val) {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val.toISOString();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // fallback
  }
  return String(val);
}

function canonicalJamTopic(topic) {
  if (!topic || typeof topic !== 'string') return topic;
  const clean = topic.trim().toLowerCase();
  if (clean === 'jam-mathematical-physics' || clean === 'mathematical-physics') {
    return 'iit-jam-mathematical-methods';
  }
  if (clean === 'jam-mechanics-general-properties' || clean === 'mechanics-general-properties') {
    return 'iit-jam-mechanics';
  }
  return topic;
}

export async function extractAndValidateManifest(zip, expectedExamMode) {
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw fail(
      'Missing manifest.json at ZIP root. Download the format guide and add the manifest.',
      422
    );
  }

  const manifestBytes = await manifestFile.async('nodebuffer');
  if (manifestBytes.length > 128 * 1024) {
    throw fail('manifest.json exceeds 128 KiB. Split this upload.', 422);
  }

  let parsed;
  try {
    parsed = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw fail(
      'manifest.json is not valid JSON. Remove trailing commas and use double quotes.',
      422
    );
  }

  const result = manifestSchema.safeParse(parsed);
  if (!result.success) {
    throw fail(
      `Invalid manifest: ${result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
      422
    );
  }
  const manifest = result.data;

  if (manifest.examMode && expectedExamMode && manifest.examMode !== expectedExamMode) {
    throw fail(
      'Manifest examMode does not match requested exam mode. Open the correct exam mode or fix the manifest.',
      422
    );
  }

  return manifest;
}

export async function decodeAndVerifyImages(zip, mappings) {
  const converted = new Map();

  for (const row of mappings) {
    if (converted.has(row.file)) continue;

    const entry = zip.file(row.file);
    if (!entry) {
      throw fail(`Missing image ${row.file}. File names are case sensitive.`, 422);
    }

    try {
      const bytes = await entry.async('nodebuffer');
      const image = sharp(bytes, IMAGE_INPUT_OPTIONS);
      const metadata = await image.metadata();

      const rawExt = row.file.split('.').at(-1)?.toLowerCase();
      const extension = rawExt === 'jpg' ? 'jpeg' : rawExt;

      const extMatches = extension === metadata.format;

      if (
        !['png', 'jpeg', 'webp'].includes(metadata.format) ||
        (metadata.pages || 1) !== 1 ||
        !extMatches
      ) {
        throw new Error('Use a static PNG, JPEG or WebP whose extension matches its content');
      }

      const { data, info } = await image
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });

      converted.set(row.file, {
        bytes: data,
        width: info.width,
        height: info.height,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw fail(
        `${row.file}: cannot decode image. ${error.message}. Re-export a static PNG/JPEG/WebP under 8 MiB and 16 million pixels.`,
        422
      );
    }
  }

  return converted;
}

async function persistUpdates(editsByQuestion, examMode, expectedUpdatedAts) {
  const collection = getQuestionsCollection();

  const performWrites = async ({ session, db } = {}) => {
    const questionsCol = db ? db.collection('questions') : collection;

    // Phase 1 (Verification): Query all targeted questions, verify currentIso === expectedIso
    // for EVERY targeted question. If any question does not match, throw HTTP 409 immediately
    // BEFORE executing any write.
    const snapshots = new Map();
    for (const [questionId, { doc }] of editsByQuestion) {
      const findOpts = session ? { session } : undefined;
      const fresh = await questionsCol.findOne({ _id: doc._id }, findOpts);
      const currentIso = normalizeUpdatedAt(fresh?.updatedAt);
      const expectedIso = normalizeUpdatedAt(expectedUpdatedAts[questionId]);

      if (!fresh || currentIso !== expectedIso) {
        throw Object.assign(
          new Error(`Question ${questionId} changed after validation. Reload questions and validate the ZIP again.`),
          { statusCode: 409, code: 'CONCURRENCY_CONFLICT' }
        );
      }
      snapshots.set(questionId, fresh);
    }

    // Phase 2 (Execution): Perform updateOne on all targeted questions only after Phase 1 has completely succeeded.
    const modified = [];
    try {
      for (const [questionId, { doc, updates }] of editsByQuestion) {
        const updateOpts = session ? { session } : undefined;
        const result = await questionsCol.updateOne(
          scopedQuestionFilter({ _id: doc._id }, examMode),
          { $set: updates },
          updateOpts
        );

        if (result.matchedCount !== 1) {
          throw Object.assign(
            new Error(`Question ${questionId} changed after validation. Reload questions and validate the ZIP again.`),
            { statusCode: 409, code: 'CONCURRENCY_CONFLICT' }
          );
        }
        modified.push(questionId);
      }
    } catch (writeErr) {
      // In standalone / non-transactional fallback (when session is null), if an error happens
      // mid-way through Phase 2, attempt best-effort rollback of previously modified questions
      if (!session && modified.length > 0) {
        for (const rolledBackId of modified) {
          const originalDoc = snapshots.get(rolledBackId);
          if (originalDoc) {
            try {
              const { _id, ...originalFields } = originalDoc;
              await questionsCol.replaceOne({ _id: originalDoc._id }, originalFields);
            } catch (revertErr) {
              logger.error(
                { err: revertErr, questionId: rolledBackId },
                'Failed to compensate partial update in fallback mode'
              );
            }
          }
        }
      }
      throw writeErr;
    }
  };

  try {
    await withMongoTransaction(performWrites);
  } catch (err) {
    if (
      err.message &&
      (err.message.includes('replica set') ||
        err.message.includes('Transaction numbers') ||
        err.message.includes('standalone'))
    ) {
      await performWrites();
    } else {
      throw err;
    }
  }
}

/**
 * Validates and processes a bulk image ZIP archive for existing Question Bank questions.
 *
 * @param {Buffer|object} bufferOrOptions - ZIP file Buffer or options object
 * @param {object} [options] - Configuration options
 * @param {string} [options.action='validate'] - 'validate' or 'apply'
 * @param {string} [options.examMode='ssc'] - Active exam mode ('ssc' | 'iit-jam')
 * @param {Record<string, string|null>} [options.expectedUpdatedAts={}] - Concurrency control timestamps
 * @param {boolean} [options.validateOnly] - Dry-run flag (overrides action)
 * @param {boolean} [options.replaceOptionImages=true] - Replace existing option images
 * @returns {Promise<object>} Validation preview or apply outcome
 */
export async function processQuestionBankImageZip(bufferOrOptions, options = {}) {
  let buffer;
  let opts = {};

  if (Buffer.isBuffer(bufferOrOptions)) {
    buffer = bufferOrOptions;
    opts = options || {};
  } else if (bufferOrOptions && typeof bufferOrOptions === 'object') {
    buffer = bufferOrOptions.buffer || bufferOrOptions.zipBuffer;
    opts = bufferOrOptions;
  } else {
    buffer = bufferOrOptions;
    opts = options || {};
  }

  const examMode = opts.examMode || 'ssc';
  parseQuestionExamMode(examMode);

  const validateOnly = opts.validateOnly !== undefined
    ? Boolean(opts.validateOnly)
    : opts.action !== 'apply';

  const expectedUpdatedAts = opts.expectedUpdatedAts || {};

  // 1. SafeZip decompression & limits check
  let zip;
  try {
    zip = await loadSafeZip(buffer, ZIP_LIMITS);
  } catch (error) {
    throw fail(
      `ZIP rejected: ${error.message}. Use a standard, unencrypted ZIP within the documented limits.`,
      error.statusCode || 422
    );
  }

  // 2. Manifest location, size, and Zod validation
  const manifest = await extractAndValidateManifest(zip, examMode);

  // 3. Archive hygiene checks (traversal, symlinks, unexpected directories and files)
  const referencedFiles = new Set(manifest.images.map(row => row.file));
  for (const entry of Object.values(zip.files)) {
    const rawName = entry.unsafeOriginalName || entry.name;

    // Check 3.1: Strict path traversal and separator verification on ALL entries
    if (rawName.includes('..') || rawName.startsWith('/') || rawName.includes('\\')) {
      throw fail(
        `Unsafe ZIP entry path: ${rawName}. Use standard relative paths without .. or backslashes.`,
        422
      );
    }

    // Check 3.2: Symlink permissions check on ALL entries (including symlink folders)
    const isSymlinkPerm = Boolean(
      entry.unixPermissions &&
      (Number(entry.unixPermissions) & 0o170000) === 0o120000
    );
    if (isSymlinkPerm) {
      throw fail(
        `Symbolic links are forbidden: ${entry.name}. Use standard image files.`,
        422
      );
    }

    // Check 3.3: Directory entry validation
    const isDir = Boolean(entry.dir || entry.name.endsWith('/'));
    if (isDir) {
      const normalizedDir = entry.name.replace(/^\.\//, '').replace(/\/+$/, '');
      if (normalizedDir !== 'images' && normalizedDir !== '') {
        throw fail(
          `Unexpected file: ${entry.name}. Remove unused files, nested ZIPs and system metadata.`,
          422
        );
      }
      continue;
    }

    // Check 3.4: File payload inspection for symlink markers
    const bytes = await entry.async('nodebuffer');
    const isSymlinkPayload =
      bytes.length > 0 &&
      bytes.length < 260 &&
      !bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
      !bytes.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) &&
      !bytes.slice(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
      !bytes.slice(0, 4).equals(Buffer.from([0x47, 0x49, 0x46, 0x38])) &&
      /^[A-Za-z0-9_./-]+\.(png|jpg|jpeg|webp)$/.test(bytes.toString('utf8').trim());

    if (isSymlinkPayload) {
      throw fail(
        `Symbolic links are forbidden: ${entry.name}. Use standard image files.`,
        422
      );
    }
    if (entry.name !== 'manifest.json' && !referencedFiles.has(entry.name)) {
      throw fail(
        `Unexpected file: ${entry.name}. Remove unused files, nested ZIPs and system metadata.`,
        422
      );
    }
  }

  // 4. Missing files and duplicate targets check
  const seenTargets = new Set();
  for (const row of manifest.images) {
    const targetKey = `${row.questionId}:${row.target}:${row.language || ''}:${row.option || ''}`;
    if (seenTargets.has(targetKey)) {
      throw fail(`Duplicate target ${targetKey}. Keep one image per target.`, 422);
    }
    seenTargets.add(targetKey);

    const fileEntry = zip.file(row.file);
    if (!fileEntry) {
      throw fail(`Missing image ${row.file}. File names are case sensitive.`, 422);
    }
  }

  // 5. Question bank target resolution & option validation
  const collection = getQuestionsCollection();
  const resolvedQuestions = new Map();

  for (const row of manifest.images) {
    if (!resolvedQuestions.has(row.questionId)) {
      let question = await resolveQuestion(collection, row.questionId, { examMode });
      if (!question) {
        const unscoped = await resolveQuestion(collection, row.questionId, {});
        if (unscoped) {
          throw fail(
            `Question ${row.questionId} belongs to a different exam mode. Choose questions from the current exam mode (${examMode.toUpperCase()}).`,
            422
          );
        }
        throw fail(
          `Unknown question ID ${row.questionId}. Use the ID shown in the Question Bank, not its display number.`,
          422
        );
      }

      const checkDoc = question.topic
        ? { ...question, topic: canonicalJamTopic(question.topic) }
        : question;
      assertQuestionExamMode(checkDoc, examMode);
      resolvedQuestions.set(row.questionId, question);
    }

    const doc = resolvedQuestions.get(row.questionId);

    if (row.target === 'option') {
      const index = 'ABCDEFGH'.indexOf(row.option);
      if (
        index === -1 ||
        doc.questionType === 'NAT' ||
        !Array.isArray(doc.options) ||
        index >= doc.options.length
      ) {
        throw fail(
          `Question ${row.questionId}: option ${row.option} does not exist on this question. Use an existing option letter.`,
          422
        );
      }

      if (row.language === 'bn') {
        const bnOption = doc.translations?.bn?.options?.[index];
        if (bnOption === undefined || bnOption === null) {
          throw fail(
            `Question ${row.questionId}: option ${row.option}/bn does not exist. Use an existing option and language.`,
            422
          );
        }
      }
    }
  }

  // 6. Decode and standardize images via Sharp
  const converted = await decodeAndVerifyImages(zip, manifest.images);

  // 7. Calculate target preview and replacement statuses
  const targets = [];
  const expectedUpdatedAtsMap = {};

  for (const [qId, doc] of resolvedQuestions) {
    expectedUpdatedAtsMap[qId] = doc.updatedAt
      ? normalizeUpdatedAt(doc.updatedAt)
      : null;
  }

  for (const row of manifest.images) {
    const doc = resolvedQuestions.get(row.questionId);
    let replacesExisting = false;
    let status = 'New image · ready to upload';

    if (row.target === 'question') {
      replacesExisting = Boolean(doc.questionImage || doc.image);
      status = replacesExisting
        ? 'Already linked · will replace image'
        : 'New image · ready to upload';
    } else if (row.target === 'solution') {
      replacesExisting = Boolean(
        doc.solutionImage || (doc.solution && /!\[solution\]\([^)]+\)/.test(doc.solution))
      );
      status = replacesExisting
        ? 'Already linked · will replace solution image'
        : 'New image · ready to upload';
    } else if (row.target === 'option') {
      const index = 'ABCDEFGH'.indexOf(row.option);
      const text = row.language === 'bn' ? doc.translations?.bn?.options?.[index] : doc.options?.[index];
      const hasImage = typeof text === 'string' && /!\[[^\]]*\]\([^)]+\)/.test(text);
      const hasText = Boolean(text && String(text).trim());
      replacesExisting = hasImage || hasText;
      status = hasImage
        ? 'Already linked · will replace option image'
        : hasText
          ? 'New image · replaces existing text'
          : 'New image · ready to upload';
    }

    targets.push({
      questionId: row.questionId,
      target: row.target,
      option: row.option,
      language: row.language,
      file: row.file,
      replaces: replacesExisting,
      replacesExisting,
      status,
    });
  }

  // 8. Dry-run validation exit: ZERO writes to storage or DB
  if (validateOnly) {
    const summary = {
      questionCount: resolvedQuestions.size,
      fileCount: converted.size,
      targetCount: manifest.images.length,
      targets,
      expectedUpdatedAts: expectedUpdatedAtsMap,
    };
    return {
      valid: true,
      summary,
      ...summary,
    };
  }

  // 9. Pre-upload optimistic concurrency check
  for (const [questionId, doc] of resolvedQuestions) {
    const currentIso = normalizeUpdatedAt(doc.updatedAt);
    const expectedIso = normalizeUpdatedAt(expectedUpdatedAts[questionId]);

    if (currentIso !== expectedIso) {
      throw Object.assign(
        new Error(`Question ${questionId} changed after validation. Reload questions and validate the ZIP again.`),
        { statusCode: 409, code: 'CONCURRENCY_CONFLICT' }
      );
    }
  }

  // 10. Apply: Upload images to B2 and persist to MongoDB with rollback
  const prefix = `question-images/bank-imports/${randomUUID()}`;
  const attempted = [];
  const urls = new Map();
  let saving = false;

  try {
    let uploadIdx = 0;
    for (const [file, item] of converted) {
      const key = `${prefix}/${uploadIdx}.webp`;
      uploadIdx++;
      await putObject(key, item.bytes, 'image/webp');
      attempted.push(key);
      urls.set(file, {
        url: stableImageUrl(key),
        key,
        width: item.width,
        height: item.height,
      });
    }

    saving = true;

    const editsByQuestion = new Map();
    for (const row of manifest.images) {
      let editEntry = editsByQuestion.get(row.questionId);
      if (!editEntry) {
        const doc = resolvedQuestions.get(row.questionId);
        editEntry = {
          doc,
          updates: {},
        };
        editsByQuestion.set(row.questionId, editEntry);
      }
      const { doc, updates } = editEntry;
      const imageMeta = urls.get(row.file);

      if (row.target === 'question') {
        updates.questionImage = imageMeta.url;
        updates.questionImageKey = imageMeta.key;
        updates.questionImageWidth = imageMeta.width;
        updates.questionImageHeight = imageMeta.height;
        updates.question = mergeQuestionContent(updates.question ?? doc.question, imageMeta.url);
      } else if (row.target === 'solution') {
        updates.solutionImage = imageMeta.url;
        updates.solutionImageKey = imageMeta.key;
        updates.solutionImageWidth = imageMeta.width;
        updates.solutionImageHeight = imageMeta.height;
        updates.solution = mergeSolutionContent(updates.solution ?? doc.solution, imageMeta.url);
      } else if (row.target === 'option') {
        const optIndex = 'ABCDEFGH'.indexOf(row.option);
        const markdown = `![Option ${row.option}](${imageMeta.url})`;
        if (row.language === 'en') {
          updates.options ??= [...(doc.options || [])];
          updates.options[optIndex] = markdown;
        } else if (row.language === 'bn') {
          updates.translations ??= structuredClone(doc.translations || {});
          updates.translations.bn ??= {};
          updates.translations.bn.options ??= [...(doc.translations?.bn?.options || [])];
          updates.translations.bn.options[optIndex] = markdown;
        }
      }
    }

    const nowIso = new Date().toISOString();
    for (const [, { updates }] of editsByQuestion) {
      updates.updatedAt = nowIso;
    }

    await persistUpdates(editsByQuestion, examMode, expectedUpdatedAts);
    await invalidateQuestionMetadata();

    const summary = {
      questionCount: resolvedQuestions.size,
      fileCount: converted.size,
      targetCount: manifest.images.length,
      targets,
    };

    return {
      success: true,
      appliedCount: manifest.images.length,
      ...summary,
      summary,
      images: targets,
    };
  } catch (error) {
    if (!saving || error.statusCode) {
      await Promise.all(
        attempted.map(key =>
          deleteObject(key).catch(err =>
            logger.error({ err, key }, 'question bank ZIP cleanup failed')
          )
        )
      );
    } else {
      logger.error(
        { err: error, keys: attempted },
        'question bank ZIP save outcome unknown; reconcile objects before cleanup'
      );
    }

    if (error.statusCode) throw error;

    throw fail(
      saving
        ? 'Save outcome could not be confirmed. Reload questions to check images before retrying; report this to an administrator.'
        : 'B2 upload failed. No question changes were saved. Retry the ZIP; if it repeats, ask an administrator to check B2 connectivity and credentials.',
      503
    );
  }
}

export const importQuestionBankImageZip = processQuestionBankImageZip;
export const importQuestionImageZip = processQuestionBankImageZip;
export default processQuestionBankImageZip;
