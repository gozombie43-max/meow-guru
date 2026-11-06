export const tutorRequestSchema: z.ZodObject<{
    context: z.ZodString;
    message: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    history: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodUnknown>>>;
    lang: z.ZodDefault<z.ZodEnum<{
        en: "en";
        bn: "bn";
        hi: "hi";
    }>>;
}, z.core.$strip>;
export const tutorReplySchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    reply: z.ZodString;
}, z.core.$strip>;
export const tutorJobResponseSchema: z.ZodObject<{
    jobId: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        staging: "staging";
        queued: "queued";
        running: "running";
        failed: "failed";
        cancelled: "cancelled";
    }>;
    success: z.ZodOptional<z.ZodBoolean>;
    reply: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
import { z } from 'zod';
