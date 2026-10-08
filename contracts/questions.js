import { z } from 'zod';
export const publicTopicCountsSchema = z.object({
  subject: z.string().min(1), revision: z.number().int().nonnegative(), updatedAt: z.string(),
  totals: z.record(z.string(), z.number().int().nonnegative()),
});
export const questionAnswerRequestSchema = z.object({
  answer: z.number().int().nonnegative().max(20),
  questionUid: z.string().regex(/^q_[a-f0-9]{32}$/).optional(),
  topic: z.string().max(200).optional(),
  submissionId: z.string().min(1).max(200).optional(),
});

// Practice quiz answer precedence, shared with the browser's local grading.
/** @param {{ correctLetter?: string, correctAnswer?: unknown }} question
 * @param {string[]} options
 * @returns {number | null}
 */
export function quizCorrectIndex(question, options) {
  const letter = String(question.correctLetter ?? '').trim().toLowerCase();
  if (letter) {
    const index = letter.charCodeAt(0) - 97;
    if (index >= 0 && index < options.length) return index;
  }
  const text = String(question.correctAnswer ?? '').trim();
  if (!text) return null;
  if (/^[a-z]$/i.test(text)) {
    const index = text.toLowerCase().charCodeAt(0) - 97;
    if (index >= 0 && index < options.length) return index;
  }
  const exact = options.findIndex(option => String(option).trim() === text);
  if (exact >= 0) return exact;
  const numeric = Number(text);
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric < options.length) return numeric;
    if (numeric >= 1 && numeric <= options.length) return numeric - 1;
  }
  return null;
}
