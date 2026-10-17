import { z } from 'zod';
export type QuizLanguage = 'en' | 'bn';
export type AnswerLetter = 'A' | 'B' | 'C' | 'D';
export type LanguageText = {
    en: string;
    bn: string;
};
export type QuizQuestion = {
    id: string;
    question: LanguageText;
    options: {
        en: string[];
        bn: string[];
    };
    answer: AnswerLetter;
    solution: LanguageText;
};
export type QuizSection = {
    duration?: number;
    questions: QuizQuestion[];
};
export type ExamPaper = {
    exam: 'SSC_CGL' | 'SSC_CHSL';
    tier: 1 | 2;
    type: 'MOCK' | 'PYQ';
    paper?: number;
    examDate?: string;
    shift?: number;
    marksPerQuestion: number;
    negativeMarks: number;
    sections: Record<string, QuizSection>;
    skillTest?: {
        type: 'DEST' | 'TYPING';
        duration: number;
    };
};
/** @type {z.ZodType<ExamPaper>} */
export declare const examPaperSchema: z.ZodType<ExamPaper>;
/** @param {string} key */
export declare function sectionLabel(key: string): string;
/** @param {ExamPaper} paper */
export declare function paperPresentation(paper: ExamPaper): {
    schemaDriven: boolean;
    exam: "SSC_CGL" | "SSC_CHSL";
    tier: 1 | 2;
    type: "MOCK" | "PYQ";
    paper?: number | undefined;
    examDate?: string | undefined;
    shift?: number | undefined;
    skillTest?: {
        type: 'DEST' | 'TYPING';
        duration: number;
    } | undefined;
    examName: string;
    marksPerQuestion: number;
    negativeMarks: number;
    compositeTimer: boolean;
    totalDurationMin: number | undefined;
    sections: {
        key: string;
        label: string;
        questionCount: number;
        timeLimitMin: number;
        marking: {
            correct: number;
            incorrect: number;
        };
        questions: {
            id: string;
            questionType: 'MCQ';
            question: string;
            options: {
                id: string;
                text: string;
            }[];
            solution: string;
            translations: {
                question: LanguageText;
                options: {
                    en: string[];
                    bn: string[];
                };
                solution: LanguageText;
            };
        }[];
    }[];
};
