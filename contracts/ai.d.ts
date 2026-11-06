export const questionDraftSchema: z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    correctAnswer: z.ZodNumber;
    explanation: z.ZodString;
    topic: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
    }>;
}, z.core.$strip>;
export const questionDraftsSchema: z.ZodArray<z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    correctAnswer: z.ZodNumber;
    explanation: z.ZodString;
    topic: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
    }>;
}, z.core.$strip>>;
export const questionTagsSchema: z.ZodObject<{
    subject: z.ZodString;
    chapter: z.ZodString;
    concept: z.ZodString;
    difficulty: z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
    }>;
    trap_type: z.ZodString;
    formula: z.ZodString;
}, z.core.$strip>;
export const failureClassificationSchema: z.ZodObject<{
    dimension: z.ZodEnum<{
        CONCEPTUAL_GAP: "CONCEPTUAL_GAP";
        APPLICATION_ERROR: "APPLICATION_ERROR";
        TRAP_CAUGHT: "TRAP_CAUGHT";
    }>;
    reason: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export const mistakeCoachSchema: z.ZodObject<{
    mistakeCoach: z.ZodArray<z.ZodObject<{
        concept: z.ZodString;
        dimension: z.ZodString;
        why: z.ZodString;
        fix: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export const conceptGroupsSchema: z.ZodObject<{
    groups: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        description: z.ZodString;
        conceptIds: z.ZodArray<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
import { z } from 'zod';
