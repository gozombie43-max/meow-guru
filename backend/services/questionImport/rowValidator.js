import { createHash } from 'node:crypto';
import { assertQuestionExamMode } from '../questions/questionExamMode.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const textOf = value => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (isObject(value)) return String(value.en ?? value.text ?? value.bn ?? value.hi ?? value.value ?? '').trim();
  return '';
};

export function isStudyModeRecord(q) {
  return isObject(q) && (q.questionType === 'study-mode' || (typeof q.word === 'string' && q.word.trim() && Array.isArray(q.meanings)));
}

export function questionText(q) {
  if (isStudyModeRecord(q)) return String(q.word || '').trim();
  return textOf(q.question ?? q.questionText ?? q.q);
}

export function optionTexts(q) {
  const raw = q.options ?? q.choices ?? q.answers;
  if (Array.isArray(raw)) return raw.map(textOf);
  if (isObject(raw) && Array.isArray(raw.en)) return raw.en.map(textOf);
  if (isObject(raw) && Array.isArray(raw.bn)) return raw.bn.map(textOf);
  if (isObject(raw)) return Object.values(raw).map(textOf);
  return ['A', 'B', 'C', 'D', 'E', 'F'].map(letter => textOf(q[`option${letter}`] ?? q[`option${letter}Text`])).filter(Boolean);
}

function answerResolves(q, options) {
  if (q.correctIndex !== undefined && q.correctIndex !== null && q.correctIndex !== '') {
    const idx = Number(q.correctIndex);
    return Number.isInteger(idx) && idx >= 0 && idx < options.length;
  }
  const answer = q.answer ?? q.correctAnswer ?? q.correct;
  const text = textOf(answer);
  if (!text) return false;
  if (options.some(option => option.toLowerCase() === text.toLowerCase())) return true;
  if (/^[A-Ha-h]$/.test(text)) return text.toUpperCase().charCodeAt(0) - 65 < options.length;
  if (/^\d+$/.test(text)) return Number(text) >= 0 && Number(text) <= options.length;
  const normalized = text.toLowerCase().replace(/^option\s*/, '');
  if (/^[a-h]$/.test(normalized)) return normalized.charCodeAt(0) - 97 < options.length;
  return false;
}

/** Shape validation for one raw record. Returns `{ severity, code, message }[]`. */
export function validateRecord(q) {
  if (!isObject(q)) return [{ severity: 'error', code: 'NOT_OBJECT', message: 'Row must be a JSON object' }];
  const issues = [];
  const error = (code, message) => issues.push({ severity: 'error', code, message });
  const warn = (code, message) => issues.push({ severity: 'warning', code, message });
  if (isStudyModeRecord(q)) {
    if (!String(q.word || '').trim()) error('MISSING_WORD', 'Study-mode row is missing "word"');
    return issues;
  }
  if (!questionText(q) && !q.image && !q.questionImage) error('MISSING_QUESTION', 'Missing question text');
  const options = optionTexts(q);
  if (!options.length) error('MISSING_OPTIONS', 'Missing options');
  else if (options.length < 2) error('TOO_FEW_OPTIONS', 'At least 2 options are required');
  else if (options.some(option => !option) && !q.optionImages) warn('EMPTY_OPTION', 'One or more options are empty');
  const answer = q.correctIndex ?? q.answer ?? q.correctAnswer ?? q.correct;
  if (answer === undefined || answer === null || answer === '') error('MISSING_ANSWER', 'Missing answer');
  else if (options.length >= 2 && !answerResolves(q, options)) warn('ANSWER_NOT_IN_OPTIONS', 'Answer does not match any option index, letter, or text');
  return issues;
}

/** Stable content fingerprint used for in-file and cross-file duplicate detection. */
export function recordFingerprint(q) {
  const normalize = value => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const scope = `${normalize(String(q.subject ?? q.quizSubject ?? ''))}|${normalize(String(q.topic ?? q.chapter ?? q.quizTopic ?? ''))}`;
  const body = isStudyModeRecord(q) ? `s:${scope}|w:${normalize(String(q.word))}` : `s:${scope}|${normalize(questionText(q))}|${optionTexts(q).map(normalize).join('|')}`;
  return createHash('sha256').update(body).digest('hex');
}

export function mappingErrors(mapping = {}) {
  const errors = [];
  if (!String(mapping.subject || '').trim()) errors.push('Subject is not selected');
  if (!String(mapping.topic || '').trim()) errors.push('Topic is not selected');
  if (!String(mapping.quizName || '').trim()) errors.push('Quiz is not selected');
  return errors;
}

const INTERNAL_FIELDS = ['_id', '_idx', '_status', '_issue', '_existingText', '_incomingText', 'ingestionKey', 'ingestionHash'];

/** Applies a file's target mapping to a record exactly as the import will write it. */
export function applyMapping(record, mapping, examMode) {
  const clean = { ...record };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  const chapterTitle = String(mapping.chapterTitle || '').trim();
  const topic = chapterTitle || mapping.topic;
  return {
    ...clean,
    subject: mapping.subject,
    topic,
    quizSubject: mapping.subject,
    quizTopic: topic,
    quizName: mapping.quizName,
    ...(examMode === 'iit-jam' ? { exam: 'IIT JAM Physics' } : {}),
    ...(chapterTitle ? { chapter: chapterTitle, chapterSlug: mapping.chapterSlug || undefined, topicGroup: mapping.topic } : {}),
    ...(!chapterTitle && mapping.subject === 'general-awareness' ? { topicGroup: mapping.topic } : {}),
  };
}

/** Row-level checks that depend on the mapping (exam bank, study-mode targets). */
export function validateMappedRecord(mapped, record, mapping, examMode) {
  const issues = [];
  try { assertQuestionExamMode(mapped, examMode); }
  catch (error) { issues.push({ severity: 'error', code: 'EXAM_MODE', message: error.message }); }
  const studyTarget = /study\s*mode/i.test(String(mapping.quizName || ''));
  const studyRow = isStudyModeRecord(record);
  if (studyRow && !studyTarget) issues.push({ severity: 'error', code: 'STUDY_MODE_TARGET', message: 'Study-mode rows can only be imported into a Study Mode quiz' });
  if (!studyRow && studyTarget) issues.push({ severity: 'error', code: 'STUDY_MODE_TARGET', message: 'Study Mode quizzes only accept study-mode rows' });
  return issues;
}
