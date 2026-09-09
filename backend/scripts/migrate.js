import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { migrate } from '../migrations/runner.js';
try {
  await migrate(await connectMongoDB());
  console.log('Database migrations complete');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await disconnectMongoDB(); }
