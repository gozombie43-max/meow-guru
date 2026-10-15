import { isDeepStrictEqual } from 'node:util';
import { battleQuestionMetadata } from './battleQuestionMetadata.js';

const fields = ['questionType', 'numericTolerance', 'tolerance', 'partialCredit', 'optionImages', 'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage', 'questionUid', 'id', 'question', 'options', 'correctAnswer', 'rankedEligible', 'difficulty', 'concept', 'topic', 'chapter', 'language', 'questionImage', 'exam', 'source', 'year', 'examYear', 'validationStatus'];
export async function backfillBattleMetadata(collection, { apply = false, batchSize = 250 } = {}) {
  const stats = { scanned: 0, candidates: 0, modified: 0, conflicts: 0, rankedEligible: 0 };
  let writes = [];
  const flush = async () => {
    if (apply && writes.length) {
      const result = await collection.bulkWrite(writes, { ordered: false });
      stats.modified += result.modifiedCount;
      stats.conflicts += writes.length - result.matchedCount;
    }
    writes = [];
  };
  for await (const row of collection.find({}).batchSize(batchSize)) {
    stats.scanned++;
    const metadata = battleQuestionMetadata(row);
    if (metadata.rankedEligible) stats.rankedEligible++;
    if (Object.entries(metadata).every(([key, value]) => isDeepStrictEqual(row[key], value))) continue;
    stats.candidates++;
    const filter = { _id: row._id };
    for (const key of fields) filter[key] = Object.hasOwn(row, key) ? { $exists: true, $eq: row[key] } : { $exists: false };
    writes.push({ updateOne: { filter, update: { $set: metadata } } });
    if (writes.length >= batchSize) await flush();
  }
  await flush();
  return stats;
}
