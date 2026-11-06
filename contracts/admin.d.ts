export const VALID_ROLES: string[];
export const VALID_STATUSES: string[];
export const VALID_SORT_FIELDS: string[];
export const adminUsersQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<number, string>>;
    limit: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<number, string>>;
    search: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    status: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
    role: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
    sort: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export const roleUpdateSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        moderator: "moderator";
        admin: "admin";
        superadmin: "superadmin";
    }>;
}, z.core.$strip>;
export const statusUpdateSchema: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        suspended: "suspended";
        banned: "banned";
    }>;
    reason: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export const notificationSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
}, z.core.$strip>;
import { z } from 'zod';
