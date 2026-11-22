import { cachedQuestionPage, isNormalizedQuestionKeysEnabled } from './questionCache.js';
import { questionExamModeCondition } from './questionExamMode.js';
import { canonicalQuestionQuery } from './questionQueryIdentity.js';
import { toPublicQuestionDTO } from './quizQuestionDTO.js';
import { PUBLIC_QUESTION_PROJECTION } from './questionReadService.js';
import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { readQuestionFacets } from './questionFacets.js';
import { getQuestionsCollection } from '../../config/mongodb.js';
import { normalizeFilterKey, normalizeQuizKey, normalizeSearchKey, parseShiftInt, parseYearInt } from './questionNormalizer.js';
import {
  buildGeneralAwarenessChapterCondition,
  buildGeneralAwarenessTopicCondition,
  resolveGeneralAwarenessTopicGroupSlug,
} from './generalAwarenessTopics.js';
import { caseInsensitiveExact, combineMongoConditions, buildStudyModeMatchCondition, buildExcludeStudyModeCondition } from './questionQueryBuilder.js';

let cachedCursorProjection = null;
function getCursorQuestionProjection() {
  if (!cachedCursorProjection) {
    cachedCursorProjection = Object.freeze({ ...PUBLIC_QUESTION_PROJECTION, _id: 1 });
  }
  return cachedCursorProjection;
}

