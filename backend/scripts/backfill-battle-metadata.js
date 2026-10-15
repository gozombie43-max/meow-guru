import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../config/mongodb.js';
import { mutateQuestionBank } from '../repositories/questionBankMutation.js';
import { backfillBattleMetadata } from '../services/questions/battleMetadataBackfill.js';

try {
  const db = await connectMongoDB(), apply = process.argv.includes('--apply');
  const run = () => backfillBattleMetadata(getQuestionsCollection(), { apply });
  const stats = apply ? await mutateQuestionBank(db, run) : await run();
  console.log(JSON.stringify({ apply, ...stats }));
  if (stats.conflicts) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await disconnectMongoDB(); }
