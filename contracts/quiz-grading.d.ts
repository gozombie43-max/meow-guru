/** @param {{ correctLetter?: string, correctAnswer?: unknown }} question
 * @param {string[]} options
 * @returns {number | null}
 */
export function quizCorrectIndex(question: {
    correctLetter?: string;
    correctAnswer?: unknown;
}, options: string[]): number | null;
