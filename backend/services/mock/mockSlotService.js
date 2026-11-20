import { parseQuestionExamMode } from '../questions/questionExamMode.js';
import { cleanMongoDoc, summarizeSlot } from './mockModel.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { pyqCatalogSort, pyqSortProjection } from './pyqCatalogSort.js';
import * as questionCache from '../questions/questionCache.js';

import { invalidPaper } from '../assessmentPolicy.js';
import { getExamConfig, getSlotById as getStaticSlotById, getSlotsForExam as getStaticSlotsForExam, MOCK_TEST_SLOTS } from '../../config/exam-config.js';
import { getMockSlotsCollection } from '../../config/mongodb.js';
import { mutateMockCatalog, readMockCatalogMetadata } from '../../repositories/mockCatalogMetadataRepository.js';

async function invalidateMockCatalogCache(examSlug) {
  if (typeof questionCache.invalidateQuestionCaches === 'function') {
    await questionCache.invalidateQuestionCaches({
      ...(examSlug ? { exam: examSlug } : {}),
      bumpRevision: true,
    }).catch(() => {});
  }
}

// Read saved paper metadata; question arrays never cross the driver.
const readSlotCatalog = (slots, examSlug) => slots.aggregate([
  { $match: { examSlug } },
  { $project: { fixedQuestions: 0, sourcePaper: 0, _fixedCount: 0, _id: 0, _cosmosRid: 0 } },
  { $sort: { order: 1, id: 1 } },
  { $limit: 500 },
]).toArray();

// Inspect current links so older ZIP imports work without a metadata backfill,
// and removing all imported images clears the status automatically.
export function hasZipImages(slot) {
  const containsZipImage = value => {
    if (!value) return false;
    if (typeof value === 'object') return Object.values(value).some(containsZipImage);
    if (typeof value !== 'string') return false;
    return [...value.matchAll(/\/api\/upload\/image\/([A-Za-z0-9_-]+)/g)].some(([, encoded]) =>
      Buffer.from(encoded, 'base64url').toString('utf8').startsWith('question-images/paper-imports/'));
  };
  const questions = slot.sourcePaper
    ? Object.values(slot.sourcePaper.sections || {}).flatMap(section => section.questions || [])
    : slot.fixedQuestions || [];
  return questions.some(question => containsZipImage([
    question.questionImage, question.image, question.options, question.optionImages,
  ]));
}

export async function fetchSlotsForExam(examSlug) {
  try {
    const resources = await readSlotCatalog(getMockSlotsCollection(), examSlug);
    return (resources.length ? resources : getStaticSlotsForExam(examSlug)).map(summarizeSlot);
  } catch (err) {
    runtimeLog.warn(`fetchSlotsForExam failed for ${examSlug}, falling back to static config:`, err.message);
    return getStaticSlotsForExam(examSlug).map(summarizeSlot);
  }
}

export async function fetchCachedSlotsForExam(examSlug) {
  if (typeof questionCache.cachedExamConfig === 'function') {
    return questionCache.cachedExamConfig({ scope: 'mock-slots', exam: examSlug }, () =>
      fetchSlotsForExam(examSlug),
    );
  }
  return fetchSlotsForExam(examSlug);
}

export async function fetchCachedSlotById(examSlug, slotId, options = {}) {
  if (typeof questionCache.cachedExamConfig === 'function') {
    const summaryKey = options?.summaryOnly ? 'summary' : 'full';
    return questionCache.cachedExamConfig(
      { scope: 'mock-slot', ...(examSlug ? { exam: examSlug } : {}), slotId: String(slotId || ''), variant: summaryKey },
      () => fetchSlotById(examSlug, slotId, options),
    );
  }
  return fetchSlotById(examSlug, slotId, options);
}

