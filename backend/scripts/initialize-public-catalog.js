import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { initializePublicCatalogs } from '../services/questions/topicCountSnapshot.js';

try {
  await connectMongoDB();
  console.log(JSON.stringify({ catalogs: await initializePublicCatalogs({ fresh: true }) }, null, 2));
} catch (error) {
  console.error('Public catalog initialization failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
