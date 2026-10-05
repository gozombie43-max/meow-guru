import { readSeparatedHistory, mutateSeparatedHistory, analyticsFields } from './userHistoryRepository.js';
// backend/repositories/userRepository.js
import { getMongoDB, getUsersCollection, getStudyActivityDailyCollection } from '../config/mongodb.js';

export const getUser = async (id, projection) => {
  const include = projection && Object.entries(projection).some(([key, value]) => key !== '_id' && value === 1);
  const selected = projection ? { ...projection, ...(include ? { historyStorageVersion: 1, id: 1 } : {}) } : { aiChats: 0, recentQuizzes: 0, bookmarkEntries: 0, failureMap: 0, masteryMap: 0, timePerQuestion: 0 };
  const user = await getUsersCollection().findOne({ id: String(id), type: { $ne: 'email_lock' } }, { projection: selected });
  if (!user || user.historyStorageVersion !== 1) return user;
  for (const field of ['recentQuizzes', 'aiChats', 'bookmarkEntries']) {
    const fields = Object.keys(projection || {}).filter(key => projection[key] === 1 && (key === field || key.startsWith(`${field}.`)));
    if (!fields.length) { delete user[field]; continue; }
    const rows = await readSeparatedHistory(getMongoDB(), id, field);
    user[field] = fields.includes(field) ? rows : rows.map(row => Object.fromEntries(fields.map(key => key.slice(field.length + 1)).filter(key => row[key] !== undefined).map(key => [key, row[key]])));
  }
  const requestedAnalytics = analyticsFields.filter(field => projection?.[field] === 1);
  if (requestedAnalytics.length) {
    const data = await getMongoDB().collection('userAnalytics').findOne({ userId: String(id) }, { projection: Object.fromEntries(requestedAnalytics.map(field => [field, 1])) });
    for (const field of requestedAnalytics) user[field] = data?.[field] || {};
  }
  return user;
};

// Compare-and-swap protects embedded histories against concurrent requests/tabs.
export const mutateUserList = async (id, field, mutate) => {
  const users = getUsersCollection();
  const owner = await users.findOne({ id: String(id), type: { $ne: 'email_lock' } }, { projection: { historyStorageVersion: 1 } });
  if (!owner) return null;
  if (owner.historyStorageVersion === 1 && ['aiChats', 'recentQuizzes', 'bookmarkEntries'].includes(field)) return mutateSeparatedHistory(id, field, mutate);
  const revisionField = `${field}Revision`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const user = await getUser(id, { [field]: 1, [revisionField]: 1 });
    if (!user) return null;
    const value = mutate(Array.isArray(user[field]) ? user[field] : []);
    const revision = user[revisionField] ?? 0;
    const result = await users.updateOne({ id: String(id), type: { $ne: 'email_lock' },
      [revisionField]: user[revisionField] === undefined ? { $exists: false } : revision },
    { $set: { [field]: value }, $inc: { [revisionField]: 1 } });
    if (result.matchedCount) return value;
  }
  throw Object.assign(new Error('History changed concurrently. Please retry.'), { statusCode: 409 });
};

export const updateUser = async (id, fields) => {
  const users = getUsersCollection();
  const result = await users.updateOne(
    {
      id: String(id),
      type: { $ne: 'email_lock' },
    },
    {
      $set: fields,
    }
  );
  return result.matchedCount > 0;
};

export const updateUserProgress = async (id, topic, attempted, correct) => {
  const users = getUsersCollection();
  return users.findOneAndUpdate(
    { id: String(id), type: { $ne: 'email_lock' } },
    {
      $inc: {
        [`progress.${topic}.attempted`]: attempted,
        [`progress.${topic}.correct`]: correct,
      },
    },
    { returnDocument: 'after', projection: { progress: 1 } }
  );
};

export const trackStudyUsage = async (userId, activeSeconds, effectiveTimezone, dateKey) => {
  const users = getUsersCollection();
  const daily = getStudyActivityDailyCollection();

  await Promise.all([
    users.updateOne(
      { id: userId },
      {
        $inc: { studyTime: activeSeconds },
        $set: { timezone: effectiveTimezone },
      }
    ),
    daily.updateOne(
      {
        userId,
        dateKey,
      },
      {
        $inc: { activeSeconds },
        $set: {
          timezone: effectiveTimezone,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    ),
  ]);
};
