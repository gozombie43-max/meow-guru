import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const accessCodeVerifySchema = z.object({
  code: z.string().trim().min(1, 'Access code is required').max(32),
});

export const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80).optional(),
  avatar: z.string().trim().max(2000).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
});
