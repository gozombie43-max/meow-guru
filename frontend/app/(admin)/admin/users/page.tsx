'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAdminDashboardStats,
  fetchAdminUsers,
  fetchAdminUser,
  fetchAdminUserStats,
  updateUserRole,
  updateUserStatus,
  deleteAdminUser,
  sendUserNotification,
} from '@/lib/api/adminApi';
import type {
  AdminUser,
  AdminUserStats,
  AdminUsersResponse,
  AdminDashboardStats,
  UserRole,
  UserStatus,
  AdminUsersQueryParams,
} from '@/types/admin';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserPlus,
  ShieldAlert,
  X,
  MoreVertical,
  Bell,
  Ban,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  Smartphone,
} from 'lucide-react';
import s from './AdminUsersPage.module.css';

// ── Helpers ──────────────────────────────────────────────

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString('en-IN');
  return String(n);
}

function canonicalRole(role: string): UserRole {
  return (role === 'student' ? 'user' : role) as UserRole;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    user: 'User',
    student: 'User',
    moderator: 'Mod',
    admin: 'Admin',
    superadmin: 'Super',
  };
  return labels[role] || role;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    suspended: 'Suspended',
    banned: 'Banned',
  };
  return labels[status] || status;
}

// ── Component ────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [pushFilter, setPushFilter] = useState<'android' | 'none' | ''>('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);

  // Drawer
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modals
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<UserStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyResult, setNotifyResult] = useState<Awaited<ReturnType<typeof sendUserNotification>> | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Debounce ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, authLoading, router]);

  // ── Debounce search ────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // ── Fetch stats ────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;
    fetchAdminDashboardStats()
      .then(setStats)
      .catch((err) => console.error('Stats fetch error:', err));
  }, [authUser]);

  // ── Fetch users ────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: AdminUsersQueryParams = {
        page,
        limit: 25,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        push: pushFilter || undefined,
        sort,
      };
      const res = await fetchAdminUsers(params);
      setData(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to load users';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, roleFilter, pushFilter, sort]);

  useEffect(() => {
    if (!authUser) return;
    loadUsers();
  }, [authUser, loadUsers]);

  // ── Open drawer ────────────────────────────────────────
  const openDrawer = useCallback(async (userId: string) => {
    setDrawerLoading(true);
    setUserStats(null);
    try {
      const [user, ustats] = await Promise.all([
        fetchAdminUser(userId),
        fetchAdminUserStats(userId),
      ]);
      setSelectedUser(user);
      setUserStats(ustats);
    } catch {
      setSelectedUser(null);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedUser(null);
    setUserStats(null);
    setShowNotifyModal(false);
    setShowDeleteConfirm(false);
    setShowStatusConfirm(null);
    setNotifyResult(null);
  }, []);

  // ── Role change ────────────────────────────────────────
  const handleRoleChange = useCallback(
    async (newRole: UserRole) => {
      if (!selectedUser) return;
      setActionLoading(true);
      try {
        await updateUserRole(selectedUser.id, newRole);
        setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : prev));
        await loadUsers();
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || 'Failed to update role';
        alert(msg);
      } finally {
        setActionLoading(false);
      }
    },
    [selectedUser, loadUsers]
  );

  // ── Status change ──────────────────────────────────────
  const handleStatusChange = useCallback(
    async (newStatus: UserStatus) => {
      if (!selectedUser) return;
      setActionLoading(true);
      try {
        await updateUserStatus(selectedUser.id, newStatus, statusReason);
        setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : prev));
        setShowStatusConfirm(null);
        setStatusReason('');
        await loadUsers();
        // Refresh stats
        fetchAdminDashboardStats().then(setStats).catch(() => {});
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || 'Failed to update status';
        alert(msg);
      } finally {
        setActionLoading(false);
      }
    },
    [selectedUser, statusReason, loadUsers]
  );

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await deleteAdminUser(selectedUser.id);
      setShowDeleteConfirm(false);
      closeDrawer();
      await loadUsers();
      fetchAdminDashboardStats().then(setStats).catch(() => {});
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to delete user';
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  }, [selectedUser, closeDrawer, loadUsers]);

  // ── Send notification ──────────────────────────────────
  const handleNotify = useCallback(async () => {
    if (!selectedUser || !notifyTitle.trim() || !notifyBody.trim()) return;
    setActionLoading(true);
    try {
      const result = await sendUserNotification(selectedUser.id, notifyTitle, notifyBody);
      setNotifyResult(result);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to send notification';
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  }, [selectedUser, notifyTitle, notifyBody]);

  // ── Auth loading / guard ───────────────────────────────
  if (authLoading) {
    return (
      <div className={s.page}>
        <div className={s.loadingWrap}>
          <div className={s.spinner} />
        </div>
      </div>
    );
  }

  if (!authUser) return null;

  // ── Pagination helpers ─────────────────────────────────
  const totalPages = data?.totalPages || 1;
  const showingStart = data ? (page - 1) * (data.limit || 25) + 1 : 0;
  const showingEnd = data ? Math.min(page * (data.limit || 25), data.total) : 0;

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className={s.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <header className={s.header}>
        <div className={s.headerLeft}>
          <button className={s.backBtn} onClick={() => router.push('/admin')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className={s.headerTitle}>User Management</div>
            <div className={s.headerSubtitle}>Manage accounts, roles, access and activity</div>
          </div>
        </div>
        <div className={s.headerRight}>
          <Link href="/admin/notifications" className={s.navLinkBtn}>
            <Bell size={15} />
            <span>Broadcast Push</span>
          </Link>
        </div>
      </header>

      <div className={s.content}>
        {/* ── Error Banner ───────────────────────────────── */}
        {error && (
          <div className={s.errorBanner}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* ── Stats Cards ───────────────────────────────── */}
        <div className={s.statsGrid}>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.blue}`}>
              <Users size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.totalUsers) : '—'}</div>
            <div className={s.statLabel}>Total Users</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.green}`}>
              <UserCheck size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.activeToday) : '—'}</div>
            <div className={s.statLabel}>Active Today</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.purple}`}>
              <UserPlus size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.newThisWeek) : '—'}</div>
            <div className={s.statLabel}>New This Week</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.red}`}>
              <ShieldAlert size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.suspendedCount) : '—'}</div>
            <div className={s.statLabel}>Suspended</div>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────── */}
        <div className={s.toolbar}>
          <div className={s.searchWrap}>
            <Search size={16} className={s.searchIcon} />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search users by name, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={s.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | '');
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select
            className={s.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | '');
              setPage(1);
            }}
          >
              <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <select
            className={s.filterSelect}
            value={pushFilter}
            onChange={(e) => {
              setPushFilter(e.target.value as 'android' | 'none' | '');
              setPage(1);
            }}
          >
            <option value="">All Push States</option>
            <option value="android">Android Push</option>
            <option value="none">No Android Push</option>
          </select>
          <select
            className={s.filterSelect}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="-createdAt">Newest First</option>
            <option value="createdAt">Oldest First</option>
            <option value="name">Name A–Z</option>
            <option value="-name">Name Z–A</option>
            <option value="-lastLoginAt">Last Active</option>
          </select>
        </div>

        {/* ── User Table ─────────────────────────────────── */}
        <div className={s.tableCard}>
          {/* Desktop header */}
          <div className={s.tableHeader}>
            <span>User</span>
            <span>Role</span>
            <span>Platform / Push</span>
            <span>Status</span>
            <span>Joined</span>
            <span>Last Active</span>
            <span />
          </div>

          {loading ? (
            <div className={s.loadingWrap}>
              <div className={s.spinner} />
            </div>
          ) : !data || data.users.length === 0 ? (
            <div className={s.emptyState}>
              {debouncedSearch || statusFilter || roleFilter
                ? 'No users match your filters'
                : 'No users found'}
            </div>
          ) : (
            <>
              {data.users.map((u) => (
                <div
                  key={u.id}
                  className={s.tableRow}
                  onClick={() => openDrawer(u.id)}
                >
                  <div className={s.userCell}>
                    <div className={s.avatar}>
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} />
                      ) : (
                        '🐱'
                      )}
                    </div>
                    <div className={s.userInfo}>
                      <div className={s.userName}>{u.name}</div>
                      <div className={s.userEmail}>{u.email}</div>
                    </div>
                  </div>
                  <div>
                    <span className={`${s.roleBadge} ${s[canonicalRole(u.role)]}`}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                  <div className={s.pushCell}>
                    <Smartphone size={15} aria-hidden="true" />
                    <span className={u.push?.androidRegistered ? s.pushEnabled : s.pushUnavailable}>
                      {u.push?.androidRegistered
                        ? `Android Push · ${u.push.activeDeviceCount} device${u.push.activeDeviceCount === 1 ? '' : 's'}`
                        : 'No Android Push'}
                    </span>
                  </div>
                  <div>
                    <span className={`${s.statusDot} ${s[u.status || 'active']}`}>
                      {statusLabel(u.status || 'active')}
                    </span>
                  </div>
                  <div className={s.dateCell}>
                    {formatDate(u.createdAt)}
                  </div>
                  <div className={s.dateCell}>
                    {relativeTime(u.lastLoginAt || u.lastActiveDate)}
                  </div>
                  <div>
                    <button
                      className={s.moreBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDrawer(u.id);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Pagination ───────────────────────────── */}
              <div className={s.pagination}>
                <div className={s.pageInfo}>
                  Showing {showingStart}–{showingEnd} of{' '}
                  {data.total.toLocaleString('en-IN')}
                </div>
                <div className={s.pageButtons}>
                  <button
                    className={s.pageBtn}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className={s.pageBtn} style={{ cursor: 'default', border: 'none' }}>
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`${s.pageBtn} ${p === page ? s.active : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    className={s.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── User Detail Drawer ────────────────────────────── */}
      {(selectedUser || drawerLoading) && (
        <>
          <div className={s.drawerOverlay} onClick={closeDrawer} />
          <div className={s.drawer}>
            <div className={s.drawerHeader}>
              <div className={s.drawerTitle}>User Details</div>
              <button className={s.closeBtn} onClick={closeDrawer}>
                <X size={18} />
              </button>
            </div>

            {drawerLoading ? (
              <div className={s.loadingWrap}>
                <div className={s.spinner} />
              </div>
            ) : selectedUser ? (
              <div className={s.drawerBody}>
                {/* Profile header */}
                <div className={s.profileHeader}>
                  <div className={s.profileAvatar}>
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} />
                    ) : (
                      '🐱'
                    )}
                  </div>
                  <div className={s.profileName}>{selectedUser.name}</div>
                  <div className={s.profileEmail}>{selectedUser.email}</div>
                </div>

                {/* Info section */}
                <div className={s.section}>
                  <div className={s.sectionTitle}>Account</div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Status</span>
                    <span className={`${s.statusDot} ${s[selectedUser.status || 'active']}`}>
                      {statusLabel(selectedUser.status || 'active')}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Role</span>
                    <select
                      className={s.inlineSelect}
                      value={canonicalRole(selectedUser.role)}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      disabled={actionLoading}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Auth Provider</span>
                    <span className={s.detailValue}>
                      {selectedUser.authProvider === 'google' ? '🔵 Google' : '📧 Email'}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Joined</span>
                    <span className={s.detailValue}>{formatDate(selectedUser.createdAt)}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Last Login</span>
                    <span className={s.detailValue}>
                      {relativeTime(selectedUser.lastLoginAt || selectedUser.lastActiveDate)}
                    </span>
                  </div>
                </div>

                <div className={s.section}>
                  <div className={s.sectionTitle}>Notification capability</div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Platform</span>
                    <span className={`${s.detailValue} ${selectedUser.push?.androidRegistered ? s.pushEnabled : s.pushUnavailable}`}>
                      {selectedUser.push?.androidRegistered ? 'Android Push' : 'No Android Push'}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Registered devices</span>
                    <span className={s.detailValue}>{selectedUser.push?.activeDeviceCount || 0}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Last device seen</span>
                    <span className={s.detailValue}>{relativeTime(selectedUser.push?.lastSeenAt || undefined)}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Notification route</span>
                    <span className={s.detailValue}>
                      {selectedUser.push?.androidRegistered ? 'In-app + Android push' : 'In-app only'}
                    </span>
                  </div>
                </div>

                {/* Learning stats */}
                {userStats && (
                  <div className={s.section}>
                    <div className={s.sectionTitle}>Learning</div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Questions attempted</span>
                      <span className={s.statRowValue}>
                        {userStats.questionsAttempted.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Correct answers</span>
                      <span className={s.statRowValue}>
                        {userStats.correctAnswers.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Accuracy</span>
                      <span className={s.statRowValue}>{userStats.accuracy}%</span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Mock tests</span>
                      <span className={s.statRowValue}>{userStats.mockTestsCompleted}</span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Study time</span>
                      <span className={s.statRowValue}>
                        {userStats.studyTimeMinutes > 60
                          ? `${Math.round(userStats.studyTimeMinutes / 60)}h ${userStats.studyTimeMinutes % 60}m`
                          : `${userStats.studyTimeMinutes}m`}
                      </span>
                    </div>

                    {/* Top topics */}
                    {userStats.topTopics.length > 0 && (
                      <>
                        <div
                          className={s.sectionTitle}
                          style={{ marginTop: 16 }}
                        >
                          Top Topics
                        </div>
                        {userStats.topTopics.slice(0, 5).map((t) => (
                          <div className={s.statRow} key={t.topic}>
                            <span className={s.statRowLabel}>{t.topic}</span>
                            <span className={s.statRowValue}>
                              {t.accuracy}% ({t.attempted})
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Exam preferences */}
                {selectedUser.examPreferences && selectedUser.examPreferences.length > 0 && (
                  <div className={s.section}>
                    <div className={s.sectionTitle}>Exam Focus</div>
                    <div className={s.examTags}>
                      {selectedUser.examPreferences.map((exam) => (
                        <span key={exam} className={s.examTag}>
                          {exam.replace(/-/g, ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account actions */}
                <div className={s.section}>
                  <div className={s.sectionTitle}>Actions</div>
                  <div className={s.actions}>
                    <button
                      className={s.actionBtn}
                      onClick={() => { setNotifyResult(null); setShowNotifyModal(true); }}
                    >
                      <Bell size={16} />
                      Send Notification
                    </button>

                    {(selectedUser.status || 'active') === 'active' ? (
                      <button
                        className={`${s.actionBtn} ${s.danger}`}
                        onClick={() => setShowStatusConfirm('suspended')}
                        disabled={actionLoading}
                      >
                        <Ban size={16} />
                        Suspend Account
                      </button>
                    ) : (
                      <button
                        className={s.actionBtn}
                        onClick={() => setShowStatusConfirm('active')}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={16} />
                        Reactivate Account
                      </button>
                    )}

                    {(selectedUser.status || 'active') !== 'banned' && (
                      <button
                        className={`${s.actionBtn} ${s.danger}`}
                        onClick={() => setShowStatusConfirm('banned')}
                        disabled={actionLoading}
                      >
                        <Shield size={16} />
                        Ban Account
                      </button>
                    )}

                    <button
                      className={`${s.actionBtn} ${s.danger}`}
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={actionLoading}
                    >
                      <Trash2 size={16} />
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* ── Notification Modal ────────────────────────────── */}
      {showNotifyModal && selectedUser && (
        <div className={s.modal} onClick={() => { setShowNotifyModal(false); setNotifyResult(null); }}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalTitle}>
              Send Notification to {selectedUser.name}
            </div>
            {!notifyResult && <>
              <div className={s.notifyCapability}>
                <div><CheckCircle size={16} /><span>Notification Center</span></div>
                {selectedUser.push?.androidRegistered ? (
                  <div><CheckCircle size={16} /><span>Android FCM push</span></div>
                ) : (
                  <div className={s.notifyUnavailable}>— Android push unavailable</div>
                )}
              </div>
              <input
                className={s.modalInput}
                placeholder="Title (e.g. Your SSC CGL mock is ready)"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
              />
              <textarea
                className={s.modalInput}
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Body message..."
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
              />
            </>}
            {notifyResult && (
              <div className={s.notifyResult}>
                <div><CheckCircle size={16} /> Notification Center saved</div>
                {notifyResult.sent ? (
                  <div><CheckCircle size={16} /> FCM Accepted: {notifyResult.successCount} Android device{notifyResult.successCount === 1 ? '' : 's'}</div>
                ) : notifyResult.noDevices ? (
                  <div className={s.notifyWarning}>In-app only — no Android device</div>
                ) : notifyResult.suppressed ? (
                  <div className={s.notifyWarning}>Push disabled by user</div>
                ) : (
                  <div className={s.notifyFailed}>FCM Failed</div>
                )}
                {notifyResult.failureCount > 0 && <div className={s.notifyFailed}>Failed: {notifyResult.failureCount}</div>}
                {notifyResult.invalidDeviceCount > 0 && <div className={s.notifyFailed}>Invalid devices: {notifyResult.invalidDeviceCount}</div>}
              </div>
            )}
            <div className={s.modalActions}>
              <button
                className={s.modalBtnSecondary}
                onClick={() => { setShowNotifyModal(false); setNotifyResult(null); }}
              >
                {notifyResult ? 'Close' : 'Cancel'}
              </button>
              {!notifyResult && <button
                className={s.modalBtnPrimary}
                onClick={handleNotify}
                disabled={actionLoading || !notifyTitle.trim() || !notifyBody.trim()}
              >
                {actionLoading ? 'Sending…' : 'Send'}
              </button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Status Confirm Modal ──────────────────────────── */}
      {showStatusConfirm && selectedUser && (
        <div className={s.modal} onClick={() => setShowStatusConfirm(null)}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalTitle}>
              {showStatusConfirm === 'active'
                ? `Reactivate ${selectedUser.name}?`
                : showStatusConfirm === 'banned'
                  ? `Ban ${selectedUser.name}?`
                  : `Suspend ${selectedUser.name}?`}
            </div>
            {showStatusConfirm !== 'active' && (
              <input
                className={s.modalInput}
                placeholder="Reason (optional)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            )}
            <div className={s.modalActions}>
              <button
                className={s.modalBtnSecondary}
                onClick={() => setShowStatusConfirm(null)}
              >
                Cancel
              </button>
              <button
                className={
                  showStatusConfirm === 'active'
                    ? s.modalBtnPrimary
                    : s.modalBtnDanger
                }
                onClick={() => handleStatusChange(showStatusConfirm)}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Processing…'
                  : showStatusConfirm === 'active'
                    ? 'Reactivate'
                    : showStatusConfirm === 'banned'
                      ? 'Ban User'
                      : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────── */}
      {showDeleteConfirm && selectedUser && (
        <div className={s.modal} onClick={() => setShowDeleteConfirm(false)}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalTitle}>
              Delete {selectedUser.name}?
            </div>
            <p style={{ fontSize: 14, color: '#636366', marginBottom: 16 }}>
              This will permanently remove the user account and all associated data.
              This action cannot be undone.
            </p>
            <div className={s.modalActions}>
              <button
                className={s.modalBtnSecondary}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={s.modalBtnDanger}
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
