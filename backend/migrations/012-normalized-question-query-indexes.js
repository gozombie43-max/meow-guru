export const id = '012-normalized-question-query-indexes';

export async function up(db) {
  const questions = db.collection('questions');
  await questions.createIndex(
    { topicKey: 1, modeKey: 1, _id: 1 },
    { name: 'question_topic_mode_cursor' },
  );
  await questions.createIndex(
    { subjectKey: 1, modeKey: 1, _id: 1 },
    { name: 'question_subject_mode_cursor' },
  );
  await questions.createIndex(
    { subjectKey: 1, difficulty: 1, modeKey: 1 },
    { name: 'question_subject_difficulty_mode' },
  );
  await questions.createIndex(
    { topicKey: 1, exam: 1, modeKey: 1 },
    { name: 'question_topic_exam_mode' },
  );
}
