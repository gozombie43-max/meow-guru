'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { FieldFrame } from './FieldFrame';
import styles from './Form.module.css';

export interface BaseTextFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
}

export interface InputProps
  extends BaseTextFieldProps,
    InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
  shellClassName?: string;
}

export interface TextareaProps
  extends BaseTextFieldProps,
    TextareaHTMLAttributes<HTMLTextAreaElement> {
  resize?: 'none' | 'vertical' | 'both';
  shellClassName?: string;
}

/**
 * Canonical single-line text input primitive.
 * Enforces `44px` minimum height, `>= 16px` font-size on mobile/coarse pointers,
 * explicit label/error/hint wiring, and `--meow-*` contrast-safe colors.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    leadingIcon,
    trailingAction,
    fullWidth = true,
    required,
    disabled,
    className,
    containerClassName,
    shellClassName,
    'aria-describedby': externalDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const hasLeading = leadingIcon !== undefined && leadingIcon !== null && leadingIcon !== false;
  const hasTrailing =
    trailingAction !== undefined && trailingAction !== null && trailingAction !== false;

  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      externalDescribedBy={externalDescribedBy}
      containerClassName={containerClassName}
    >
      {({ controlId, describedBy, hasError }) => (
        <div
          className={cn(
            styles.controlShell,
            hasError && styles.controlShellError,
            disabled && styles.controlShellDisabled,
            shellClassName,
          )}
        >
          {hasLeading ? (
            <span className={styles.leadingIcon} aria-hidden="true">
              {leadingIcon}
            </span>
          ) : null}

          <input
            {...rest}
            ref={ref}
            id={controlId}
            required={required}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={hasError ? true : ariaInvalid}
            data-custom-focus="true"
            data-ui-interaction="none"
            className={cn(
              styles.input,
              hasLeading && styles.inputWithLeading,
              hasTrailing && styles.inputWithTrailing,
              className,
            )}
          />

          {hasTrailing ? <div className={styles.trailingSlot}>{trailingAction}</div> : null}
        </div>
      )}
    </FieldFrame>
  );
});

/**
 * Canonical multi-line textarea primitive sharing `Input` validation, focus, and mobile typography contracts.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    hint,
    error,
    fullWidth = true,
    resize = 'vertical',
    rows = 3,
    required,
    disabled,
    className,
    containerClassName,
    shellClassName,
    'aria-describedby': externalDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      externalDescribedBy={externalDescribedBy}
      containerClassName={containerClassName}
    >
      {({ controlId, describedBy, hasError }) => (
        <div
          className={cn(
            styles.controlShell,
            styles.textareaShell,
            hasError && styles.controlShellError,
            disabled && styles.controlShellDisabled,
            shellClassName,
          )}
        >
          <textarea
            {...rest}
            ref={ref}
            id={controlId}
            rows={rows}
            required={required}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={hasError ? true : ariaInvalid}
            data-custom-focus="true"
            data-ui-interaction="none"
            className={cn(
              styles.textarea,
              resize === 'none' && styles.textareaResizeNone,
              resize === 'both' && styles.textareaResizeBoth,
              className,
            )}
          />
        </div>
      )}
    </FieldFrame>
  );
});
