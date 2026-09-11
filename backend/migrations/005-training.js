export const id = "005-training";
export async function up(db) {
  await db
    .collection("trainingQuestionVariants")
    .createIndex({ id: 1 }, { unique: true });
  await db
    .collection("trainingQuestionVariants")
    .createIndex({ validationStatus: 1, createdAt: -1 });
  await db
    .collection("trainingSessions")
    .createIndex({ id: 1 }, { unique: true });
  await db.collection("trainingSessions").createIndex(
    { userId: 1, exam: 1, missionDate: 1 },
    {
      unique: true,
      partialFilterExpression: { missionDate: { $exists: true } },
    },
  );
  await db
    .collection("trainingSessions")
    .createIndex({ userId: 1, exam: 1, status: 1, completedAt: -1 });
  await db
    .collection("trainingSessions")
    .createIndex({ userId: 1, exam: 1, status: 1, startedAt: -1 });
  // Historical sessions are durable learning evidence, so there is intentionally no TTL.
  for (const field of ["exam", "examName", "exams"]) {
    await db
      .collection("questions")
      .createIndex({ [field]: 1, subject: 1, topic: 1, updatedAt: -1 });
  }
}
