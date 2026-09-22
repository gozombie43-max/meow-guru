export const id = '010-training-learner-state-meta';

export async function up(db) {
  await db.collection('trainingLearnerStateMeta').createIndex(
    { userId: 1, exam: 1 },
    { unique: true, name: 'training_learner_state_meta_unique' },
  );
  await db.collection('trainingLearnerStateMeta').createIndex(
    { status: 1, updatedAt: 1 },
    { name: 'training_learner_state_meta_status' },
  );
}
