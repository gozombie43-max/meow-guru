import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
try {
  if (!process.env.RELEASE_ID) throw new Error('RELEASE_ID is required');
  const db = await connectMongoDB();
  const active = await db.collection('runtimeHealth').find({ releaseId: process.env.RELEASE_ID, expiresAt: { $gt: new Date() } }).toArray();
  for (const role of ['maintenance', 'attachments']) {
    if (!active.some(worker => worker.role === role)) throw new Error(`No healthy ${role} worker for this release; deploy workers before the API`);
  }
  console.log('Both worker roles are healthy for this release');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await disconnectMongoDB(); }
