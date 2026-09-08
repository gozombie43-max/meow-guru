'use client';

import React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotificationCenter } from '@/context/NotificationCenterContext';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  size?: number;
  iconSize?: number;
  className?: string;
}

export default function NotificationBell({
  size = 34,
  iconSize = 18,
  className = '',
}: NotificationBellProps) {
  const { unreadCount } = useNotificationCenter();

  return (
    <Link
      href="/notifications"
      className={`${styles.bellButton} ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : 'Notifications'
      }
      title="Notifications"
    >
      <Bell size={iconSize} className={styles.bellIcon} />
      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
