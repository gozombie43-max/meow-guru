import { cleanMongoDoc, summarizeSlot } from './mockModel.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';

import { invalidPaper } from '../assessmentPolicy.js';
import { getSlotById as getStaticSlotById, getSlotsForExam as getStaticSlotsForExam, MOCK_TEST_SLOTS } from '../../config/exam-config.js';
import { getMockSlotsCollection } from '../../config/mongodb.js';

export async function fetchSlotsForExam(
  examSlug
) {
  try {
    const slots =
      getMockSlotsCollection();

    let resources =
      await slots
        .find({
          examSlug,
        })
        .sort({
          order: 1,
        })
        .toArray();

    if (resources.length > 0) {
      return resources.map(
        summarizeSlot
      );
    }

    const staticSlots =
      getStaticSlotsForExam(
        examSlug
      );

    if (staticSlots.length === 0) {
      return [];
    }

    const now =
      new Date().toISOString();

    for (const slot of staticSlots) {
      try {
        await slots.updateOne(
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
            upsert: true,
          }
        );
      } catch (err) {
        runtimeLog.warn(
          `Failed to seed slot ${slot.id}:`,
          err.message
        );
      }
    }

    resources =
      await slots
        .find({
          examSlug,
        })
        .sort({
          order: 1,
        })
        .toArray();

    return resources.length
      ? resources.map(
          summarizeSlot
        )
      : staticSlots.map(
          (slot) =>
            summarizeSlot(slot)
        );
  } catch (err) {
    runtimeLog.warn(
      `fetchSlotsForExam failed for ${examSlug}, falling back to static config:`,
      err.message
    );

    return getStaticSlotsForExam(
      examSlug
    );
  }
}

export async function fetchAllAdminSlots(
  examFilter = null
) {
  try {
    const filter = {};

    if (
      examFilter &&
      examFilter !== 'all'
    ) {
      filter.examSlug =
        examFilter;
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
      MOCK_TEST_SLOTS;

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
      MOCK_TEST_SLOTS;

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

export async function seedDefaultSlots() {
  const slots =
    getMockSlotsCollection();
  let createdCount = 0;

  for (const slot of MOCK_TEST_SLOTS) {
    try {
      const now =
        new Date().toISOString();

      const result =
        await slots.updateOne(
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
            upsert: true,
          }
        );

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
    year: slotData.year || null,
    shift: slotData.shift || null,
    isFree: Boolean(slotData.isFree),
    order:
      Number(slotData.order) || 1,
    fixedQuestions:
      Array.isArray(slotData.questions)
        ? slotData.questions
        : null,
    createdAt: now,
    updatedAt: now,
  };

  await slots.insertOne(doc);

  return cleanMongoDoc(doc);
}

export async function updateMockSlot(
  examSlug,
  slotId,
  updates
) {
  if (updates?.assessmentMode !== undefined || updates?.fixedQuestions !== undefined || updates?.questions !== undefined) {
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

  await getMockSlotsCollection()
    .updateOne(
      {
        id: updatedDoc.id,
        examSlug: updatedDoc.examSlug,
      },
      {
        $set: updatedDoc,
      },
      {
        upsert: true,
      }
    );

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

  await getMockSlotsCollection()
    .deleteOne({
      id: slotId,
      examSlug,
    });

  return {
    success: true,
    id: slotId,
  };
}
