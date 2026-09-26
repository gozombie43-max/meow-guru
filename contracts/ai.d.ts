import { z } from 'zod';
export declare const questionDraftSchema: z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    correctAnswer: z.ZodNumber;
    explanation: z.ZodString;
    topic: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodEnum<{
        easy: "easy";
        hard: "hard";
        medium: "medium";
    }>;
}, z.core.$strip>;
export declare const questionDraftsSchema: z.ZodArray<z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    correctAnswer: z.ZodNumber;
    explanation: z.ZodString;
    topic: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodEnum<{
        easy: "easy";
        hard: "hard";
        medium: "medium";
    }>;
}, z.core.$strip>>;
export declare const questionTagsSchema: z.ZodObject<{
    subject: z.ZodString;
    chapter: z.ZodString;
    concept: z.ZodString;
    difficulty: z.ZodEnum<{
        easy: "easy";
        hard: "hard";
        medium: "medium";
    }>;
    trap_type: z.ZodString;
    formula: z.ZodString;
}, z.core.$strip>;
export declare const failureClassificationSchema: z.ZodObject<{
    dimension: z.ZodEnum<{
        APPLICATION_ERROR: "APPLICATION_ERROR";
        CONCEPTUAL_GAP: "CONCEPTUAL_GAP";
        TRAP_CAUGHT: "TRAP_CAUGHT";
    }>;
    reason: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export declare const mistakeCoachSchema: z.ZodObject<{
    mistakeCoach: z.ZodArray<z.ZodObject<{
        concept: z.ZodString;
        dimension: z.ZodString;
        why: z.ZodString;
        fix: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const conceptGroupsSchema: z.ZodObject<{
    groups: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        description: z.ZodString;
        conceptIds: z.ZodArray<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
