'use client';

import React, { useMemo } from 'react';
import styles from './auth.module.css';

interface PasswordStrengthBarProps {
  password?: string;
}

export default function PasswordStrengthBar({ password = '' }: PasswordStrengthBarProps) {
  const strength = useMemo(() => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 9 && /[0-9]/.test(password)) score += 1;
    if (/[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', class: styles.strengthStatusWeak };
    if (score === 2) return { score: 2, label: 'Fair', class: styles.strengthStatusMedium };
    return { score: 3, label: 'Strong', class: styles.strengthStatusStrong };
  }, [password]);

  if (!strength) return null;

  return (
    <div className={styles.strengthContainer}>
      <div className={styles.strengthSegments}>
        <div
          className={`${styles.strengthSegment} ${
            strength.score >= 1
              ? strength.score === 1
                ? styles.strengthSegmentWeak
                : strength.score === 2
                ? styles.strengthSegmentMedium
                : styles.strengthSegmentStrong
              : ''
          }`}
        />
        <div
          className={`${styles.strengthSegment} ${
            strength.score >= 2
              ? strength.score === 2
                ? styles.strengthSegmentMedium
                : styles.strengthSegmentStrong
              : ''
          }`}
        />
        <div
          className={`${styles.strengthSegment} ${
            strength.score >= 3 ? styles.strengthSegmentStrong : ''
          }`}
        />
      </div>
      <div className={styles.strengthLabel}>
        <span>Security</span>
        <span className={strength.class}>{strength.label}</span>
      </div>
    </div>
  );
}