// Opt-in canonical listing. Legacy offset clients retain their existing contract.
async function buildfetchQuestionCursorPage(params, legacyFingerprint) {
  const collection = getQuestionsCollection();
  const normalized = isNormalizedQuestionKeysEnabled();
  const allowUnnormalizedFallback = process.env.QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK === 'true';
  const exactKeys = normalized && !allowUnnormalizedFallback;
  const conditions = [questionExamModeCondition(params.examMode, { useNormalizedKeys: exactKeys })];
  const sorted = params.sort === 'asc' || params.sort === 'desc';
  const reverse = params.before === 'true' || params.before === true || params.last === 'true' || params.last === true;
  if (reverse && !sorted) throw Object.assign(new Error('Reverse pagination requires an explicit sort'), { statusCode: 400 });
  const direction = (params.sort === 'desc' ? -1 : 1) * (reverse ? -1 : 1);
  const collation = { locale: 'en', numericOrdering: true, strength: 2 };
  const fingerprint = createHash('sha256').update(JSON.stringify(['topic', 'subject', 'chapter', 'concept', 'difficulty', 'quizName', 'questionType', 'exam', 'year', 'shift', 'examDate', 'date', 'search', 'sort'].map(key => params[key] || '').concat(params.examMode ? [params.examMode] : []))).digest('hex').slice(0, 24);
  let boundary;
  if (params.cursor) {
    try {
      if (String(params.cursor).length > 2048) throw new Error();
      boundary = JSON.parse(Buffer.from(String(params.cursor), 'base64url').toString());
      if (
        boundary.v !== 1 ||
        ![fingerprint, legacyFingerprint].includes(boundary.f) ||
        !/^[a-fA-F0-9]{24}$/.test(boundary._id) ||
        (sorted && typeof boundary.id !== 'string' && typeof boundary.id !== 'number')
      ) throw new Error();
    } catch { throw Object.assign(new Error('Invalid question cursor'), { statusCode: 400 }); }
  }
  if (params.exam) {
    const examKey = normalizeFilterKey(params.exam);
    conditions.push(
      exactKeys
        ? { examKey }
        : normalized
          ? { $or: [{ examKey }, { examKey: { $exists: false }, exam: caseInsensitiveExact(params.exam) }] }
          : { exam: caseInsensitiveExact(params.exam) },
    );
  }
  if (params.year !== undefined && params.year !== '') {
    const parsedYear = parseYearInt(params.year) ?? Number(params.year);
    if (Number.isInteger(parsedYear)) {
      conditions.push(
        exactKeys
          ? { yearInt: parsedYear }
          : { $or: [{ yearInt: parsedYear }, { year: { $in: [parsedYear, String(parsedYear)] } }] },
      );
    }
  }
  if (params.shift !== undefined && params.shift !== '') {
    const rawShift = String(params.shift).trim();
    const parsedShift = parseShiftInt(rawShift);
    const numericShift = Number(rawShift);
    if (exactKeys && parsedShift !== null) {
      conditions.push({ shiftInt: parsedShift });
    } else {
      conditions.push(Number.isInteger(numericShift) ? { shift: { $in: [numericShift, rawShift] } } : { shift: caseInsensitiveExact(rawShift) });
    }
  }
  const effectiveDate = params.examDate || params.date;
  if (effectiveDate) conditions.push({ examDate: caseInsensitiveExact(String(effectiveDate).trim().slice(0, 32)) });
  if (params.search) {
    const trimmedSearch = String(params.search).trim().slice(0, 120);
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ $or: ['question', 'translations.bn.question', 'id', 'chapter', 'concept', 'exam'].map(field => ({ [field]: new RegExp(escaped, 'i') })) });
    }
  }
  const gaGroupSlug = resolveGeneralAwarenessTopicGroupSlug(params.topic);
  const isGaQuery = Boolean(gaGroupSlug) || normalizeSearchKey(params.subject) === 'generalawareness';
  if (params.topic) {
    const gaTopicCondition = gaGroupSlug ? buildGeneralAwarenessTopicCondition(gaGroupSlug, normalized, { exactKeys }) : null;
    if (gaTopicCondition) {
      conditions.push(gaTopicCondition);
    } else {
      const key = normalizeSearchKey(params.topic);
      const aliases = ['synonymsantonyms', 'antosynopyq'].includes(key);
      conditions.push(normalized ? { topicKey: aliases ? { $in: ['synonymsantonyms', 'antosynopyq'] } : key } : { topic: aliases ? { $in: [params.topic, 'synonyms-antonyms', 'antosynopyq'] } : params.topic });
    }
  }
  if (params.subject && (!params.topic || normalizeSearchKey(params.subject) === 'iitjamphysics')) {
    const subKey = normalizeSearchKey(params.subject);
    conditions.push(normalized ? { subjectKey: subKey } : (
      subKey === 'reasoning'
        ? { subject: { $in: [/^reasoning$/i, /^logical reasoning$/i] } }
        : subKey === 'generalawareness'
          ? { subject: { $in: [/^general awareness$/i, /^general-awareness$/i] } }
          : { subject: caseInsensitiveExact(params.subject) }
    ));
  }
  if (params.chapter) {
    const gaChapterCondition = isGaQuery ? buildGeneralAwarenessChapterCondition(params.chapter, normalized, { exactKeys }) : null;
    const chapterKey = normalizeFilterKey(params.chapter);
    conditions.push(
      gaChapterCondition || (
        exactKeys
          ? { chapterKey }
          : normalized
            ? { $or: [{ chapterKey }, { chapterKey: { $exists: false }, chapter: caseInsensitiveExact(params.chapter) }] }
            : { chapter: caseInsensitiveExact(params.chapter) }
      ),
    );
  }
  if (params.concept) {
    const conceptKey = normalizeFilterKey(params.concept);
    conditions.push(
      exactKeys
        ? { conceptKey }
        : normalized
          ? { $or: [{ conceptKey }, { conceptKey: { $exists: false }, concept: caseInsensitiveExact(params.concept) }] }
          : { concept: caseInsensitiveExact(params.concept) },
    );
  }
  if (params.difficulty) conditions.push(normalized ? { difficulty: String(params.difficulty).toLowerCase() } : { difficulty: caseInsensitiveExact(params.difficulty) });
  if (params.quizName) {
    const quizKey = normalizeQuizKey(params.quizName);
    if (exactKeys) {
      conditions.push(
        quizKey === 'pyq'
          ? { quizKey: { $in: ['pyq', ''] } }
          : { quizKey },
      );
    } else {
      const regex = caseInsensitiveExact(params.quizName);
      const alternatives = ['quizName', 'quizId', 'source'].map(field => ({ [field]: regex }));
      if (quizKey === 'pyq') alternatives.push({ quizName: { $in: [null, ''] } });
      conditions.push({ $or: alternatives });
    }
  }
  const type = String(params.questionType || '').trim().toLowerCase();
  if (['study-mode', 'studymode'].includes(type)) conditions.push(normalized ? { modeKey: 'studyMode' } : buildStudyModeMatchCondition());
  else if (type && type !== 'all') conditions.push({ questionType: caseInsensitiveExact(type) });
  else if (!type) conditions.push(normalized ? { modeKey: { $ne: 'studyMode' } } : buildExcludeStudyModeCondition());
  if (boundary?.fallback) {
    const topicRegex = caseInsensitiveExact(params.topic);
    const index = conditions.findIndex(c => c.topic);
    if (index >= 0) conditions.splice(index, 1);
    conditions.push({ $or: ['topic', 'chapter', 'subject', 'quizTopic', 'quizName', 'source'].map(field => ({ [field]: topicRegex })) });
  }
  let countFilter = combineMongoConditions([...conditions]);
  if (params.cursor) {
    const objectId = new ObjectId(boundary?._id || params.cursor);
    const comparison = direction === -1 ? '$lt' : '$gt';
    conditions.push(sorted ? { $or: [{ id: { [comparison]: boundary.id } }, { id: boundary.id, _id: { [comparison]: objectId } }] } : { _id: { $gt: objectId } });
  }
  const limit = Math.max(1, Math.min(200, Math.floor(Number(params.limit)) || 50));
  const lastPage = params.last === 'true' || params.last === true;
  let lastTotal = lastPage ? await collection.countDocuments(countFilter, { maxTimeMS: 5000, ...(sorted ? { collation } : {}) }) : undefined;
  let queryLimit = lastPage ? (lastTotal % limit || limit) : limit;
  const read = filter => {
    let query = collection.find(filter, { projection: getCursorQuestionProjection(), maxTimeMS: 5000, timeoutMS: 10000 }).sort(sorted ? { id: direction, _id: direction } : { _id: 1 });
    if (sorted) query = query.collation(collation);
    return query.limit(queryLimit + 1).toArray();
  };
  let rows = await read(combineMongoConditions(conditions));
  let fallback = Boolean(boundary?.fallback);
  if (!params.cursor && !rows.length && params.topic && !normalized && !['synonymsantonyms', 'antosynopyq'].includes(normalizeSearchKey(params.topic))) {
    const fallbackConditions = conditions.filter(c => !c.topic);
    fallbackConditions.push({ $or: ['topic', 'chapter', 'subject', 'quizTopic', 'quizName', 'source'].map(field => ({ [field]: caseInsensitiveExact(params.topic) })) });
    countFilter = combineMongoConditions(fallbackConditions);
    if (lastPage) { lastTotal = await collection.countDocuments(countFilter, { maxTimeMS: 5000, ...(sorted ? { collation } : {}) }); queryLimit = lastTotal % limit || limit; }
    rows = await read(countFilter);
    fallback = true;
  }
  const moreInDirection = rows.length > queryLimit;
  const hasMore = lastPage ? false : reverse ? Boolean(params.cursor) : moreInDirection;
  const page = rows.slice(0, queryLimit);
  if (reverse) page.reverse();
  const total = lastTotal ?? (params.includeTotal === 'true' || params.includeTotal === true
    ? await collection.countDocuments(countFilter, { maxTimeMS: 5000, ...(sorted ? { collation } : {}) })
    : undefined);
  const last = page.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ v: 1, f: fingerprint, _id: last._id.toString(), ...(sorted ? { id: last.id } : {}), fallback })).toString('base64url') : null;
  const first = page[0];
  const hasPrevious = reverse ? moreInDirection : Boolean(params.cursor);
  const prevCursor = hasPrevious && first ? Buffer.from(JSON.stringify({ v: 1, f: fingerprint, _id: first._id.toString(), ...(sorted ? { id: first.id } : {}), fallback })).toString('base64url') : null;
  const result = { count: total ?? page.length, total, questions: page.map(toPublicQuestionDTO), nextCursor: last ? nextCursor : null, prevCursor, hasMore: hasMore && Boolean(last) };
  if (params.includeFacets === 'true') result.facets = await readQuestionFacets(params.subject, params.examMode);
  return result;
}

export async function fetchQuestionCursorPage(params) {
  const query = canonicalQuestionQuery('cursor', params);
  const legacyFingerprint = createHash('sha256').update(JSON.stringify(['topic', 'subject', 'chapter', 'concept', 'difficulty', 'quizName', 'questionType', 'exam', 'search', 'sort'].map(key => query[key] || '').concat(query.examMode ? [query.examMode] : []))).digest('hex').slice(0, 24);
  return cachedQuestionPage("fetchQuestionCursorPage", query, () => buildfetchQuestionCursorPage(query, legacyFingerprint));
}
