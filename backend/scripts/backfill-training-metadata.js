import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../config/mongodb.js';
import { backfillTrainingMetadata } from '../services/training/questionMetadataBackfill.js';

try {
  await connectMongoDB();
  const apply = process.argv.includes('--apply');
  const stats = await backfillTrainingMetadata(getQuestionsCollection(), { apply });
  console.log(JSON.stringify({ apply, ...stats }));
  if (stats.conflicts) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
