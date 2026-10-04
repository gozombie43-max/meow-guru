import { z } from 'zod';
export declare const TRAINING_MODES: string[];
export declare const TRAINING_EXAMS: {
    id: string;
    label: string;
}[];
export declare const MISTAKES: string[];
export declare const startSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        [x: string]: string;
    }>;
    exam: z.ZodEnum<{
        [x: string]: string;
    }>;
    tier: z.ZodDefault<z.ZodEnum<{
        1: "1";
        2: "2";
    }>>;
    subject: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    count: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<10>, z.ZodLiteral<20>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<"full">]>>;
    minutes: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>]>>;
}, z.core.$strip>;
export declare const actionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"answer">;
    revision: z.ZodNumber;
    choice: z.ZodNullable<z.ZodNumber>;
    confidence: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        guess: "guess";
        sure: "sure";
        unsure: "unsure";
    }>>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"visit">;
    revision: z.ZodNumber;
    index: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"finish">;
    revision: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"abandon">;
    revision: z.ZodNumber;
}, z.core.$strip>], "type">;
