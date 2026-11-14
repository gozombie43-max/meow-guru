'use client';

import { forwardRef, useCallback, useRef, useState, type ChangeEvent } from 'react';
import { assignRef } from './FieldFrame';
import { Input, type InputProps } from './Input';
import styles from './Form.module.css';

export interface SearchInputProps extends Omit<InputProps, 'leadingIcon' | 'trailingAction'> {
  onClear?: () => void;
  onValueChange?: (value: string) => void;
  clearLabel?: string;
  shortcutHint?: string;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20L16.2 16.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Canonical search input built on `Input`.
 * Renders a leading search icon, optional desktop-only keyboard shortcut hint, and a `44x44px` clear button when non-empty.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    type = 'search',
    value,
    defaultValue,
    disabled,
    onChange,
    onClear,
    onValueChange,
    clearLabel = 'Clear search',
    shortcutHint,
    ...rest
  },
  forwardedRef,
) {
  const internalRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledHasValue, setUncontrolledHasValue] = useState(() =>
    defaultValue !== undefined ? String(defaultValue).length > 0 : false,
  );

  const isControlled = value !== undefined;
  const hasValue = isControlled ? String(value).length > 0 : uncontrolledHasValue;

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      internalRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setUncontrolledHasValue(event.currentTarget.value.length > 0);
    }
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  const handleClear = () => {
    const input = internalRef.current;
    if (input) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (valueSetter) {
        valueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.value = '';
      }
      input.focus();
    }

    if (!isControlled) {
      setUncontrolledHasValue(false);
    }
    onValueChange?.('');
    onClear?.();
  };

  const trailingAction = hasValue ? (
    <button
      type="button"
      className={styles.clearButton}
      onClick={handleClear}
      disabled={disabled}
      aria-label={clearLabel}
      data-custom-focus="true"
      data-ui-interaction="none"
    >
      <ClearIcon />
    </button>
  ) : shortcutHint ? (
    <kbd className={styles.shortcutHint} aria-hidden="true">
      {shortcutHint}
    </kbd>
  ) : undefined;

  return (
    <Input
      {...rest}
      ref={setRefs}
      type={type}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onChange={handleChange}
      leadingIcon={<SearchIcon />}
      trailingAction={trailingAction}
    />
  );
});
