import { cachedQuestionPage } from './questionCache.js';
import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { readQuestionFacets } from './questionFacets.js';
import { getQuestionsCollection } from '../../config/mongodb.js';
import { normalizeSearchKey } from './questionNormalizer.js';
import { caseInsensitiveExact, combineMongoConditions, buildStudyModeMatchCondition, buildExcludeStudyModeCondition } from './questionQueryBuilder.js';
import { isNormalizedQuestionKeysEnabled, questionsQueryCache, revisionedQuestionCacheKey } from './questionCache.js';

// Opt-in canonical listing. Legacy offset clients retain their existing contract.
async function buildfetchQuestionCursorPage(params) {
  const collection = getQuestionsCollection();
  const normalized = isNormalizedQuestionKeysEnabled();
  const conditions = [];
  const sorted = params.sort === 'asc' || params.sort === 'desc';
  const reverse = params.before === 'true' || params.before === true || params.last === 'true' || params.last === true;
  if (reverse && !sorted) throw Object.assign(new Error('Reverse pagination requires an explicit sort'), { statusCode: 400 });
  const direction = (params.sort === 'desc' ? -1 : 1) * (reverse ? -1 : 1);
  const collation = { locale: 'en', numericOrdering: true, strength: 2 };
  const fingerprint = createHash('sha256').update(JSON.stringify(['topic', 'subject', 'chapter', 'concept', 'difficulty', 'quizName', 'questionType', 'exam', 'search', 'sort'].map(key => params[key] || ''))).digest('hex').slice(0, 24);
  let boundary;
  if (params.cursor && (sorted || !/^[a-fA-F0-9]{24}$/.test(String(params.cursor)))) {
    try {
      if (String(params.cursor).length > 2048) throw new Error();
      boundary = JSON.parse(Buffer.from(String(params.cursor), 'base64url').toString());
      if (boundary.v !== 1 || boundary.f !== fingerprint || !/^[a-fA-F0-9]{24}$/.test(boundary._id) || (sorted && typeof boundary.id !== 'string')) throw new Error();
    } catch { throw Object.assign(new Error('Invalid question cursor'), { statusCode: 400 }); }
  }
  if (params.exam) conditions.push(normalized ? { exam: params.exam } : { exam: caseInsensitiveExact(params.exam) });
  if (params.search) {
    const escaped = String(params.search).slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ $or: ['question', 'id', 'chapter'].map(field => ({ [field]: new RegExp(escaped, 'i') })) });
  }
  if (params.topic) {
    const key = normalizeSearchKey(params.topic);
    const aliases = ['synonymsantonyms', 'antosynopyq'].includes(key);
    conditions.push(normalized ? { topicKey: aliases ? { $in: ['synonymsantonyms', 'antosynopyq'] } : key } : { topic: aliases ? { $in: [params.topic, 'synonyms-antonyms', 'antosynopyq'] } : params.topic });
  } else if (params.subject) {
    const subKey = normalizeSearchKey(params.subject);
    conditions.push(normalized ? { subjectKey: subKey } : (
      subKey === 'reasoning'
        ? { subject: { $in: [/^reasoning$/i, /^logical reasoning$/i] } }
        : subKey === 'generalawareness'
          ? { subject: { $in: [/^general awareness$/i, /^general-awareness$/i] } }
          : { subject: caseInsensitiveExact(params.subject) }
    ));
  }
  for (const field of ['chapter', 'concept', 'difficulty']) if (params[field]) conditions.push(normalized ? { [field]: field === 'difficulty' ? String(params[field]).toLowerCase() : params[field] } : { [field]: caseInsensitiveExact(params[field]) });
  if (params.quizName) {
    const regex = caseInsensitiveExact(params.quizName);
    const alternatives = ['quizName', 'quizId', 'source'].map(field => ({ [field]: regex }));
    if (normalizeSearchKey(params.quizName) === 'pyq') alternatives.push({ quizName: { $in: [null, ''] } });
    conditions.push({ $or: alternatives });
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
  const shouldCache = !params.cursor && params.includeTotal !== 'true' && params.includeTotal !== true;
  const cacheKey = shouldCache
    ? await revisionedQuestionCacheKey('cursor:' + JSON.stringify(params))
    : null;
  if (cacheKey) {
    const cached = questionsQueryCache.get(cacheKey);
    if (cached) return cached;
  }

  const limit = Math.max(1, Math.min(200, Math.floor(Number(params.limit)) || 50));
  const lastPage = params.last === 'true' || params.last === true;
  let lastTotal = lastPage ? await collection.countDocuments(countFilter, { maxTimeMS: 5000, ...(sorted ? { collation } : {}) }) : undefined;
  let queryLimit = lastPage ? (lastTotal % limit || limit) : limit;
  const read = filter => {
    let query = collection.find(filter, { maxTimeMS: 5000, timeoutMS: 10000 }).sort(sorted ? { id: direction, _id: direction } : { _id: 1 });
    if (sorted) query = query.collation(collation);
    return query.limit(queryLimit + 1).toArray();
  };
  let rows = await read(combineMongoConditions(conditions));
  let fallback = Boolean(boundary?.fallback);
  if (!params.cursor && !rows.length && params.topic && !normalized && !['synonymsantonyms', 'antosynopyq'].includes(normalizeSearchKey(params.topic))) {
    const fallbackConditions = conditions.filter(c => !c.topic);
    fallbackConditions.push({ $or: ['topic', 'chapter', 'subject', 'quizTopic', 'quizName', 'source'].map(field => ({ [field]: caseInsensitiveExact(params.topic) })) });
    countFilter = combineMongoConditions(fallbackConditions);
    if (lastPage) { lastTotal = await collection.countDocuments(countFilter, { maxTimeMS: 5000, collation }); queryLimit = lastTotal % limit || limit; }
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
  const result = { count: total ?? page.length, total, questions: page.map(({ _id, ...row }) => row), nextCursor: last ? nextCursor : null, prevCursor, hasMore: hasMore && Boolean(last) };
  if (params.includeFacets === 'true') result.facets = await readQuestionFacets(params.subject);
  if (cacheKey) questionsQueryCache.set(cacheKey, result);
  return result;
}

export function fetchQuestionCursorPage(params) {
  return cachedQuestionPage("fetchQuestionCursorPage", params, () => buildfetchQuestionCursorPage(params));
}
