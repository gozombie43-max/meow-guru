// backend/routes/adminUsers.routes.js

import express from 'express';
import { protect } from '../middleware/protect.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validation.js';
import {
  roleUpdateSchema,
  statusUpdateSchema,
  notificationSchema,
} from '../schemas/adminSchemas.js';

import {
  getDashboardStats,
  getUsers,
  getUserById,
  getUserStats,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  sendNotification,
} from '../controllers/adminUsers.controller.js';

const router = express.Router();

// All admin routes require JWT authentication + admin/superadmin role
const adminGuard = [protect, requireRole('admin', 'superadmin')];

// ── Dashboard stats ──────────────────────────────────────
router.get('/stats', ...adminGuard, getDashboardStats);

// ── User listing with search, filters, pagination ────────
router.get(
  '/users',
  ...adminGuard,
  getUsers
);

// ── Single user detail ───────────────────────────────────
router.get('/users/:id', ...adminGuard, getUserById);

// ── User quiz stats ──────────────────────────────────────
router.get('/users/:id/stats', ...adminGuard, getUserStats);

// ── Role management ──────────────────────────────────────
router.patch(
  '/users/:id/role',
  ...adminGuard,
  validateBody(roleUpdateSchema),
  updateUserRole
);

// ── Status management (suspend / reactivate / ban) ───────
router.patch(
  '/users/:id/status',
  ...adminGuard,
  validateBody(statusUpdateSchema),
  updateUserStatus
);

// ── Delete user ────────────────────────
router.delete(
  '/users/:id',
  ...adminGuard,
  deleteUser
);

// ── Send notification ────────────────────────────────────
router.post(
  '/users/:id/notification',
  ...adminGuard,
  validateBody(notificationSchema),
  sendNotification
);

export default router;
