// backend/repositories/userRepository.js
import { getUsersCollection, getStudyActivityDailyCollection } from '../config/mongodb.js';

export const getUser = async (id, projection) => {
  const users = getUsersCollection();
  return users.findOne({
    id: String(id),
    type: { $ne: 'email_lock' },
  }, projection ? { projection } : undefined);
};

// Compare-and-swap protects embedded histories against concurrent requests/tabs.
export const mutateUserList = async (id, field, mutate) => {
  const users = getUsersCollection();
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
