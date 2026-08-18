// backend/schemas/apiSchemas.js
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const accessCodeVerifySchema = z.object({
  code: z.string().trim().min(1, 'Access code is required').max(32),
});

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
  topic: z.string().trim().min(1, 'Topic is required'),
  attempted: z.number().int().min(0),
  correct: z.number().int().min(0),
});

export const recentQuizPatchSchema = z.object({
  quizKey: z.string().min(1),
  title: z.string().min(1),
  subject: z.string().min(1),
  slug: z.string().optional().default(''),
  href: z.string().min(1),
  mode: z.string().optional().default('mixed'),
  currentIndex: z.number().int().min(0).optional().default(0),
  totalQuestions: z.number().int().min(0).optional().default(0),
  selectedAnswers: z.record(z.string(), z.any()).optional().default({}),
  submittedQuestions: z.array(z.number()).optional().default([]),
  results: z.array(z.any()).optional().default([]),
  status: z.enum(['in-progress', 'completed']).optional().default('in-progress'),
});

export const studyTimePatchSchema = z.object({
  activeSeconds: z.number().int().positive().max(86400),
});
