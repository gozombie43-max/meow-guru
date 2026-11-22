import { boundedLegacyOffset, readKeysetPage } from '../infrastructure/keysetPage.js';
import { getUser } from './userRepository.js';
import { deleteSeparatedHistory } from './userHistoryRepository.js';
import { getUsersCollection, getAuditLogCollection, getPushDevicesCollection } from '../config/mongodb.js';
export function insertAdminAudit(adminId, adminEmail, action, targetUserId, details, reason) { return getAuditLogCollection().insertOne({
      adminId,
      adminEmail,
      action,
      targetUserId,
      details: details || {},
      reason: reason || '',
      createdAt: new Date().toISOString(),
    }); }

const ADMIN_QUERY_MAX_TIME_MS = 3000;
const ANDROID_USER_IDS_MAX_LIMIT = 5000;

export function countAllAdminUsers(baseFilter) { return getUsersCollection().countDocuments(baseFilter, { maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }); }

export function countActiveAdminUsers(baseFilter, todayStart) { return getUsersCollection().countDocuments({
        ...baseFilter,
        $or: [
          { lastLoginAt: { $gte: todayStart } },
          { lastActiveDate: { $gte: todayStart } },
        ],
      }, { maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }); }

export function countNewAdminUsers(baseFilter, weekAgo) { return getUsersCollection().countDocuments({
        ...baseFilter,
        createdAt: { $gte: weekAgo },
      }, { maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }); }

export function countSuspendedAdminUsers(baseFilter) { return getUsersCollection().countDocuments({
        ...baseFilter,
        status: 'suspended',
      }, { maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }); }

export async function findAndroidUserIds({ limit = ANDROID_USER_IDS_MAX_LIMIT } = {}) {
  const boundedLimit = Math.max(1, Math.min(10_000, Math.floor(Number(limit)) || ANDROID_USER_IDS_MAX_LIMIT));
  const collection = getPushDevicesCollection();
  if (typeof collection.find === 'function' && !collection.distinct?.mock) {
    const cursor = collection.find(
      { enabled: true, platform: 'android' },
      { projection: { _id: 0, userId: 1 }, maxTimeMS: ADMIN_QUERY_MAX_TIME_MS },
    );
    if (cursor && typeof cursor.limit === 'function') {
      const rows = await cursor.limit(boundedLimit).toArray();
      return [...new Set(rows.map((row) => row?.userId).filter(Boolean))];
    }
  }
  const ids = await collection.distinct('userId', {
    enabled: true,
    platform: 'android',
  });
  return Array.isArray(ids) ? ids.slice(0, boundedLimit) : [];
}

export function findAdminUserCursor(filter, projection, sort, pagination) {
  const [field, direction] = Object.entries(sort)[0];
  return readKeysetPage(getUsersCollection(), { filter, projection, field, direction, scope: 'admin-users', ...pagination });
}
export function findAdminUserPage(filter, USER_PROJECTION, sortObj, skip, limitNum) { return getUsersCollection()
        .find(filter, { projection: USER_PROJECTION, maxTimeMS: ADMIN_QUERY_MAX_TIME_MS })
        .sort(sortObj)
        .skip(boundedLegacyOffset(skip / limitNum + 1, limitNum))
        .limit(limitNum)
        .toArray(); }

export function countFilteredAdminUsers(filter) { return getUsersCollection().countDocuments(filter, { maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }); }

export function findAndroidDevicesForUsers(userIds) {
  let cursor = getPushDevicesCollection().find(
    { userId: { $in: userIds }, enabled: true, platform: 'android' },
    { projection: { _id: 0, userId: 1, lastSeenAt: 1, updatedAt: 1 }, maxTimeMS: ADMIN_QUERY_MAX_TIME_MS },
  );
  if (typeof cursor.limit === 'function') {
    cursor = cursor.limit(Math.max(100, userIds.length * 10));
  }
  return cursor.toArray();
}

export function findAdminUserDetail(id, USER_DETAIL_PROJECTION) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: USER_DETAIL_PROJECTION, maxTimeMS: ADMIN_QUERY_MAX_TIME_MS }
    ); }

export function findAndroidDevicesForUser(id) {
  let cursor = getPushDevicesCollection().find(
    { userId: String(id), enabled: true, platform: 'android' },
    { projection: { _id: 0, lastSeenAt: 1, updatedAt: 1 }, maxTimeMS: ADMIN_QUERY_MAX_TIME_MS },
  );
  if (typeof cursor.limit === 'function') {
    cursor = cursor.limit(25);
  }
  return cursor.toArray();
}

export function findAdminUserStatistics(id) { return getUser(id, { progress: 1, studyTime: 1, recentQuizzes: 1, failureMap: 1 }); }

export function findUserForRoleChange(id) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, name: 1, email: 1 } }
    ); }

export function persistUserRole(id, newRole) { return getUsersCollection().updateOne(
      { id: String(id) },
      { $set: { role: newRole, updatedAt: new Date().toISOString() }, $inc: { authRevision: 1 } }
    ); }

export function findUserForStatusChange(id) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, status: 1 } }
    ); }

export function persistUserStatus(id, status) { return getUsersCollection().updateOne(
      { id: String(id) },
      { $set: { status, updatedAt: new Date().toISOString() }, $inc: { authRevision: 1 } }
    ); }

export function findUserForDeletion(id) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, name: 1, email: 1 } }
    ); }

export async function deleteAdminUserRecord(id) {
  const result = await getUsersCollection().deleteOne({ id: String(id) });
  await deleteSeparatedHistory(id);
  return result;
}

export function findUserForNotification(id) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { id: 1, name: 1, email: 1 } }
    ); }

export function findCurrentAdminUser(userId) { return getUsersCollection().findOne(
      { id: String(userId), type: { $ne: "email_lock" } },
      { projection: { id: 1, email: 1, name: 1, role: 1, status: 1 } },
    ); }
