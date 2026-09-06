// backend/controllers/adminUsers.controller.js

import { getUsersCollection, getAuditLogCollection } from '../config/mongodb.js';
import { roleLevel } from '../middleware/requireRole.js';

// ── Helpers ──────────────────────────────────────────────

const USER_PROJECTION = {
  passwordHash: 0,
  _id: 0,
  _cosmosRid: 0,
  aiChats: 0,
  bookmarkEntries: 0,
  bookmarks: 0,
  recentQuizzes: 0,
  failureMap: 0,
  masteryMap: 0,
  timePerQuestion: 0,
};

const USER_DETAIL_PROJECTION = {
  passwordHash: 0,
  _id: 0,
  _cosmosRid: 0,
  aiChats: 0,
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function logAudit({ adminId, adminEmail, action, targetUserId, details, reason }) {
  try {
    const auditLog = getAuditLogCollection();
    await auditLog.insertOne({
      adminId,
      adminEmail,
      action,
      targetUserId,
      details: details || {},
      reason: reason || '',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

// ── GET /api/admin/stats ─────────────────────────────────

export async function getDashboardStats(req, res) {
  try {
    const users = getUsersCollection();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const baseFilter = { type: { $ne: 'email_lock' } };

    const [totalUsers, activeToday, newThisWeek, suspendedCount] = await Promise.all([
      users.countDocuments(baseFilter),
      users.countDocuments({
        ...baseFilter,
        $or: [
          { lastLoginAt: { $gte: todayStart } },
          { lastActiveDate: { $gte: todayStart } },
        ],
      }),
      users.countDocuments({
        ...baseFilter,
        createdAt: { $gte: weekAgo },
      }),
      users.countDocuments({
        ...baseFilter,
        status: 'suspended',
      }),
    ]);

    res.json({ totalUsers, activeToday, newThisWeek, suspendedCount });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/admin/users ─────────────────────────────────

export async function getUsers(req, res) {
  try {
    const { page, limit, search, status, role, sort } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = { type: { $ne: 'email_lock' } };

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { id: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (status && ['active', 'suspended', 'banned'].includes(status)) {
      if (status === 'active') {
        // Users without a status field are considered active
        filter.$and = [
          ...(filter.$and || []),
          { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        ];
      } else {
        filter.status = status;
      }
    }

    if (role && ['user', 'student', 'moderator', 'admin', 'superadmin'].includes(role)) {
      if (role === 'user') {
        // Match both "user" and legacy "student"
        filter.role = { $in: ['user', 'student'] };
      } else {
        filter.role = role;
      }
    }

    // Build sort
    let sortObj = { createdAt: -1 };
    if (sort) {
      const desc = sort.startsWith('-');
      const field = desc ? sort.slice(1) : sort;
      if (['createdAt', 'name', 'lastLoginAt'].includes(field)) {
        sortObj = { [field]: desc ? -1 : 1 };
      }
    }

    const users = getUsersCollection();

    const [docs, total] = await Promise.all([
      users
        .find(filter, { projection: USER_PROJECTION })
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      users.countDocuments(filter),
    ]);

    // Normalize status for users without the field
    const normalizedDocs = docs.map((u) => ({
      ...u,
      status: u.status || 'active',
    }));

    res.json({
      users: normalizedDocs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/admin/users/:id ─────────────────────────────

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const users = getUsersCollection();

    const user = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: USER_DETAIL_PROJECTION }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ ...user, status: user.status || 'active' });
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/admin/users/:id/stats ───────────────────────

export async function getUserStats(req, res) {
  try {
    const { id } = req.params;
    const users = getUsersCollection();

    const user = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { progress: 1, studyTime: 1, recentQuizzes: 1, failureMap: 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compute stats from progress object
    const progress = user.progress || {};
    let questionsAttempted = 0;
    let correctAnswers = 0;
    const topTopics = [];

    for (const [topic, data] of Object.entries(progress)) {
      const attempted = data.attempted || 0;
      const correct = data.correct || 0;
      questionsAttempted += attempted;
      correctAnswers += correct;
      if (attempted > 0) {
        topTopics.push({
          topic,
          attempted,
          correct,
          accuracy: Math.round((correct / attempted) * 1000) / 10,
        });
      }
    }

    topTopics.sort((a, b) => b.attempted - a.attempted);

    const accuracy = questionsAttempted > 0
      ? Math.round((correctAnswers / questionsAttempted) * 1000) / 10
      : 0;

    // Mock tests from recent quizzes
    const recentQuizzes = user.recentQuizzes || [];
    const mockTestsCompleted = recentQuizzes.filter((q) => q.status === 'completed').length;

    // Study time in minutes
    const studyTimeMinutes = Math.round((user.studyTime || 0) / 60);

    // Current streak (from failureMap's lastActiveDate tracking — approximate)
    const currentStreak = 0; // Would need daily login tracking to compute properly

    res.json({
      questionsAttempted,
      correctAnswers,
      accuracy,
      mockTestsCompleted,
      currentStreak,
      studyTimeMinutes,
      topTopics: topTopics.slice(0, 10),
    });
  } catch (err) {
    console.error('getUserStats error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── PATCH /api/admin/users/:id/role ──────────────────────

export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role: newRole } = req.body;
    const adminUser = req.user;

    // Cannot modify yourself
    if (adminUser.id === id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Cannot escalate above your own role
    const adminLevel = roleLevel(adminUser.role);
    const targetLevel = roleLevel(newRole);
    if (targetLevel >= adminLevel) {
      return res.status(403).json({
        error: 'Cannot assign a role equal to or higher than your own',
      });
    }

    const users = getUsersCollection();

    // Check target user exists and their current role
    const targetUser = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, name: 1, email: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot modify someone with equal or higher role
    const currentTargetLevel = roleLevel(targetUser.role);
    if (currentTargetLevel >= adminLevel) {
      return res.status(403).json({
        error: 'Cannot modify a user with equal or higher role',
      });
    }

    await users.updateOne(
      { id: String(id) },
      { $set: { role: newRole, updatedAt: new Date().toISOString() } }
    );

    await logAudit({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'ROLE_CHANGED',
      targetUserId: id,
      details: { from: targetUser.role, to: newRole },
    });

    res.json({ message: 'Role updated ✅', role: newRole });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── PATCH /api/admin/users/:id/status ────────────────────

export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminUser = req.user;

    // Cannot modify yourself
    if (adminUser.id === id) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    const users = getUsersCollection();

    const targetUser = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, status: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot modify someone with equal or higher role
    const adminLevel = roleLevel(adminUser.role);
    const targetLevel = roleLevel(targetUser.role);
    if (targetLevel >= adminLevel) {
      return res.status(403).json({
        error: 'Cannot modify a user with equal or higher role',
      });
    }

    const previousStatus = targetUser.status || 'active';

    await users.updateOne(
      { id: String(id) },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );

    const actionMap = {
      active: 'USER_REACTIVATED',
      suspended: 'USER_SUSPENDED',
      banned: 'USER_BANNED',
    };

    await logAudit({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: actionMap[status] || 'STATUS_CHANGED',
      targetUserId: id,
      details: { from: previousStatus, to: status },
      reason,
    });

    res.json({ message: `User ${status} ✅`, status });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── DELETE /api/admin/users/:id ──────────────────────────

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const adminUser = req.user;

    // Cannot delete yourself
    if (adminUser.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const users = getUsersCollection();

    const targetUser = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { role: 1, id: 1, name: 1, email: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete someone with equal or higher role
    const adminLevel = roleLevel(adminUser.role);
    const targetLevel = roleLevel(targetUser.role);
    if (targetLevel >= adminLevel) {
      return res.status(403).json({
        error: 'Cannot delete a user with equal or higher role',
      });
    }

    await users.deleteOne({ id: String(id) });

    await logAudit({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'USER_DELETED',
      targetUserId: id,
      details: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
    });

    res.json({ message: 'User deleted ✅' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── POST /api/admin/users/:id/notification ───────────────

export async function sendNotification(req, res) {
  try {
    const { id } = req.params;
    const { title, body } = req.body;
    const adminUser = req.user;

    const users = getUsersCollection();

    const targetUser = await users.findOne(
      { id: String(id), type: { $ne: 'email_lock' } },
      { projection: { id: 1, name: 1, email: 1, notifications: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Integrate FCM here when configured
    // const tokens = targetUser.notifications?.fcmTokens || [];
    // if (tokens.length === 0) {
    //   return res.status(400).json({ error: 'User has no FCM tokens' });
    // }
    // await sendFCM(tokens, { title, body });

    await logAudit({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'NOTIFICATION_SENT',
      targetUserId: id,
      details: { title, body },
    });

    res.json({
      message: 'Notification logged ✅ (FCM not yet configured)',
      sent: false,
    });
  } catch (err) {
    console.error('sendNotification error:', err);
    res.status(500).json({ error: err.message });
  }
}