// Saved counts supply totals; Mongo returns only the requested catalog page.
export async function fetchSlotPage(examSlug, { kind = 'mock', tier = '', year = '', offset = 0, limit = 20 } = {}) {
  const { metadata, total } = await readMockCatalogMetadata(examSlug, { kind, tier, year });
  const pyq = { $or: [{ $eq: ['$isPyq', true] }, { $eq: [{ $toLower: { $ifNull: ['$type', ''] } }, 'pyq'] }] };
  const filter = { _kind: kind, ...(year ? { _year: Number(year) } : {}), ...(tier ? { $or: [{ tier }, { tier: { $in: [null, ''] } }] } : {}) };
  // Drop large embedded question arrays immediately after $match so $sort never buffers multi-MB papers.
  const slots = limit === 0 ? [] : await getMockSlotsCollection().aggregate([
    { $match: { examSlug } },
    { $project: { fixedQuestions: 0, sourcePaper: 0, _fixedCount: 0, _id: 0, _cosmosRid: 0 } },
    { $set: { _kind: { $cond: [pyq, 'pyq', 'mock'] }, _year: { $convert: { input: '$year', to: 'int', onError: null, onNull: null } } } },
    { $match: filter },
    ...(kind === 'pyq' ? pyqCatalogSort : [{ $sort: { order: 1, id: 1 } }]),
    { $skip: offset },
    { $limit: limit },
    { $project: { _kind: 0, _year: 0, ...pyqSortProjection } },
  ], { allowDiskUse: true }).toArray();
  return { slots: slots.map(summarizeSlot), metadata, total, nextOffset: limit > 0 && offset + limit < total ? offset + limit : null };
}

export async function fetchAllAdminSlots(
  examFilter = null,
  examMode = undefined
) {
  const mode = parseQuestionExamMode(examMode);
  const inMode = slot => !mode || String(slot.examSlug).startsWith('iit-jam') === (mode === 'iit-jam');
  try {
    const filter = mode ? { examSlug: mode === 'iit-jam' ? /^iit-jam/ : { $not: /^iit-jam/ } } : {};

    if (
      examFilter &&
      examFilter !== 'all'
    ) {
      if (mode && !inMode({ examSlug: examFilter })) return [];
      filter.examSlug = examFilter;
    }

    const collection = getMockSlotsCollection();
    // Project out multi-MB fixedQuestions/sourcePaper arrays; compute questionCount server-side.
    const resources = await collection.aggregate([
      { $match: filter },
      {
        $project: {
          _id: 0,
          id: 1,
          examSlug: 1,
          configKey: 1,
          title: 1,
          tier: 1,
          type: 1,
          year: 1,
          examDate: 1,
          paperMetadata: 1,
          shift: 1,
          isFree: 1,
          hasZipImages: 1,
          order: 1,
          createdAt: 1,
          updatedAt: 1,
          questionCount: {
            $cond: [
              { $gt: [{ $size: { $cond: [{ $isArray: '$fixedQuestions' }, '$fixedQuestions', []] } }, 0] },
              { $size: '$fixedQuestions' },
              { $ifNull: ['$questionCount', 0] },
            ],
          },
        },
      },
      { $sort: { examSlug: 1, order: 1, id: 1 } },
      { $limit: 2000 },
    ], { allowDiskUse: true }).toArray();

    // Only inspect embedded papers for legacy docs missing a persisted boolean hasZipImages flag.
    const missingZipFlag = resources.filter(s => typeof s.hasZipImages !== 'boolean');
    const computedZipByKey = new Map();
    if (missingZipFlag.length > 0) {
      const legacyDocs = await collection.find(
        { id: { $in: missingZipFlag.map(s => s.id) } },
        { projection: { _id: 0, id: 1, examSlug: 1, fixedQuestions: 1, sourcePaper: 1 } }
      ).toArray();
      for (const doc of legacyDocs) {
        computedZipByKey.set(`${doc.examSlug}:${doc.id}`, hasZipImages(doc));
      }
    }

    if (resources.length > 0) {
      return resources.map(
        (raw) => {
          const s =
            cleanMongoDoc(raw);

          return {
            id: s.id,
            examSlug: s.examSlug,
            configKey: s.configKey,
            title: s.title,
            tier: s.tier,
            type:
              s.type ||
              (
                s.id?.includes('pyq')
                  ? 'pyq'
                  : 'mock'
              ),
            year: s.year || null,
            examDate: s.examDate || s.paperMetadata?.examDate || null,
            shift: s.shift || null,
            isFree: Boolean(s.isFree),
            hasZipImages: typeof s.hasZipImages === 'boolean'
              ? s.hasZipImages
              : Boolean(computedZipByKey.get(`${s.examSlug}:${s.id}`)),
            order: s.order || 1,
            questionCount: s.questionCount || 0,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          };
        }
      );
    }

    let filtered =
      MOCK_TEST_SLOTS.filter(inMode);

    if (
      examFilter &&
      examFilter !== 'all'
    ) {
      filtered =
        filtered.filter(
          (slot) =>
            slot.examSlug ===
            examFilter
        );
    }

    return filtered.map(
      (s) => ({
        ...s,
        type:
          s.type ||
          (
            s.id.includes('pyq')
              ? 'pyq'
              : 'mock'
          ),
        questionCount: 0,
        hasZipImages: false,
      })
    );
  } catch (err) {
    runtimeLog.warn(
      'fetchAllAdminSlots fallback to defaults:',
      err.message
    );

    let filtered =
      MOCK_TEST_SLOTS.filter(inMode);

    if (
      examFilter &&
      examFilter !== 'all'
    ) {
      filtered =
        filtered.filter(
          (slot) =>
            slot.examSlug ===
            examFilter
        );
    }

    return filtered.map(
      (s) => ({
        ...s,
        type:
          s.type ||
          (
            s.id.includes('pyq')
              ? 'pyq'
              : 'mock'
          ),
        questionCount: 0,
        hasZipImages: false,
      })
    );
  }
}

