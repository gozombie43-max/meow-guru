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
