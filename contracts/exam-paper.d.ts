/** @param {string} key */
export function sectionLabel(key: string): string;
/** @param {ExamPaper} paper */
export function paperPresentation(paper: ExamPaper): {
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
            translations: {
                question: LanguageText;
                options: {
                    en: string[];
                    bn: string[];
                };
                solution: LanguageText;
            };
            questionImage?: string | undefined;
            questionImageWidth?: number | undefined;
            questionImageHeight?: number | undefined;
            id: string;
            questionType: "MCQ";
            question: string;
            options: {
                id: string;
                text: string;
            }[];
            solution: string;
        }[];
    }[];
    skillTest?: {
        type: "DEST" | "TYPING";
        duration: number;
    } | undefined;
    shift?: number | undefined;
    examDate?: string | undefined;
    paper?: number | undefined;
    schemaDriven: boolean;
    exam: "SSC_CGL" | "SSC_CHSL";
    tier: 1 | 2;
    type: "MOCK" | "PYQ";
};
/** @type {z.ZodType<ExamPaper>} */
export const examPaperSchema: z.ZodType<ExamPaper>;
export type QuizLanguage = "en" | "bn";
export type AnswerLetter = "A" | "B" | "C" | "D";
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
    questionImage?: string | null;
    questionImageWidth?: number;
    questionImageHeight?: number;
};
export type QuizSection = {
    duration?: number;
    questions: QuizQuestion[];
};
export type ExamPaper = {
    exam: "SSC_CGL" | "SSC_CHSL";
    tier: 1 | 2;
    type: "MOCK" | "PYQ";
    paper?: number;
    examDate?: string;
    shift?: number;
    marksPerQuestion: number;
    negativeMarks: number;
    sections: Record<string, QuizSection>;
    skillTest?: {
        type: "DEST" | "TYPING";
        duration: number;
    };
};
import { z } from 'zod';
