'use client';

import React from 'react';
import styles from './MacTrafficLights.module.css';

interface MacTrafficLightsProps {
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export default function MacTrafficLights({
  className = '',
  onClose,
  onMinimize,
  onMaximize,
}: MacTrafficLightsProps) {
  return (
    <div className={`${styles.trafficLights} ${className}`} aria-hidden="true">
      <span
        className={`${styles.dot} ${styles.close}`}
        onClick={onClose}
        title="Close"
      >
        <svg viewBox="0 0 12 12" className={styles.icon}>
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className={`${styles.dot} ${styles.minimize}`}
        onClick={onMinimize}
        title="Minimize"
      >
        <svg viewBox="0 0 12 12" className={styles.icon}>
          <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className={`${styles.dot} ${styles.maximize}`}
        onClick={onMaximize}
        title="Maximize"
      >
        <svg viewBox="0 0 12 12" className={styles.icon}>
          <path d="M3 8.5l5.5-5.5M8.5 7V3H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
