import { z } from 'zod';
export declare const publicTopicCountsSchema: z.ZodObject<{
    subject: z.ZodString;
    revision: z.ZodNumber;
    updatedAt: z.ZodString;
    totals: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, z.core.$strip>;
export declare const questionAnswerRequestSchema: z.ZodObject<{
    answer: z.ZodNumber;
    submissionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
