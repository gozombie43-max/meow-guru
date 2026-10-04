import { z } from 'zod';
export const tutorRequestSchema = z.object({
  context: z.string().min(1).max(20000), message: z.string().max(20000).optional().default(''),
  history: z.array(z.unknown()).max(1000).optional().default([]), lang: z.enum(['en', 'hi', 'bn']).default('en'),
});
export const tutorReplySchema = z.object({ success: z.literal(true), reply: z.string() });
export const tutorJobResponseSchema = z.object({
  jobId: z.string().min(1), status: z.enum(['staging', 'queued', 'running', 'completed', 'failed', 'cancelled']),
  success: z.boolean().optional(), reply: z.string().optional(), error: z.string().optional(),
}).passthrough();
