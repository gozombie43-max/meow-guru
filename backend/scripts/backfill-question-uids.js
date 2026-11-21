import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB, getQuestionsCollection } from '../config/mongodb.js';
import { mutateQuestionBank } from '../repositories/questionBankMutation.js';
import {
  backfillMissingQuestionUids,
  ensureQuestionCanonicalIdentityIndex,
} from '../services/questions/questionUidBackfill.js';

const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');

try {
  const db = await connectMongoDB();
  const questions = getQuestionsCollection();

  const run = async () => {
    const report = await backfillMissingQuestionUids(questions, {
      apply,
      verifyIndex: !apply,
    });
    if (apply) {
      report.index = await ensureQuestionCanonicalIdentityIndex(questions);
    }
    return report;
  };

  const report = apply ? await mutateQuestionBank(db, run) : await run();
  console.log(JSON.stringify(report, null, 2));

  const failed =
    report.collisions.length > 0 ||
    report.skippedConcurrent > 0 ||
    (verify && (report.candidates > 0 || !report.index?.ok));
  if (failed) {
    process.exitCode = 1;
  }
} catch (error) {
  if (error?.report) {
    console.error(JSON.stringify(error.report, null, 2));
  }
  console.error(error?.message || error);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
