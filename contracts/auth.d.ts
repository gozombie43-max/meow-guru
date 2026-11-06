export const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export const requestEmailOtpSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export const verifyEmailOtpSchema: z.ZodObject<{
    email: z.ZodString;
    challengeId: z.ZodString;
    code: z.ZodString;
}, z.core.$strip>;
export const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export const resendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export const accessCodeVerifySchema: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strip>;
export const profilePatchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    avatar: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
import { z } from 'zod';
