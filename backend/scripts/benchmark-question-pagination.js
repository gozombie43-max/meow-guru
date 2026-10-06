import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId, Collection } from 'mongodb';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Always disposable local Mongo. No dotenv, supplied URI or remote target.
const sizes = (process.env.PAGINATION_BENCH_SIZES || '10000,50000,100000').split(',').map(Number);
const repetitions = Number(process.env.PAGINATION_BENCH_REPEATS || 5);
if (sizes.some(size => ![10000, 50000, 100000].includes(size)) || !Number.isInteger(repetitions) || repetitions < 3 || repetitions > 20) throw new Error('Invalid benchmark sizes/repetitions');
process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
delete process.env.REDIS_URL;
const pageSize = 50;
const collation = { locale: 'en', numericOrdering: true, strength: 2 };
const oid = index => new ObjectId((index + 1).toString(16).padStart(24, '0'));
const report = { environment: 'disposable local Mongo', repetitions, pageSize, notes: ['Offset comparison deliberately bypasses the retired-offset API guard.', 'End-to-end cursor timings include last-page count work; pageQueryStats describe page find queries only.', 'Indexes are existing repository migrations; fixture timings are not Atlas capacity.'], datasets: [] };
let mongo, disconnect;
const originalFind = Collection.prototype.find;
let pageCursors = [];
try {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `pagination_bench_${Date.now()}`;
  const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
  disconnect = disconnectMongoDB;
  const db = await connectMongoDB();
  const questions = db.collection('questions');
  for (const migration of ['011-question-browser-sort', '012-normalized-question-query-indexes']) await (await import(`../migrations/${migration}.js`)).up(db);
  const { fetchQuestionCursorPage } = await import('../services/questions/questionCursorService.js');
  const { invalidateQuestionCacheRevision } = await import('../services/questions/questionCache.js');
  Collection.prototype.find = function (...args) {
    const cursor = originalFind.apply(this, args);
    if (this.collectionName !== 'questions') return cursor;
    const read = cursor.toArray.bind(cursor);
    cursor.toArray = async () => { pageCursors.push(cursor.clone()); return read(); };
    return cursor;
  };
  const measure = async work => {
    const elapsed = [], stats = [];
    let result;
    for (let run = 0; run < repetitions; run++) {
      invalidateQuestionCacheRevision();
      pageCursors = [];
      const started = performance.now();
      result = await work();
      elapsed.push(performance.now() - started);
      for (const cursor of pageCursors) {
        // Driver explain forbids simultaneous server/client timeout options;
        // retain the server budget and clear only the clone's client timeout.
        const { executionStats } = await cursor.explain('executionStats', { timeoutMS: undefined });
        stats.push({ docsExamined: executionStats.totalDocsExamined, keysExamined: executionStats.totalKeysExamined, executionMs: executionStats.executionTimeMillis });
        await cursor.close();
      }
    }
    elapsed.sort((a, b) => a - b);
    const percentile = p => Math.round(elapsed[Math.ceil(elapsed.length * p) - 1] * 100) / 100;
    return { result, metrics: { p50Ms: percentile(.5), p95Ms: percentile(.95), pageQueryStats: stats } };
  };
  for (const size of sizes) {
    await questions.deleteMany({});
    for (let start = 0; start < size; start += 5000) await questions.insertMany(Array.from({ length: Math.min(5000, size - start) }, (_, offset) => {
      const index = start + offset;
      return { _id: oid(index), id: `bench_q${index}`, topic: index % 5 === 0 ? 'algebra' : 'geometry', topicKey: index % 5 === 0 ? 'algebra' : 'geometry', subjectKey: 'mathematics', modeKey: 'quiz', question: `Question ${index} ${'content '.repeat(15)}`, options: ['a', 'b', 'c', 'd'], correctAnswer: index % 4 };
    }));
    const dataset = { size, cases: [] };
    for (const variant of ['global', 'filtered', 'sorted', 'filtered-sorted']) {
      const filtered = variant.includes('filtered'), sorted = variant.includes('sorted');
      const total = filtered ? Math.ceil(size / 5) : size;
      const params = { questionType: 'all', limit: pageSize, includeTotal: 'false', ...(filtered ? { topic: 'algebra' } : {}), ...(sorted ? { sort: 'asc' } : {}) };
      const filter = filtered ? { topicKey: 'algebra' } : {};
      const sort = sorted ? { id: 1, _id: 1 } : { _id: 1 };
      const offsets = [...new Set([0, Math.min(99 * pageSize, Math.floor((total - 1) / pageSize) * pageSize), Math.min(999 * pageSize, Math.floor((total - 1) / pageSize) * pageSize), Math.floor((total - 1) / pageSize) * pageSize])];
      for (const offset of offsets) {
        let cursor;
        if (offset) {
          // Establish a known boundary directly from deterministic seed rows;
          // traversing previous pages is excluded from per-page seek timings.
          const index = (offset - 1) * (filtered ? 5 : 1);
          if (sorted) {
            const boundary = { v: 1, f: '', _id: oid(index).toHexString(), id: `bench_q${index}` };
            // Get the service's filter fingerprint from a first-page token.
            const first = await fetchQuestionCursorPage({ ...params, limit: 1 });
            boundary.f = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString()).f;
            cursor = Buffer.from(JSON.stringify(boundary)).toString('base64url');
          } else cursor = oid(index).toHexString();
        }
        const seek = await measure(() => fetchQuestionCursorPage({ ...params, ...(cursor ? { cursor } : {}) }));
        const legacy = await measure(async () => {
          let query = questions.find(filter).sort(sort).skip(offset).limit(pageSize);
          if (sorted) query = query.collation(collation);
          return query.toArray();
        });
        assert.deepEqual(seek.result.questions.map(row => row.id), legacy.result.map(row => row.id));
        dataset.cases.push({ variant, page: offset / pageSize + 1, offset, cursor: seek.metrics, offsetQuery: legacy.metrics });
      }
      if (sorted) {
        const last = await measure(() => fetchQuestionCursorPage({ ...params, last: 'true' }));
        const expectedOffset = Math.floor((total - 1) / pageSize) * pageSize;
        let expected = questions.find(filter).sort(sort).collation(collation).skip(expectedOffset).limit(pageSize);
        assert.deepEqual(last.result.questions.map(row => row.id), (await expected.toArray()).map(row => row.id));
        const previous = await measure(() => fetchQuestionCursorPage({ ...params, cursor: last.result.prevCursor, before: 'true' }));
        expected = questions.find(filter).sort(sort).collation(collation).skip(Math.max(0, expectedOffset - pageSize)).limit(pageSize);
        assert.deepEqual(previous.result.questions.map(row => row.id), (await expected.toArray()).map(row => row.id));
        dataset.cases.push({ variant, navigation: 'last', cursor: last.metrics }, { variant, navigation: 'previous-from-last', cursor: previous.metrics });
      }
    }
    report.datasets.push(dataset);
    console.log(JSON.stringify({ size, cases: dataset.cases.map(item => ({ variant: item.variant, page: item.page, navigation: item.navigation, cursorP95Ms: item.cursor.p95Ms, offsetP95Ms: item.offsetQuery?.p95Ms, cursorMaxDocs: Math.max(...item.cursor.pageQueryStats.map(stat => stat.docsExamined)), offsetMaxDocs: item.offsetQuery && Math.max(...item.offsetQuery.pageQueryStats.map(stat => stat.docsExamined)) })) }));
  }
  if (process.env.PAGINATION_BENCH_REPORT) await writeFile(process.env.PAGINATION_BENCH_REPORT, JSON.stringify(report, null, 2) + '\n');
} finally {
  Collection.prototype.find = originalFind;
  await disconnect?.();
  await mongo?.stop();
}
