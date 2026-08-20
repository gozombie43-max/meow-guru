// backend/services/questionService.js
import { getQuestionsContainer } from '../containerStore.js';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

const QUESTIONS_QUERY_CACHE_TTL_MS = 60 * 1000;
export const questionsQueryCache = new LRUCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

// ── Helpers ───────────────────────────────────────────
export function normalizeSearchKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeQuizKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function matchesNormalizedTopic(question, normalizedTopic) {
  const candidates = [
    question.topic,
    question.chapter,
    question.subject,
    question.quizTopic,
    question.quizName,
    question.source,
  ];
  return candidates.some((field) => normalizeSearchKey(field) === normalizedTopic);
}

export function isStudyModeRecord(q) {
  if (!q || typeof q !== 'object') return false;
  const qType = String(q.questionType || '').trim().toLowerCase();
  if (qType === 'study-mode' || qType === 'studymode') return true;
  if (String(q.quizName || '').trim().toLowerCase() === 'study mode') return true;
  if (typeof q.word === 'string' && q.word.trim() && Array.isArray(q.meanings)) return true;
  return false;
}

export function buildQuestionsCacheKey(parameters, offset, limit) {
  return JSON.stringify({
    params: parameters.map((entry) => [entry.name, entry.value]),
    offset,
    limit,
  });
}

export async function fetchAllQueryResults(container, query, parameters, options = {}) {
  const iterator = container.items.query(
    { query, parameters },
    {
      maxItemCount: 1000,
      enableCrossPartition: options.partitionKey ? undefined : true,
      ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
    }
  );
  const { resources } = await iterator.fetchAll({
    maxItemCount: 1000,
    enableCrossPartition: options.partitionKey ? undefined : true,
    ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
  });
  return resources;
}

// ── Service Methods ────────────────────────────────────

export async function createQuestion(newQuestion) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const { resource } = await container.items.create(newQuestion);
  return resource;
}

export async function createQuestionsBulk(questionsData) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');

  const normalizedQuestions = questionsData.map((q, idx) => {
    const item = (q && typeof q === 'object') ? { ...q } : { value: q };

    if (item.id !== undefined && item.id !== null) {
      item.id = String(item.id).trim();
    }

    if (!item.id) {
      const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
      item.id = `q_${Date.now()}_${idx}_${suffix}`;
    }

    const quizSubject = String(item.quizSubject ?? '').trim();
    const quizTopic = String(item.quizTopic ?? '').trim();

    if (item.word && item.meanings && item.synonyms && item.antonyms) {
      item.questionType = item.questionType || 'study-mode';
      item.quizName = String(item.quizName || 'Study Mode').trim();
    }

    if (!item.subject && quizSubject) item.subject = quizSubject;
    if (!item.chapter && quizTopic) item.chapter = quizTopic;
    if (quizTopic) item.topic = quizTopic;
    if (!item.topic) item.topic = item.chapter || item.subject || item.category || 'misc';
    item.topic = String(item.topic).trim() || 'misc';

    return item;
  });

  const buildNewId = (idx, attempt = 0) => {
    const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
    return `q_${Date.now()}_${idx}_${attempt}_${suffix}`;
  };

  const createWithRetry = async (item, idx) => {
    let current = { ...item };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await container.items.create(current);
      } catch (err) {
        const status = err?.code || err?.statusCode;
        if (status !== 409) throw err;
        current = { ...current, id: buildNewId(idx, attempt + 1) };
      }
    }
    return await container.items.create({ ...current, id: buildNewId(idx, 99) });
  };

  return await Promise.allSettled(
    normalizedQuestions.map((q, idx) => createWithRetry(q, idx))
  );
}

export async function fetchImageQuestions(topic = "visual_reasoning", limit = 20) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');

  const query = {
    query: `
      SELECT * FROM c
      WHERE c.questionType = "image_mcq"
      AND c.topic = @topic
      OFFSET 0 LIMIT @limit
    `,
    parameters: [
      { name: "@topic", value: topic },
      { name: "@limit", value: parseInt(limit) },
    ],
  };

  const { resources } = await container.items.query(query).fetchAll();
  return { count: resources.length, questions: resources };
}

