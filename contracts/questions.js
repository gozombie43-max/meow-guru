import { z } from 'zod';
export const publicTopicCountsSchema = z.object({
  subject: z.string().min(1), revision: z.number().int().nonnegative(), updatedAt: z.string(),
  totals: z.record(z.string(), z.number().int().nonnegative()),
});
export const questionAnswerRequestSchema = z.object({
  answer: z.number().int().nonnegative().max(20),
  questionUid: z.string().regex(/^q_[a-f0-9]{32}$/).optional(),
  topic: z.string().max(200).optional(),
  submissionId: z.string().min(1).max(200).optional(),
});

export { quizCorrectIndex } from './quiz-grading.js';
