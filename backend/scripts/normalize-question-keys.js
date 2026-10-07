import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { backfillQuestionKeys } from '../services/questions/questionBackfill.js';
import { mutateQuestionBank } from '../repositories/questionBankMutation.js';
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'quizDB');
  const apply = process.argv.includes('--apply');
  const build = () => backfillQuestionKeys(db.collection('questions'), { apply });
  const stats = apply ? await mutateQuestionBank(db, build) : await build();
  console.log(JSON.stringify(stats));
  if (stats.conflicted || (process.argv.includes('--verify') && stats.candidates)) process.exitCode = 1;
} finally { await client.close(); }