export async function fetchQuestions(params) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const {
    topic,
    subject,
    chapter,
    concept,
    difficulty,
    quizName,
    questionType,
    offset = 0,
    limit,
  } = params;

  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const normalizedQuizName = quizName ? normalizeQuizKey(quizName) : null;
  const normalizedQuestionType = questionType ? String(questionType).trim().toLowerCase() : null;
  const isStudyModeRequested = normalizedQuestionType === 'study-mode' || normalizedQuestionType === 'studymode';
  const isAllRequested = normalizedQuestionType === 'all';
  const queryMode = topic ? 'topic' : subject ? 'subject' : 'global';

  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters = [];
  let partitionKey;

  if (topic) {
    query += ' AND c.topic = @topic';
    parameters.push({ name: '@topic', value: topic });
    partitionKey = topic;
  } else if (subject) {
    query += ' AND LOWER(c.subject) = LOWER(@subject)';
    parameters.push({ name: '@subject', value: subject });
  }
  if (chapter) {
    query += ' AND LOWER(c.chapter) = LOWER(@chapter)';
    parameters.push({ name: '@chapter', value: chapter });
  }
  if (concept) {
    query += ' AND LOWER(c.concept) = LOWER(@concept)';
    parameters.push({ name: '@concept', value: concept });
  }
  if (difficulty) {
    query += ' AND LOWER(c.difficulty) = LOWER(@difficulty)';
    parameters.push({ name: '@difficulty', value: difficulty });
  }
  if (quizName) {
    if (normalizedQuizName === 'pyq') {
      query += ` AND (
        (IS_DEFINED(c.quizName) AND LOWER(REPLACE(REPLACE(c.quizName, '-', ''), ' ', '')) = @normalizedQuizName)
        OR (IS_DEFINED(c.quizId) AND LOWER(REPLACE(REPLACE(c.quizId, '-', ''), ' ', '')) = @normalizedQuizName)
        OR (IS_DEFINED(c.source) AND LOWER(REPLACE(REPLACE(c.source, '-', ''), ' ', '')) = @normalizedQuizName)
        OR NOT IS_DEFINED(c.quizName)
        OR c.quizName = null
        OR c.quizName = ""
      )`;
    } else {
      query += ` AND ((IS_DEFINED(c.quizName) AND LOWER(REPLACE(REPLACE(c.quizName, '-', ''), ' ', '')) = @normalizedQuizName) OR (IS_DEFINED(c.quizId) AND LOWER(REPLACE(REPLACE(c.quizId, '-', ''), ' ', '')) = @normalizedQuizName) OR (IS_DEFINED(c.source) AND LOWER(REPLACE(REPLACE(c.source, '-', ''), ' ', '')) = @normalizedQuizName))`;
    }
    parameters.push({ name: '@normalizedQuizName', value: normalizedQuizName });
  }

  if (isStudyModeRequested) {
    query += ' AND (LOWER(c.questionType) = "study-mode" OR LOWER(c.questionType) = "studymode" OR (IS_DEFINED(c.word) AND IS_ARRAY(c.meanings)))';
  } else if (!isAllRequested) {
    if (normalizedQuestionType) {
      query += ' AND LOWER(c.questionType) = @questionType';
      parameters.push({ name: '@questionType', value: normalizedQuestionType });
    } else {
      query += ' AND (NOT IS_DEFINED(c.questionType) OR (LOWER(c.questionType) != "study-mode" AND LOWER(c.questionType) != "studymode")) AND (NOT IS_DEFINED(c.quizName) OR LOWER(c.quizName) != "study mode") AND (NOT IS_DEFINED(c.word) OR c.word = null OR c.word = "")';
    }
  }

  const parsedOffset = Number.isFinite(Number(offset)) ? parseInt(offset, 10) : 0;
  const parsedLimit = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : null;

  if (parsedLimit !== null && parsedLimit > 0) {
    query += ` OFFSET ${parsedOffset} LIMIT ${parsedLimit}`;
  } else if (parsedOffset > 0) {
    query += ` OFFSET ${parsedOffset} LIMIT 99999`;
  }

  const cacheable =
    parsedOffset === 0 &&
    (parsedLimit === null || parsedLimit > 0) &&
    (queryMode === 'topic' || queryMode === 'subject');
  const cacheKey = cacheable ? `${queryMode}:${buildQuestionsCacheKey(parameters, parsedOffset, parsedLimit)}` : null;

  let resources = cacheKey ? questionsQueryCache.get(cacheKey) : null;

  if (!resources) {
    resources = await fetchAllQueryResults(container, query, parameters, { partitionKey });

    if (topic && resources.length === 0) {
      const fallbackQuery = query.replace(' AND c.topic = @topic', ' AND (LOWER(c.topic) = LOWER(@topic) OR LOWER(c.chapter) = LOWER(@topic) OR LOWER(c.subject) = LOWER(@topic) OR LOWER(c.quizTopic) = LOWER(@topic) OR LOWER(c.quizName) = LOWER(@topic) OR LOWER(c.source) = LOWER(@topic))');
      resources = await fetchAllQueryResults(container, fallbackQuery, parameters);
    }

    if (normalizedTopic && queryMode === 'topic') {
      resources = resources.filter((q) => matchesNormalizedTopic(q, normalizedTopic));
    }

    if (isStudyModeRequested) {
      resources = resources.filter((q) => isStudyModeRecord(q));
    } else if (!isAllRequested) {
      resources = resources.filter((q) => !isStudyModeRecord(q));
    }

    if (cacheKey) {
      questionsQueryCache.set(cacheKey, resources);
    }
  }

  return { count: resources.length, questions: resources };
}