export async function fetchSlotById(
  examSlug,
  slotId,
  { summaryOnly = false } = {}
) {
  if (typeof slotId !== 'string' || !slotId.trim()) return null;
  if (examSlug !== undefined && examSlug !== null && typeof examSlug !== 'string') return null;
  const safeSlotId = String(slotId).trim();
  const safeExamSlug = typeof examSlug === 'string' && examSlug.trim() ? String(examSlug).trim() : null;

  try {
    const filter =
      safeExamSlug
        ? {
            id: safeSlotId,
            examSlug: safeExamSlug,
          }
        : {
            id: safeSlotId,
          };

    const projection = summaryOnly
      ? { _id: 0, _cosmosRid: 0, fixedQuestions: 0, sourcePaper: 0 }
      : { _id: 0, _cosmosRid: 0 };

    const slot =
      await getMockSlotsCollection()
        .findOne(filter, { projection });

    if (slot) {
      return slot;
    }

    const fallback = getStaticSlotById(safeSlotId);
    if (fallback && safeExamSlug && fallback.examSlug !== safeExamSlug) return null;
    return fallback;
  } catch (err) {
    runtimeLog.warn(
      `fetchSlotById error for ${safeSlotId}:`,
      err.message
    );

    const fallback = getStaticSlotById(safeSlotId);
    if (fallback && safeExamSlug && fallback.examSlug !== safeExamSlug) return null;
    return fallback;
  }
}

export async function seedDefaultSlots(examMode = undefined) {
  const mode = parseQuestionExamMode(examMode);
  let createdCount = 0;

  for (const slot of MOCK_TEST_SLOTS) {
    if (mode && String(slot.examSlug).startsWith('iit-jam') !== (mode === 'iit-jam')) continue;
    try {
      const now =
        new Date().toISOString();

      const result =
        await mutateMockCatalog(slot.examSlug, (slots, options) => slots.updateOne(
          {
            id: slot.id,
            examSlug: slot.examSlug,
          },
          {
            $setOnInsert: {
              ...slot,
              type:
                slot.type ||
                'mock',
              createdAt: now,
              updatedAt: now,
            },
          },
          {
            ...options,
            upsert: true,
          }
        ));

      if (result.upsertedCount > 0) {
        createdCount++;
      }
    } catch (err) {
      runtimeLog.warn(
        `Failed to seed slot ${slot.id}:`,
        err.message
      );
    }
  }

  await invalidateMockCatalogCache(null);
  return {
    totalSeeded: createdCount,
  };
}

export async function createMockSlot(
  slotData
) {
  if (getExamConfig(slotData.configKey)?.requireFixedPaper) throw invalidPaper('Upload a complete fixed paper for IIT JAM; dynamic slots are not supported.');
  if (slotData.assessmentMode === 'confidential') throw invalidPaper('Upload a fixed paper to create a confidential assessment');
  if (
    !slotData.id ||
    !slotData.examSlug ||
    !slotData.configKey ||
    !slotData.title
  ) {
    throw new Error(
      'Missing required slot fields: id, examSlug, configKey, title'
    );
  }

  const slots =
    getMockSlotsCollection();

  const existing =
    await slots.findOne({
      id: slotData.id,
      examSlug: slotData.examSlug,
    });

  if (existing) {
    throw new Error(
      `Mock slot already exists: ${slotData.id}`
    );
  }

  const now =
    new Date().toISOString();
  const doc = {
    id: slotData.id,
    examSlug: slotData.examSlug,
    configKey: slotData.configKey,
    title: slotData.title,
    tier: slotData.tier || null,
    type: slotData.type || 'mock',
    isPyq: String(slotData.type || 'mock').toLowerCase() === 'pyq',
    year: slotData.year || null,
    shift: slotData.shift || null,
    isFree: Boolean(slotData.isFree),
    order:
      Number(slotData.order) || 1,
    fixedQuestions:
      Array.isArray(slotData.questions)
        ? slotData.questions
        : null,
    questionCount: Array.isArray(slotData.questions) ? slotData.questions.length : 0,
    hasFixedPaper: Array.isArray(slotData.questions) && slotData.questions.length > 0,
    createdAt: now,
    updatedAt: now,
  };

  await mutateMockCatalog(doc.examSlug, async (collection, options) => {
    if (await collection.findOne({ id: doc.id, examSlug: doc.examSlug }, options)) throw new Error(`Mock slot already exists: ${doc.id}`);
    return collection.insertOne(doc, options);
  });

  await invalidateMockCatalogCache(doc.examSlug);
  return cleanMongoDoc(doc);
}

