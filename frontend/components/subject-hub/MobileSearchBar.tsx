"use client";

import { Search, X } from "lucide-react";
import React, { useRef } from "react";
import styles from "./MobileSearchBar.module.css";

export interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onClear?: () => void;
  autoFocus?: boolean;
}

export function MobileSearchBar({
  value,
  onChange,
  placeholder = "Search topics",
  ariaLabel = "Search topics",
  className,
  inputRef,
  onClear,
  autoFocus,
}: MobileSearchBarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const activeInputRef = inputRef || internalRef;

  React.useEffect(() => {
    if (autoFocus) {
      activeInputRef.current?.focus();
    }
  }, [autoFocus, activeInputRef]);

  const handleClear = () => {
    onChange("");
    onClear?.();
    activeInputRef.current?.focus();
  };

  return (
    <div
      role="search"
      data-hub-part="mobileSearchRow"
      className={`${styles.searchRow} ${className || ""}`}
    >
      <Search className={styles.searchIcon} size={15} aria-hidden="true" />
      <input
        ref={activeInputRef as React.RefObject<HTMLInputElement>}
        type="search"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        data-custom-focus
        data-mobile-chapter-search
        enterKeyHint="search"
        className={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      {value ? (
        <div className={styles.searchActions}>
          <button
            type="button"
            data-custom-focus
            data-ui-interaction="none"
            className={styles.clearBtn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            aria-label="Clear Search"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default MobileSearchBar;
