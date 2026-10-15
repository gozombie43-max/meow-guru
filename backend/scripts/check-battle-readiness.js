import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { inspectBattleReadiness } from '../battle/battleReadiness.js';

try {
  const report = await inspectBattleReadiness(await connectMongoDB());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Battle readiness inspection failed: ${error.message}\n`);
  process.exitCode = 1;
} finally { await disconnectMongoDB(); }
