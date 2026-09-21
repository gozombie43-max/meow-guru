"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useBackLayer } from "@/hooks/useAppNavigation";
import { useThemeMode } from "@/hooks/useTheme";
import "./training-select-dropdown.css";
import "./training-filter-picker.css";


export function TrainingFilterPicker({ label, value, options, emptyLabel, onChange }: {
  label: string;
  value: string;
  options: string[];
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useThemeMode();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Open → find portal target (inside the dialog so it renders in top-layer), animate in
  useEffect(() => {
    if (!open) return;

    // Portal INTO the native dialog so we live in the top-layer with it.
    // Fall back to document.body if for some reason the dialog isn't found.
    const setup = document.getElementById("training-setup");

    // Add class for subtle visual state on the setup dialog (no blur needed now)
    setup?.setAttribute("data-picker-open", "true");

  // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => {
      setPortalTarget(setup ?? document.body);
      setVisible(true);
    });
    // Auto-focus search after animation
    const timer = setTimeout(() => searchRef.current?.focus(), 220);

    const trigger = triggerRef.current;

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      setup?.removeAttribute("data-picker-open");
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    // Wait for slide-out animation before unmounting
    setTimeout(() => {
      setOpen(false);
      setQuery("");
      setPortalTarget(null);
    }, 320);
  };

  useBackLayer(open, () => handleClose());

  const handleDone = () => {
    onChange(draft);
    handleClose();
  };

  // Tap backdrop to dismiss
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  };

  // Keyboard: Escape closes, Enter confirms
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleClose(); }
      if (e.key === "Enter") { e.preventDefault(); handleDone(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        className={`tfp-sheet ${visible ? "tfp-sheet--in" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        {/* iOS Drag Handle */}
        <div className="tfp-handle" aria-hidden="true" />

        {/* Header: Cancel · Title · Done */}
        <header className="tfp-header">
          <button type="button" className="tfp-header-btn tfp-cancel" onClick={handleClose}>
            Cancel
          </button>
          <h2 id={`${id}-title`} className="tfp-title">Choose {label}</h2>
          <button type="button" className="tfp-header-btn tfp-done" onClick={handleDone}>
            Done
          </button>
        </header>

        {/* Search bar */}
        <div className="tfp-search">
          <Search size={16} aria-hidden="true" className="tfp-search-icon" />
          <input
            ref={searchRef}
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
            <button type="button" className="tfp-search-clear" aria-label="Clear search" onClick={() => setQuery("")}>
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
    <div className={`tsd-field ${isDark ? "tsd-dark" : ""}`}>
      <label id={`${id}-label`} className="tsd-label">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        className={`tsd-trigger ${open ? "tsd-trigger--open" : ""}`}
        aria-labelledby={`${id}-label`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setDraft(value); setQuery(""); setOpen(true); }}
      >
        <span className={`tsd-trigger-value ${!value ? "tsd-trigger-placeholder" : ""}`}>
          {value || emptyLabel}
        </span>
        <ChevronDown
          size={16}
          className={`tsd-chevron ${open ? "tsd-chevron--open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && portalTarget && createPortal(sheet, portalTarget)}
    </div>
  );
}
