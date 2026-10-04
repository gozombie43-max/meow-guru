import { z } from 'zod';

export const registerSchema = z.object({
  fid: z.string().trim().min(10).max(256),
  platform: z.enum(["android"]).default("android"),
});

export const unregisterSchema = z.object({
  fid: z.string().trim().min(10).max(256),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  route: z.string().trim().default("/"),
  data: z.record(z.string(), z.any()).optional().default({}),
});

export const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  route: z.string().trim().default("/"),
  sendAt: z.string().datetime(),
});

export const retryScheduleSchema = z.object({
  sendAt: z.string().datetime().optional(),
});

export const engagementSchema = z.object({
  event: z.enum(["opened", "action_clicked"]),
  source: z.enum(["in_app", "push"]),
});
