import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { normalizedQuestionKeys } from '../services/questions/questionNormalizer.js';

// Dry run by default. Apply explicitly after reviewing the counts.
const apply = process.argv.includes('--apply');
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const collection = client.db('quizDB').collection('questions');
  let scanned = 0, changed = 0, batch = [];
  for await (const row of collection.find({}, { projection: { topic: 1, subject: 1, quizSubject: 1, quizName: 1, quizId: 1, source: 1, topicKey: 1, subjectKey: 1, quizKey: 1, keyVersion: 1 } }).batchSize(250)) {
    scanned++;
    const keys = normalizedQuestionKeys(row);
    if (Object.entries(keys).every(([key, value]) => row[key] === value)) continue;
    changed++;
    // Guard against overwriting keys after a concurrent content edit.
    const filter = { _id: row._id };
    for (const key of ['topic', 'subject', 'quizSubject', 'quizName', 'quizId', 'source']) filter[key] = row[key] ?? { $exists: false };
    batch.push({ updateOne: { filter, update: { $set: keys } } });
    if (batch.length === 250) {
      if (apply) await collection.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }
  if (apply && batch.length) await collection.bulkWrite(batch, { ordered: false });
  console.log(JSON.stringify({ apply, scanned, changed }));
} finally { await client.close(); }
