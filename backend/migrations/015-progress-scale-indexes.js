export const id = '015-progress-scale-indexes';

function sameKey(left = {}, right = {}) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([field, direction], index) => {
      const [otherField, otherDirection] = rightEntries[index] || [];
      return field === otherField && direction === otherDirection;
    });
}

async function ensureIndex(collection, key, options) {
  let existing;
  try {
    existing = await collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') throw error;
    existing = [];
  }
  const matchingKey = existing.find(index => sameKey(index.key, key));
  if (matchingKey) {
    const expectedUnique = Boolean(options.unique);
    const actualUnique = Boolean(matchingKey.unique);
    if (expectedUnique !== actualUnique) {
      throw new Error(
        `Index ${collection.collectionName}.${options.name} conflicts with existing index ${matchingKey.name}`,
      );
    }
    return matchingKey.name;
  }
  return collection.createIndex(key, options);
}

export async function up(db) {
  const questionProgress = db.collection('userQuestionProgress');
  const topicProgress = db.collection('userTopicProgress');

  await ensureIndex(
    questionProgress,
    { userId: 1, questionId: 1 },
    { unique: true, name: 'progress_user_question_unique' },
  );
  await ensureIndex(
    questionProgress,
    { userId: 1, topic: 1 },
    { name: 'progress_user_topic_lookup' },
  );
  await ensureIndex(
    topicProgress,
    { userId: 1, topic: 1 },
    { unique: true, name: 'topic_progress_user_topic_unique' },
  );
}
