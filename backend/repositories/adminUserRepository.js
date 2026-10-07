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

export function countAllAdminUsers(baseFilter) { return getUsersCollection().countDocuments(baseFilter); }

export function countActiveAdminUsers(baseFilter, todayStart) { return getUsersCollection().countDocuments({
        ...baseFilter,
        $or: [
          { lastLoginAt: { $gte: todayStart } },
          { lastActiveDate: { $gte: todayStart } },
        ],
      }); }

export function countNewAdminUsers(baseFilter, weekAgo) { return getUsersCollection().countDocuments({
        ...baseFilter,
        createdAt: { $gte: weekAgo },
      }); }

export function countSuspendedAdminUsers(baseFilter) { return getUsersCollection().countDocuments({
        ...baseFilter,
        status: 'suspended',
      }); }

export function findAndroidUserIds() { return getPushDevicesCollection().distinct('userId', {
        enabled: true,
        platform: 'android',
      }); }

export function findAdminUserCursor(filter, projection, sort, pagination) {
  const [field, direction] = Object.entries(sort)[0];
  return readKeysetPage(getUsersCollection(), { filter, projection, field, direction, scope: 'admin-users', ...pagination });
}
export function findAdminUserPage(filter, USER_PROJECTION, sortObj, skip, limitNum) { return getUsersCollection()
        .find(filter, { projection: USER_PROJECTION })
        .sort(sortObj)
        .skip(boundedLegacyOffset(skip / limitNum + 1, limitNum))
        .limit(limitNum)
        .toArray(); }

export function countFilteredAdminUsers(filter) { return getUsersCollection().countDocuments(filter); }

export function findAndroidDevicesForUsers(userIds) { return getPushDevicesCollection()
        .find(
          { userId: { $in: userIds }, enabled: true, platform: 'android' },
          { projection: { _id: 0, userId: 1, lastSeenAt: 1, updatedAt: 1 } }
        )
        .toArray(); }

export function findAdminUserDetail(id, USER_DETAIL_PROJECTION) { return getUsersCollection().findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: USER_DETAIL_PROJECTION }
    ); }

export function findAndroidDevicesForUser(id) { return getPushDevicesCollection()
      .find(
        { userId: String(id), enabled: true, platform: 'android' },
        { projection: { _id: 0, lastSeenAt: 1, updatedAt: 1 } }
      )
      .toArray(); }

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
