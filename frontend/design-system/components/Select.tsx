'use client';

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { FieldFrame } from './FieldFrame';
import styles from './Form.module.css';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options?: readonly SelectOption[];
  placeholder?: string;
  leadingIcon?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
  shellClassName?: string;
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Canonical styled native `<select>` primitive.
 * Guarantees a `44px` trigger height, `>= 16px` font-size on mobile/coarse pointers,
 * dark/light readable `<option>` surface, and full keyboard/screen-reader semantics.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    hint,
    error,
    options,
    placeholder,
    leadingIcon,
    fullWidth = true,
    required,
    disabled,
    value,
    defaultValue,
    className,
    containerClassName,
    shellClassName,
    children,
    'aria-describedby': externalDescribedBy,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const hasLeading = leadingIcon !== undefined && leadingIcon !== null && leadingIcon !== false;
  const resolvedDefaultValue =
    value === undefined && defaultValue === undefined && placeholder !== undefined
      ? ''
      : defaultValue;
  const isShowingPlaceholder =
    placeholder !== undefined && (value !== undefined ? value === '' : false);

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

          <select
            {...rest}
            ref={ref}
            id={controlId}
            value={value}
            defaultValue={resolvedDefaultValue}
            required={required}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={hasError ? true : ariaInvalid}
            data-custom-focus="true"
            data-ui-interaction="none"
            className={cn(
              styles.select,
              hasLeading && styles.selectWithLeading,
              isShowingPlaceholder && styles.selectPlaceholder,
              className,
            )}
          >
            {placeholder !== undefined ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options
              ? options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>

          <span className={styles.selectChevron} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </div>
      )}
    </FieldFrame>
  );
});
