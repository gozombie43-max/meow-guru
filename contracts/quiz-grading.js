// Shared practice grading without importing request validation into browser entry bundles.
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
