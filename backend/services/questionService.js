import { canonicalQuestionUid } from './questions/questionIdentity.js';
// Stable public API; implementations are grouped by responsibility.
export { buildQuestionsCacheKey, questionCountsCache, questionsQueryCache, invalidateQuestionCacheRevision, getQuestionRevision } from './questions/questionCache.js';
export { fetchQuestionCounts,fetchQuestionsMeta } from './questions/questionMetadataService.js';
export { isStudyModeRecord,matchesNormalizedTopic,normalizeQuizKey,normalizeSearchKey } from './questions/questionNormalizer.js';
export { analyzeAnswers,exportQuestions,fetchAllQueryResults,fetchImageQuestions,fetchPracticeTest,fetchQuestionById,fetchQuestions } from './questions/questionReadService.js';
export { fetchQuestionsSession, fetchQuestionsRevealWindow } from './questions/questionSessionService.js';
export { checkDuplicates,createQuestion,createQuestionsBulk,modifyQuestion,removeQuestion,removeQuestionsBulk } from './questions/questionWriteService.js';

import { quizCorrectIndex } from '@meow/contracts/questions';
import { findAnsweredQuestion, recordQuestionAnswer } from '../repositories/questionProgressRepository.js';
import { invalidateTopicProgress } from './questions/topicProgressCache.js';

export const processUserAnswer = async (userId, questionId, providedAnswer, submissionId, context = {}) => {
  
  // 1. Find the question to get the correct answer and topic
  const question = await findAnsweredQuestion(questionId, context);
  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    throw error;
  }
  
  // Grade consistently via quizCorrectIndex (supports MCQ text/letter/index and image_mcq).
  const imageKeys = Object.keys(question.optionRegions || {});
  const options =
    Array.isArray(question.options) && question.options.length
      ? question.options.map(String)
      : question.questionType === 'image_mcq'
        ? (imageKeys.length ? imageKeys : ['a', 'b', 'c', 'd']).sort().map((key) => key.toUpperCase())
        : [];
  const correctIdx = quizCorrectIndex(question, options);
  const isCorrect = correctIdx !== null && Number(providedAnswer) === correctIdx;
  
  const topic = question.topic || question.chapter || question.subject || 'unknown';
  
  // 2. Use a transaction to safely update both collections
  const result = await recordQuestionAnswer(userId, canonicalQuestionUid(question), topic, isCorrect, question.id);
  if (result.isFirstTime || result.becameMastered) await invalidateTopicProgress(userId);
  return result;
};
