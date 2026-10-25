export const id = '025-question-import-jobs';

export async function up(db) {
  const jobs = db.collection('questionImportJobs');
  await jobs.createIndex({ createdBy: 1, updatedAt: -1 }, { name: 'question_import_owner_recent' });
  await jobs.createIndex({ phase: 1, 'lease.until': 1 }, { name: 'question_import_claim' });
  await jobs.createIndex({ expiresAt: 1 }, { name: 'question_import_expiry' });
  await db.collection('questionImportIssues').createIndex({ jobId: 1, fileId: 1, line: 1 }, { name: 'question_import_issue_lookup' });
}
