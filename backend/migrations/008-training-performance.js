export const id = '008-training-performance';
export async function up(db) {
  const questions = db.collection('questions');
  for (const [name, sort] of [
    ['latest', { updatedAt: -1, _id: 1 }],
    ['oldest', { updatedAt: 1, _id: 1 }],
    ['quality', { 'trainingCandidate.difficulty': -1, 'trainingCandidate.discrimination': -1, updatedAt: -1 }],
  ]) {
    await questions.createIndex({ trainingExamSlugs: 1, trainingEligible: 1, trainingSubjectSlug: 1, ...sort }, { name: `training_indexed_${name}` });
  }
  await questions.createIndex({ trainingExamSlugs: 1, trainingEligible: 1, trainingSubjectSlug: 1, trainingTopicSlug: 1, 'trainingCandidate.discrimination': -1, updatedAt: -1 }, { name: 'training_indexed_topic' });
  await db.collection('mockAttempts').createIndex({ userId: 1, examSlug: 1, status: 1, submittedAt: -1 }, { name: 'training_mock_history' });
}
