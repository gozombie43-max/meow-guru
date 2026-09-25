import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { fetchQuestions } from '../questions/questionReadService.js';
import { fetchQuestionsSession } from '../questions/questionSessionService.js';
import { normalizedQuestionKeys } from '../questions/questionNormalizer.js';
import { questionsQueryCache, questionCountsCache, revisionedQuestionCacheKey } from '../questions/questionCache.js';
import { up as createBrowserIndex } from '../../migrations/011-question-browser-sort.js';

let server, db;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', server.getUri());
  vi.stubEnv('MONGODB_DB', 'question_performance');
  db = await connectMongoDB();
  await createBrowserIndex(db);
  await createBrowserIndex(db);
}, 120000);
beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'false');
  questionsQueryCache.clear(); questionCountsCache.clear();
  await db.collection('questions').deleteMany({});
  await db.collection('questionMetadata').deleteMany({});
  const rows = Array.from({ length: 451 }, (_, index) => {
    const row = { id: `q${index}`, topic: 'algebra', subject: 'Mathematics', question: `Example ${index}`, exam: index < 250 ? 'SSC CGL' : 'SSC CHSL', quizName: 'PYQ' };
    return { ...row, ...normalizedQuestionKeys(row) };
  });
  await db.collection('questions').insertMany(rows);
});
afterAll(async () => { await disconnectMongoDB(); await server?.stop(); vi.unstubAllEnvs(); });

describe('bounded question reads', () => {
  it('uses the natural ID index for both admin sort directions', async () => {
    for (const direction of [1, -1]) {
      const plan = await db.collection('questions').find({}).collation({ locale: 'en', numericOrdering: true, strength: 2 }).sort({ id: direction, _id: direction }).limit(50).explain('executionStats');
      expect(plan.executionStats.totalDocsExamined).toBe(50);
      expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('question_browser_natural_id');
    }
  });
  it('keeps legacy pages small and searches/sorts across the full bank', async () => {
    expect((await fetchQuestions({})).questions).toHaveLength(50);
    expect((await fetchQuestions({ limit: 5000 })).questions).toHaveLength(200);
    const page = await fetchQuestions({ limit: 50, offset: 50, sort: 'asc', exam: 'SSC CGL' });
    expect(page.count).toBe(250);
    expect(page.questions[0].id).toBe('q50');
    expect(page.questions.at(-1).id).toBe('q99');
    const search = await fetchQuestions({ search: 'Example 450', includeFacets: 'true' });
    expect(search.questions.map(row => row.id)).toEqual(['q450']);
    expect(search.facets.exams.sort()).toEqual(['SSC CGL', 'SSC CHSL']);
    expect((await fetchQuestions({ search: '.*' })).questions).toEqual([]);
  });

  it.each(['false', 'true'])('returns every cursor row exactly once with normalized=%s', async normalized => {
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', normalized);
    const ids = [];
    let cursor;
    do {
      const page = await fetchQuestions({ pagination: 'cursor', topic: 'algebra', limit: 5000, cursor });
      expect(page.questions.length).toBeLessThanOrEqual(200);
      expect(page.total).toBeUndefined();
      ids.push(...page.questions.map(row => row.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(451);
    expect(new Set(ids).size).toBe(451);
  });

  it('only counts session pages when explicitly requested, excluding cursor from count', async () => {
    const first = await fetchQuestionsSession({ topic: 'algebra', limit: 5000 });
    expect(first.questions).toHaveLength(200);
    expect(first.totalCount).toBeUndefined();
    const second = await fetchQuestionsSession({ topic: 'algebra', cursor: first.nextCursor, includeTotal: 'true' });
    expect(second.totalCount).toBe(451);
    expect(second.questions).toHaveLength(50);
    await expect(fetchQuestionsSession({ cursor: 'invalid' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('uses normalized alias keys in sessions and legacy listings', async () => {
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
    const row = { id: 'alias', topic: 'Synonyms & Antonyms', question: 'Opposite?', subject: 'English' };
    await db.collection('questions').insertOne({ ...row, ...normalizedQuestionKeys(row) });
    expect((await fetchQuestionsSession({ topic: 'antosynopyq' })).questions.map(q => q.id)).toEqual(['alias']);
    expect((await fetchQuestions({ topic: 'synonyms-antonyms' })).questions.map(q => q.id)).toEqual(['alias']);
  });

  it('reuses bounded production cache and observes another writer revision immediately', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const params = { topic: 'algebra', limit: 1 };
    const first = await fetchQuestions(params);
    expect(questionsQueryCache.size).toBe(1);
    await db.collection('questions').updateOne({ id: first.questions[0].id }, { $set: { question: 'Updated by another worker' } });
    expect((await fetchQuestions(params)).questions[0].question).toBe(first.questions[0].question);
    await db.collection('questionMetadata').updateOne({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
    expect((await fetchQuestions(params)).questions[0].question).toBe('Updated by another worker');
    const oldKey = await revisionedQuestionCacheKey('race');
    await db.collection('questionMetadata').updateOne({ _id: 'revision' }, { $inc: { revision: 1 } });
    questionsQueryCache.set(oldKey, { stale: true });
    expect(questionsQueryCache.get(await revisionedQuestionCacheKey('race'))).toBeUndefined();
    questionsQueryCache.set('too-large', { text: 'x'.repeat(1024 * 1024 + 1) });
    expect(questionsQueryCache.has('too-large')).toBe(false);
  });
});
