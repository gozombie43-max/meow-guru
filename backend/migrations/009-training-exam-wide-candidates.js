export const id = '009-training-exam-wide-candidates';

export async function up(db) {
  const questions = db.collection('questions');
  for (const [name, sort] of [
    ['latest', { updatedAt: -1, _id: 1 }],
    ['oldest', { updatedAt: 1, _id: 1 }],
    ['quality', { 'trainingCandidate.difficulty': -1, 'trainingCandidate.discrimination': -1, updatedAt: -1 }],
  ]) {
    await questions.createIndex(
      { trainingExamSlugs: 1, trainingEligible: 1, ...sort },
      { name: `training_exam_wide_${name}` },
    );
  }
}