const ALLOWED_SLOT_UPDATES = new Set([
  'title', 'tier', 'type', 'year', 'shift', 'examDate', 'isFree', 'order', 'configKey', 'timingPolicy',
]);

function sanitizeSlotUpdates(updates) {
  const src = updates && typeof updates === 'object' ? updates : {};
  const safeUpdates = {};
  for (const key of ALLOWED_SLOT_UPDATES) {
    if (!Object.hasOwn(src, key) || src[key] === undefined) continue;
    const value = src[key];
    if (key === 'order') {
      safeUpdates.order = Number(value) || 1;
    } else if (key === 'isFree') {
      safeUpdates.isFree = Boolean(value);
    } else if (key === 'year' || key === 'shift') {
      if (value === null) safeUpdates[key] = null;
      else if (typeof value === 'number' && Number.isFinite(value)) safeUpdates[key] = value;
      else if (typeof value === 'string') safeUpdates[key] = value;
    } else if (value === null) {
      safeUpdates[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safeUpdates[key] = String(value);
    }
  }
  if (safeUpdates.type !== undefined) safeUpdates.isPyq = String(safeUpdates.type).toLowerCase() === 'pyq';
  return safeUpdates;
}

export async function updateMockSlot(
  examSlug,
  slotId,
  updates
) {
  if (updates?.assessmentMode !== undefined || updates?.fixedQuestions !== undefined || updates?.questions !== undefined || updates?.sourcePaper !== undefined || updates?.paperMetadata !== undefined) {
    throw invalidPaper('Use paper upload to change assessment mode or questions');
  }
  const existing = await fetchSlotById(examSlug, slotId, { summaryOnly: true });

  if (!existing) {
    throw Object.assign(new Error(`Slot not found: ${slotId}`), { statusCode: 404 });
  }

  const safeUpdates = sanitizeSlotUpdates(updates);
  const now = new Date().toISOString();
  const targetExamSlug = String(existing.examSlug || examSlug || '').trim();
  const targetSlotId = String(existing.id).trim();
  const patch = {
    ...safeUpdates,
    updatedAt: now,
  };
  const insertDefaults = Object.fromEntries(
    Object.entries({
      ...cleanMongoDoc(existing),
      id: targetSlotId,
      examSlug: targetExamSlug,
      createdAt: existing.createdAt || now,
    }).filter(([key]) => !Object.hasOwn(patch, key))
  );

  await mutateMockCatalog(targetExamSlug, (collection, options) => collection.updateOne(
    { id: targetSlotId, examSlug: targetExamSlug },
    {
      $set: patch,
      $setOnInsert: insertDefaults,
    },
    { ...options, upsert: true }
  ));

  await invalidateMockCatalogCache(targetExamSlug);
  return summarizeSlot({ ...cleanMongoDoc(existing), ...patch, id: targetSlotId, examSlug: targetExamSlug });
}

export async function deleteMockSlot(
  examSlug,
  slotId
) {
  if (typeof examSlug !== 'string' || !examSlug.trim() || typeof slotId !== 'string' || !slotId.trim()) {
    throw Object.assign(new Error('Invalid mock slot identifier'), { statusCode: 400 });
  }
  const safeExamSlug = String(examSlug).trim();
  const safeSlotId = String(slotId).trim();

  const existing = await getMockSlotsCollection().findOne(
    { id: safeSlotId, examSlug: safeExamSlug },
    { projection: { _id: 1 } }
  );

  if (!existing) {
    throw Object.assign(new Error(`Slot not found: ${safeSlotId}`), { statusCode: 404 });
  }

  await mutateMockCatalog(safeExamSlug, (collection, options) => collection.deleteOne({
    id: safeSlotId,
    examSlug: safeExamSlug,
  }, options));

  await invalidateMockCatalogCache(safeExamSlug);
  return {
    success: true,
    id: safeSlotId,
  };
}
