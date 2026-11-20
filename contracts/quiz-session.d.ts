/**
 * Normalize request body aliases into a canonical CreateQuizSession command.
 * @param {z.infer<typeof createQuizSessionBodySchema>} input
 */
export function normalizeCreateQuizSessionInput(input: z.infer<typeof createQuizSessionBodySchema>): {
    timeLimitSec?: number | undefined;
    lang: "en" | "bn" | "hi";
    randomize: boolean;
    totalQuestions?: number | undefined;
    mode: "topic" | "practice" | "speed" | "mock" | "ai";
    filters: {};
    batchSize: number;
};
export const QUIZ_SESSION_MODES: readonly ["practice", "topic", "speed", "mock", "ai"];
export const QUIZ_SESSION_LANGS: readonly ["en", "bn", "hi"];
export const QUIZ_SESSION_STATUSES: readonly ["in_progress", "completed"];
export const DEFAULT_QUIZ_SESSION_BATCH_SIZE: 20;
export const MAX_QUIZ_SESSION_BATCH_SIZE: 50;
export const MAX_QUIZ_SESSION_TOTAL_QUESTIONS: 200;
export const quizSessionIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export const createQuizSessionBodySchema: z.ZodObject<{
    mode: z.ZodEnum<{
        topic: "topic";
        practice: "practice";
        speed: "speed";
        mock: "mock";
        ai: "ai";
    }>;
    exam: z.ZodOptional<z.ZodString>;
    tier: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    chapter: z.ZodOptional<z.ZodString>;
    concept: z.ZodOptional<z.ZodString>;
    letter: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodPreprocess<z.ZodOptional<z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
        mixed: "mixed";
        all: "all";
    }>>, unknown>;
    examMode: z.ZodOptional<z.ZodEnum<{
        ssc: "ssc";
        "iit-jam": "iit-jam";
    }>>;
    batchSize: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    totalQuestions: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    questionCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    lang: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        en: "en";
        bn: "bn";
        hi: "hi";
    }>>>;
    randomize: z.ZodOptional<z.ZodBoolean>;
    randomized: z.ZodOptional<z.ZodBoolean>;
    timeLimitSec: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    timeLimitSeconds: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export const getSessionQuestionsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    batchSize: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    lang: z.ZodOptional<z.ZodEnum<{
        en: "en";
        bn: "bn";
        hi: "hi";
    }>>;
}, z.core.$strip>;
export const submitSessionAnswerBodySchema: z.ZodObject<{
    questionUid: z.ZodString;
    answer: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodArray<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>]>;
    timeTakenMs: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    timeTakenSeconds: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    submissionId: z.ZodOptional<z.ZodString>;
    revision: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export const submitSessionBodySchema: z.ZodPreprocess<z.ZodObject<{
    reason: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        timeout: "timeout";
    }>>>;
}, z.core.$strip>, unknown>;
export const idempotencyKeyHeaderSchema: z.ZodString;
import { z } from 'zod';
