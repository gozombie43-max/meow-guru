import { advanceQuestionBankRevision } from '../repositories/questionBankMutation.js';
import {
  backfillMissingQuestionUids,
  ensureQuestionCanonicalIdentityIndex,
} from '../services/questions/questionUidBackfill.js';

export const id = '028-backfill-question-uids';

export async function up(db) {
  const questions = db.collection('questions');
  const report = await backfillMissingQuestionUids(questions, {
    apply: true,
    verifyIndex: false,
  });
  await ensureQuestionCanonicalIdentityIndex(questions);
  if (report.modified > 0) {
    await advanceQuestionBankRevision(db);
  }
}
