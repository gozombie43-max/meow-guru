import { z } from 'zod';
import { API_BASE } from '@/lib/api-base';
import { DEFAULT_QUIZ_BATCH_SIZE } from '@/features/quiz/model/constants';
import { request } from '@/shared/api/request';

export const V1_QUIZ_SESSION_MODES = ['practice', 'topic', 'speed', 'mock', 'ai'] as const;
export const V1_QUIZ_SESSION_LANGS = ['en', 'hi', 'bn'] as const;
export const V1_MAX_BATCH_SIZE = 50;
export const V1_MAX_TOTAL_QUESTIONS = 200;

const localizedContentSchema = z.object({
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  solution: z.string().optional(),
}).passthrough();

export const quizSessionQuestionSchema = z.object({
  questionUid: z.string().trim().min(1),
  id: z.union([z.string(), z.number()]).optional(),
  sessionAnchor: z.string().optional(),
  question: z.string().optional().default(''),
  options: z.array(z.string()).optional().default([]),
  questionType: z.string().optional(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  chapter: z.string().optional(),
  concept: z.string().optional(),
  difficulty: z.string().optional(),
  exam: z.string().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
  shift: z.union([z.string(), z.number()]).nullable().optional(),
  examDate: z.string().nullable().optional(),
  questionImage: z.string().nullable().optional(),
  questionImageWidth: z.number().optional(),
  questionImageHeight: z.number().optional(),
  optionRegions: z.record(
    z.string(),
    z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  ).optional(),
  diagram: z.record(z.string(), z.unknown()).optional(),
  needs_diagram: z.boolean().optional(),
  translations: z.object({
    bn: localizedContentSchema.optional(),
    hi: localizedContentSchema.optional(),
  }).passthrough().optional(),
}).passthrough();

export type QuizSessionQuestion = z.infer<typeof quizSessionQuestionSchema>;

export const createQuizSessionRequestSchema = z.object({
  mode: z.enum(V1_QUIZ_SESSION_MODES),
  exam: z.string().trim().min(1).max(200).optional(),
  tier: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(200).optional(),
  chapter: z.string().trim().min(1).max(200).optional(),
  concept: z.string().trim().min(1).max(200).optional(),
  letter: z.string().trim().min(1).max(40).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed', 'all']).optional(),
  examMode: z.enum(['ssc', 'iit-jam']).optional(),
  lang: z.enum(V1_QUIZ_SESSION_LANGS).optional(),
  batchSize: z.number().int().min(1).max(V1_MAX_BATCH_SIZE).optional(),
  totalQuestions: z.number().int().min(1).max(V1_MAX_TOTAL_QUESTIONS).optional(),
  // Backward-compatible aliases supported by contracts/quiz-session.js
  questionCount: z.number().int().min(1).max(V1_MAX_TOTAL_QUESTIONS).optional(),
  timeLimitSec: z.number().int().min(0).max(14_400).optional(),
  timeLimitSeconds: z.number().int().min(0).max(14_400).optional(),
  randomize: z.boolean().optional(),
  randomized: z.boolean().optional(),
}).passthrough();

export type CreateQuizSessionRequest = z.input<typeof createQuizSessionRequestSchema>;

export const createQuizSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.string().min(1),
  status: z.string().min(1),
  batchSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  answeredCount: z.number().int().nonnegative(),
  questions: z.array(quizSessionQuestionSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  deadlineAt: z.string().nullable().optional(),
  revision: z.number().int().nonnegative(),
}).passthrough();

export type CreateQuizSessionResponse = z.infer<typeof createQuizSessionResponseSchema>;

export const getQuizSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.string().min(1),
  status: z.string().min(1),
  answeredCount: z.number().int().nonnegative(),
  answeredQuestionUids: z.array(z.string()),
  lastCursor: z.string().nullable(),
  deadlineAt: z.string().nullable().optional(),
  revision: z.number().int().nonnegative(),
  hasMore: z.boolean(),
}).passthrough();

export type GetQuizSessionResponse = z.infer<typeof getQuizSessionResponseSchema>;

export const getSessionQuestionsResponseSchema = z.object({
  sessionId: z.string().min(1),
  questions: z.array(quizSessionQuestionSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  batchNumber: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
}).passthrough();

export type GetSessionQuestionsResponse = z.infer<typeof getSessionQuestionsResponseSchema>;

export const sessionAnswerEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  correct: z.number().int().optional(),
  correctIndex: z.number().int().optional(),
  correctAnswer: z.unknown().optional(),
  solution: z.string().optional(),
  solutionImage: z.string().nullable().optional(),
  solutionImageWidth: z.number().optional(),
  solutionImageHeight: z.number().optional(),
  translations: z.record(z.string(), localizedContentSchema).optional(),
}).passthrough();

