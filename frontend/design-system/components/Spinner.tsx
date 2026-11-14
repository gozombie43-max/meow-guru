import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerTone = 'inherit' | 'accent' | 'secondary' | 'on-accent';

export type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  /** Accessible status label when rendered standalone; omit inside loading buttons. */
  label?: string;
};

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

const TONE_CLASSES: Record<SpinnerTone, string> = {
  inherit: styles.toneInherit,
  accent: styles.toneAccent,
  secondary: styles.toneSecondary,
  'on-accent': styles.toneOnAccent,
};

/** Standardized loading indicator backed by canonical `--meow-icon-*` sizing and `meow-spin`. */
export function Spinner({
  size = 'md',
  tone = 'inherit',
  label,
  className,
  ...rest
}: SpinnerProps) {
  const isStandalone = Boolean(label);

  return (
    <span
      {...rest}
      role={isStandalone ? 'status' : rest.role}
      aria-live={isStandalone ? 'polite' : rest['aria-live']}
      aria-hidden={isStandalone ? undefined : true}
      data-meow-component="spinner"
      data-meow-size={size}
      data-meow-motion="spin"
      className={cn(styles.spinner, SIZE_CLASSES[size], TONE_CLASSES[tone], className)}
    >
      <svg
        className={styles.svg}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className={styles.track}
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          className={styles.arc}
          d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {isStandalone ? <span className={styles.srOnly}>{label}</span> : null}
    </span>
  );
}
