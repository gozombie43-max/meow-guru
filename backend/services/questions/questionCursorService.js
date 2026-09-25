import { ObjectId } from 'mongodb';
import { getQuestionsCollection } from '../../config/mongodb.js';
import { normalizeSearchKey } from './questionNormalizer.js';
import { caseInsensitiveExact, combineMongoConditions, buildStudyModeMatchCondition, buildExcludeStudyModeCondition } from './questionQueryBuilder.js';
import { questionsQueryCache, revisionedQuestionCacheKey } from './questionCache.js';

// Opt-in canonical listing. Legacy offset clients retain their existing contract.
export async function fetchQuestionCursorPage(params) {
  const collection = getQuestionsCollection();
  const normalized = process.env.QUESTIONS_NORMALIZED_KEYS !== 'false';
  const conditions = [];
  if (params.topic) {
    const key = normalizeSearchKey(params.topic);
    const aliases = ['synonymsantonyms', 'antosynopyq'].includes(key);
    conditions.push(normalized ? { topicKey: aliases ? { $in: ['synonymsantonyms', 'antosynopyq'] } : key } : { topic: aliases ? { $in: [params.topic, 'synonyms-antonyms', 'antosynopyq'] } : params.topic });
  } else if (params.subject) conditions.push(normalized ? { subjectKey: normalizeSearchKey(params.subject) } : { subject: caseInsensitiveExact(params.subject) });
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
  const countFilter = combineMongoConditions([...conditions]);
  if (params.cursor) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(params.cursor))) throw Object.assign(new Error('Invalid question cursor'), { statusCode: 400 });
    conditions.push({ _id: { $gt: new ObjectId(params.cursor) } });
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
  const rows = await collection.find(combineMongoConditions(conditions)).sort({ _id: 1 }).limit(limit + 1).toArray();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const total = params.includeTotal === 'true' || params.includeTotal === true
    ? await collection.countDocuments(countFilter, { maxTimeMS: 5000 })
    : undefined;
  const result = { count: page.length, total, questions: page.map(({ _id, ...row }) => row), nextCursor: hasMore ? page.at(-1)._id.toString() : null, hasMore };
  if (cacheKey) questionsQueryCache.set(cacheKey, result);
  return result;
}
