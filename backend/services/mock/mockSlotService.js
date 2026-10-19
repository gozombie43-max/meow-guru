import { parseQuestionExamMode } from '../questions/questionExamMode.js';
import { cleanMongoDoc, summarizeSlot } from './mockModel.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { pyqCatalogSort, pyqSortProjection } from './pyqCatalogSort.js';

import { invalidPaper } from '../assessmentPolicy.js';
import { getExamConfig, getSlotById as getStaticSlotById, getSlotsForExam as getStaticSlotsForExam, MOCK_TEST_SLOTS } from '../../config/exam-config.js';
import { getMockSlotsCollection } from '../../config/mongodb.js';
import { mutateMockCatalog, readMockCatalogMetadata } from '../../repositories/mockCatalogMetadataRepository.js';

// Read saved paper metadata; question arrays never cross the driver.
const readSlotCatalog = (slots, examSlug) => slots.aggregate([
  { $match: { examSlug } },
  { $sort: { order: 1 } },
  { $project: { fixedQuestions: 0, sourcePaper: 0, _fixedCount: 0, _id: 0, _cosmosRid: 0 } },
]).toArray();

export async function fetchSlotsForExam(examSlug) {
  try {
    const resources = await readSlotCatalog(getMockSlotsCollection(), examSlug);
    return (resources.length ? resources : getStaticSlotsForExam(examSlug)).map(summarizeSlot);
  } catch (err) {
    runtimeLog.warn(`fetchSlotsForExam failed for ${examSlug}, falling back to static config:`, err.message);
    return getStaticSlotsForExam(examSlug).map(summarizeSlot);
  }
}

// Saved counts supply totals; Mongo returns only the requested catalog page.
export async function fetchSlotPage(examSlug, { kind = 'mock', tier = '', year = '', offset = 0, limit = 20 } = {}) {
  const { metadata, total } = await readMockCatalogMetadata(examSlug, { kind, tier, year });
  const pyq = { $or: [{ $eq: ['$isPyq', true] }, { $eq: [{ $toLower: { $ifNull: ['$type', ''] } }, 'pyq'] }] };
  const filter = { _kind: kind, ...(year ? { _year: Number(year) } : {}), ...(tier ? { $or: [{ tier }, { tier: { $in: [null, ''] } }] } : {}) };
  const slots = limit === 0 ? [] : await getMockSlotsCollection().aggregate([
    { $match: { examSlug } },
    { $set: { _kind: { $cond: [pyq, 'pyq', 'mock'] }, _year: { $convert: { input: '$year', to: 'int', onError: null, onNull: null } } } },
        { $match: filter }, ...(kind === 'pyq' ? pyqCatalogSort : [{ $sort: { order: 1, id: 1 } }]), { $skip: offset }, { $limit: limit },
        { $project: { fixedQuestions: 0, sourcePaper: 0, _fixedCount: 0, _kind: 0, _year: 0, _id: 0, _cosmosRid: 0, ...pyqSortProjection } },
  ]).toArray();
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

    const resources =
      await getMockSlotsCollection()
        .find(filter)
        .sort({
          examSlug: 1,
          order: 1,
        })
        .toArray();

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
            order: s.order || 1,
            questionCount:
              s.fixedQuestions?.length ||
              s.questionCount ||
              0,
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
      })
    );
  }
}

export async function fetchSlotById(
  examSlug,
  slotId
) {
  try {
    const filter =
      examSlug
        ? {
            id: slotId,
            examSlug,
          }
        : {
            id: slotId,
          };

    const slot =
      await getMockSlotsCollection()
        .findOne(
          filter,
          {
            projection: {
              _id: 0,
              _cosmosRid: 0,
            },
          }
        );

    if (slot) {
      return slot;
    }

    return getStaticSlotById(
      slotId
    );
  } catch (err) {
    runtimeLog.warn(
      `fetchSlotById error for ${slotId}:`,
      err.message
    );

    return getStaticSlotById(
      slotId
    );
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

  return cleanMongoDoc(doc);
}

export async function updateMockSlot(
  examSlug,
  slotId,
  updates
) {
  if (updates?.assessmentMode !== undefined || updates?.fixedQuestions !== undefined || updates?.questions !== undefined || updates?.sourcePaper !== undefined || updates?.paperMetadata !== undefined) {
    throw invalidPaper('Use paper upload to change assessment mode or questions');
  }
  const existing =
    await fetchSlotById(
      examSlug,
      slotId
    );

  if (!existing) {
    throw new Error(
      `Slot not found: ${slotId}`
    );
  }

  const {
    _id,
    _cosmosRid,
    id: _updateId,
    examSlug: _updateExam,
    ...safeUpdates
  } = updates || {};

  const updatedDoc = {
    ...cleanMongoDoc(existing),
    ...safeUpdates,
    id: existing.id,
    examSlug:
      existing.examSlug ||
      examSlug,
    createdAt:
      existing.createdAt ||
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString(),
  };
  if (safeUpdates.type !== undefined) updatedDoc.isPyq = String(safeUpdates.type).toLowerCase() === 'pyq';

  await mutateMockCatalog(updatedDoc.examSlug, (collection, options) => collection.updateOne(
      {
        id: updatedDoc.id,
        examSlug: updatedDoc.examSlug,
      },
      {
        $set: updatedDoc,
      },
      {
        ...options,
        upsert: true,
      }
    ));

  return updatedDoc;
}

export async function deleteMockSlot(
  examSlug,
  slotId
) {
  const existing =
    await fetchSlotById(
      examSlug,
      slotId
    );

  if (!existing) {
    throw new Error(
      `Slot not found: ${slotId}`
    );
  }

  await mutateMockCatalog(examSlug, (collection, options) => collection.deleteOne({
      id: slotId,
      examSlug,
    }, options));

  return {
    success: true,
    id: slotId,
  };
}
