import { createHash } from 'node:crypto';
import { mockAnswerIndex } from '../mockAnswer.js';

export function battleQuestionMetadata(question) {
  return {
    battleEligible: Array.isArray(question.options) && question.options.length >= 2 && mockAnswerIndex(question.correctAnswer, question.options) !== null,
    battleSelectionKey: createHash('sha256').update(String(question.questionUid || question._id || question.id)).digest('hex'),
  };
}
