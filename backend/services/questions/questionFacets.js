import { getQuestionsCollection } from '../../config/mongodb.js';
import { buildExcludeStudyModeCondition, caseInsensitiveExact } from './questionQueryBuilder.js';
import { isNormalizedQuestionKeysEnabled, questionCountsCache, revisionedQuestionCacheKey } from './questionCache.js';
import { normalizeSearchKey } from './questionNormalizer.js';

export async function readQuestionFacets(subject) {
  const normalizedSubject = subject ? normalizeSearchKey(subject) : '';
  const key = await revisionedQuestionCacheKey(`admin-question-facets:${normalizedSubject || 'all'}`);
  let facets = questionCountsCache.get(key);
  if (!facets) {
    const matchConditions = [buildExcludeStudyModeCondition()];
    if (subject) {
      if (isNormalizedQuestionKeysEnabled()) {
        matchConditions.push({ subjectKey: normalizedSubject });
      } else if (normalizedSubject === 'reasoning') {
        matchConditions.push({ subject: { $in: [/^reasoning$/i, /^logical reasoning$/i] } });
      } else if (normalizedSubject === 'generalawareness') {
        matchConditions.push({ subject: { $in: [/^general awareness$/i, /^general-awareness$/i] } });
      } else {
        matchConditions.push({ subject: caseInsensitiveExact(subject) });
      }
    }
    const match = matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0];
    [facets] = await getQuestionsCollection().aggregate([
      { $match: match },
      { $group: { _id: null, topics: { $addToSet: '$topic' }, exams: { $addToSet: '$exam' }, quizNames: { $addToSet: { $ifNull: ['$quizName', '$source'] } } } },
      { $project: { _id: 0 } },
    ], { maxTimeMS: 5000 }).toArray();
    if (facets) questionCountsCache.set(key, facets);
  }
  return facets || { topics: [], exams: [], quizNames: [] };
}
