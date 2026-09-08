import api from '@/lib/axios';
import type {
  AdminUser,
  AdminUserStats,
  AdminUsersResponse,
  AdminUsersQueryParams,
  AdminDashboardStats,
  UserRole,
  UserStatus,
} from '@/types/admin';

// ── Dashboard stats ──────────────────────────────────────

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { data } = await api.get('/api/admin/stats');
  return data;
}

// ── User listing ─────────────────────────────────────────

export async function fetchAdminUsers(
  params: AdminUsersQueryParams = {}
): Promise<AdminUsersResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.role) query.set('role', params.role);
  if (params.push) query.set('push', params.push);
  if (params.sort) query.set('sort', params.sort);

  const { data } = await api.get(`/api/admin/users?${query.toString()}`);
  return data;
}

// ── Single user ──────────────────────────────────────────

export async function fetchAdminUser(id: string): Promise<AdminUser> {
  const { data } = await api.get(`/api/admin/users/${id}`);
  return data;
}

// ── User stats ───────────────────────────────────────────

export async function fetchAdminUserStats(id: string): Promise<AdminUserStats> {
  const { data } = await api.get(`/api/admin/users/${id}/stats`);
  return data;
}

// ── Role management ──────────────────────────────────────

export async function updateUserRole(
  id: string,
  role: UserRole
): Promise<{ message: string; role: UserRole }> {
  const { data } = await api.patch(`/api/admin/users/${id}/role`, { role });
  return data;
}

// ── Status management ────────────────────────────────────

export async function updateUserStatus(
  id: string,
  status: UserStatus,
  reason?: string
): Promise<{ message: string; status: UserStatus }> {
  const { data } = await api.patch(`/api/admin/users/${id}/status`, {
    status,
    reason,
  });
  return data;
}

// ── Delete user ──────────────────────────────────────────

export async function deleteAdminUser(
  id: string
): Promise<{ message: string }> {
  const { data } = await api.delete(`/api/admin/users/${id}`);
  return data;
}

// ── Send notification ────────────────────────────────────

export async function sendUserNotification(
  id: string,
  title: string,
  body: string
): Promise<{
  message: string;
  sent: boolean;
  successCount: number;
  failureCount: number;
  invalidDeviceCount: number;
  noDevices: boolean;
  suppressed: boolean;
  notificationId: string | null;
}> {
  const { data } = await api.post(`/api/admin/users/${id}/notification`, {
    title,
    body,
  });
  return data;
}

// ── Broadcast notification ───────────────────────────────

export interface BroadcastNotificationPayload {
  title: string;
  body: string;
  route?: string;
}

export interface BroadcastNotificationResult {
  ok: boolean;
  totalDevices: number;
  successCount: number;
  failureCount: number;
  invalidDeviceCount?: number;
}

export async function sendBroadcastNotification(
  payload: BroadcastNotificationPayload
): Promise<BroadcastNotificationResult> {
  const { data } = await api.post(
    '/api/notifications/broadcast',
    payload
  );

  return data;
}

export interface NotificationHealth {
  status: "healthy" | "warning" | "critical";
  checkedAt: string;
  workers: Array<{
    workerName: string;
    state: string;
    instanceId?: string;
    ageSeconds?: number;
    intervalMs: number;
    lastDurationMs?: number | null;
    lastMetrics?: Record<string, unknown>;
    lastError?: string | null;
  }>;
  scheduled: {
    overduePending: number;
    stuckProcessing: number;
    failed24h: number;
  };
  push24h: {
    targetDevices: number;
    acceptedCount: number;
    failureCount: number;
    invalidDeviceCount: number;
    failureRatePercent: number;
  };
}

export async function fetchNotificationHealth(): Promise<NotificationHealth> {
  const { data } = await api.get('/api/notifications/health');
  return data;
}

// ── Notification history ──────────────────────────────────

export interface NotificationHistoryItem {
  _id: string;
  type: "broadcast" | "scheduled-broadcast" | "new-mock";

  title: string;
  body: string;
  route: string;

  totalDevices: number;
  successCount: number;
  failureCount: number;
  invalidDeviceCount: number;

  sentByUserId?: string;
  sentByEmail?: string;

  examSlug?: string;
  testId?: string;
  mockTitle?: string | null;

  createdAt: string;
}

export interface NotificationHistoryResponse {
  items: NotificationHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchNotificationHistory(
  page = 1
): Promise<NotificationHistoryResponse> {
  const { data } = await api.get(
    `/api/notifications/history?page=${page}&limit=20`
  );

  return data;
}

// ── Scheduled notifications ───────────────────────────────

export type ScheduledNotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export interface ScheduledNotificationItem {
  _id: string;

  title: string;
  body: string;
  route: string;

  sendAt: string;
  createdAt: string;

  status: ScheduledNotificationStatus;

  successCount?: number;
  failureCount?: number;
  totalDevices?: number;

  error?: string;
  attempts?: number;

  sentAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  retriedAt?: string;
  retryJobId?: string;
}

export interface ScheduledNotificationResponse {
  items: ScheduledNotificationItem[];

  total: number;
  page: number;
  limit: number;
  totalPages: number;

  counts: {
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
}

export async function fetchScheduledNotifications(
  status: ScheduledNotificationStatus | "all" = "all",
  page = 1
): Promise<ScheduledNotificationResponse> {
  const { data } = await api.get(
    `/api/notifications/scheduled?status=${status}&page=${page}&limit=20`
  );

  return data;
}

export async function cancelScheduledNotification(
  id: string
) {
  const { data } = await api.post(
    `/api/notifications/scheduled/${id}/cancel`
  );

  return data;
}

export async function retryScheduledNotification(
  id: string,
  sendAt?: string
) {
  const { data } = await api.post(
    `/api/notifications/scheduled/${id}/retry`,
    sendAt
      ? { sendAt }
      : {}
  );

  return data;
}

export interface NotificationAnalytics {
  days: number;

  notifications: number;

  targetDevices: number;
  acceptedCount: number;
  failureCount: number;

  opened: number;
  pushOpened: number;
  inAppOpened: number;
  actionClicked: number;

  openRate: number;
  actionRate: number;
}

export async function fetchNotificationAnalytics(
  days = 30
): Promise<NotificationAnalytics> {
  const { data } = await api.get(
    `/api/notifications/analytics?days=${days}`
  );

  return data;
}
