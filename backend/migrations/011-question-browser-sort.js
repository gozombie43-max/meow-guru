export const id = '011-question-browser-sort';

export async function up(db) {
  await db.collection('questions').createIndex(
    { id: 1, _id: 1 },
    { name: 'question_browser_natural_id', collation: { locale: 'en', numericOrdering: true, strength: 2 } },
  );
}
