export const failureRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    questionId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    topic: z.ZodString;
    concept: z.ZodString;
    question: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodArray<z.ZodString>>;
    userAnswer: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>;
    correctAnswer: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    solution: z.ZodOptional<z.ZodString>;
    timeSpent: z.ZodOptional<z.ZodNumber>;
    changedAnswer: z.ZodOptional<z.ZodBoolean>;
    skipped: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export const failureBatchRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    wrongAnswers: z.ZodArray<z.ZodObject<{
        question: z.ZodOptional<z.ZodString>;
        topic: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodString>>;
        correctAnswer: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        concept: z.ZodString;
        questionId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        userAnswer: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>;
        solution: z.ZodOptional<z.ZodString>;
        timeSpent: z.ZodOptional<z.ZodNumber>;
        changedAnswer: z.ZodOptional<z.ZodBoolean>;
        skipped: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
import { z } from 'zod';
