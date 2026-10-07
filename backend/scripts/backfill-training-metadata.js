import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../config/mongodb.js';
import { backfillTrainingMetadata } from '../services/training/questionMetadataBackfill.js';
import { mutateQuestionBank } from '../repositories/questionBankMutation.js';

try {
  const db = await connectMongoDB();
  const apply = process.argv.includes('--apply');
  const build = () => backfillTrainingMetadata(getQuestionsCollection(), { apply });
  const stats = apply ? await mutateQuestionBank(db, build) : await build();
  console.log(JSON.stringify({ apply, ...stats }));
  if (stats.conflicts) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
