'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Button.module.css';
import { Spinner, type SpinnerTone } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type DestructiveTone = 'solid' | 'subtle';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  destructiveTone?: DestructiveTone;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

function resolveUiButtonAttr(
  variant: ButtonVariant,
  size: ButtonSize,
  destructiveTone: DestructiveTone,
): 'primary' | 'secondary' | 'danger' | 'icon' | 'state' {
  if (size === 'icon' && variant === 'secondary') return 'icon';
  if (variant === 'primary') return 'primary';
  if (variant === 'secondary') return 'secondary';
  if (variant === 'destructive') return destructiveTone === 'solid' ? 'danger' : 'state';
  return 'state';
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
};

/**
 * Canonical Meow action button primitive.
 * - Uses `--meow-action-fill` (`#2563EB`) for primary fills (>= 5.17:1 with white ink).
 * - Stamps `data-ui-button` for legacy interface contract compliance while scoping
 *   `--ui-*` variables directly onto the control so un-migrated pages remain isolated.
 * - Preserves rendered button width during `loading`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    destructiveTone = 'solid',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    type = 'button',
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);
  const uiButton = resolveUiButtonAttr(variant, size, destructiveTone);
  const uiShape = size === 'icon' && uiButton !== 'icon' ? 'icon' : undefined;

  const variantClass =
    variant === 'primary'
      ? styles.variantPrimary
      : variant === 'secondary'
        ? styles.variantSecondary
        : variant === 'ghost'
          ? styles.variantGhost
          : destructiveTone === 'solid'
            ? styles.variantDestructiveSolid
            : styles.variantDestructiveSubtle;

  const spinnerTone: SpinnerTone =
    variant === 'primary' || (variant === 'destructive' && destructiveTone === 'solid')
      ? 'on-accent'
      : 'inherit';

  return (
    <button
      data-meow-component="button"
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      data-ui-button={uiButton}
      data-ui-shape={uiShape}
      data-custom-focus="true"
      data-meow-variant={variant}
      data-meow-size={size}
      data-meow-motion="button"
      className={cn(
        styles.button,
        variantClass,
        SIZE_CLASSES[size],
        fullWidth && styles.fullWidth,
        className,
      )}
    >
      <span className={cn(styles.content, loading && styles.contentHidden)}>
        {leftIcon ? <span className={styles.iconSlot} aria-hidden="true">{leftIcon}</span> : null}
        {children}
        {rightIcon ? <span className={styles.iconSlot} aria-hidden="true">{rightIcon}</span> : null}
      </span>
      {loading ? (
        <span className={styles.spinnerOverlay}>
          <Spinner size="sm" tone={spinnerTone} />
        </span>
      ) : null}
    </button>
  );
});
