import { z } from 'zod';

export const bookmarkPatchSchema = z.object({
  questionId: z.union([z.string(), z.number()]).transform(String),
  action: z.enum(['add', 'remove']),
  meta: z
    .object({
      quizKey: z.string().optional(),
      title: z.string().optional(),
      subject: z.string().optional(),
      slug: z.string().optional(),
      href: z.string().optional(),
      mode: z.string().optional(),
      questionIndex: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

export const progressPatchSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required').max(120).regex(/^[^.$]+$/, 'Invalid topic'),
  attempted: z.number().int().min(0).max(1_000),
  correct: z.number().int().min(0).max(1_000),
}).refine(({ attempted, correct }) => correct <= attempted, {
  message: 'Correct answers cannot exceed attempted answers',
  path: ['correct'],
});

export const recentQuizPatchSchema = z.object({
  quizKey: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(120),
  slug: z.string().optional().default(''),
  href: z.string().min(1),
  mode: z.string().optional().default('mixed'),
  currentIndex: z.number().int().min(0).optional().default(0),
  totalQuestions: z.number().int().min(0).optional().default(0),
  selectedAnswers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).refine((value) => Object.keys(value).length <= 500).optional().default({}),
  submittedQuestions: z.array(z.number().int().nonnegative()).max(500).optional().default([]),
  results: z.array(z.any()).max(500).optional().default([]),
  delta: z.boolean().optional(),
  removedAnswers: z.array(z.number().int().nonnegative()).max(500).optional(),
  questionAnchor: z.string().max(200).optional(),
  sessionFilters: z.object({ exam: z.string().optional(), concept: z.string().optional(), letter: z.string().optional() }).optional(),
  status: z.enum(['in-progress', 'completed']).optional().default('in-progress'),
});

export const studyTimePatchSchema = z.object({
  activeSeconds: z.number().int().positive().max(86400),
  timezone: z.string().trim().min(1).max(100).optional(),
});
