import { z } from 'zod';

/**
 * FINDING-06: notification routes are rendered by clients as in-app navigation
 * targets. Only same-origin absolute paths are allowed: must start with a single
 * "/", must not be protocol-relative ("//host"), and must not contain whitespace,
 * quotes, angle brackets or backslashes (which browsers normalise to "/").
 */
export const SAFE_INTERNAL_ROUTE_REGEX = /^\/(?!\/)[^\s"'<>\\]*$/;
export const MAX_INTERNAL_ROUTE_LENGTH = 512;
export const MAX_EXTERNAL_URL_LENGTH = 2048;
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

/** @param {unknown} value */
export function isSafeInternalRoute(value) {
  return typeof value === 'string'
    && value.length <= MAX_INTERNAL_ROUTE_LENGTH
    && SAFE_INTERNAL_ROUTE_REGEX.test(value);
}

/** @param {unknown} value */
export function isSafeHttpUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_EXTERNAL_URL_LENGTH) return false;
  try {
    return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const safeInternalRouteSchema = z.string()
  .trim()
  .max(MAX_INTERNAL_ROUTE_LENGTH)
  .regex(SAFE_INTERNAL_ROUTE_REGEX, 'Route must be a safe internal path starting with /');

export const safeHttpUrlSchema = z.string()
  .trim()
  .max(MAX_EXTERNAL_URL_LENGTH)
  .refine(isSafeHttpUrl, 'URL must use http or https');

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
  route: safeInternalRouteSchema.default("/"),
  data: z.record(z.string(), z.any()).optional().default({}),
});

export const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  route: safeInternalRouteSchema.default("/"),
  sendAt: z.string().datetime(),
});

export const retryScheduleSchema = z.object({
  sendAt: z.string().datetime().optional(),
});

export const engagementSchema = z.object({
  event: z.enum(["opened", "action_clicked"]),
  source: z.enum(["in_app", "push"]),
});
