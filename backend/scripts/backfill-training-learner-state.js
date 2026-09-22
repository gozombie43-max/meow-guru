import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import {
  completedLearnerPairs,
  inspectLearnerStatePair,
  rebuildLearnerStateForPair,
} from '../services/training/application/rebuildLearnerState.js';

const apply = process.argv.includes('--apply');

try {
  const db = await connectMongoDB();
  const pairs = await completedLearnerPairs(db);
  console.log(`${apply ? 'Rebuilding' : 'Inspecting'} learner state for ${pairs.length} user/exam pair(s).`);
  for (const { userId, exam } of pairs) {
    if (apply) {
      const result = await rebuildLearnerStateForPair(db, userId, exam);
      console.log(`rebuilt ${userId} / ${exam}: ${result.sourceSessionCount} sessions, ${result.sourceAttemptCount} attempts${result.retries ? ` (retry ${result.retries})` : ''}`);
    } else {
      const result = await inspectLearnerStatePair(db, userId, exam);
      console.log(`${userId} / ${exam}: ${result.sourceSessionCount} sessions, ${result.sourceAttemptCount} attempts, meta=${result.meta?.status || 'absent'}`);
    }
  }
  if (!apply) console.log('Dry run only. Re-run with --apply to write durable learner state.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
