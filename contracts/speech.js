import { z } from 'zod';

export const speechRequestSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  bengaliText: z.string().trim().max(5000).optional().default(''),
  voice: z.enum(['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural']).catch('en-IN-NeerjaNeural'),
  rate: z.string().regex(/^(?:-?(?:[0-9]|1[0-9]|20))%$/).catch('0%'),
});
export const translationRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(2000).refine(text => Boolean(text.trim()))).min(1).max(20)
    .refine(texts => texts.reduce((total, text) => total + text.length, 0) <= 10000),
  targetLang: z.enum(['hi', 'bn']),
});
export const translationResponseSchema = z.array(z.object({
  translations: z.array(z.object({ text: z.string(), to: z.enum(['hi', 'bn']) })).min(1),
}));
