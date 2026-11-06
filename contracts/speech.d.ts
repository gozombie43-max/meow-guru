export const speechRequestSchema: z.ZodObject<{
    text: z.ZodString;
    bengaliText: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    voice: z.ZodCatch<z.ZodEnum<{
        "en-IN-NeerjaNeural": "en-IN-NeerjaNeural";
        "en-IN-PrabhatNeural": "en-IN-PrabhatNeural";
    }>>;
    rate: z.ZodCatch<z.ZodString>;
}, z.core.$strip>;
export const translationRequestSchema: z.ZodObject<{
    texts: z.ZodArray<z.ZodString>;
    targetLang: z.ZodEnum<{
        bn: "bn";
        hi: "hi";
    }>;
}, z.core.$strip>;
export const translationResponseSchema: z.ZodArray<z.ZodObject<{
    translations: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        to: z.ZodEnum<{
            bn: "bn";
            hi: "hi";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
import { z } from 'zod';
