import { ensureIndex, listIndexesSafe, sameKeySpec } from './indexUtils.js';

export const id = '029-production-scale-indexes';

export const DROPPED_INDEXES_BY_COLLECTION = Object.freeze({
  questions: Object.freeze([
    // ESR-broken indexes: modeKey preceded selectionKey, blocking IXSCAN + non-blocking SORT
    // when queries filter `modeKey: { $ne: 'studyMode' }` and sort `{ selectionKey: 1, _id: 1 }`.
    {
      name: 'questions_topic_mode_selection_id',
      key: { topicKey: 1, modeKey: 1, selectionKey: 1, _id: 1 },
    },
    {
      name: 'questions_examMode_subject_mode_selection_id',
      key: { examModeKey: 1, subjectKey: 1, modeKey: 1, selectionKey: 1, _id: 1 },
    },
  ]),
  battleProfiles: Object.freeze([
    // Strict prefix of 016's `battle_ranking_order` ({ rating: -1, wins: -1, gamesPlayed: -1 }).
    {
      key: { rating: -1, wins: -1 },
      coveredBy: { rating: -1, wins: -1, gamesPlayed: -1 },
    },
  ]),
  notificationFeed: Object.freeze([
    // Strict prefix of 014's `{ audience: 1, userId: 1, createdAt: -1, _id: -1 }`.
    {
      key: { audience: 1, userId: 1, createdAt: -1 },
      coveredBy: { audience: 1, userId: 1, createdAt: -1, _id: -1 },
    },
  ]),
  examUpdates: Object.freeze([
    // Strict prefix of 014's `{ publishedAt: -1, _id: -1 }`.
    {
      key: { publishedAt: -1 },
      coveredBy: { publishedAt: -1, _id: -1 },
    },
  ]),
});

export function isRetiredIndexCreate(collectionName, key, options = {}) {
  const specs = DROPPED_INDEXES_BY_COLLECTION[collectionName];
  if (!specs) return false;
  return specs.some(
    spec => (spec.name && options?.name === spec.name) || (spec.key && sameKeySpec(key, spec.key)),
  );
}

async function dropIndexesMatching(collection, specsToDrop) {
  const existing = await listIndexesSafe(collection);
  if (!existing.length) return 0;
  let dropped = 0;
  for (const index of existing) {
    if (index.name === '_id_') continue;
    const matchedSpec = specsToDrop.find(
      spec => (spec.name && index.name === spec.name) || (spec.key && sameKeySpec(index.key, spec.key)),
    );
    if (!matchedSpec) continue;
    if (
      matchedSpec.coveredBy
      && !existing.some(other => other.name !== index.name && sameKeySpec(other.key, matchedSpec.coveredBy))
    ) {
      continue;
    }
    try {
      await collection.dropIndex(index.name);
      dropped++;
    } catch (error) {
      if (error?.code === 27 || error?.code === 26 || /index not found|ns does not exist/i.test(error?.message || '')) {
        continue;
      }
      throw error;
    }
  }
  return dropped;
}

export async function up(db) {
  const questions = db.collection('questions');

  // 1. Create ESR-aligned ring-scan indexes BEFORE dropping the superseded 027 indexes
  //    so there is never an unindexed window during live rollout.
  const newQuestionIndexes = [
    { key: { selectionKey: 1, _id: 1 }, name: 'questions_selection_id' },
    { key: { topicKey: 1, selectionKey: 1, _id: 1 }, name: 'questions_topic_selection_id' },
    { key: { examModeKey: 1, subjectKey: 1, selectionKey: 1, _id: 1 }, name: 'questions_examMode_subject_selection_id' },
  ];
  for (const { key, name } of newQuestionIndexes) {
    await ensureIndex(questions, key, { name });
  }

  // 2. Drop ESR-broken 027 `questions` indexes.
  await dropIndexesMatching(questions, DROPPED_INDEXES_BY_COLLECTION.questions);

  // 3. Drop strict-prefix duplicate indexes only when their covering superset exists.
  await dropIndexesMatching(db.collection('battleProfiles'), DROPPED_INDEXES_BY_COLLECTION.battleProfiles);
  await dropIndexesMatching(db.collection('notificationFeed'), DROPPED_INDEXES_BY_COLLECTION.notificationFeed);
  await dropIndexesMatching(db.collection('examUpdates'), DROPPED_INDEXES_BY_COLLECTION.examUpdates);

  // 4. Create verified partial indexes for global & seasonal battle leaderboards.
  //    Note: mockAttempts already has `{ examSlug: 1, testId: 1, status: 1, 'result.totalScore': 1 }` in 003.
  await ensureIndex(
    db.collection('battleProfiles'),
    { rating: -1, wins: -1, updatedAt: -1 },
    {
      name: 'battle_profiles_active_leaderboard',
      partialFilterExpression: { gamesPlayed: { $gte: 1 } },
    },
  );
  await ensureIndex(
    db.collection('battleSeasonProfiles'),
    { seasonId: 1, rating: -1, wins: -1, updatedAt: -1 },
    {
      name: 'battle_season_id_profiles_active_leaderboard',
      partialFilterExpression: { gamesPlayed: { $gte: 5 } },
    },
  );
  await ensureIndex(
    db.collection('battleSeasonProfiles'),
    { seasonKey: 1, rating: -1, wins: -1, updatedAt: -1 },
    {
      name: 'battle_season_profiles_active_leaderboard',
      partialFilterExpression: { gamesPlayed: { $gte: 5 } },
    },
  );
}
