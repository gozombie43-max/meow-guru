import { z } from 'zod';

/** @typedef {'en' | 'bn'} QuizLanguage */
/** @typedef {'A' | 'B' | 'C' | 'D'} AnswerLetter */
/** @typedef {{ en: string, bn: string }} LanguageText */
/** @typedef {{ id: string, question: LanguageText, options: { en: string[], bn: string[] }, answer: AnswerLetter, solution: LanguageText }} QuizQuestion */
/** @typedef {{ duration?: number, questions: QuizQuestion[] }} QuizSection */
/** @typedef {{ exam: 'SSC_CGL' | 'SSC_CHSL', tier: 1 | 2, type: 'MOCK' | 'PYQ', paper?: number, examDate?: string, shift?: number, marksPerQuestion: number, negativeMarks: number, sections: Record<string, QuizSection>, skillTest?: { type: 'DEST' | 'TYPING', duration: number } }} ExamPaper */

const text = z.object({ en: z.string().trim().min(1), bn: z.string().trim().min(1) });
const options = z.object({ en: z.array(z.string().min(1)).length(4), bn: z.array(z.string().min(1)).length(4) });
/** @type {z.ZodType<ExamPaper>} */
export const examPaperSchema = z.object({
  exam: z.enum(['SSC_CGL', 'SSC_CHSL']),
  tier: z.union([z.literal(1), z.literal(2)]),
  type: z.enum(['MOCK', 'PYQ']),
  paper: z.number().int().positive().optional(),
  examDate: z.iso.date().optional(),
  shift: z.number().int().positive().optional(),
  marksPerQuestion: z.number().positive(),
  negativeMarks: z.number().nonnegative(),
  sections: z.record(z.string().regex(/^[a-z][a-z0-9_-]*$/i), z.object({
    duration: z.number().positive().optional(),
    questions: z.array(z.object({
      id: z.string().trim().min(1), question: text, options,
      answer: z.enum(['A', 'B', 'C', 'D']), solution: text,
    })),
  })),
  skillTest: z.object({ type: z.enum(['DEST', 'TYPING']), duration: z.number().positive() }).optional(),
}).superRefine((paper, ctx) => {
  const ids = new Set();
  let count = 0;
  for (const [key, section] of Object.entries(paper.sections)) {
    section.questions.forEach((question, index) => {
      count++;
      if (ids.has(question.id)) ctx.addIssue({ code: 'custom', path: ['sections', key, 'questions', index, 'id'], message: 'Question IDs must be unique within the paper' });
      ids.add(question.id);
    });
  }
  if (!count) ctx.addIssue({ code: 'custom', path: ['sections'], message: 'A paper must contain at least one MCQ question' });
});

/** @param {string} key */
export function sectionLabel(key) {
  /** @type {Record<string, string>} */
  const labels = { english: 'English', reasoning: 'Reasoning', math: 'Math', gk: 'GK', computer: 'Computer' };
  return Object.hasOwn(labels, key) ? labels[key]
    : key.replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

// Adapt at the mock-paper boundary; practice questions keep their existing model.
/** @param {ExamPaper} paper */
export function paperPresentation(paper) {
  const entries = Object.entries(paper.sections);
  return {
    schemaDriven: true,
    exam: paper.exam, tier: paper.tier, type: paper.type,
    ...(paper.paper !== undefined ? { paper: paper.paper } : {}),
    ...(paper.examDate ? { examDate: paper.examDate } : {}),
    ...(paper.shift ? { shift: paper.shift } : {}),
    ...(paper.skillTest ? { skillTest: paper.skillTest } : {}),
    examName: `${paper.exam.replace('_', ' ')} Tier ${paper.tier}`,
    marksPerQuestion: paper.marksPerQuestion, negativeMarks: paper.negativeMarks,
    compositeTimer: !entries.some(([, section]) => section.duration !== undefined && section.questions.length),
    totalDurationMin: entries.every(([, section]) => !section.questions.length || section.duration !== undefined)
      ? entries.reduce((sum, [, section]) => sum + (section.questions.length ? section.duration ?? 0 : 0), 0) : undefined,
    sections: entries.map(([key, section]) => ({
      key, label: sectionLabel(key), questionCount: section.questions.length,
      timeLimitMin: section.duration ?? 0,
      marking: { correct: paper.marksPerQuestion, incorrect: paper.negativeMarks },
      questions: section.questions.map(question => ({
        id: question.id, questionType: /** @type {'MCQ'} */ ('MCQ'), question: question.question.en,
        options: question.options.en.map((value, index) => ({ id: 'ABCD'[index], text: value })),
        solution: question.solution.en,
        translations: { question: question.question, options: question.options, solution: question.solution },
      })),
    })),
  };
}
