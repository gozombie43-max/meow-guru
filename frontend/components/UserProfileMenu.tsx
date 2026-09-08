'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPen,
  Settings,
  LayoutDashboard,
  LogOut,
  CheckCircle2,
  Sparkles,
  Shield,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationCenter } from '@/context/NotificationCenterContext';
import GoogleAvatarRing from './GoogleAvatarRing';
import EditProfileModal from './EditProfileModal';
import UserSettingsModal from './UserSettingsModal';
import styles from './UserProfileMenu.module.css';

interface UserProfileMenuProps {
  size?: number;
  className?: string;
  align?: 'right' | 'left' | 'center';
}

function getRoleBadge(role?: string) {
  const r = (role || 'user').toLowerCase();
  switch (r) {
    case 'superadmin':
      return {
        label: 'Super Admin',
        className: styles.roleSuperadmin,
      };
    case 'admin':
      return {
        label: 'Admin',
        className: styles.roleAdmin,
      };
    case 'moderator':
      return {
        label: 'Moderator',
        className: styles.roleModerator,
      };
    case 'student':
      return {
        label: 'Student Member',
        className: styles.roleStudent,
      };
    case 'user':
    default:
      return {
        label: 'User',
        className: styles.roleUser,
      };
  }
}

export default function UserProfileMenu({
  size = 34,
  className = '',
  align = 'right',
}: UserProfileMenuProps) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotificationCenter();
  const router = useRouter();

  const roleInfo = getRoleBadge(user?.role);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [isOpen, setIsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Toast timer
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
      setToastMessage('Logged out successfully 👋');
    } catch {
      // ignore
    }
  };

  const handleOpenEditProfile = () => {
    setIsOpen(false);
    setIsEditProfileOpen(true);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleProfileUpdated = () => {
    setToastMessage('Profile updated successfully! ✨');
  };

  const userInitial = user?.name && user.name.trim().length > 0
    ? user.name.trim().charAt(0).toUpperCase()
    : 'G';

  const popoverAlignStyle = align === 'left'
    ? { left: 0, right: 'auto', transformOrigin: 'top left' }
    : align === 'center'
    ? { left: '50%', right: 'auto', transform: 'translateX(-50%)', transformOrigin: 'top center' }
    : { right: 0, left: 'auto', transformOrigin: 'top right' };

  if (!user) {
    return (
      <Link
        href="/login"
        className={`${styles.loginPillBtn} ${className}`}
        aria-label="Log in"
      >
        LOGIN
      </Link>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      {/* Avatar Button Trigger */}
      <button
        type="button"
        className={styles.avatarTrigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="User profile menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={user ? user.name : 'Account menu'}
      >
        <GoogleAvatarRing
          initial={userInitial}
          avatarUrl={user?.avatar || undefined}
          size={size}
        />
      </button>

      {/* Mini Pop-up Modal / Dropdown */}
      {isOpen && (
        <>
          <div
            className={styles.popoverBackdrop}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className={styles.popover}
            style={popoverAlignStyle}
            role="menu"
            aria-orientation="vertical"
          >
            {user ? (
              <>
                {/* User Info Header */}
                <div className={styles.popoverHeader}>
                  <GoogleAvatarRing
                    initial={userInitial}
                    avatarUrl={user?.avatar || undefined}
                    size={42}
                  />
                  <div className={styles.headerInfo}>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userEmail}>{user.email}</span>
                    <span className={`${styles.roleBadge} ${roleInfo.className}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Actions Menu */}
                <div className={styles.menuList}>
                  {/* Admin Panel (Admin / Superadmin only) */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className={styles.menuItem}
                      onClick={() => setIsOpen(false)}
                      role="menuitem"
                    >
                      <div className={`${styles.menuItemIcon} ${styles.iconPurple}`}>
                        <Shield size={17} />
                      </div>
                      <div className={styles.menuItemText}>
                        <span className={styles.menuItemTitle}>Admin Panel</span>
                        <span className={styles.menuItemSub}>Manage users, tests & broadcast</span>
                      </div>
                    </Link>
                  )}

                  {/* Notifications */}
                  <Link
                    href="/notifications"
                    className={styles.menuItem}
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                  >
                    <div
                      className={`${styles.menuItemIcon} ${styles.iconBlue} ${styles.notificationIcon}`}
                    >
                      <Bell size={17} />
                      {unreadCount > 0 && (
                        <span className={styles.notificationBadge}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <div className={styles.menuItemText}>
                      <span className={styles.menuItemTitle}>Notifications</span>
                      <span className={styles.menuItemSub}>Battles, reminders & updates</span>
                    </div>
                  </Link>

                  {/* Edit Profile */}
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleOpenEditProfile}
                    role="menuitem"
                  >
                    <div className={`${styles.menuItemIcon} ${styles.iconBlue}`}>
                      <UserPen size={17} />
                    </div>
                    <div className={styles.menuItemText}>
                      <span className={styles.menuItemTitle}>Edit Profile</span>
                      <span className={styles.menuItemSub}>Change name & avatar photo</span>
                    </div>
                  </button>

                  {/* Settings */}
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleOpenSettings}
                    role="menuitem"
                  >
                    <div className={`${styles.menuItemIcon} ${styles.iconPurple}`}>
                      <Settings size={17} />
                    </div>
                    <div className={styles.menuItemText}>
                      <span className={styles.menuItemTitle}>Settings</span>
                      <span className={styles.menuItemSub}>Theme, audio & preferences</span>
                    </div>
                  </button>

                  {/* Dashboard */}
                  <Link
                    href="/dashboard"
                    className={styles.menuItem}
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                  >
                    <div className={`${styles.menuItemIcon} ${styles.iconAmber}`}>
                      <LayoutDashboard size={17} />
                    </div>
                    <div className={styles.menuItemText}>
                      <span className={styles.menuItemTitle}>My Dashboard</span>
                      <span className={styles.menuItemSub}>Analytics, notes & streak</span>
                    </div>
                  </Link>

                  <div className={styles.divider} />

                  {/* Log Out */}
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <div className={`${styles.menuItemIcon} ${styles.iconRed}`}>
                      <LogOut size={17} />
                    </div>
                    <div className={styles.menuItemText}>
                      <span className={styles.menuItemTitle}>Log Out</span>
                      <span className={styles.menuItemSub}>Sign out of your session</span>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* Guest Popover */
              <div className={styles.guestBox}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
                  <GoogleAvatarRing initial="G" size={46} />
                </div>
                <h3 className={styles.guestTitle}>Welcome to Study Guru! 👋</h3>
                <p className={styles.guestDesc}>
                  Sign in to save your progress, customize your avatar, and track study milestones.
                </p>
                <div className={styles.guestActions}>
                  <Link
                    href="/login"
                    className={styles.loginBtn}
                    onClick={() => setIsOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className={styles.registerBtn}
                    onClick={() => setIsOpen(false)}
                  >
                    Create Free Account
                  </Link>
                </div>
                <div className={styles.divider} />
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleOpenSettings}
                >
                  <div className={`${styles.menuItemIcon} ${styles.iconPurple}`}>
                    <Settings size={17} />
                  </div>
                  <div className={styles.menuItemText}>
                    <span className={styles.menuItemTitle}>Preferences</span>
                    <span className={styles.menuItemSub}>Theme & sound controls</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Full Dialog Modals */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={handleProfileUpdated}
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Feedback Toast */}
      {toastMessage && (
        <div className={styles.toastSuccess} role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
