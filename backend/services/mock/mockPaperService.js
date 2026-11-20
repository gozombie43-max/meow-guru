import { randomBytes } from 'node:crypto';
import { JAM_SECTIONS, jamQuestionTopic } from '@meow/contracts/jam';
import { assertQuestionSourceMode, questionExamModeCondition } from '../questions/questionExamMode.js';
import { assignQuestionIdentity } from '../questions/questionIdentity.js';
import { battleQuestionMetadata } from '../questions/battleQuestionMetadata.js';
import { fetchSlotById, hasZipImages } from './mockSlotService.js';
import { shuffleArray, exactCI, stripAnswer } from './mockModel.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { invalidateQuestionMetadata } from '../questions/questionMetadataCache.js';
import * as questionCache from '../questions/questionCache.js';
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { buildNormalizedQuestionFields } from '../questions/questionNormalizer.js';
import { buildExcludeStudyModeCondition, combineMongoConditions } from '../questions/questionQueryBuilder.js';

// Safe inclusion projection for dynamic mock paper construction:
// keeps display/translation/solution/answer fields needed to assemble the paper & server answerKey
// while never pulling ingestion, training, or battle internal metadata.
const MOCK_DYNAMIC_QUESTION_PROJECTION = Object.freeze({
  _id: 0,
  id: 1,
  questionUid: 1,
  question: 1,
  questionHindi: 1,
  text: 1,
  questionType: 1,
  options: 1,
  correctAnswer: 1,
  answer: 1,
  correctLetter: 1,
  solution: 1,
  solutionImage: 1,
  solutionImageWidth: 1,
  solutionImageHeight: 1,
  explanation: 1,
  subject: 1,
  topic: 1,
  chapter: 1,
  concept: 1,
  difficulty: 1,
  exam: 1,
  year: 1,
  shift: 1,
  examDate: 1,
  image: 1,
  questionImage: 1,
  questionImageWidth: 1,
  questionImageHeight: 1,
  optionImages: 1,
  optionAImage: 1,
  optionBImage: 1,
  optionCImage: 1,
  optionDImage: 1,
  passage: 1,
  sectionKey: 1,
  translations: 1,
});

import { validateQuestions, validateConfidentialUpload, invalidPaper } from '../assessmentPolicy.js';
import { getExamConfig } from '../../config/exam-config.js';
import { getQuestionsCollection, getMockSlotsCollection } from '../../config/mongodb.js';
import { buildSchemaPaper, uploadSchemaPaper } from './schemaPaperService.js';
import { mutateMockCatalog } from '../../repositories/mockCatalogMetadataRepository.js';

