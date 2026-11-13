'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { assignRef } from './FieldFrame';
import styles from './Form.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  indeterminate?: boolean;
  fullWidth?: boolean;
  containerClassName?: string;
}

/**
 * Canonical checkbox primitive backed by native `<input type="checkbox">`.
 * Guarantees a minimum `44x44px` hit target around the `20x20px` visual indicator.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    id,
    label,
    description,
    error,
    indeterminate = false,
    disabled,
    fullWidth = false,
    className,
    containerClassName,
    'aria-describedby': externalDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  forwardedRef,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = `${controlId}-desc`;
  const errorId = `${controlId}-error`;
  const internalRef = useRef<HTMLInputElement | null>(null);

  const hasLabel = label !== undefined && label !== null && label !== false;
  const hasDescription =
    description !== undefined && description !== null && description !== false;
  const hasError = error !== undefined && error !== null && error !== false;

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      internalRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const describedByParts = [
    externalDescribedBy,
    hasError ? errorId : undefined,
    hasDescription ? descriptionId : undefined,
  ].filter(Boolean);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  return (
    <div className={cn(styles.choiceGroup, fullWidth && styles.choiceGroupFull, containerClassName)}>
      <div
        className={cn(
          styles.choiceRow,
          fullWidth && styles.choiceRowBetween,
          disabled && styles.choiceRowDisabled,
        )}
      >
        <span className={cn(styles.checkboxHitBox, hasError && styles.checkboxError)}>
          <input
            {...rest}
            ref={setRefs}
            id={controlId}
            type="checkbox"
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={hasError ? true : ariaInvalid}
            data-custom-focus="true"
            data-ui-interaction="none"
            className={cn(styles.checkboxNative, className)}
          />
          <span className={styles.checkboxIndicator} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                className={styles.checkGlyph}
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className={styles.mixedGlyph}
                d="M3.5 8H12.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>

        {hasLabel || hasDescription ? (
          <div className={styles.choiceText}>
            {hasLabel ? (
              <label
                htmlFor={controlId}
                className={cn(styles.choiceLabel, disabled && styles.choiceLabelDisabled)}
              >
                {label}
              </label>
            ) : null}
            {hasDescription ? (
              <span
                id={descriptionId}
                className={cn(styles.choiceDescription, disabled && styles.choiceLabelDisabled)}
              >
                {description}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasError ? (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
