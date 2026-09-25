"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Layers, Search, Sparkles, X } from "lucide-react";
import { useModalSurface } from "@/components/ui/Dialog";
import { useThemeMode } from "@/hooks/useTheme";
import "./training-select-dropdown.css";
import "./training-filter-picker.css";


export function TrainingFilterPicker({
  label,
  value,
  options,
  catalog,
  disabled = false,
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
  catalog?: { subject: string; topic: string }[];
  disabled?: boolean;
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
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const backdropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const groups = useMemo(() => {
    const available = new Set(options.filter(Boolean));
    const assigned = new Set<string>();
    const grouped = new Map<string, Set<string>>();
    for (const item of catalog || []) {
      if (!available.has(item.topic) || !item.subject.trim()) continue;
      const topics = grouped.get(item.subject) || new Set<string>();
      topics.add(item.topic);
      grouped.set(item.subject, topics);
      assigned.add(item.topic);
    }
    const remaining = [...available].filter(topic => !assigned.has(topic));
    const result = [...grouped].map(([name, topics]) => ({ name, topics: [...topics].sort((a, b) => a.localeCompare(b)) }));
    if (remaining.length) result.push({ name: grouped.size ? "Other topics" : "Topics", topics: remaining.sort((a, b) => a.localeCompare(b)) });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [options, catalog]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGroups = groups.filter(group => !category || category === group.name).map(group => ({
    ...group,
    topics: group.topics.filter(topic => `${group.name} ${topic}`.toLocaleLowerCase().includes(normalizedQuery)),
  })).filter(group => group.topics.length);
  const resultCount = new Set(filteredGroups.flatMap(group => group.topics)).size;
  const topicCount = new Set(options.filter(Boolean)).size;

  function renderChoice(topic: string, title: string, description?: string) {
    return (
      <label key={topic || "__mix__"} className={`tfp-row ${draft === topic ? "tfp-row--selected" : ""} ${!topic ? "tfp-row--mix" : ""}`}>
        <input type="radio" aria-label={title} name={`${id}-selection`} value={topic}
          checked={draft === topic} onChange={() => setDraft(topic)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); handleDone(); } }} />
        {!topic && <Sparkles size={22} aria-hidden="true" />}
        <span className="tfp-row-label"><span>{title}</span>{description && <small>{description}</small>}</span>
        <span className="tfp-radio-mark" aria-hidden="true">{draft === topic && <Check size={14} strokeWidth={3} />}</span>
      </label>
    );
  }

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

        <header className="tfp-header">
          <div className="tfp-heading-icon"><Layers size={22} aria-hidden="true" /></div>
          <div className="tfp-heading-copy">
            <h2 id={`${id}-title`} className="tfp-title">Choose {label}</h2>
            <p>Focus on one topic or practice a balanced mix.</p>
          </div>
          <button type="button" data-ui-button="icon" aria-label="Close topic picker" onClick={handleClose}><X size={20} /></button>
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
            onChange={e => { setQuery(e.target.value); listRef.current?.scrollTo?.({ top: 0 }); }}
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

        <div className="tfp-categories" role="group" aria-label="Topic categories">
          <button type="button" data-ui-button="state" aria-pressed={!category} onClick={() => { setCategory(""); listRef.current?.scrollTo?.({ top: 0 }); }}>All topics <span>{topicCount}</span></button>
          {groups.length > 1 && groups.map(group => (
            <button key={group.name} type="button" data-ui-button="state" aria-pressed={category === group.name}
              onClick={() => { setCategory(group.name); listRef.current?.scrollTo?.({ top: 0 }); }}>
              {group.name}<span>{group.topics.length}</span>
            </button>
          ))}
        </div>
        <div ref={listRef} className="tfp-list" role="group" aria-label={`${label} options`}>
          {!normalizedQuery && !category && renderChoice("", emptyLabel, "Include all topics in your current subject selection")}
          <div className="tfp-results-meta" aria-live="polite">{resultCount} {resultCount === 1 ? "topic" : "topics"}{normalizedQuery ? " found" : " available"}</div>
          {filteredGroups.map((group, index) => (
            <section key={group.name} className="tfp-group" aria-labelledby={`${id}-group-${index}`}>
              <h3 id={`${id}-group-${index}`}><Layers size={15} aria-hidden="true" />{group.name}<span>{group.topics.length}</span></h3>
              <div className="tfp-group-options">{group.topics.map(topic => renderChoice(topic, topic))}</div>
            </section>
          ))}
          {!resultCount && <div className="tfp-empty" role="status">
            <Search size={28} aria-hidden="true" />
            <strong>{normalizedQuery ? "No matching topics found." : "No topics available."}</strong>
            <p>{normalizedQuery ? "Try a shorter search or browse all categories." : "Choose a different subject to explore its topics."}</p>
            {(query || category) && <button type="button" data-ui-button="secondary" onClick={() => { setQuery(""); setCategory(""); }}>Reset filters</button>}
          </div>}
        </div>
        <footer className="tfp-footer">
          <div className="tfp-selection"><span>YOUR SELECTION</span><strong>{draft || emptyLabel}</strong></div>
          <div className="tfp-actions">
            <button type="button" data-ui-button="secondary" onClick={handleClose}>Cancel</button>
            <button type="button" data-ui-button="primary" onClick={handleDone}><Check size={18} aria-hidden="true" />Done</button>
          </div>
        </footer>
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
        disabled={disabled}
        onClick={() => { setDraft(value); setQuery(""); setCategory(""); setOpen(true); }}
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
