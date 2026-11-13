'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastRegionProps = HTMLAttributes<HTMLDivElement>;

export type ToastProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  message: ReactNode;
  tone?: ToastTone;
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: styles.toneSuccess,
  error: styles.toneError,
  info: styles.toneInfo,
  warning: styles.toneWarning,
};

/** Accessible fixed live-region host respecting safe-area & BottomNav bottom clearance. */
export function ToastRegion({ className, children, ...rest }: ToastRegionProps) {
  return (
    <div
      {...rest}
      aria-live={rest['aria-live'] ?? 'polite'}
      aria-atomic={rest['aria-atomic'] ?? 'true'}
      data-meow-component="toast-region"
      className={cn(styles.region, className)}
    >
      {children}
    </div>
  );
}

/**
 * Canonical Meow status toast backed by `--meow-surface`, `--meow-text`,
 * `--meow-font-sans` (eliminating legacy `Nunito Sans`), and semantic accent stripes.
 */
export function Toast({
  message,
  tone = 'info',
  role = 'status',
  className,
  ...rest
}: ToastProps) {
  return (
    <div
      {...rest}
      role={role}
      data-meow-component="toast"
      data-meow-tone={tone}
      data-meow-motion="toast"
      className={cn(styles.toast, TONE_CLASSES[tone], className)}
    >
      <span className={styles.indicator} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
    </div>
  );
}
