export function mockAnswerIndex(answer, options, selected = false) {
  if (!Array.isArray(options) || answer === null || answer === undefined || answer === '') return null;
  const validIndex = value => Number.isInteger(value) && value >= 0 && value < options.length;
  if (typeof answer === 'number') return validIndex(answer) ? answer : null;
  if (typeof answer !== 'string') return null;
  const value = answer.trim();
  // The test UI submits object option IDs or zero-based indices for string options.
  const idIndex = options.findIndex(option => option && typeof option === 'object' && String(option.id) === value);
  if (idIndex >= 0) return idIndex;
  if (selected && /^\d+$/.test(value) && validIndex(Number(value))) return Number(value);
  const textIndex = options.findIndex(option => String(typeof option === 'object' ? option?.text : option).trim() === value);
  if (textIndex >= 0) return textIndex;
  const letter = value.match(/^\(?([a-z])\)?[.):]?$/i)?.[1]?.toUpperCase();
  if (letter && validIndex(letter.charCodeAt(0) - 65)) return letter.charCodeAt(0) - 65;
  return /^\d+$/.test(value) && validIndex(Number(value)) ? Number(value) : null;
}

export const isUnanswered = answer => answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0);
export function mockAnswerCorrect(question, selected, key) {
  if (isUnanswered(selected) || key == null) return false;
  if (question.questionType === 'NAT') {
    if (!['number', 'string'].includes(typeof selected) || String(selected).trim() === '') return false;
    const number = Number(selected);
    if (!Number.isFinite(number)) return false;
    if (typeof key === 'object' && !Array.isArray(key)) return Number.isFinite(key.min) && Number.isFinite(key.max) && number >= key.min && number <= key.max;
    return Number.isFinite(Number(key)) && number === Number(key);
  }
  if (question.questionType === 'MSQ') {
    if (!Array.isArray(selected) || !Array.isArray(key) || !key.length) return false;
    const wanted = key.map(value => mockAnswerIndex(value, question.options));
    const actual = selected.map(value => mockAnswerIndex(value, question.options, true));
    return !wanted.includes(null) && !actual.includes(null) && new Set(actual).size === actual.length && actual.length === new Set(wanted).size && actual.every(value => wanted.includes(value));
  }
  return Array.isArray(question.options) && question.options.length
    ? mockAnswerIndex(key, question.options) !== null && mockAnswerIndex(selected, question.options, true) === mockAnswerIndex(key, question.options)
    : String(selected) === String(key);
}
