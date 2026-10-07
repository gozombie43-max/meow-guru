import { z } from 'zod';
import { normalizeSearchKey } from './questionNormalizer.js';

const text = z.string().max(200).optional();
const cursor = z.string().max(2048).optional();
const objectId = z.union([z.literal(''), z.string().regex(/^[a-fA-F0-9]{24}$/)]).optional();
const flag = z.union([z.boolean(), z.string().max(5)]).optional().transform(value => value === true || value === 'true');
const number = z.union([z.number(), z.string().max(20)]).optional();
const filters = { topic: text, subject: text, chapter: text, concept: text, difficulty: text, quizName: text, questionType: text, exam: text };
const schemas = {
  legacy: z.object({ ...filters, offset: number, limit: number, search: text, sort: text, includeTotal: flag, includeFacets: flag }),
  cursor: z.object({ ...filters, cursor, limit: number, search: text, sort: text, before: flag, last: flag, includeTotal: flag, includeFacets: flag }),
  session: z.object({ topic: text, subject: text, mode: text, letter: text, exam: text, concept: text, cursor: objectId, anchor: objectId, resumeIndex: number, windowOffset: number, limit: number, includeTotal: flag }),
  counts: z.object({ topic: text, subject: text }),
  metadata: z.object({ topic: text, subject: text, mode: text }),
};

export function canonicalQuestionQuery(family, input, normalized = process.env.QUESTIONS_NORMALIZED_KEYS === 'true') {
  const parsed = schemas[family].safeParse(input);
  if (!parsed.success) throw Object.assign(new Error('Invalid question query'), { statusCode: 400 });
  const query = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined && value !== '' && value !== false));
  if (Object.hasOwn(schemas, family) && ['legacy', 'cursor', 'session'].includes(family)) {
    const limit = Number(query.limit);
    query.limit = Number.isFinite(limit) ? Math.min(200, Math.max(1, Math.floor(limit) || 50)) : 50;
  }
  if (family === 'legacy') query.offset = Math.max(0, Math.floor(Number(query.offset)) || 0);
  if (query.sort && !['asc', 'desc'].includes(query.sort)) delete query.sort;
  if (query.includeFacets) query.includeFacets = 'true';
  if (query.subject) query.subject = normalized ? normalizeSearchKey(query.subject) : query.subject.trim().toLowerCase();
  if (query.topic && normalized) {
    query.topic = normalizeSearchKey(query.topic);
    if (query.topic === 'antosynopyq') query.topic = 'synonymsantonyms';
  }
  if (['legacy', 'cursor', 'counts', 'session'].includes(family) && query.topic && !query.includeFacets) delete query.subject;
  if (query.quizName) query.quizName = query.quizName.trim().toLowerCase();
  if (query.difficulty) query.difficulty = query.difficulty.trim().toLowerCase();
  if (query.questionType) {
    query.questionType = query.questionType.trim().toLowerCase();
    if (query.questionType === 'studymode') query.questionType = 'study-mode';
  }
  if (query.mode) {
    if (query.mode === 'ai-challenge') query.mode = 'aiChallenge';
    if (!['concept', 'formula', 'mixed', 'aiChallenge', 'easy', 'hard', 'studyMode'].includes(query.mode)) throw Object.assign(new Error('Invalid question mode'), { statusCode: 400 });
  }
  if (family === 'session') {
    for (const field of ['letter', 'exam', 'concept']) {
      if (!query[field]) continue;
      if (field !== 'letter' && query[field] === 'all') { delete query[field]; continue; }
      query[field] = [...new Set(query[field].split(',').map(value => field === 'letter' ? value.trim().toUpperCase() : value.trim()).filter(Boolean))].sort().join(',');
    }
    if (query.windowOffset !== undefined) { query.windowOffset = Number(query.windowOffset); delete query.resumeIndex; }
    else if (query.resumeIndex !== undefined) query.resumeIndex = Number(query.resumeIndex);
    if (query.cursor) {
      query.cursor = query.cursor.toLowerCase();
      delete query.anchor; delete query.resumeIndex; delete query.windowOffset;
    } else {
      const offset = query.windowOffset ?? query.resumeIndex;
      if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)) throw Object.assign(new Error('Invalid resume window'), { statusCode: 400 });
      if (query.anchor) query.anchor = query.anchor.toLowerCase();
    }
  }
  return Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
}

export const questionQueryIdentity = (family, input) => JSON.stringify(canonicalQuestionQuery(family, input));
