import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { backfillQuestionKeys } from '../services/questions/questionBackfill.js';
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const stats = await backfillQuestionKeys(client.db(process.env.MONGODB_DB || 'quizDB').collection('questions'), { apply: process.argv.includes('--apply') });
  console.log(JSON.stringify(stats));
  if (stats.conflicted || (process.argv.includes('--verify') && stats.candidates)) process.exitCode = 1;
} finally { await client.close(); }
