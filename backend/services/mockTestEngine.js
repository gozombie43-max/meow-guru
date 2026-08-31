import { getExamConfig, getSlotById as getStaticSlotById, getSlotsForExam as getStaticSlotsForExam, MOCK_TEST_SLOTS } from '../config/exam-config.js';
import {
  getQuestionsCollection,
  getMockAttemptsCollection,
  getMockSlotsCollection,
} from '../config/mongodb.js';

// ─── Helpers ──────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegex(value = '') {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function exactCI(value) {
  return new RegExp(
    `^${escapeRegex(value)}$`,
    'i'
  );
}

function cleanMongoDoc(doc) {
  if (!doc) return doc;

  const {
    _id,
    _cosmosRid,
    ...clean
  } = doc;

  return clean;
}

function summarizeSlot(slot) {
  const clean = cleanMongoDoc(slot);
  const {
    fixedQuestions,
    ...summary
  } = clean;

  return {
    ...summary,
    hasFixedPaper: Boolean(
      fixedQuestions &&
      fixedQuestions.length > 0
    ),
    questionCount:
      fixedQuestions?.length ||
      clean.questionCount ||
      0,
  };
}

function stripAnswer(q) {
  const { correctAnswer, answer, ...rest } = q;
  return rest;
}

// ─── Slot Management with MongoDB ─────────────────────────

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
        console.warn(
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
    console.warn(
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
    console.warn(
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
    console.warn(
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
      console.warn(
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
// ─── Full Paper Upload (Mock & PYQ) ─────────────────────────

export async function uploadFullPaper({ slotData, questions }) {
  if (!slotData || !slotData.id || !slotData.examSlug || !slotData.configKey || !slotData.title) {
    throw new Error('Missing slot metadata (id, examSlug, configKey, title)');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array cannot be empty');
  }

  const slotCollection =
    getMockSlotsCollection();
  const questionsCollection =
    getQuestionsCollection();

  // Normalize questions
  const normalizedQuestions = questions.map((q, idx) => {
    const qId = q.id ? String(q.id).trim() : `${slotData.id}_q${idx + 1}`;
    const options = Array.isArray(q.options) ? q.options : (q.options ? Object.values(q.options) : []);
    const correctAnswer = q.correctAnswer ?? q.answer ?? q.correctOption ?? 0;

    return {
      id: qId,
      question: q.question || '',
      options,
      correctAnswer,
      solution: q.solution || q.explanation || '',
      subject: q.subject || 'General',
      topic: q.topic || 'General',
      sectionKey: q.sectionKey || q.section || null,
      difficulty: q.difficulty || 'medium',
      questionImage: q.questionImage || null,
      solutionImage: q.solutionImage || null,
      exam: slotData.examSlug,
      tier: slotData.tier || null,
      testId: slotData.id,
      year: slotData.year || null,
      shift: slotData.shift || null,
    };
  });

  // 1. Save or update slot
  const slotDoc = {
    id: slotData.id,
    examSlug: slotData.examSlug,
    configKey: slotData.configKey,
    title: slotData.title,
    tier: slotData.tier || null,
    type: slotData.type || 'mock',
    year: slotData.year || null,
    shift: slotData.shift || null,
    isFree: Boolean(slotData.isFree),
    order: Number(slotData.order) || 1,
    questionCount: normalizedQuestions.length,
    fixedQuestions: normalizedQuestions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await slotCollection.updateOne(
    {
      id: slotDoc.id,
      examSlug: slotDoc.examSlug,
    },
    {
      $set: slotDoc,
    },
    {
      upsert: true,
    }
  );

  // 2. Also optionally batch upsert questions into question bank
  let insertedToBank = 0;
  for (const q of normalizedQuestions) {
    try {
      await questionsCollection.updateOne(
        {
          id: q.id,
          topic: q.topic,
        },
        {
          $set: q,
        },
        {
          upsert: true,
        }
      );
      insertedToBank++;
    } catch (err) {
      console.warn(`Upsert question ${q.id} warning:`, err.message);
    }
  }

  return {
    success: true,
    slotId: slotDoc.id,
    examSlug: slotDoc.examSlug,
    totalQuestions: normalizedQuestions.length,
    insertedToBank,
  };
}

// ─── buildPaper ───────────────────────────────────────────

export async function buildPaper({ examSlug, testId }) {
  const slot = await fetchSlotById(examSlug, testId);
  if (!slot) throw new Error(`Slot not found: ${testId}`);

  const config = getExamConfig(slot.configKey);
  if (!config) throw new Error(`Config not found: ${slot.configKey}`);

  const questionsCollection =
    getQuestionsCollection();
  const sections = [];
  const answerKey = {};

  // Case A: Slot has a fixed paper (e.g. uploaded official PYQ or curated mock)
  if (slot.fixedQuestions && Array.isArray(slot.fixedQuestions) && slot.fixedQuestions.length > 0) {
    const allFixed = slot.fixedQuestions;

    for (const section of config.sections) {
      // Find questions explicitly tagged with sectionKey or matching section topics/subject
      let sectionQuestions = allFixed.filter(q => {
        if (q.sectionKey && q.sectionKey.toLowerCase() === section.key.toLowerCase()) return true;
        if (q.subject && q.subject.toLowerCase() === section.label.toLowerCase()) return true;
        if (q.topic && section.topics.some(t => t.toLowerCase() === q.topic.toLowerCase())) return true;
        return false;
      });

      // If no tag matching, take slice based on section questionCount
      if (sectionQuestions.length === 0) {
        const offset = sections.reduce((sum, s) => sum + s.questions.length, 0);
        sectionQuestions = allFixed.slice(offset, offset + section.questionCount);
      }

      for (const q of sectionQuestions) {
        answerKey[q.id] = q.correctAnswer ?? q.answer ?? null;
      }

      sections.push({
        key: section.key,
        label: section.label,
        questionCount: sectionQuestions.length || section.questionCount,
        timeLimitMin: section.timeLimitMin,
        marking: section.marking,
        questions: sectionQuestions.map(stripAnswer),
      });
    }

    return {
      clientPaper: {
        examName: config.name,
        configKey: config.key,
        compositeTimer: config.compositeTimer,
        totalDurationMin: config.totalDurationMin,
        sections,
      },
      answerKey,
    };
  }

  // Case B: Dynamic paper generation from question pool
  for (const section of config.sections) {
    const overfetchCount = section.questionCount * 3;
    const topicList = section.topics.map(t => t.toLowerCase());

    let allQuestions = [];
    if (topicList.length > 0) {
      try {
        const topicRegexes =
          topicList.map(
            (topic) =>
              exactCI(topic)
          );

        const resources =
          await questionsCollection
            .find(
              {
                topic: {
                  $in: topicRegexes,
                },
              },
              {
                projection: {
                  _id: 0,
                  _cosmosRid: 0,
                },
              }
            )
            .limit(
              overfetchCount *
              Math.max(
                topicList.length,
                1
              )
            )
            .toArray();

        allQuestions =
          resources;
      } catch (err) {
        console.warn(`Query for topics [${topicList.join(', ')}] failed:`, err.message);
      }
    }

    // Deduplicate by id
    const seen = new Set();
    allQuestions = allQuestions.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });

    // Apply 30/50/20 difficulty distribution
    const easy = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy');
    const medium = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium');
    const hard = allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard');
    const rest = allQuestions.filter(q => !['easy', 'medium', 'hard'].includes((q.difficulty || '').toLowerCase()));

    const easyCount = Math.round(section.questionCount * 0.3);
    const hardCount = Math.round(section.questionCount * 0.2);
    const mediumCount = section.questionCount - easyCount - hardCount;

    let selected = [
      ...shuffleArray(easy).slice(0, easyCount),
      ...shuffleArray(medium).slice(0, mediumCount),
      ...shuffleArray(hard).slice(0, hardCount),
    ];

    if (selected.length < section.questionCount) {
      const selectedIds = new Set(selected.map(q => q.id));
      const remaining = [...allQuestions, ...rest].filter(q => !selectedIds.has(q.id));
      selected.push(...shuffleArray(remaining).slice(0, section.questionCount - selected.length));
    }

    selected = shuffleArray(selected).slice(0, section.questionCount);

    for (const q of selected) {
      answerKey[q.id] = q.correctAnswer ?? q.answer ?? null;
    }

    sections.push({
      key: section.key,
      label: section.label,
      questionCount: section.questionCount,
      timeLimitMin: section.timeLimitMin,
      marking: section.marking,
      questions: selected.map(stripAnswer),
    });
  }

  return {
    clientPaper: {
      examName: config.name,
      configKey: config.key,
      compositeTimer: config.compositeTimer,
      totalDurationMin: config.totalDurationMin,
      sections,
    },
    answerKey,
  };
}

// ─── gradeAttempt ─────────────────────────────────────────

export function gradeAttempt({ attemptDoc }) {
  const config = getExamConfig(attemptDoc.configKey);
  if (!config) throw new Error(`Config not found: ${attemptDoc.configKey}`);

  const sectionResults = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const sectionConfig of config.sections) {
    const paperSection = (attemptDoc.paper?.sections || []).find(s => s.key === sectionConfig.key);
    if (!paperSection) continue;

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (const q of paperSection.questions) {
      const userAnswer = attemptDoc.answers?.[q.id];
      const correctAnswer = attemptDoc.answerKey?.[q.id];

      if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
        skipped++;
      } else if (String(userAnswer) === String(correctAnswer)) {
        correct++;
      } else {
        incorrect++;
      }
    }

    const sectionScore = (correct * sectionConfig.marking.correct) - (incorrect * sectionConfig.marking.incorrect);
    const sectionMax = paperSection.questions.length * sectionConfig.marking.correct;

    sectionResults.push({
      key: sectionConfig.key,
      label: sectionConfig.label,
      correct,
      incorrect,
      skipped,
      total: paperSection.questions.length,
      score: Math.round(sectionScore * 100) / 100,
      maxScore: sectionMax,
      accuracy: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 10000) / 100 : 0,
    });

    totalScore += sectionScore;
    maxScore += sectionMax;
  }

  return {
    sections: sectionResults,
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore,
    percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0,
  };
}

// ─── computePercentile ───────────────────────────────────

export async function computePercentile({
  examSlug,
  testId,
  score,
}) {
  try {
    const attempts =
      getMockAttemptsCollection();

    const baseFilter = {
      examSlug,
      testId,
      status: 'completed',
    };

    const [
      countBelow,
      total,
    ] = await Promise.all([
      attempts.countDocuments({
        ...baseFilter,
        'result.totalScore': {
          $lte: Number(score),
        },
      }),
      attempts.countDocuments(
        baseFilter
      ),
    ]);

    return total > 0
      ? Math.round(
          (
            countBelow /
            total
          ) * 10000
        ) / 100
      : 50;
  } catch (err) {
    console.warn(
      'Percentile computation failed:',
      err.message
    );

    return 50;
  }
}
