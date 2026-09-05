import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { normalizeSearchKey } from '../services/questions/questionNormalizer.js';
const topic = process.argv[2];
if (!topic) throw new Error('Usage: node scripts/profile-question-queries.js "Topic label"');
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const collection = client.db('quizDB').collection('questions');
  for (const [name, query] of Object.entries({ legacy: { topic }, normalized: { topicKey: normalizeSearchKey(topic) } })) {
    const plan = await collection.find(query).sort({ _id: 1 }).limit(51).maxTimeMS(10000).explain('executionStats');
    const { nReturned, totalDocsExamined, totalKeysExamined, executionTimeMillis } = plan.executionStats;
    console.log(JSON.stringify({ name, nReturned, totalDocsExamined, totalKeysExamined, executionTimeMillis }));
  }
} finally { await client.close(); }
