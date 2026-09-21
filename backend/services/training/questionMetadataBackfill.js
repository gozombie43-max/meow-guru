import { isDeepStrictEqual } from 'node:util';
import { trainingQuestionMetadata } from './domain/questionMetadata.js';

const sourceFields = ['id', 'exam', 'examName', 'exams', 'subject', 'topic', 'questionTopic', 'subtopic', 'chapter', 'concepts', 'options', 'correctAnswer', 'question', 'questionText', 'solution', 'explanation', 'questionImage', 'image', 'difficulty', 'expectedTime', 'sourceType', 'validationStatus', 'year', 'shift', 'discrimination'];

export async function backfillTrainingMetadata(collection, { apply = false, batchSize = 250 } = {}) {
  const stats = { scanned: 0, candidates: 0, modified: 0, conflicts: 0 };
  let batch = [];
  const flush = async () => {
    if (apply && batch.length) {
      const result = await collection.bulkWrite(batch, { ordered: false });
      stats.modified += result.modifiedCount;
      stats.conflicts += batch.length - result.matchedCount;
    }
    batch = [];
  };
  for await (const row of collection.find({}).batchSize(batchSize)) {
    stats.scanned++;
    const metadata = trainingQuestionMetadata(row);
    if (Object.entries(metadata).every(([key, value]) => isDeepStrictEqual(row[key], value))) continue;
    stats.candidates++;
    // A concurrent edit must win. Retry conflicted rows on the next run.
    const filter = { _id: row._id };
    for (const key of sourceFields) filter[key] = Object.hasOwn(row, key) ? { $exists: true, $eq: row[key] } : { $exists: false };
    batch.push({ updateOne: { filter, update: { $set: metadata } } });
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  return stats;
}
