import { z } from 'zod';
const identifier = z.union([z.string().trim().min(1).max(200), z.number().finite()]);
const label = z.string().trim().min(1).max(300).refine(value => !/[.$]/.test(value), 'Invalid concept key');
export const failureRequestSchema = z.object({
  userId: z.string().trim().min(1).max(200), questionId: identifier, topic: label, concept: label,
  question: z.string().max(20000).optional(), options: z.array(z.string().max(5000)).max(10).optional(),
  userAnswer: z.union([z.string().max(5000), z.number().finite(), z.null()]).optional(),
  correctAnswer: z.union([z.string().max(5000), z.number().finite()]).optional(),
  solution: z.string().max(20000).optional(), timeSpent: z.number().finite().nonnegative().max(86400).optional(),
  changedAnswer: z.boolean().optional(), skipped: z.boolean().optional(),
});
export const failureBatchRequestSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  wrongAnswers: z.array(failureRequestSchema.omit({ userId: true })).min(1).max(100),
});
