'use client';

import { useId, type ForwardedRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Form.module.css';

export function assignRef<T>(ref: ForwardedRef<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export interface FieldFrameRenderProps {
  controlId: string;
  describedBy: string | undefined;
  hasError: boolean;
}

export interface FieldFrameProps {
  id?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  externalDescribedBy?: string;
  containerClassName?: string;
  children: (props: FieldFrameRenderProps) => ReactNode;
}

/**
 * Shared accessible field chrome for `Input`, `Textarea`, `SearchInput`, and `Select`.
 * Wires explicit `<label htmlFor>`, `aria-describedby` (hint + error), and disabled/error tokens.
 */
export function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  disabled,
  fullWidth = true,
  externalDescribedBy,
  containerClassName,
  children,
}: FieldFrameProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  const hasLabel = label !== undefined && label !== null && label !== false;
  const hasHint = hint !== undefined && hint !== null && hint !== false;
  const hasError = error !== undefined && error !== null && error !== false;

  const describedByParts = [
    externalDescribedBy,
    hasError ? errorId : undefined,
    hasHint ? hintId : undefined,
  ].filter(Boolean);

  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  return (
    <div className={cn(styles.field, !fullWidth && styles.fieldInline, containerClassName)}>
      {hasLabel ? (
        <label
          htmlFor={controlId}
          className={cn(styles.label, disabled && styles.labelDisabled)}
        >
          <span>{label}</span>
          {required ? (
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children({ controlId, describedBy, hasError })}

      {hasError ? (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      {hasHint ? (
        <p id={hintId} className={cn(styles.hint, disabled && styles.labelDisabled)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
