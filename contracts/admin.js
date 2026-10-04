// backend/schemas/adminSchemas.js
import { z } from 'zod';

export const VALID_ROLES = ['user', 'student', 'moderator', 'admin', 'superadmin'];
export const VALID_STATUSES = ['active', 'suspended', 'banned'];
export const VALID_SORT_FIELDS = ['-createdAt', 'createdAt', 'name', '-name', '-lastLoginAt', 'lastLoginAt'];

export const adminUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('25')
    .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 25))),
  search: z.string().trim().max(200).optional().default(''),
  status: z
    .string()
    .optional()
    .default('')
    .transform((v) => (VALID_STATUSES.includes(v) ? v : '')),
  role: z
    .string()
    .optional()
    .default('')
    .transform((v) => (VALID_ROLES.includes(v) ? v : '')),
  sort: z
    .string()
    .optional()
    .default('-createdAt')
    .transform((v) => (VALID_SORT_FIELDS.includes(v) ? v : '-createdAt')),
});

export const roleUpdateSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin', 'superadmin']),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().trim().max(500).optional().default(''),
});

export const notificationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(1000),
});
