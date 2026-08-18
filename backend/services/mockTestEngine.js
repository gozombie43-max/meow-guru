import { getExamConfig, getSlotById as getStaticSlotById, getSlotsForExam as getStaticSlotsForExam, MOCK_TEST_SLOTS } from '../config/exam-config.js';
import { getQuestionsContainer, getMockAttemptsContainer, getMockSlotsContainer } from '../containerStore.js';

// ─── Helpers ──────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripAnswer(q) {
  const { correctAnswer, answer, ...rest } = q;
  return rest;
}

// ─── Slot Management with Cosmos DB ────────────────────────

export async function fetchSlotsForExam(examSlug) {
  try {
    const container = getMockSlotsContainer();
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.examSlug = @examSlug ORDER BY c.order ASC',
        parameters: [{ name: '@examSlug', value: examSlug }],
      })
      .fetchAll();

    if (resources && resources.length > 0) {
      // Don't send full question payloads on list view
      return resources.map(s => {
        const { fixedQuestions, ...summary } = s;
        return {
          ...summary,
          hasFixedPaper: Boolean(fixedQuestions && fixedQuestions.length > 0),
          questionCount: fixedQuestions?.length || s.questionCount,
        };
      });
    }

    // Auto-seed if none exist in DB for this exam
    const staticSlots = getStaticSlotsForExam(examSlug);
    if (staticSlots.length > 0) {
      const seeded = [];
      for (const slot of staticSlots) {
        try {
          const { resource } = await container.items.create({
            ...slot,
            type: slot.type || 'mock',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          seeded.push(resource);
        } catch (e) {
          seeded.push(slot);
        }
      }
      return seeded;
    }

    return [];
  } catch (err) {
    console.warn(`fetchSlotsForExam failed for ${examSlug}, falling back to static config:`, err.message);
    return getStaticSlotsForExam(examSlug);
  }
}

export async function fetchAllAdminSlots(examFilter = null) {
  try {
    const container = getMockSlotsContainer();
    let query = 'SELECT * FROM c';
    const parameters = [];
    if (examFilter && examFilter !== 'all') {
      query += ' WHERE c.examSlug = @examSlug';
      parameters.push({ name: '@examSlug', value: examFilter });
    }
    query += ' ORDER BY c.examSlug ASC, c.order ASC';

    const { resources } = await container.items.query({ query, parameters }).fetchAll();
    if (resources && resources.length > 0) {
      return resources.map(s => ({
        id: s.id,
        examSlug: s.examSlug,
        configKey: s.configKey,
        title: s.title,
        tier: s.tier,
        type: s.type || (s.id.includes('pyq') ? 'pyq' : 'mock'),
        year: s.year || null,
        shift: s.shift || null,
        isFree: Boolean(s.isFree),
        order: s.order || 1,
        questionCount: s.fixedQuestions?.length || 0,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    }

    // If container is empty or offline, fallback to static defaults
    let filtered = MOCK_TEST_SLOTS;
    if (examFilter && examFilter !== 'all') {
      filtered = filtered.filter(s => s.examSlug === examFilter);
    }
    return filtered.map(s => ({
      ...s,
      type: s.type || (s.id.includes('pyq') ? 'pyq' : 'mock'),
      questionCount: 0,
    }));
  } catch (err) {
    console.warn('fetchAllAdminSlots fallback to defaults:', err.message);
    let filtered = MOCK_TEST_SLOTS;
    if (examFilter && examFilter !== 'all') {
      filtered = filtered.filter(s => s.examSlug === examFilter);
    }
    return filtered.map(s => ({
      ...s,
      type: s.type || (s.id.includes('pyq') ? 'pyq' : 'mock'),
      questionCount: 0,
    }));
  }
}

export async function fetchSlotById(examSlug, slotId) {
  try {
    const container = getMockSlotsContainer();
    
    if (examSlug) {
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.id = @id AND c.examSlug = @examSlug',
          parameters: [
            { name: '@id', value: slotId },
            { name: '@examSlug', value: examSlug },
          ],
        })
        .fetchAll();
      if (resources && resources.length > 0) return resources[0];
    } else {
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: slotId }],
        })
        .fetchAll();
      if (resources && resources.length > 0) return resources[0];
    }

    return getStaticSlotById(slotId);
  } catch (err) {
    console.warn(`fetchSlotById error for ${slotId}:`, err.message);
    return getStaticSlotById(slotId);
  }
}

