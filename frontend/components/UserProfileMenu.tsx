'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import GoogleAvatarRing from './GoogleAvatarRing';
import styles from './UserProfileMenu.module.css';

interface UserProfileMenuProps {
  size?: number;
  className?: string;
  align?: 'right' | 'left' | 'center';
}

/** Shared header avatar: account actions live on the Profile page. */
export default function UserProfileMenu({ size = 34, className = '' }: UserProfileMenuProps) {
  const { user } = useAuth();
  if (!user) return <Link href="/login" className={`${styles.loginPillBtn} ${className}`} aria-label="Log in">LOGIN</Link>;
  return (
    <Link href="/profile" className={`${styles.avatarTrigger} ${className}`} aria-label="Your profile" title={user.name}>
      <GoogleAvatarRing initial={user.name?.trim().charAt(0).toUpperCase() || 'U'} avatarUrl={user.avatar || undefined} size={size} />
    </Link>
  );
}
