import { z } from 'zod';
export declare const bookmarkPatchSchema: z.ZodObject<{
    questionId: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    action: z.ZodEnum<{
        add: "add";
        remove: "remove";
    }>;
    meta: z.ZodOptional<z.ZodObject<{
        quizKey: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        subject: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        href: z.ZodOptional<z.ZodString>;
        mode: z.ZodOptional<z.ZodString>;
        questionIndex: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const progressPatchSchema: z.ZodObject<{
    topic: z.ZodString;
    attempted: z.ZodNumber;
    correct: z.ZodNumber;
}, z.core.$strip>;
export declare const recentQuizPatchSchema: z.ZodObject<{
    quizKey: z.ZodString;
    title: z.ZodString;
    subject: z.ZodString;
    slug: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    href: z.ZodString;
    mode: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    currentIndex: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    totalQuestions: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    selectedAnswers: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>>;
    submittedQuestions: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodNumber>>>;
    results: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodAny>>>;
    delta: z.ZodOptional<z.ZodBoolean>;
    removedAnswers: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    questionAnchor: z.ZodOptional<z.ZodString>;
    sessionFilters: z.ZodOptional<z.ZodObject<{
        exam: z.ZodOptional<z.ZodString>;
        concept: z.ZodOptional<z.ZodString>;
        letter: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        "in-progress": "in-progress";
    }>>>;
}, z.core.$strip>;
export declare const studyTimePatchSchema: z.ZodObject<{
    activeSeconds: z.ZodNumber;
    timezone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
