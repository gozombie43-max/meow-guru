'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Bell, ChevronRight, LayoutDashboard, LogOut, Pencil, Settings, Shield, Swords } from 'lucide-react';
import GoogleAvatarRing from '@/components/GoogleAvatarRing';
import { useAuth } from '@/context/AuthContext';
import { useNotificationCenter } from '@/context/NotificationCenterContext';
import styles from './profile.module.css';

const EditProfileModal = dynamic(() => import('@/components/EditProfileModal'));
const UserSettingsModal = dynamic(() => import('@/components/UserSettingsModal'));

export default function ProfileClient() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { unreadCount } = useNotificationCenter();
  const [panel, setPanel] = useState<'edit' | 'settings' | null>(null);
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const closePanel = () => setPanel(null);
  const handleLogout = async () => {
    setSigningOut(true);
    setMessage('');
    try {
      await logout();
    } catch {
      setMessage('Unable to log out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) return <main className={styles.page}><h1>Profile</h1><p role="status">Loading your profile…</p></main>;
  if (!user) return null;

  const attempted = Object.values(user.progress || {}).reduce((sum, item) => sum + (item.attempted || 0), 0);
  const correct = Object.values(user.progress || {}).reduce((sum, item) => sum + (item.correct || 0), 0);
  const accuracy = attempted ? `${Math.round(correct / attempted * 100)}%` : '—';
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
      <h1>Profile</h1>
      <section className={styles.identity} aria-label="Your account">
        <GoogleAvatarRing initial={user.name?.trim().charAt(0).toUpperCase() || 'U'} avatarUrl={user.avatar || undefined} size={48} />
        <div className={styles.identityDetails}>
          <h2>{user.name}</h2>
          <p title={user.email}>{user.email}</p>
        </div>
        <button type="button" data-ui-button="icon" aria-label="Edit profile" title="Edit profile" className={styles.edit} onClick={() => { setMessage(''); setPanel('edit'); }}><Pencil size={18} aria-hidden="true" /></button>
      </section>
      </header>

      <div className={styles.scrollContent}>
      <dl className={styles.stats} aria-label="Study statistics">
        <div><dt>Attempted</dt><dd>{attempted.toLocaleString()}</dd></div>
        <div><dt>Accuracy</dt><dd>{accuracy}</dd></div>
        <div><dt>Saved</dt><dd>{(user.bookmarks?.length || 0).toLocaleString()}</dd></div>
      </dl>

      <div className={styles.group} aria-label="Account settings">
        <button type="button" data-ui-button="state" className={styles.row} onClick={() => setPanel('settings')}><span className={styles.icon}><Settings /></span><span>Preferences & reminders</span><ChevronRight /></button>
        <Link href="/notifications" className={styles.row}><span className={styles.icon}><Bell /></span><span>Notifications</span>{unreadCount > 0 && <span className={styles.badge} aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}<ChevronRight /></Link>
        {isAdmin && <Link href="/admincontrol" className={styles.row}><span className={styles.icon}><Shield /></span><span>Admin Panel</span><ChevronRight /></Link>}
      </div>

      <nav className={styles.group} aria-label="Your learning">
        <Link href="/dashboard" className={styles.row}><span className={styles.icon}><LayoutDashboard /></span><span>My dashboard</span><ChevronRight /></Link>
        <Link href="/battle/profile" className={styles.row}><span className={styles.icon}><Swords /></span><span>Battle profile & rewards</span><ChevronRight /></Link>
      </nav>

      <div className={styles.group}>
        <button type="button" data-ui-button="state" className={`${styles.row} ${styles.logout}`} disabled={signingOut} onClick={() => void handleLogout()}><span className={styles.icon}><LogOut /></span><span>{signingOut ? 'Logging out…' : 'Log out'}</span></button>
      </div>
      {message && <p role="status" className={styles.message}>{message}</p>}
      </div>
      {panel === 'edit' && <EditProfileModal isOpen onClose={closePanel} onSuccess={() => setMessage('Profile updated successfully.')} />}
      {panel === 'settings' && <UserSettingsModal isOpen onClose={closePanel} />}
    </main>
  );
}
