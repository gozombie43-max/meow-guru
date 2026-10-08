import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { quizCorrectIndex } from '@meow/contracts/questions';
import { getMongoDB, withMongoTransaction } from '../config/mongodb.js';
import { canonicalQuestionUid, resolveQuestion } from './questions/questionIdentity.js';
import { recordQuestionAnswerInTransaction } from '../repositories/questionProgressRepository.js';
import { persistQuizResume } from '../repositories/userHistoryRepository.js';
import { invalidateTopicProgress } from './questions/topicProgressCache.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function replay(record, fingerprint) {
  if (record.fingerprint !== fingerprint) throw fail('Submission key was used with different input', 409);
  return { response: record.response, replayed: true };
}

export async function submitQuizAnswer(userId, command) {
  userId = String(userId);
  const id = hash(`${userId}:quiz.answer:${command.submissionId}`);
  const fingerprint = hash(JSON.stringify(canonical(command)));
  const journal = getMongoDB().collection('idempotencyRecords');
  const recorded = await journal.findOne({ _id: id });
  if (recorded) return replay(recorded, fingerprint);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await withMongoTransaction(async ({ db, session }) => {
        const records = db.collection('idempotencyRecords');
        // Unique reservation, effects and response all commit or roll back together.
        await records.insertOne({ _id: id, fingerprint, status: 'pending',
          createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) }, { session });
        const readOptions = { session, projection: {
            id: 1, questionUid: 1, topic: 1, subject: 1, chapter: 1, concept: 1, difficulty: 1,
            letter: 1, word: 1, options: 1, correctAnswer: 1, correctLetter: 1, questionType: 1, optionRegions: 1,
          } };
        const question = command.questionAnchor
          ? await db.collection('questions').findOne({ _id: new ObjectId(command.questionAnchor),
            ...(command.questionUid ? { questionUid: command.questionUid } : {}) }, readOptions)
          : await resolveQuestion(db.collection('questions'), command.questionId,
            { questionUid: command.questionUid, topic: command.topic }, readOptions);
        if (!question) throw fail('Question not found', 404);
        const imageKeys = Object.keys(question.optionRegions || {});
        const options = Array.isArray(question.options) && question.options.length ? question.options.map(String)
          : question.questionType === 'image_mcq' ? (imageKeys.length ? imageKeys : ['a', 'b', 'c', 'd']).sort().map(key => key.toUpperCase()) : [];
        const correct = quizCorrectIndex(question, options);
        if (correct === null) throw fail('Question has no valid answer', 422);
        if (command.answer >= options.length) throw fail('Answer is outside the question options', 400);
        const owner = await db.collection('users').aggregate([
          { $match: { id: userId, type: { $ne: 'email_lock' } } },
          { $project: { id: 1, historyStorageVersion: 1,
            recentQuizzes: { $cond: [{ $eq: ['$historyStorageVersion', 1] }, '$$REMOVE', '$recentQuizzes'] } } },
        ], { session }).next();
        if (!owner) throw fail('User not found', 404);
        const letter = String(question.letter || String(question.word || '').trim().charAt(0)).trim().toUpperCase();
        const concept = String(question.concept || '').trim() || String(question.chapter || '').trim()
          || (letter ? `Letter ${letter}` : '') || String(question.topic || '').trim() || 'General';
        const isCorrect = command.answer === correct, questionUid = canonicalQuestionUid(question);
        const progress = await recordQuestionAnswerInTransaction(db, session, userId, questionUid,
          question.topic || question.chapter || question.subject || 'unknown', isCorrect, question.id);
        const difficultyText = String(question.difficulty || '').toLowerCase();
        const answerResult = { questionId: command.questionId, questionUid, questionIndex: command.questionIndex,
          selected: command.answer, correct, isCorrect, timeTaken: command.timeTaken, concept,
          difficulty: difficultyText.includes('hard') ? 'hard' : difficultyText.includes('easy') ? 'easy' : 'medium' };
        const resume = { ...command.resume,
          selectedAnswers: { ...command.resume.selectedAnswers, [command.questionIndex]: command.answer },
          submittedQuestions: [...new Set([...command.resume.submittedQuestions, command.questionIndex])],
          removedAnswers: command.resume.removedAnswers?.filter(index => index !== command.questionIndex),
          results: [...command.resume.results.filter(row => row?.questionIndex !== command.questionIndex), answerResult] };
        const embedded = await persistQuizResume(db, session, owner, resume);
        // Literal keys preserve concept labels containing dots/dollar signs safely.
        const counter = { $getField: { field: { $literal: concept }, input: { $ifNull: ['$progress', {}] } } };
        const fence = await db.collection('users').updateOne({ _id: owner._id,
          historyStorageVersion: owner.historyStorageVersion === 1 ? 1 : { $ne: 1 } }, [{ $set: {
            progress: { $setField: { field: { $literal: concept }, input: { $ifNull: ['$progress', {}] }, value: {
              $mergeObjects: [{ $ifNull: [counter, {}] }, {
                attempted: { $add: [{ $ifNull: [{ $getField: { field: 'attempted', input: counter } }, 0] }, 1] },
                correct: { $add: [{ $ifNull: [{ $getField: { field: 'correct', input: counter } }, 0] }, isCorrect ? 1 : 0] },
              }],
            } } },
            recentQuizzesRevision: { $add: [{ $ifNull: ['$recentQuizzesRevision', 0] }, 1] },
            ...(embedded ? { recentQuizzes: { $literal: embedded } } : {}),
          } }], { session });
        if (!fence.matchedCount) throw fail('History storage changed; retry', 409);
        const response = { ...progress, correct, concept, questionUid, submissionId: command.submissionId, resumeSaved: true };
        await records.updateOne({ _id: id }, { $set: { status: 'completed', response, completedAt: new Date() } }, { session });
        return { response, replayed: false };
      });
      if (!result.replayed && (result.response.isFirstTime || result.response.becameMastered)) {
        await invalidateTopicProgress(userId).catch(() => {});
      }
      return result;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await journal.findOne({ _id: id });
      if (winner) return replay(winner, fingerprint);
      // Different submissions can contend on an initially absent progress row.
    }
  }
  throw fail('Answer changed concurrently; retry this submission', 425);
}
