import { z } from 'zod';

const text = z.string().trim().min(1).max(20000);
export const questionDraftSchema = z.object({
  question: text, options: z.array(text).length(4), correctAnswer: z.number().int().min(0).max(3),
  explanation: text, topic: text, subject: text.optional(), difficulty: z.enum(['easy', 'medium', 'hard']),
});
export const questionDraftsSchema = z.array(questionDraftSchema).min(1).max(50);
export const questionTagsSchema = z.object({
  subject: text, chapter: text, concept: text, difficulty: z.enum(['easy', 'medium', 'hard']),
  trap_type: z.string().max(1000), formula: z.string().max(2000),
});
export const failureClassificationSchema = z.object({
  dimension: z.enum(['CONCEPTUAL_GAP', 'APPLICATION_ERROR', 'TRAP_CAUGHT']),
  reason: text, confidence: z.number().min(0).max(1),
});
export const mistakeCoachSchema = z.object({ mistakeCoach: z.array(z.object({
  concept: text, dimension: text, why: text, fix: text,
})).min(1).max(4) });
export const conceptGroupsSchema = z.object({ groups: z.array(z.object({
  label: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(600),
  conceptIds: z.array(z.number().int().nonnegative()).min(1),
})).min(1).max(200) });
