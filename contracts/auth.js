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

export const requestEmailOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254).toLowerCase(),
});

export const verifyEmailOtpSchema = z.object({
  email: requestEmailOtpSchema.shape.email,
  challengeId: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid sign-in request'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required').max(256),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254).toLowerCase(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254).toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required').max(256),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password is too long')
    .refine(password => new TextEncoder().encode(password).byteLength <= 72, 'Password must not exceed 72 UTF-8 bytes'),
});

export const accessCodeVerifySchema = z.object({
  code: z.string().trim().min(1, 'Access code is required').max(32),
});

export const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80).optional(),
  avatar: z.string().trim().max(150000).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
});