export const submitSessionAnswerRequestSchema = z.object({
  questionUid: z.string().trim().min(1).max(128),
  answer: z.unknown(),
  timeTakenMs: z.number().min(0).max(3_600_000).optional(),
  timeTakenSeconds: z.number().min(0).max(3_600).optional(),
  submissionId: z.string().trim().min(4).max(128).optional(),
  revision: z.number().int().nonnegative().optional(),
});

export type SubmitSessionAnswerRequest = z.input<typeof submitSessionAnswerRequestSchema>;

export const submitSessionAnswerResponseSchema = z.object({
  sessionId: z.string().min(1),
  questionUid: z.string().trim().min(1),
  accepted: z.boolean(),
  idempotent: z.boolean().optional(),
  revision: z.number().int().nonnegative(),
  answeredCount: z.number().int().nonnegative(),
  evaluation: sessionAnswerEvaluationSchema.optional(),
}).passthrough();

export type SubmitSessionAnswerResponse = z.infer<typeof submitSessionAnswerResponseSchema>;

export const submitSessionRequestSchema = z.object({
  reason: z.enum(['manual', 'timeout']).optional(),
});

export type SubmitSessionRequest = z.input<typeof submitSessionRequestSchema>;

export const submitSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.string().min(1),
  idempotent: z.boolean().optional(),
  result: z.record(z.string(), z.unknown()),
}).passthrough();

export type SubmitSessionResponse = z.infer<typeof submitSessionResponseSchema>;

export const getSessionResultResponseSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.string().min(1),
  status: z.string().min(1),
  submittedAt: z.string().nullable().optional(),
  result: z.record(z.string(), z.unknown()),
  review: z.array(z.record(z.string(), z.unknown())),
}).passthrough();

export type GetSessionResultResponse = z.infer<typeof getSessionResultResponseSchema>;

export interface QuizSessionRequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

function makeIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function createQuizSession(
  payload: CreateQuizSessionRequest,
  options: QuizSessionRequestOptions = {},
): Promise<CreateQuizSessionResponse> {
  const validated = createQuizSessionRequestSchema.parse({
    batchSize: DEFAULT_QUIZ_BATCH_SIZE,
    ...payload,
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const raw = await request<unknown>(`${API_BASE}/api/v1/quiz/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(validated),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return createQuizSessionResponseSchema.parse(raw);
}

export async function getQuizSession(
  sessionId: string,
  options: Pick<QuizSessionRequestOptions, 'signal'> = {},
): Promise<GetQuizSessionResponse> {
  const raw = await request<unknown>(
    `${API_BASE}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  return getQuizSessionResponseSchema.parse(raw);
}

export async function fetchSessionQuestionsBatch(
  sessionId: string,
  params: { cursor?: string | null; batchSize?: number; lang?: 'en' | 'hi' | 'bn' } = {},
  options: Pick<QuizSessionRequestOptions, 'signal'> = {},
): Promise<GetSessionQuestionsResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.batchSize !== undefined) {
    query.set('batchSize', String(Math.max(1, Math.min(V1_MAX_BATCH_SIZE, Math.floor(params.batchSize)))));
  }
  if (params.lang) query.set('lang', params.lang);
  const qs = query.toString();
  const url = `${API_BASE}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/questions${qs ? `?${qs}` : ''}`;

  const raw = await request<unknown>(url, {
    method: 'GET',
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return getSessionQuestionsResponseSchema.parse(raw);
}

export async function submitSessionAnswer(
  sessionId: string,
  payload: SubmitSessionAnswerRequest,
  options: QuizSessionRequestOptions = {},
): Promise<SubmitSessionAnswerResponse> {
  const validated = submitSessionAnswerRequestSchema.parse(payload);
  const idempotencyKey = options.idempotencyKey ?? validated.submissionId ?? makeIdempotencyKey('ans');

  const raw = await request<unknown>(
    `${API_BASE}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ ...validated, submissionId: validated.submissionId ?? idempotencyKey }),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  return submitSessionAnswerResponseSchema.parse(raw);
}

export async function submitQuizSession(
  sessionId: string,
  payload: SubmitSessionRequest = {},
  options: QuizSessionRequestOptions = {},
): Promise<SubmitSessionResponse> {
  const validated = submitSessionRequestSchema.parse(payload);
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const idempotencyKey = options.idempotencyKey ?? `submit_${safeId || makeIdempotencyKey('sub')}`;

  const raw = await request<unknown>(
    `${API_BASE}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(validated),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  return submitSessionResponseSchema.parse(raw);
}

export async function getQuizSessionResult(
  sessionId: string,
  options: Pick<QuizSessionRequestOptions, 'signal'> = {},
): Promise<GetSessionResultResponse> {
  const raw = await request<unknown>(
    `${API_BASE}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/result`,
    {
      method: 'GET',
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  return getSessionResultResponseSchema.parse(raw);
}
