import { normalizedQuestionKeys } from './questionNormalizer.js';

export const normalizationSourceFields = ['topic', 'subject', 'quizSubject', 'quizName', 'quizId', 'source', 'questionType', 'word', 'meanings', 'letter'];

export function normalizationUpdate(row) {
  const keys = normalizedQuestionKeys(row);
  if (Object.entries(keys).every(([key, value]) => row[key] === value)) return null;
  const filter = { _id: row._id };
  for (const key of normalizationSourceFields) {
    filter[key] = Object.hasOwn(row, key) ? { $exists: true, $eq: row[key] } : { $exists: false };
  }
  return { updateOne: { filter, update: { $set: keys } } };
}

export async function backfillQuestionKeys(collection, { apply = false, batchSize = 250 } = {}) {
  const stats = { apply, scanned: 0, candidates: 0, matched: 0, modified: 0, conflicted: 0 };
  let batch = [];
  const flush = async () => {
    if (apply && batch.length) {
      const result = await collection.bulkWrite(batch, { ordered: false });
      stats.matched += result.matchedCount;
      stats.modified += result.modifiedCount;
      stats.conflicted += batch.length - result.matchedCount;
    }
    batch = [];
  };
  const projection = Object.fromEntries([...normalizationSourceFields, 'topicKey', 'subjectKey', 'quizKey', 'modeKey', 'keyVersion'].map(key => [key, 1]));
  for await (const row of collection.find({}, { projection }).batchSize(batchSize)) {
    stats.scanned++;
    const operation = normalizationUpdate(row);
    if (!operation) continue;
    stats.candidates++;
    batch.push(operation);
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  return stats;
}
