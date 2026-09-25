export const id = '012-normalized-question-query-indexes';

export async function up(db) {
  const questions = db.collection('questions');
  const desiredIndexes = [
    { key: { topicKey: 1, modeKey: 1, _id: 1 }, name: 'question_topic_mode_cursor' },
    { key: { subjectKey: 1, modeKey: 1, _id: 1 }, name: 'question_subject_mode_cursor' },
    { key: { subjectKey: 1, difficulty: 1, modeKey: 1 }, name: 'question_subject_difficulty_mode' },
    { key: { topicKey: 1, exam: 1, modeKey: 1 }, name: 'question_topic_exam_mode' },
  ];

  const existing = await questions.listIndexes().toArray();
  const existingNames = new Set(existing.map(index => index.name));

  for (const definition of desiredIndexes) {
    if (existingNames.has(definition.name)) continue;
    const duplicate = existing.find(index => index.key && Object.keys(index.key).length === Object.keys(definition.key).length && Object.entries(index.key).every(([field, value]) => definition.key[field] === value));
    if (duplicate) continue;
    try {
      await questions.createIndex(definition.key, { name: definition.name });
    } catch (error) {
      if (error?.code === 85 || /already exists/i.test(error.message || '')) continue;
      throw error;
    }
  }
}
