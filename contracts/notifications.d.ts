/** @param {unknown} value */
export function isSafeInternalRoute(value: unknown): boolean;
/** @param {unknown} value */
export function isSafeHttpUrl(value: unknown): boolean;
/**
 * FINDING-06: notification routes are rendered by clients as in-app navigation
 * targets. Only same-origin absolute paths are allowed: must start with a single
 * "/", must not be protocol-relative ("//host"), and must not contain whitespace,
 * quotes, angle brackets or backslashes (which browsers normalise to "/").
 */
export const SAFE_INTERNAL_ROUTE_REGEX: RegExp;
export const MAX_INTERNAL_ROUTE_LENGTH: 512;
export const MAX_EXTERNAL_URL_LENGTH: 2048;
export const safeInternalRouteSchema: z.ZodString;
export const safeHttpUrlSchema: z.ZodString;
export const registerSchema: z.ZodObject<{
    fid: z.ZodString;
    platform: z.ZodDefault<z.ZodEnum<{
        android: "android";
    }>>;
}, z.core.$strip>;
export const unregisterSchema: z.ZodObject<{
    fid: z.ZodString;
}, z.core.$strip>;
export const broadcastSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    route: z.ZodDefault<z.ZodString>;
    data: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export const scheduleSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    route: z.ZodDefault<z.ZodString>;
    sendAt: z.ZodString;
}, z.core.$strip>;
export const retryScheduleSchema: z.ZodObject<{
    sendAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export const engagementSchema: z.ZodObject<{
    event: z.ZodEnum<{
        opened: "opened";
        action_clicked: "action_clicked";
    }>;
    source: z.ZodEnum<{
        in_app: "in_app";
        push: "push";
    }>;
}, z.core.$strip>;
import { z } from 'zod';
