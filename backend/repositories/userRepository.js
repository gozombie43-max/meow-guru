// backend/repositories/userRepository.js
import { getUsersCollection, getStudyActivityDailyCollection } from '../config/mongodb.js';

export const getUser = async (id) => {
  const users = getUsersCollection();
  return users.findOne({
    id: String(id),
    type: { $ne: 'email_lock' },
  });
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
