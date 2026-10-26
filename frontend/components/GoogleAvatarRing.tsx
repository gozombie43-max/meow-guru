import React from 'react';
import styles from './GoogleAvatarRing.module.css';

interface GoogleAvatarRingProps {
  initial?: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}

export default function GoogleAvatarRing({
  initial = 'G',
  avatarUrl,
  size = 40,
  className = '',
}: GoogleAvatarRingProps) {
  return (
    <div
      className={`${styles.container} ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      aria-hidden="true"
    >
      <div className={styles.innerBadge}>
        {avatarUrl ? (
          <span
            className={styles.avatarImg}
            style={{ backgroundImage: `url("${avatarUrl}")` }}
          />
        ) : (
          <span className={styles.initialText}>{initial}</span>
        )}
      </div>
    </div>
  );
}
