"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useModalSurface } from "@/components/ui/Dialog";
import { useThemeMode } from "@/hooks/useTheme";
import "./training-select-dropdown.css";
import "./training-filter-picker.css";


export function TrainingFilterPicker({
  label,
  value,
  options,
  emptyLabel,
  onChange,
  icon,
  iconBgClass,
  variant = "default",
  className,
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  iconBgClass?: string;
  variant?: "default" | "card";
  className?: string;
}) {
  const { theme } = useThemeMode();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const backdropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Open → find portal target, animate in
  useEffect(() => {
    if (!open) return;

    const setup = document.getElementById("training-setup");
    setup?.setAttribute("data-picker-open", "true");

    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => {
      setPortalTarget(setup ?? (typeof document !== "undefined" ? document.body : null));
      setVisible(true);
    });

    const trigger = triggerRef.current;

    return () => {
      cancelAnimationFrame(raf);
      setup?.removeAttribute("data-picker-open");
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    // Wait for slide-out animation before unmounting
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setQuery("");
      setPortalTarget(null);
    }, (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) ? 0 : 320);
  };

  useModalSurface(sheetRef, open && !!portalTarget, handleClose, { initialFocus: "input[type=search]" });

  const handleDone = () => {
    onChange(draft);
    handleClose();
  };

  // Tap backdrop to dismiss
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  };

  const choices = [
    { value: "", label: emptyLabel },
    ...[...new Set(options)].map(item => ({ value: item, label: item })),
  ];
  const filtered = choices.filter(item =>
    item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  const sheet = (
    <div
      ref={backdropRef}
      className={`tfp-backdrop ${visible ? "tfp-backdrop--in" : ""} ${theme === "dark" ? "training-dark" : ""}`}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`tfp-sheet ${visible ? "tfp-sheet--in" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        {/* iOS Drag Handle */}
        <div className="tfp-handle" aria-hidden="true" />

        {/* Header: Cancel · Title · Done */}
        <header className="tfp-header">
          <button type="button" data-ui-button="state" className="tfp-header-btn tfp-cancel" onClick={handleClose}>
            Cancel
          </button>
          <h2 id={`${id}-title`} className="tfp-title">Choose {label}</h2>
          <button type="button" data-ui-button="state" className="tfp-header-btn tfp-done" onClick={handleDone}>
            Done
          </button>
        </header>

        {/* Search bar */}
        <div className="tfp-search">
          <Search size={16} aria-hidden="true" className="tfp-search-icon" />
          <input
            ref={searchRef}
            onKeyDown={event => {
              if (event.key === "Enter") { event.preventDefault(); handleDone(); }
            }}
            type="search"
            className="tfp-search-input"
            aria-label={`Search ${label.toLowerCase()}s`}
            placeholder={`Search ${label.toLowerCase()}s…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" data-ui-button="icon" className="tfp-search-clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Option list */}
        <div className="tfp-list" role="group" aria-label={`${label} options`}>
          {filtered.map((item, idx) => (
            <label
              key={item.value || "__empty__"}
              className={`tfp-row ${draft === item.value ? "tfp-row--selected" : ""} ${idx === 0 ? "tfp-row--empty" : ""}`}
            >
              <input
                onKeyDown={event => {
              if (event.key === "Enter") { event.preventDefault(); handleDone(); }
            }}
                type="radio"
                aria-label={item.label}
                name={`${id}-selection`}
                value={item.value}
                checked={draft === item.value}
                onChange={() => setDraft(item.value)}
              />
              <span className="tfp-row-label">{item.label}</span>
              {draft === item.value && (
                <Check size={20} className="tfp-check" aria-hidden="true" strokeWidth={2.5} />
              )}
            </label>
          ))}
          {!filtered.length && (
            <p className="tfp-empty" role="status">
              No matching {label.toLowerCase()}s found.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const isDark = theme === "dark";

  return (
    <div className={`tsd-field ${variant === "card" ? "tsd-field--card" : ""} ${open ? "tsd-field--open" : ""} ${isDark ? "tsd-dark" : ""} ${className || ""}`}>
      {variant !== "card" && (
        <label id={`${id}-label`} className="tsd-label">{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        className={`tsd-trigger ${variant === "card" ? "tsd-trigger--card" : ""} ${open ? "tsd-trigger--open" : ""}`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setDraft(value); setQuery(""); setOpen(true); }}
      >
        {variant === "card" && icon && (
          <div className={`tsd-card-icon-wrap ${iconBgClass || ""}`} aria-hidden="true">
            {icon}
          </div>
        )}
        {variant === "card" ? (
          <div className="tsd-card-content">
            <span id={`${id}-label`} className="tsd-card-label">{label}</span>
            <span id={`${id}-value`} className={`tsd-card-value ${!value ? "tsd-trigger-placeholder" : ""}`}>
              {value || emptyLabel}
            </span>
          </div>
        ) : (
          <span id={`${id}-value`} className={`tsd-trigger-value ${!value ? "tsd-trigger-placeholder" : ""}`}>
            {value || emptyLabel}
          </span>
        )}
        <ChevronDown
          size={variant === "card" ? 18 : 16}
          className={`tsd-chevron ${open ? "tsd-chevron--open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && portalTarget && createPortal(sheet, portalTarget)}
    </div>
  );
}
