'use client';

import { useEffect, useState } from 'react';

import { useStudentPresence } from '@/context/StudentPresenceContext';
import { formatLastSeen, formatOnlineCount } from '@/lib/student-presence';
import styles from './StudentActivity.module.css';

function getDisplayName(data: unknown) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'displayName' in data &&
    typeof data.displayName === 'string' &&
    data.displayName.trim()
  ) {
    return data.displayName.trim();
  }

  return 'Meow student';
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'S';
}

export default function StudentActivity() {
  const { enabled, currentUserId, users, onlineSummary } = useStudentPresence();
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!enabled) {
    return null;
  }

  const onlineCount = onlineSummary
    ? formatOnlineCount(onlineSummary.count, onlineSummary.capped)
    : '—';
  const studentLabel =
    onlineSummary?.count === 1 && !onlineSummary.capped
      ? 'student online now'
      : 'students online now';

  return (
    <section className={styles.card} aria-labelledby="student-activity-heading">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <p className={styles.eyebrow}>LIVE COMMUNITY</p>
          <h2 id="student-activity-heading">Student activity</h2>
        </div>
        <div className={styles.onlineSummary} aria-live="polite">
          <span className={styles.onlineDot} aria-hidden="true" />
          <span>
            {onlineSummary ? `${onlineCount} ${studentLabel}` : 'Connecting…'}
          </span>
        </div>
      </header>

      {users.length === 0 ? (
        <p className={styles.empty}>
          {onlineSummary ? 'No recent student activity yet.' : 'Loading student activity…'}
        </p>
      ) : (
        <ul className={styles.list}>
          {users.slice(0, 6).map((entry) => {
            const displayName = getDisplayName(entry.data);
            const isCurrentUser = entry.userId === currentUserId;

            return (
              <li className={styles.row} key={entry.userId}>
                <span className={styles.avatar} aria-hidden="true">
                  {getInitials(displayName)}
                </span>
                <span className={styles.userDetails}>
                  <span className={styles.name}>
                    {isCurrentUser ? 'You' : displayName}
                  </span>
                  <span className={entry.online ? styles.onlineStatus : styles.lastSeen}>
                    {entry.online
                      ? 'Online'
                      : formatLastSeen(entry.lastDisconnected, now || Date.now())}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.footnote}>
        Visible to signed-in students. Online status follows active Meow sessions.
      </p>
    </section>
  );
}
