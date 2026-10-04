// Stable public API; implementations are grouped by responsibility.
export { buildQuestionsCacheKey, questionCountsCache, questionsQueryCache, invalidateQuestionCacheRevision, getQuestionRevision } from './questions/questionCache.js';
export { fetchQuestionCounts,fetchQuestionsMeta } from './questions/questionMetadataService.js';
export { isStudyModeRecord,matchesNormalizedTopic,normalizeQuizKey,normalizeSearchKey } from './questions/questionNormalizer.js';
export { analyzeAnswers,fetchAllQueryResults,fetchImageQuestions,fetchPracticeTest,fetchQuestionById,fetchQuestions } from './questions/questionReadService.js';
export { fetchQuestionsSession } from './questions/questionSessionService.js';
export { checkDuplicates,createQuestion,createQuestionsBulk,modifyQuestion,removeQuestion,removeQuestionsBulk } from './questions/questionWriteService.js';

import { findAnsweredQuestion, recordQuestionAnswer } from '../repositories/questionProgressRepository.js';
import { invalidateTopicProgress } from './questions/topicProgressCache.js';

export const processUserAnswer = async (userId, questionId, providedAnswer, submissionId) => {
  
  // 1. Find the question to get the correct answer and topic
  const numericId = Number(questionId);
  const queryId = !Number.isNaN(numericId) ? numericId : questionId;
  const question = await findAnsweredQuestion(questionId, queryId);
  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    throw error;
  }
  
  // Check against string correct answer or array correct index
  let isCorrect = false;
  if (typeof question.correctAnswer === 'string') {
    isCorrect = providedAnswer === question.options.indexOf(question.correctAnswer);
  } else if (typeof question.correctAnswer === 'number') {
    isCorrect = providedAnswer === question.correctAnswer;
  }
  
  const topic = question.topic || question.chapter || question.subject || 'unknown';
  
  // 2. Use a transaction to safely update both collections
  const result = await recordQuestionAnswer(userId, queryId, topic, isCorrect);
  if (result.isFirstTime || result.becameMastered) await invalidateTopicProgress(userId);
  return result;
};