export async function uploadFullPaper({ slotData, questions, paper, examMode }) {
  if (paper) {
    const schemaResult = await uploadSchemaPaper({ slotData, paper, examMode });
    if (typeof questionCache.invalidateQuestionCaches === 'function') {
      const targetExam = schemaResult?.examSlug || slotData?.examSlug;
      await questionCache.invalidateQuestionCaches({
        ...(targetExam ? { exam: targetExam } : {}),
        bumpRevision: true,
      }).catch(() => {});
    }
    return schemaResult;
  }
  if (!slotData || !slotData.id || !slotData.examSlug || !slotData.configKey || !slotData.title) {
    throw new Error('Missing slot metadata (id, examSlug, configKey, title)');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array cannot be empty');
  }
  if (examMode) questions.forEach(question => assertQuestionSourceMode(question, examMode));

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
  const isJam = String(slotData.examSlug).startsWith('iit-jam-physics');
  const normalizedQuestions = questions.map((q, idx) => {
    const rawTopic = String(q.topic || 'general');
    const jamSection = JAM_SECTIONS.find(s => s.slug === rawTopic || s.title.toLowerCase() === rawTopic.toLowerCase() || jamQuestionTopic(s.slug) === rawTopic || s.topics.some(topic => topic.toLowerCase() === rawTopic.toLowerCase()) || (!q.topic && slotData.examSlug === `iit-jam-physics-${s.slug}`));
    if (examMode === 'iit-jam' && String(q.questionType || 'MCQ').toUpperCase() === 'MCQ' && !jamSection) throw invalidPaper('Assign each JAM MCQ to one of the seven Physics sections');
    const topic = isJam ? jamQuestionTopic(jamSection?.slug || rawTopic.replace(/^iit-jam-/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')) : rawTopic;
    const qId = q.id ? String(q.id).trim() : `${slotData.id}_q${idx + 1}`;
    const options = Array.isArray(q.options) ? q.options : (q.options ? Object.values(q.options) : []);
    const correctAnswer = q.correctAnswer ?? q.answer ?? q.correctOption;

    return {
      id: qId,
      question: q.question || '',
      questionType: String(q.questionType || 'MCQ').toUpperCase(),
      options,
      correctAnswer,
      solution: q.solution || q.explanation || '',
      subject: isJam ? 'iit-jam-physics' : q.subject || 'General',
      topic: isJam ? topic : q.topic || 'General',
      sectionKey: q.sectionKey || q.section || null,
      difficulty: q.difficulty || 'medium',
      questionImage: q.questionImage || null,
      questionImageWidth: q.questionImageWidth,
      questionImageHeight: q.questionImageHeight,
      solutionImage: q.solutionImage || null,
      solutionImageWidth: q.solutionImageWidth,
      solutionImageHeight: q.solutionImageHeight,
      exam: slotData.examSlug,
      tier: slotData.tier || null,
      testId: slotData.id,
      year: slotData.year || null,
      shift: slotData.shift || null,
    };
  });

  // Batch-resolve existing question identities in 1 query instead of N sequential lookups.
  if (slotData.assessmentMode !== 'confidential') {
    const allIds = [...new Set(normalizedQuestions.map(q => q.id))];
    const cursor = allIds.length
      ? questionsCollection.find(
          { id: { $in: allIds } },
          { projection: { _id: 0, id: 1, topic: 1, questionUid: 1 } }
        )
      : null;
    const existingRows = cursor
      ? await (typeof cursor.limit === 'function' ? cursor.limit(Math.max(allIds.length * 2, 2)) : cursor).toArray()
      : [];
    const byId = new Map();
    for (const row of existingRows) {
      const list = byId.get(row.id) || [];
      list.push(row);
      byId.set(row.id, list);
    }
    for (const question of normalizedQuestions) {
      const candidates = byId.get(question.id) || [];
      const topicMatch = candidates.find(c => String(c.topic || '').toLowerCase() === String(question.topic || '').toLowerCase());
      const existing = topicMatch || (candidates.length === 1 ? candidates[0] : null);
      const identity = existing?.questionUid || assignQuestionIdentity({ ingestionKey: `mock:${slotData.examSlug}:${slotData.id}:${question.id}` }).questionUid;
      question.questionUid = identity;
    }
  } else {
    for (const question of normalizedQuestions) {
      question.questionUid = assignQuestionIdentity({ ingestionKey: `mock:${slotData.examSlug}:${slotData.id}:${question.id}` }).questionUid;
    }
  }

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
    isPyq: String(slotData.type || 'mock').toLowerCase() === 'pyq',
    year: slotData.year || null,
    shift: slotData.shift || null,
    isFree: Boolean(slotData.isFree),
    order: Number(slotData.order) || 1,
    questionCount: normalizedQuestions.length,
    hasFixedPaper: true,
    hasZipImages: hasZipImages({ fixedQuestions: normalizedQuestions }),
    fixedQuestions: normalizedQuestions,
    assessmentMode: slotData.assessmentMode === 'confidential' ? 'confidential' : 'practice',
    timingPolicy: slotData.timingPolicy || 'composite',
    createdAt:
      existingSlot?.createdAt ||
      now,
    updatedAt:
      now,
  };

  await mutateMockCatalog(slotDoc.examSlug, (collection, options) => collection.updateOne(
    {
      id: slotDoc.id,
      examSlug: slotDoc.examSlug,
    },
    {
      $set: slotDoc,
      $unset: { sourcePaper: '', paperMetadata: '' },
    },
    {
      ...options,
      upsert: true,
    }
  ));

  // 2. Batch upsert MCQ questions into the question bank in a single bulkWrite instead of N sequential updateOnes.
  let insertedToBank = 0;
  const bankQuestions = slotDoc.assessmentMode === 'confidential'
    ? []
    : normalizedQuestions.filter(question => question.questionType === 'MCQ');
  if (bankQuestions.length > 0) {
    if (typeof questionsCollection.bulkWrite === 'function') {
      const ops = bankQuestions.map(q => ({
        updateOne: {
          filter: { questionUid: q.questionUid },
          update: {
            $set: { ...q, ...buildNormalizedQuestionFields(q), ...trainingQuestionMetadata(q), ...battleQuestionMetadata(q) },
          },
          upsert: true,
        },
      }));
      try {
        const bulkResult = await questionsCollection.bulkWrite(ops, { ordered: false });
        insertedToBank = (bulkResult.upsertedCount || 0) + (bulkResult.matchedCount || 0);
      } catch (err) {
        runtimeLog.warn(`Batch upsert questions warning for slot ${slotDoc.id}:`, err.message);
        const r = err.result;
        insertedToBank = r ? ((r.nUpserted || r.upsertedCount || 0) + (r.nMatched || r.matchedCount || 0)) : 0;
      }
    } else {
      for (const q of bankQuestions) {
        try {
          await questionsCollection.updateOne(
            { questionUid: q.questionUid },
            { $set: { ...q, ...buildNormalizedQuestionFields(q), ...trainingQuestionMetadata(q), ...battleQuestionMetadata(q) } },
            { upsert: true }
          );
          insertedToBank++;
        } catch (err) {
          runtimeLog.warn(`Upsert question ${q.id} warning:`, err.message);
        }
      }
    }
  }

  if (insertedToBank) await invalidateQuestionMetadata();
  if (typeof questionCache.invalidateQuestionCaches === 'function') {
    await questionCache.invalidateQuestionCaches({ exam: slotDoc.examSlug, bumpRevision: !insertedToBank }).catch(() => {});
  }

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

export async function buildPaper({ examSlug, testId, slot: loadedSlot }) {
  const slot = loadedSlot ?? await fetchSlotById(examSlug, testId);
  if (!slot) throw new Error(`Slot not found: ${testId}`);
  if (slot.sourcePaper) return buildSchemaPaper(slot.sourcePaper);
  if ((slot.isPyq || String(slot.type).toLowerCase() === 'pyq') && !slot.fixedQuestions?.length) {
    throw invalidPaper('This previous-year paper has no published questions. Ask an admin to upload the complete paper.');
  }

  const config = getExamConfig(slot.configKey);
  if (!config) throw new Error(`Config not found: ${slot.configKey}`);
  if (config.requireFixedPaper && !slot.fixedQuestions?.length) throw invalidPaper('This exam requires a published, complete fixed paper.');

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
      // top up partially filled or empty sections from untagged questions only.
      const sectionQuestions = assigned.get(section.key);
      if (sectionQuestions.length < section.questionCount && unassigned.length > 0) {
        sectionQuestions.push(...unassigned.splice(0, section.questionCount - sectionQuestions.length));
      }

      for (const q of sectionQuestions) {
        answerKey[q.questionUid || q.id] = q.correctAnswer ?? q.answer ?? null;
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
  // Keep section order, prevent cross-section duplicates via globalSeen,
  // enforce examMode + non-studyMode, and use unbiased selectionKey random pivot + wraparound.
  const examMode = String(examSlug || slot.examSlug || '').startsWith('iit-jam') ? 'iit-jam' : 'ssc';
  const useNormalizedKeys =
    typeof questionCache.isNormalizedKeysEnabled === 'function'
      ? questionCache.isNormalizedKeysEnabled()
      : process.env.QUESTIONS_NORMALIZED_KEYS !== 'false';
  const globalSeen = new Set();
  for (let offset = 0; offset < config.sections.length; offset += 3) {
    const batch = await Promise.all(config.sections.slice(offset, offset + 3).map(async section => {
      const overfetchCount = section.questionCount * 3;
      const topicList = section.topics.map(t => t.toLowerCase());
      const normalizedKeys = [...new Set(topicList.map(t => t.replace(/[^a-z0-9]/g, '')).filter(Boolean))];
      const fetchLimit = Math.min(overfetchCount * Math.max(topicList.length, 1), 600);

      let allQuestions = [];
      if (topicList.length > 0) {
        try {
          const projection = MOCK_DYNAMIC_QUESTION_PROJECTION;
          const modeFilter = questionExamModeCondition(examMode);
          const nonStudyFilter = useNormalizedKeys
            ? { $or: [{ modeKey: { $exists: true, $ne: 'studyMode' } }, { modeKey: { $exists: false }, ...buildExcludeStudyModeCondition() }] }
            : buildExcludeStudyModeCondition();
          const pivot = randomBytes(8).toString('hex');
          const sortSpec = { selectionKey: 1, _id: 1 };

          let resources = [];
          const runQuery = (filter, limit, applySort = false) => {
            let cursor = questionsCollection.find(filter, { projection });
            if (applySort && typeof cursor.sort === 'function') {
              cursor = cursor.sort(sortSpec);
            }
            if (typeof cursor.maxTimeMS === 'function') {
              cursor = cursor.maxTimeMS(5000);
            }
            return { cursor, promise: cursor.limit(limit).toArray() };
          };

          if (useNormalizedKeys && normalizedKeys.length > 0) {
            const baseNormFilter = combineMongoConditions([
              modeFilter,
              nonStudyFilter,
              { topicKey: { $in: normalizedKeys } },
            ]);
            const headExec = runQuery(
              combineMongoConditions([baseNormFilter, { selectionKey: { $gte: pivot } }]),
              fetchLimit,
              true,
            );
            const headRows = await headExec.promise;
            resources = headRows;
            const supportsRealSort = typeof headExec.cursor?.sort === 'function';
            if (supportsRealSort && resources.length < fetchLimit) {
              const tailExec = runQuery(
                combineMongoConditions([baseNormFilter, { selectionKey: { $lt: pivot } }]),
                fetchLimit - resources.length,
                true,
              );
              resources = [...resources, ...(await tailExec.promise)];
            }
            if (supportsRealSort && resources.length < section.questionCount) {
              // Fallback for un-backfilled fixtures lacking selectionKey/topicKey.
              const topicRegexes = topicList.map((topic) => exactCI(topic));
              const fallbackFilter = combineMongoConditions([
                modeFilter,
                buildExcludeStudyModeCondition(),
                { topic: { $in: topicRegexes } },
              ]);
              const fallbackRows = await runQuery(fallbackFilter, fetchLimit, false).promise;
              if (fallbackRows.length > resources.length) resources = fallbackRows;
            }
          } else {
            const topicRegexes = topicList.map((topic) => exactCI(topic));
            const legacyFilter = combineMongoConditions([
              modeFilter,
              buildExcludeStudyModeCondition(),
              { topic: { $in: topicRegexes } },
            ]);
            resources = await runQuery(legacyFilter, fetchLimit, false).promise;
          }

          allQuestions = resources
            .filter(q => Array.isArray(q.options) && q.options.length > 0 && (q.correctAnswer ?? q.answer) != null)
            .map(q => ({ ...q, legacyId: q.id, id: q.questionUid || q.id }));
        } catch (err) {
          runtimeLog.warn(`Query for topics [${topicList.join(', ')}] failed:`, err.message);
        }
      }

      // Deduplicate within section
      const seen = new Set();
      allQuestions = allQuestions.filter(q => {
        if (seen.has(q.id)) return false;
        seen.add(q.id);
        return true;
      });

      return { section, allQuestions };
    }));

    for (const { section, allQuestions } of batch) {
      // Deduplicate across sections sequentially so no question appears in two sections.
      const uniqueQuestions = allQuestions.filter(q => !globalSeen.has(q.id));

      // Apply 30/50/20 difficulty distribution
      const easy = uniqueQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy');
      const medium = uniqueQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium');
      const hard = uniqueQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard');

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
        const remaining = uniqueQuestions.filter(q => !selectedIds.has(q.id));
        selected.push(...shuffleArray(remaining).slice(0, section.questionCount - selected.length));
      }

      selected = shuffleArray(selected).slice(0, section.questionCount);

      const sectionKeys = {};
      for (const q of selected) {
        globalSeen.add(q.id);
        sectionKeys[q.questionUid || q.id] = q.correctAnswer ?? q.answer ?? null;
      }

      sections.push({
        key: section.key,
        label: section.label,
        questionCount: section.questionCount,
        timeLimitMin: section.timeLimitMin,
        marking: section.marking,
        questions: selected.map(stripAnswer),
      });
      Object.assign(answerKey, sectionKeys);
    }
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
