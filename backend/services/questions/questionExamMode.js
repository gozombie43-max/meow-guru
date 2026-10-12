import { JAM_SECTIONS, jamQuestionTopic } from '@meow/contracts/jam';

const routingFields = ['subject', 'quizSubject', 'topic', 'quizTopic', 'exam', 'subjectId', 'topicId'];
const jamPattern = /^iit[-_\s]*jam(?:[-_\s]|$)/i;
const jamTopics = new Set(JAM_SECTIONS.map(section => jamQuestionTopic(section.slug)));
const sscSubjects = new Set(['mathematics', 'math', 'quant', 'reasoning', 'logicalreasoning', 'english', 'generalawareness']);

export function parseQuestionExamMode(value) {
  if (value === undefined) return undefined;
  if (value !== 'ssc' && value !== 'iit-jam') {
    throw Object.assign(new Error('Invalid exam mode'), { statusCode: 400 });
  }
  return value;
}

// Include legacy routing labels as well as canonical uploads in the same bank.
export function questionExamModeCondition(value) {
  const mode = parseQuestionExamMode(value);
  if (!mode) return {};
  const jam = { $or: routingFields.map(field => ({ [field]: jamPattern })) };
  return mode === 'iit-jam' ? jam : { $nor: [jam] };
}

export function assertQuestionExamMode(question, value) {
  const mode = parseQuestionExamMode(value);
  if (!mode) return;
  if (!question || typeof question !== 'object' || Array.isArray(question)) throw Object.assign(new Error('Question must be an object'), { statusCode: 400 });
  assertQuestionSourceMode(question, mode);
  const isJam = routingFields.some(field => jamPattern.test(String(question[field] || '').trim()));
  if ((mode === 'iit-jam') !== isJam) {
    throw Object.assign(new Error('Question belongs to a different exam mode'), { statusCode: 400 });
  }
  if (mode === 'iit-jam' && (
    question.subject !== 'iit-jam-physics' || !jamTopics.has(question.topic) ||
    (question.quizSubject && question.quizSubject !== 'iit-jam-physics') ||
    (question.quizTopic && !jamTopics.has(question.quizTopic))
  )) {
    throw Object.assign(new Error('Select an IIT JAM Physics subject and section for this question'), { statusCode: 400 });
  }
}

export function assertQuestionSourceMode(question, value) {
  const mode = parseQuestionExamMode(value);
  if (!mode) return;
  if (!question || typeof question !== 'object' || Array.isArray(question)) throw Object.assign(new Error('Question must be an object'), { statusCode: 400 });
  const hasJam = routingFields.some(field => jamPattern.test(String(question[field] || '').trim()));
  const hasSsc = ['subject', 'quizSubject', 'subjectId'].some(field => sscSubjects.has(String(question[field] || '').toLowerCase().replace(/[-_\s]/g, ''))) || /^(ssc|rrb|ibps|sbi)[-_\s]/i.test(String(question.exam || ''));
  if (mode === 'ssc' ? hasJam : hasSsc) throw Object.assign(new Error('Question belongs to a different exam mode'), { statusCode: 400 });
}

export const scopedQuestionFilter = (filter, examMode) => examMode === undefined
  ? filter : { $and: [filter, questionExamModeCondition(examMode)] };
