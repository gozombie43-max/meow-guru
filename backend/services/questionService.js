// Stable public API; implementations are grouped by responsibility.
export { buildQuestionsCacheKey, questionCountsCache, questionsQueryCache, invalidateQuestionCacheRevision, getQuestionRevision } from './questions/questionCache.js';
export { fetchQuestionCounts,fetchQuestionsMeta } from './questions/questionMetadataService.js';
export { isStudyModeRecord,matchesNormalizedTopic,normalizeQuizKey,normalizeSearchKey } from './questions/questionNormalizer.js';
export { analyzeAnswers,fetchAllQueryResults,fetchImageQuestions,fetchPracticeTest,fetchQuestionById,fetchQuestions } from './questions/questionReadService.js';
export { fetchQuestionsSession } from './questions/questionSessionService.js';
export { checkDuplicates,createQuestion,createQuestionsBulk,modifyQuestion,removeQuestion,removeQuestionsBulk } from './questions/questionWriteService.js';

import {
  getUserQuestionProgressCollection,
  getUserTopicProgressCollection,
  withMongoTransaction,
  getQuestionsCollection
} from '../config/mongodb.js';

export const processUserAnswer = async (userId, questionId, providedAnswer, submissionId) => {
  const questionsColl = getQuestionsCollection();
  
  // 1. Find the question to get the correct answer and topic
  const numericId = Number(questionId);
  const queryId = !Number.isNaN(numericId) ? numericId : questionId;
  const question = await questionsColl.findOne({ $or: [{ id: questionId }, { id: queryId }] });
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
  return await withMongoTransaction(async ({ db, session }) => {
    const uqpColl = db.collection('userQuestionProgress');
    const utpColl = db.collection('userTopicProgress');
    
    const now = new Date();
    
    const existingDoc = await uqpColl.findOne({ userId: String(userId), questionId: queryId }, { session });
    
    let isFirstTime = false;
    let becameMastered = false;
    
    if (!existingDoc) {
       isFirstTime = true;
       await uqpColl.insertOne({
         userId: String(userId),
         questionId: queryId,
         topic,
         firstAttemptedAt: now,
         lastAttemptedAt: now,
         isCorrect,
         attempts: 1,
         everCorrect: isCorrect
       }, { session });
       becameMastered = isCorrect;
    } else {
       const updateFields = { $set: { lastAttemptedAt: now }, $inc: { attempts: 1 } };
       if (isCorrect && !existingDoc.everCorrect) {
          updateFields.$set.everCorrect = true;
          becameMastered = true;
       }
       await uqpColl.updateOne({ _id: existingDoc._id }, updateFields, { session });
    }
    
    // If state changed, update topic progress
    if (isFirstTime || becameMastered) {
       const inc = {};
       if (isFirstTime) inc.solvedCount = 1;
       if (becameMastered) inc.masteredCount = 1;
       
       await utpColl.updateOne(
         { userId: String(userId), topic },
         {
           $inc: inc,
           $set: { lastActivityAt: now }
         },
         { upsert: true, session }
       );
    }
    
    return {
      isCorrect,
      isFirstTime,
      becameMastered
    };
  });
};
