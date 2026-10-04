import { fetchSlotById } from './mockSlotService.js';
import { shuffleArray, exactCI, stripAnswer } from './mockModel.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { invalidateQuestionMetadata } from '../questions/questionMetadataCache.js';
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { normalizedQuestionKeys } from "../questions/questionNormalizer.js";

import { validateQuestions, validateConfidentialUpload, invalidPaper } from '../assessmentPolicy.js';
import { getExamConfig } from '../../config/exam-config.js';
import { getQuestionsCollection, getMockSlotsCollection } from '../../config/mongodb.js';

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

  const existingSlot =
    await slotCollection.findOne(
      {
        id:
          String(slotData.id),

        examSlug:
          String(slotData.examSlug),
      },

      {
        projection: {
          _id: 1,
          createdAt: 1,
          assessmentMode: 1,
        },
      }
    );

  const isNewSlot =
    !existingSlot;
  if (existingSlot?.assessmentMode === 'confidential' && slotData.assessmentMode !== 'confidential') {
    throw invalidPaper('A confidential paper cannot be republished into the public practice bank');
  }

  // Normalize questions
  const normalizedQuestions = questions.map((q, idx) => {
    const qId = q.id ? String(q.id).trim() : `${slotData.id}_q${idx + 1}`;
    const options = Array.isArray(q.options) ? q.options : (q.options ? Object.values(q.options) : []);
    const correctAnswer = q.correctAnswer ?? q.answer ?? q.correctOption;

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

  validateQuestions(normalizedQuestions);
  validateConfidentialUpload(slotData, normalizedQuestions);
  if (slotData.assessmentMode === 'confidential') {
    const publicCopy = await questionsCollection.findOne({ id: { $in: normalizedQuestions.map(question => question.id) } }, { projection: { id: 1 } });
    if (publicCopy) throw invalidPaper('These question IDs already exist in the public practice bank. Use an unpublished paper.');
  }
  const now =
    new Date().toISOString();

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
    assessmentMode: slotData.assessmentMode === 'confidential' ? 'confidential' : 'practice',
    timingPolicy: slotData.timingPolicy || 'composite',
    createdAt:
      existingSlot?.createdAt ||
      now,
    updatedAt:
      now,
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
  for (const q of slotDoc.assessmentMode === 'confidential' ? [] : normalizedQuestions) {
    try {
      await questionsCollection.updateOne(
        {
          id: q.id,
          topic: q.topic,
        },
        {
          $set: { ...q, ...normalizedQuestionKeys(q), ...trainingQuestionMetadata(q) },
        },
        {
          upsert: true,
        }
      );
      insertedToBank++;
    } catch (err) {
      runtimeLog.warn(`Upsert question ${q.id} warning:`, err.message);
    }
  }

  if (insertedToBank) await invalidateQuestionMetadata();

  return {
    success: true,
    slotId: slotDoc.id,
    examSlug: slotDoc.examSlug,
    title: slotDoc.title,
    type: slotDoc.type,
    tier: slotDoc.tier,
    totalQuestions: normalizedQuestions.length,
    insertedToBank,
    isNewSlot,
  };
}

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
    const assigned = new Map(config.sections.map(section => [section.key, []]));
    const unassigned = [];
    for (const question of allFixed) {
      const section = config.sections.find(section => question.sectionKey
        ? String(question.sectionKey).toLowerCase() === section.key.toLowerCase()
        : String(question.subject || '').toLowerCase() === section.label.toLowerCase()
          || section.topics.some(topic => topic.toLowerCase() === String(question.topic || '').toLowerCase()));
      if (section) assigned.get(section.key).push(question);
      else unassigned.push(question);
    }

    for (const section of config.sections) {
      // Tagged questions belong to exactly one section. Positional fallback may
      // consume only untagged questions, never reuse another section's questions.
      const sectionQuestions = assigned.get(section.key);
      if (sectionQuestions.length === 0) sectionQuestions.push(...unassigned.splice(0, section.questionCount));

      for (const q of sectionQuestions) {
        answerKey[q.id] = q.correctAnswer ?? q.answer ?? null;
      }

      sections.push({
        key: section.key,
        label: section.label,
        questionCount: sectionQuestions.length,
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
        runtimeLog.warn(`Query for topics [${topicList.join(', ')}] failed:`, err.message);
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
      const remaining = allQuestions.filter(q => !selectedIds.has(q.id));
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