export async function fetchPracticeTest(params) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const { subject, difficulty, count = 10 } = params;
  const requestedCount = Number.isFinite(Number(count)) ? parseInt(count, 10) : 10;
  const limit = Math.max(1, requestedCount);

  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters = [];

  if (subject) {
    query += ' AND LOWER(c.subject) = LOWER(@subject)';
    parameters.push({ name: '@subject', value: subject });
  }
  if (difficulty) {
    query += ' AND LOWER(c.difficulty) = LOWER(@difficulty)';
    parameters.push({ name: '@difficulty', value: difficulty });
  }

  query += ' AND (NOT IS_DEFINED(c.questionType) OR (LOWER(c.questionType) != "study-mode" AND LOWER(c.questionType) != "studymode")) AND (NOT IS_DEFINED(c.quizName) OR LOWER(c.quizName) != "study mode") AND (NOT IS_DEFINED(c.word) OR c.word = null OR c.word = "")';

  query += ` OFFSET 0 LIMIT ${limit * 3}`;
  const resources = await fetchAllQueryResults(container, query, parameters);

  const filteredResources = resources.filter((q) => !isStudyModeRecord(q));
  if (filteredResources.length === 0) return null;

  return filteredResources
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(limit, filteredResources.length))
    .map(q => ({
      id:         q.id,
      subject:    q.subject,
      chapter:    q.chapter,
      concept:    q.concept,
      question:   q.question,
      options:    q.options,
      difficulty: q.difficulty,
    }));
}

export async function analyzeAnswers(answers) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const ids = answers.map(a => a.questionId);
  
  let questionDocs = [];
  if (ids.length > 0) {
    try {
      const paramNames = ids.map((_, i) => `@id${i}`);
      const paramValues = ids.map((id, i) => ({ name: `@id${i}`, value: id }));
      const inClause = paramNames.join(', ');

      const query = {
        query: `SELECT * FROM c WHERE c.id IN (${inClause})`,
        parameters: paramValues,
      };
      const { resources } = await container.items.query(query).fetchAll();
      questionDocs = resources;
    } catch (err) {
      console.error('runAnalysis IN query failed:', err.message);
    }
  }

  const questionMap = new Map(
    questionDocs.filter(Boolean).map(q => [q.id, q])
  );

  let correct = 0, incorrect = 0, unattempted = 0;
  const subjectBreakdown = {};
  const details = [];

  for (const ans of answers) {
    const q = questionMap.get(ans.questionId);
    if (!q) continue;

    const subj = q.subject;
    if (!subjectBreakdown[subj])
      subjectBreakdown[subj] = { correct: 0, incorrect: 0, unattempted: 0, total: 0 };

    subjectBreakdown[subj].total++;

    if (ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
      unattempted++;
      subjectBreakdown[subj].unattempted++;
      details.push({ questionId: q.id, status: 'unattempted' });
    } else if (ans.selectedAnswer === q.correctAnswer) {
      correct++;
      subjectBreakdown[subj].correct++;
      details.push({ questionId: q.id, status: 'correct' });
    } else {
      incorrect++;
      subjectBreakdown[subj].incorrect++;
      details.push({ questionId: q.id, status: 'incorrect', correctAnswer: q.correctAnswer });
    }
  }

  const total = correct + incorrect + unattempted;
  const scorePercent = total > 0 ? ((correct / total) * 100).toFixed(2) : 0;

  return {
    summary: { totalQuestions: total, correct, incorrect, unattempted, scorePercent: parseFloat(scorePercent) },
    subjectBreakdown,
    details,
  };
}

