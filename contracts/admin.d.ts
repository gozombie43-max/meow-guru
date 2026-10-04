import { z } from 'zod';
export declare const VALID_ROLES: string[];
export declare const VALID_STATUSES: string[];
export declare const VALID_SORT_FIELDS: string[];
export declare const adminUsersQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<number, string>>;
    limit: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<number, string>>;
    search: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    status: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
    role: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
    sort: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodString>>, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export declare const roleUpdateSchema: z.ZodObject<{
    role: z.ZodEnum<{
        admin: "admin";
        moderator: "moderator";
        superadmin: "superadmin";
        user: "user";
    }>;
}, z.core.$strip>;
export declare const statusUpdateSchema: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        banned: "banned";
        suspended: "suspended";
    }>;
    reason: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const notificationSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
}, z.core.$strip>;
