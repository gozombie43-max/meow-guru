import { z } from 'zod';

export const QUIZ_SESSION_MODES = /** @type {const} */ (['practice', 'topic', 'speed', 'mock', 'ai']);
export const QUIZ_SESSION_LANGS = /** @type {const} */ (['en', 'bn', 'hi']);
export const QUIZ_SESSION_STATUSES = /** @type {const} */ (['in_progress', 'completed']);
export const DEFAULT_QUIZ_SESSION_BATCH_SIZE = 20;
export const MAX_QUIZ_SESSION_BATCH_SIZE = 50;
export const MAX_QUIZ_SESSION_TOTAL_QUESTIONS = 200;

const optionalShortText = (max = 200) =>
  z.string().trim().min(1).max(max).optional();

const normalizedDifficulty = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['easy', 'medium', 'hard', 'mixed', 'all']).optional(),
);

export const quizSessionIdParamsSchema = z.object({
  id: z.string().trim().min(4).max(128).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid session ID'),
});

export const createQuizSessionBodySchema = z.object({
  mode: z.enum(QUIZ_SESSION_MODES),
  exam: optionalShortText(200),
  tier: optionalShortText(100),
  subject: optionalShortText(200),
  topic: optionalShortText(200),
  chapter: optionalShortText(200),
  concept: optionalShortText(200),
  letter: optionalShortText(40),
  difficulty: normalizedDifficulty,
  examMode: z.enum(['ssc', 'iit-jam']).optional(),
  batchSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_QUIZ_SESSION_BATCH_SIZE)
    .optional()
    .default(DEFAULT_QUIZ_SESSION_BATCH_SIZE),
  totalQuestions: z.coerce.number().int().min(1).max(MAX_QUIZ_SESSION_TOTAL_QUESTIONS).optional(),
  // Aliases supported for frontend client compatibility (frontend/features/quiz/api/quizSessionApi.ts)
  questionCount: z.coerce.number().int().min(1).max(MAX_QUIZ_SESSION_TOTAL_QUESTIONS).optional(),
  lang: z.enum(QUIZ_SESSION_LANGS).optional().default('en'),
  randomize: z.boolean().optional(),
  randomized: z.boolean().optional(),
  timeLimitSec: z.coerce.number().int().min(0).max(14_400).optional(),
  timeLimitSeconds: z.coerce.number().int().min(0).max(14_400).optional(),
});

export const getSessionQuestionsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(2048).optional(),
  batchSize: z.coerce.number().int().min(1).max(MAX_QUIZ_SESSION_BATCH_SIZE).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_QUIZ_SESSION_BATCH_SIZE).optional(),
  lang: z.enum(QUIZ_SESSION_LANGS).optional(),
});

const answerPrimitiveSchema = z.union([
  z.number().int().min(0).max(20),
  z.string().trim().min(1).max(200),
]);

export const submitSessionAnswerBodySchema = z.object({
  questionUid: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid questionUid'),
  answer: z.union([
    answerPrimitiveSchema,
    z.array(answerPrimitiveSchema).min(1).max(20),
  ]),
  timeTakenMs: z.coerce.number().min(0).max(3_600_000).optional(),
  timeTakenSeconds: z.coerce.number().min(0).max(3_600).optional(),
  submissionId: z.string().trim().min(4).max(128).regex(/^[a-zA-Z0-9_:-]+$/, 'Invalid submissionId').optional(),
  revision: z.coerce.number().int().min(0).optional(),
});

export const submitSessionBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({
    reason: z.enum(['manual', 'timeout']).optional().default('manual'),
  }),
);

export const idempotencyKeyHeaderSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_:-]+$/, 'Invalid Idempotency-Key');

/**
 * Normalize request body aliases into a canonical CreateQuizSession command.
 * @param {z.infer<typeof createQuizSessionBodySchema>} input
 */
export function normalizeCreateQuizSessionInput(input) {
  const totalQuestions = input.totalQuestions ?? input.questionCount;
  const randomize = input.randomize ?? input.randomized ?? true;
  const timeLimitSec = input.timeLimitSec ?? input.timeLimitSeconds;
  const filters = {};
  for (const key of ['exam', 'tier', 'subject', 'topic', 'chapter', 'concept', 'letter', 'difficulty', 'examMode']) {
    if (input[key] !== undefined && input[key] !== '' && input[key] !== 'all') {
      filters[key] = input[key];
    }
  }
  return {
    mode: input.mode,
    filters,
    batchSize: input.batchSize ?? DEFAULT_QUIZ_SESSION_BATCH_SIZE,
    ...(totalQuestions !== undefined ? { totalQuestions } : {}),
    lang: input.lang ?? 'en',
    randomize,
    ...(timeLimitSec !== undefined ? { timeLimitSec } : {}),
  };
}
