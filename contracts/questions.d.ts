import { z } from 'zod';
export declare const publicTopicCountsSchema: z.ZodObject<{
    subject: z.ZodString;
    revision: z.ZodNumber;
    updatedAt: z.ZodString;
    totals: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, z.core.$strip>;
export declare const questionAnswerRequestSchema: z.ZodObject<{
    answer: z.ZodNumber;
    questionUid: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    submissionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export { quizCorrectIndex } from './quiz-grading.js';
