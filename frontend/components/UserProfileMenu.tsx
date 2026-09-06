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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleAvatarRing from './GoogleAvatarRing';
import EditProfileModal from './EditProfileModal';
import UserSettingsModal from './UserSettingsModal';
import styles from './UserProfileMenu.module.css';

interface UserProfileMenuProps {
  size?: number;
  className?: string;
  align?: 'right' | 'left' | 'center';
}

export default function UserProfileMenu({
  size = 34,
  className = '',
  align = 'right',
}: UserProfileMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

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
                    <span className={styles.roleBadge}>Student Member</span>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Actions Menu */}
                <div className={styles.menuList}>
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
