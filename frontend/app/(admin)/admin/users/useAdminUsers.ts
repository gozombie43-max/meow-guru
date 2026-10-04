"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminDashboardStats, fetchAdminUsers, fetchAdminUser, fetchAdminUserStats, updateUserRole, updateUserStatus, deleteAdminUser, sendUserNotification } from '@/lib/api/adminApi';
import type { AdminUser, AdminUserStats, AdminUsersResponse, AdminDashboardStats, UserRole, UserStatus, AdminUsersQueryParams } from '@/types/admin';

export function useAdminUsers() {
const { user: authUser, loading: authLoading } = useAuth();
const router = useRouter();
const [stats, setStats] = useState<AdminDashboardStats | null>(null);
const [data, setData] = useState<AdminUsersResponse | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
const [pushFilter, setPushFilter] = useState<'android' | 'none' | ''>('');
const [sort, setSort] = useState('-createdAt');
const [page, setPage] = useState(1);
const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
const [drawerLoading, setDrawerLoading] = useState(false);
const [showNotifyModal, setShowNotifyModal] = useState(false);
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [showStatusConfirm, setShowStatusConfirm] = useState<UserStatus | null>(null);
const [actionLoading, setActionLoading] = useState(false);
const [notifyTitle, setNotifyTitle] = useState('');
const [notifyBody, setNotifyBody] = useState('');
const [notifyResult, setNotifyResult] = useState<Awaited<ReturnType<typeof sendUserNotification>> | null>(null);
const [statusReason, setStatusReason] = useState('');
const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [debouncedSearch, setDebouncedSearch] = useState('');
useEffect(() => {
    if (!authLoading && !authUser) {
      router.replace('/login');
    }
  }, [authUser, authLoading, router]);
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
useEffect(() => {
    if (!authUser) return;
    fetchAdminDashboardStats()
      .then(setStats)
      .catch((err) => console.error('Stats fetch error:', err));
  }, [authUser]);
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
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [authUser, loadUsers]);
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
return { authUser, authLoading, router, stats, setStats, data, setData, loading, setLoading, error, setError, search, setSearch, statusFilter, setStatusFilter, roleFilter, setRoleFilter, pushFilter, setPushFilter, sort, setSort, page, setPage, selectedUser, setSelectedUser, userStats, setUserStats, drawerLoading, setDrawerLoading, showNotifyModal, setShowNotifyModal, showDeleteConfirm, setShowDeleteConfirm, showStatusConfirm, setShowStatusConfirm, actionLoading, setActionLoading, notifyTitle, setNotifyTitle, notifyBody, setNotifyBody, notifyResult, setNotifyResult, statusReason, setStatusReason, searchTimerRef, debouncedSearch, setDebouncedSearch, loadUsers, openDrawer, closeDrawer, handleRoleChange, handleStatusChange, handleDelete, handleNotify, totalPages, showingStart, showingEnd, getPageNumbers };
}
export type AdminUsersView = ReturnType<typeof useAdminUsers>;
