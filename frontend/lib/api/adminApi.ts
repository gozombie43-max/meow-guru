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
): Promise<{ message: string; sent: boolean }> {
  const { data } = await api.post(`/api/admin/users/${id}/notification`, {
    title,
    body,
  });
  return data;
}
