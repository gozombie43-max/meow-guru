// Stable public API; implementations are grouped by responsibility.
export { buildQuestionsCacheKey,questionCountsCache,questionsQueryCache } from './questions/questionCache.js';
export { fetchQuestionCounts,fetchQuestionsMeta } from './questions/questionMetadataService.js';
export { isStudyModeRecord,matchesNormalizedTopic,normalizeQuizKey,normalizeSearchKey } from './questions/questionNormalizer.js';
export { analyzeAnswers,fetchAllQueryResults,fetchImageQuestions,fetchPracticeTest,fetchQuestionById,fetchQuestions } from './questions/questionReadService.js';
export { fetchQuestionsSession } from './questions/questionSessionService.js';
export { checkDuplicates,createQuestion,createQuestionsBulk,modifyQuestion,removeQuestion,removeQuestionsBulk } from './questions/questionWriteService.js';
