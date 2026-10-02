import { getQuestionsCollection } from '../../config/mongodb.js';
import { buildExcludeStudyModeCondition } from './questionQueryBuilder.js';
import { questionCountsCache, revisionedQuestionCacheKey } from './questionCache.js';

export async function readQuestionFacets() {
  const key = await revisionedQuestionCacheKey('admin-question-facets');
  let facets = questionCountsCache.get(key);
  if (!facets) {
    [facets] = await getQuestionsCollection().aggregate([
      { $match: buildExcludeStudyModeCondition() },
      { $group: { _id: null, topics: { $addToSet: '$topic' }, exams: { $addToSet: '$exam' }, quizNames: { $addToSet: { $ifNull: ['$quizName', '$source'] } } } },
      { $project: { _id: 0 } },
    ], { maxTimeMS: 5000 }).toArray();
    if (facets) questionCountsCache.set(key, facets);
  }
  return facets || { topics: [], exams: [], quizNames: [] };
}
