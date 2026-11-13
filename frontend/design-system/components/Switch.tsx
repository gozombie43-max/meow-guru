'use client';

import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import styles from './Form.module.css';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'role' | 'aria-checked'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  labelPosition?: 'start' | 'end';
  fullWidth?: boolean;
  name?: string;
  value?: string;
  containerClassName?: string;
}

/**
 * Canonical switch toggle using `<button role="switch" aria-checked>`.
 * Preserves a `44x44px` hit box around the `44x26px` track and bypasses legacy `[data-ui-button]` overrides.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    id,
    checked,
    defaultChecked = false,
    onCheckedChange,
    label,
    description,
    error,
    disabled,
    labelPosition = 'end',
    fullWidth = false,
    name,
    value = 'on',
    onClick,
    className,
    containerClassName,
    'aria-describedby': externalDescribedBy,
    'aria-labelledby': externalLabelledBy,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-desc`;
  const errorId = `${controlId}-error`;

  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : uncontrolledChecked;

  const hasLabel = label !== undefined && label !== null && label !== false;
  const hasDescription =
    description !== undefined && description !== null && description !== false;
  const hasError = error !== undefined && error !== null && error !== false;

  const describedByParts = [
    externalDescribedBy,
    hasError ? errorId : undefined,
    hasDescription ? descriptionId : undefined,
  ].filter(Boolean);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) {
      return;
    }
    const next = !isChecked;
    if (!isControlled) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  const labelElement =
    hasLabel || hasDescription ? (
      <div className={styles.choiceText}>
        {hasLabel ? (
          <label
            id={labelId}
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
    ) : null;

  const switchControl = (
    <button
      {...rest}
      ref={ref}
      id={controlId}
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-labelledby={externalLabelledBy ?? (hasLabel ? labelId : undefined)}
      aria-describedby={describedBy}
      aria-invalid={hasError ? true : undefined}
      disabled={disabled}
      onClick={handleClick}
      data-custom-focus="true"
      data-ui-interaction="none"
      className={cn(styles.switchButton, className)}
    >
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </button>
  );

  return (
    <div className={cn(styles.choiceGroup, fullWidth && styles.choiceGroupFull, containerClassName)}>
      <div
        className={cn(
          styles.choiceRow,
          (fullWidth || labelPosition === 'start') && styles.choiceRowBetween,
          disabled && styles.choiceRowDisabled,
        )}
      >
        {labelPosition === 'start' ? (
          <>
            {labelElement}
            {switchControl}
          </>
        ) : (
          <>
            {switchControl}
            {labelElement}
          </>
        )}
      </div>

      {name ? (
        <input type="hidden" name={name} value={value} disabled={disabled || !isChecked} />
      ) : null}

      {hasError ? (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
