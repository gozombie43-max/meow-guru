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