export async function fetchQuestionById(id) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const { resources } = await container.items
    .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
    .fetchAll();
  return resources.length ? resources[0] : null;
}

export async function modifyQuestion(id, updates) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const existing = await fetchQuestionById(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id, topic: updates.topic || existing.topic };
  await container.items.upsert(updated);
  return updated;
}

export async function removeQuestion(id) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');
  const numericId = Number(id);
  const query = {
    query: `SELECT * FROM c WHERE c.id = @id${Number.isFinite(numericId) ? " OR c.id = @idNum" : ""}`,
    parameters: [
      { name: "@id", value: id },
      ...(Number.isFinite(numericId) ? [{ name: "@idNum", value: numericId }] : []),
    ],
  };
  const { resources } = await container.items.query(query).fetchAll();
  if (!resources.length) return false;
  
  const { topic } = resources[0];
  await container.item(resources[0].id, topic ?? null).delete();
  return true;
}

export async function checkDuplicates(questions) {
  const container = getQuestionsContainer();
  if (!container) throw new Error('DB not ready');

  const ids = questions
    .map((q) => String(q.id || q._id || q.questionId || ''))
    .filter(Boolean);

  const getQuestionText = (q) => String(q?.question ?? q?.questionText ?? q?.q ?? '').trim();
  const incomingTexts = questions
    .map((q) => getQuestionText(q))
    .filter(Boolean);
  const uniqueTexts = Array.from(new Set(incomingTexts));

  if (ids.length === 0 && uniqueTexts.length === 0) {
    return [];
  }

  const batchSize = 100;
  const existingMap = new Map();

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const paramList = batch.map((_, idx) => `@id${i + idx}`).join(', ');
    const parameters = batch.map((id, idx) => ({
      name: `@id${i + idx}`,
      value: id,
    }));

    const { resources } = await container.items
      .query({
        query: `SELECT c.id, c.question, c.questionText FROM c WHERE c.id IN (${paramList})`,
        parameters,
      })
      .fetchAll();

    resources.forEach((r) => {
      existingMap.set(r.id, r.question || r.questionText || '');
    });
  }

  const textBatchSize = 50;
  const existingTextMap = new Map();

  for (let i = 0; i < uniqueTexts.length; i += textBatchSize) {
    const batch = uniqueTexts.slice(i, i + textBatchSize);
    const conditions = batch.map((_, idx) => `c.question = @txt${idx} OR c.questionText = @txt${idx}`).join(' OR ');
    const parameters = batch.flatMap((txt, idx) => [
      { name: `@txt${idx}`, value: txt },
    ]);

    const { resources } = await container.items
      .query({
        query: `SELECT c.id, c.question, c.questionText FROM c WHERE ${conditions}`,
        parameters,
      })
      .fetchAll();

    resources.forEach((r) => {
      const dbText = String(r.question || r.questionText || '').trim();
      if (dbText) existingTextMap.set(dbText, r.id);
    });
  }

  const duplicates = [];
  questions.forEach((q, index) => {
    const qId = String(q.id || q._id || q.questionId || '');
    const qText = getQuestionText(q);
    
    if (qId && existingMap.has(qId)) {
      duplicates.push({ index, id: qId, reason: 'Duplicate ID' });
    } else if (qText && existingTextMap.has(qText)) {
      duplicates.push({ index, id: qId, matchedId: existingTextMap.get(qText), reason: 'Duplicate Question Text' });
    }
  });

  return duplicates;
}