export async function seedDefaultSlots() {
  const container = getMockSlotsContainer();
  let createdCount = 0;

  for (const slot of MOCK_TEST_SLOTS) {
    try {
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.id = @id AND c.examSlug = @examSlug',
          parameters: [
            { name: '@id', value: slot.id },
            { name: '@examSlug', value: slot.examSlug },
          ],
        })
        .fetchAll();

      if (!resources || resources.length === 0) {
        await container.items.create({
          ...slot,
          type: slot.type || 'mock',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        createdCount++;
      }
    } catch (e) {
      console.warn(`Failed to seed slot ${slot.id}:`, e.message);
    }
  }

  return { totalSeeded: createdCount };
}

export async function createMockSlot(slotData) {
  const container = getMockSlotsContainer();
  if (!slotData.id || !slotData.examSlug || !slotData.configKey || !slotData.title) {
    throw new Error('Missing required slot fields: id, examSlug, configKey, title');
  }

  const doc = {
    id: slotData.id,
    examSlug: slotData.examSlug,
    configKey: slotData.configKey,
    title: slotData.title,
    tier: slotData.tier || null,
    type: slotData.type || 'mock', // 'mock' or 'pyq'
    year: slotData.year || null,
    shift: slotData.shift || null,
    isFree: Boolean(slotData.isFree),
    order: Number(slotData.order) || 1,
    fixedQuestions: Array.isArray(slotData.questions) ? slotData.questions : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { resource } = await container.items.create(doc);
  return resource;
}

export async function updateMockSlot(examSlug, slotId, updates) {
  const container = getMockSlotsContainer();
  const existing = await fetchSlotById(examSlug, slotId);
  if (!existing) throw new Error(`Slot not found: ${slotId}`);

  const updatedDoc = {
    ...existing,
    ...updates,
    id: existing.id,
    examSlug: existing.examSlug, // partition key cannot change
    updatedAt: new Date().toISOString(),
  };

  const { resource } = await container.item(existing.id, existing.examSlug).replace(updatedDoc);
  return resource;
}

export async function deleteMockSlot(examSlug, slotId) {
  const container = getMockSlotsContainer();
  const existing = await fetchSlotById(examSlug, slotId);
  if (!existing) throw new Error(`Slot not found: ${slotId}`);

  await container.item(existing.id, existing.examSlug).delete();
  return { success: true, id: slotId };
}

// ─── Full Paper Upload (Mock & PYQ) ─────────────────────────

export async function uploadFullPaper({ slotData, questions }) {
  if (!slotData || !slotData.id || !slotData.examSlug || !slotData.configKey || !slotData.title) {
    throw new Error('Missing slot metadata (id, examSlug, configKey, title)');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array cannot be empty');
  }

  const slotContainer = getMockSlotsContainer();
  const questionsContainer = getQuestionsContainer();

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

  const existingSlot = await fetchSlotById(slotData.examSlug, slotData.id);
  if (existingSlot) {
    await slotContainer.item(slotDoc.id, slotDoc.examSlug).replace(slotDoc);
  } else {
    await slotContainer.items.create(slotDoc);
  }

  // 2. Also optionally batch upsert questions into question bank
  let insertedToBank = 0;
  for (const q of normalizedQuestions) {
    try {
      await questionsContainer.items.upsert(q);
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

  const container = getQuestionsContainer();
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
        const paramNames = topicList.map((_, i) => `@topic${i}`);
        const paramValues = topicList.map((t, i) => ({ name: `@topic${i}`, value: t }));
        
        const { resources } = await container.items
          .query({
            query: `SELECT * FROM c WHERE LOWER(c.topic) IN (${paramNames.join(', ')}) OFFSET 0 LIMIT @limit`,
            parameters: [
              ...paramValues,
              { name: '@limit', value: overfetchCount * topicList.length },
            ],
          })
          .fetchAll();
        allQuestions = resources;
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

export async function computePercentile({ examSlug, testId, score }) {
  try {
    const container = getMockAttemptsContainer();

    const { resources: belowRes } = await container.items
      .query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.examSlug = @examSlug AND c.testId = @testId AND c.status = "completed" AND c.result.totalScore <= @score',
        parameters: [
          { name: '@examSlug', value: examSlug },
          { name: '@testId', value: testId },
          { name: '@score', value: score },
        ],
      })
      .fetchAll();

    const { resources: totalRes } = await container.items
      .query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.examSlug = @examSlug AND c.testId = @testId AND c.status = "completed"',
        parameters: [
          { name: '@examSlug', value: examSlug },
          { name: '@testId', value: testId },
        ],
      })
      .fetchAll();

    const countBelow = belowRes[0] || 0;
    const total = totalRes[0] || 0;

    return total > 0 ? Math.round((countBelow / total) * 10000) / 100 : 50;
  } catch (err) {
    console.warn('Percentile computation failed:', err.message);
    return 50; // default
  }
}
