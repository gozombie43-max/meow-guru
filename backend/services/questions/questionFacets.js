import { getQuestionsCollection } from '../../config/mongodb.js';
import { questionExamModeCondition } from './questionExamMode.js';
import { buildExcludeStudyModeCondition, caseInsensitiveExact } from './questionQueryBuilder.js';
import { isNormalizedQuestionKeysEnabled, questionCountsCache, revisionedQuestionCacheKey } from './questionCache.js';
import { normalizeSearchKey } from './questionNormalizer.js';

export async function readQuestionFacets(subject, examMode, options = {}) {
  const normalized = options?.useNormalizedKeys ?? isNormalizedQuestionKeysEnabled();
  const normalizedSubject = subject ? normalizeSearchKey(subject) : '';
  const key = await revisionedQuestionCacheKey(`admin-question-facets:${examMode || 'all'}:${normalizedSubject || 'all'}`);
  let facets = questionCountsCache.get(key);
  if (!facets) {
    const matchConditions = [
      normalized ? { modeKey: { $ne: 'studyMode' } } : buildExcludeStudyModeCondition(),
    ];
    if (examMode !== undefined) {
      matchConditions.push(
        questionExamModeCondition(
          examMode,
          options?.useNormalizedKeys !== undefined ? { useNormalizedKeys: options.useNormalizedKeys } : {},
        ),
      );
    }
    if (subject) {
      if (normalized) {
        matchConditions.push(
          normalizedSubject === 'reasoning'
            ? { subjectKey: { $in: ['reasoning', 'logicalreasoning'] } }
            : { subjectKey: normalizedSubject },
        );
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
