import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: styles.variantNeutral,
  accent: styles.variantAccent,
  success: styles.variantSuccess,
  warning: styles.variantWarning,
  error: styles.variantError,
  info: styles.variantInfo,
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

/** WCAG AA status and category badge backed cleanly by canonical semantic `-soft` tokens. */
export function Badge({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      {...rest}
      data-meow-component="badge"
      data-meow-variant={variant}
      data-meow-size={size}
      className={cn(styles.badge, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className)}
    >
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
