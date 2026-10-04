import { z } from 'zod';
export declare const tutorRequestSchema: z.ZodObject<{
    context: z.ZodString;
    message: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    history: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodUnknown>>>;
    lang: z.ZodDefault<z.ZodEnum<{
        bn: "bn";
        en: "en";
        hi: "hi";
    }>>;
}, z.core.$strip>;
export declare const tutorReplySchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    reply: z.ZodString;
}, z.core.$strip>;
export declare const tutorJobResponseSchema: z.ZodObject<{
    jobId: z.ZodString;
    status: z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
        failed: "failed";
        queued: "queued";
        running: "running";
        staging: "staging";
    }>;
    success: z.ZodOptional<z.ZodBoolean>;
    reply: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
