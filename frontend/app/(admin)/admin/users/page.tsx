"use client";

import Link from 'next/link';

import { ChevronLeft, Bell } from 'lucide-react';
import s from './AdminUsersPage.module.css';
import { useAdminUsers } from './useAdminUsers';
import { AdminUsersTable } from './AdminUsersTable';
import { AdminUserDetails } from './AdminUserDetails';
import { AdminUserNotificationDialog } from './AdminUserNotificationDialog';
import { AdminUserStatusDialog } from './AdminUserStatusDialog';
import { AdminUserDeleteDialog } from './AdminUserDeleteDialog';
export default function AdminUsersPage() {
 const view = useAdminUsers();
 const { authUser, authLoading, router } = view;
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
return (
    <div className={s.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <header data-ui-chrome="header" className={s.header}>
        <div className={s.headerLeft}>
          <button data-ui-button="icon" className={s.backBtn} onClick={() => router.replace('/admin')}>
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

      <AdminUsersTable view={view} />

      {/* ── User Detail Drawer ────────────────────────────── */}
      <AdminUserDetails view={view} />

      {/* ── Notification Modal ────────────────────────────── */}
      <AdminUserNotificationDialog view={view} />

      {/* ── Status Confirm Modal ──────────────────────────── */}
      <AdminUserStatusDialog view={view} />

      {/* ── Delete Confirm Modal ──────────────────────────── */}
      <AdminUserDeleteDialog view={view} />
    </div>
  );
}
