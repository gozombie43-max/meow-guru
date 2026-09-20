export const id = "006-training-hardening";

export async function up(db) {
  await db.collection("trainingReviewState").createIndex(
    { userId: 1, exam: 1, dueAt: 1 },
    { name: "training_review_due" },
  );
  await db.collection("trainingReviewState").createIndex(
    { userId: 1, exam: 1, questionId: 1 },
    { unique: true, name: "training_review_unique" },
  );
  await db.collection("trainingQuestionExposure").createIndex(
    { userId: 1, exam: 1, lastSeenAt: -1 },
    { name: "training_exposure_recent" },
  );
  await db.collection("trainingQuestionExposure").createIndex(
    { userId: 1, exam: 1, questionId: 1 },
    { unique: true, name: "training_exposure_unique" },
  );
  await db.collection("trainingSkillState").createIndex(
    { userId: 1, exam: 1, level: 1, mastery: 1 },
    { name: "training_skill_mastery" },
  );
  await db.collection("trainingSkillState").createIndex(
    { userId: 1, exam: 1, key: 1 },
    { unique: true, name: "training_skill_unique" },
  );
  await db.collection("questions").createIndex(
    { exam: 1, subject: 1, difficulty: -1, discrimination: -1, updatedAt: -1 },
    { name: "training_quality_candidates" },
  );
  await db.collection("questions").createIndex(
    { exam: 1, topic: 1, difficulty: -1, updatedAt: -1 },
    { name: "training_topic_candidates" },
  );
}
