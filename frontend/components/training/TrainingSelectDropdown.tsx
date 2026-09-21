"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useThemeMode } from "@/hooks/useTheme";
import "./training-select-dropdown.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface TrainingSelectDropdownProps {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placement?: "auto" | "top" | "bottom";
}

export function TrainingSelectDropdown({
  label,
  value,
  options,
  placeholder = "Select…",
  onChange,
  disabled = false,
  placement: preferredPlacement = "auto",
}: TrainingSelectDropdownProps) {
  const { theme } = useThemeMode();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isDark = theme === "dark";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const handleOpen = useCallback(() => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setFocused(idx >= 0 ? idx : 0);

    if (preferredPlacement === "auto") {
      if (triggerRef.current) {
        // Measure against scroll parent or viewport
        const scrollParent =
          triggerRef.current.closest(".training-setup-scroll") ||
          document.documentElement;
        const scrollRect = scrollParent.getBoundingClientRect();
        const triggerRect = triggerRef.current.getBoundingClientRect();

        const spaceBelowInContainer = scrollRect.bottom - triggerRect.bottom;
        const spaceAboveInContainer = triggerRect.top - scrollRect.top;
        const approxHeight = Math.min(options.length * 44 + 14, 230);

        // If bottom space in container is tight, pop upwards
        if (spaceBelowInContainer < approxHeight + 20 && spaceAboveInContainer > 120) {
          setPlacement("top");
        } else {
          setPlacement("bottom");
        }
      } else {
        setPlacement("bottom");
      }
    } else {
      setPlacement(preferredPlacement);
    }

    setOpen(true);
  }, [disabled, options, value, preferredPlacement]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  /* ── Close on click outside or Escape ───────────────────────── */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => Math.min(f + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => Math.max(f - 1, 0));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[focused];
        if (opt) {
          handleSelect(opt.value);
        }
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, focused, options, handleSelect]);

  /* ── Scroll focused item into view ─────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.children[focused] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, focused]);

  return (
    <div
      ref={wrapperRef}
      className={`tsd-field ${open ? "tsd-field--open" : ""} ${isDark ? "tsd-dark" : ""}`}
    >
      <label id={`${id}-label`} className="tsd-label">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        className={`tsd-trigger ${open ? "tsd-trigger--open" : ""}`}
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => (open ? handleClose() : handleOpen())}
      >
        <span
          className={`tsd-trigger-value ${!value ? "tsd-trigger-placeholder" : ""}`}
        >
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`tsd-chevron ${open ? "tsd-chevron--open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className={`tsd-dropdown tsd-dropdown--${placement}`}
          role="listbox"
          id={`${id}-list`}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${focused}`}
          tabIndex={-1}
        >
          <div className="tsd-list">
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focused;
              return (
                <div
                  key={opt.value || `opt-${idx}`}
                  id={`${id}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`tsd-option ${isSelected ? "tsd-option--selected" : ""} ${isFocused ? "tsd-option--focused" : ""}`}
                  onMouseEnter={() => setFocused(idx)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(opt.value);
                    }
                  }}
                >
                  <span className="tsd-option-label">{opt.label}</span>
                  {isSelected && (
                    <Check
                      size={16}
                      className="tsd-check"
                      aria-hidden="true"
                      strokeWidth={2.5}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
