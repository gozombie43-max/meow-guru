import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { backfillCanonicalIdentity } from '../services/questions/identityBackfill.js';
import { mutateQuestionBank } from '../repositories/questionBankMutation.js';

const apply = process.argv.includes('--apply');
if (apply && !process.argv.includes('--maintenance-write-fence')) throw new Error('Stop application writers and pass --maintenance-write-fence before applying');
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'quizDB');
  const run = () => backfillCanonicalIdentity(db, { apply });
  const report = await (apply ? mutateQuestionBank(db, run) : run());
  console.log(JSON.stringify(report, null, 2));
  if (report.conflicts || report.accountCollisions.length) process.exitCode = 1;
} finally { await client.close(); }
