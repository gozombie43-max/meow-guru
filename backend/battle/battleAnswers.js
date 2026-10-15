import { mockAnswerIndex } from '@meow/contracts/mock-answer';

export const battleQuestionType = question => ['MSQ', 'NAT'].includes(String(question?.questionType).trim().toUpperCase()) ? String(question.questionType).trim().toLowerCase() : 'mcq';
const optionText = option => typeof option === 'string' ? option : String(option?.text || '');
const keyIndex = (value, options) => {
  const index = mockAnswerIndex(value, options);
  if (index !== null) return index;
  const letter = typeof value === 'string' ? value.trim().match(/^\(?\s*([a-z])\s*\)?[.):]?$/i)?.[1]?.toUpperCase() : null;
  const fallback = letter ? letter.charCodeAt(0) - 65 : -1;
  return fallback >= 0 && fallback < options.length ? fallback : null;
};
const image = value => typeof value === 'string' && value.trim() ? value.trim() : null;
export function battleMedia(question) {
  return { questionImage: image(question.questionImage), optionImages: (Array.isArray(question.options) ? question.options : []).map((option, index) =>
    image(question.optionImages?.[index] ?? question.optionImages?.[String.fromCharCode(65 + index)] ?? question[`option${String.fromCharCode(65 + index)}Image`] ?? option?.image)) };
}

// Private grading metadata. Never include this projection in an open round.
export function battleAnswerKey(question) {
  const type = battleQuestionType(question), options = question.options || [], key = question.correctAnswer;
  if (type === 'mcq') {
    const selectedIndex = keyIndex(key, options);
    return selectedIndex === null ? null : { type, selectedIndex };
  }
  if (type === 'msq') {
    if (!Array.isArray(key) || !key.length) return null;
    const indices = key.map(value => keyIndex(value, options));
    return indices.includes(null) || new Set(indices).size !== indices.length ? null : { type, selectedIndices: indices.sort((a, b) => a - b) };
  }
  if (key === null || key === undefined || (typeof key === 'string' && !key.trim()) || Array.isArray(key) || typeof key === 'boolean') return null;
  if (typeof key === 'object') return Number.isFinite(key.min) && Number.isFinite(key.max) && key.min <= key.max
    ? { type, min: key.min, max: key.max } : null;
  const numericAnswer = Number(key), tolerance = question.numericTolerance ?? question.tolerance ?? 0;
  if (!Number.isFinite(numericAnswer) || !Number.isFinite(tolerance) || tolerance < 0 || !Number.isFinite(numericAnswer - tolerance) || !Number.isFinite(numericAnswer + tolerance)) return null;
  return { type, min: numericAnswer - tolerance, max: numericAnswer + tolerance };
}

export function normalizeBattleAnswer(question, input) {
  const type = battleQuestionType(question), options = question.options || [];
  // Legacy clients may omit type only for MCQ. Never coerce another answer kind.
  if ((input.type || 'mcq') !== type) return null;
  const valid = index => Number.isInteger(index) && index >= 0 && index < options.length;
  if (type === 'mcq') return valid(input.selectedIndex) ? { type, selectedIndex: input.selectedIndex } : null;
  if (type === 'msq') return Array.isArray(input.selectedIndices) && input.selectedIndices.length > 0
    && input.selectedIndices.every(valid) && new Set(input.selectedIndices).size === input.selectedIndices.length
    ? { type, selectedIndices: [...input.selectedIndices].sort((a, b) => a - b) } : null;
  return typeof input.numericAnswer === 'number' && Number.isFinite(input.numericAnswer) ? { type, numericAnswer: input.numericAnswer } : null;
}

export function gradeBattleAnswer(question, answer) {
  const key = battleAnswerKey(question);
  if (!key) return null;
  const correct = key.type === 'mcq' ? answer.selectedIndex === key.selectedIndex
    : key.type === 'nat' ? answer.numericAnswer >= key.min && answer.numericAnswer <= key.max
      : answer.selectedIndices.length === key.selectedIndices.length && answer.selectedIndices.every(index => key.selectedIndices.includes(index));
  // JAM MSQ is exact by default. Curated study items may explicitly allow a
  // correct subset, with zero credit if any distractor was selected.
  const partial = !correct && key.type === 'msq' && question.partialCredit === true
    && answer.selectedIndices.every(index => key.selectedIndices.includes(index));
  return { correct, points: correct ? 10 : partial ? Math.floor(10 * answer.selectedIndices.length / key.selectedIndices.length) : 0 };
}

export function publicBattleQuestion(question) {
  return { question: String(question.question || ''), options: (Array.isArray(question.options) ? question.options : []).map(optionText),
    type: battleQuestionType(question), partialCredit: battleQuestionType(question) === 'msq' && question.partialCredit === true,
    ...battleMedia(question) };
}

export const storedBattleAnswer = entry => entry?.answer ?? (Number.isInteger(entry?.selectedIndex) ? { type: 'mcq', selectedIndex: entry.selectedIndex } : null);
