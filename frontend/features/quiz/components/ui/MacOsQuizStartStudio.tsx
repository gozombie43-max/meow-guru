"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import { useRouter } from "next/navigation";
import { Brain, Sparkles, Target, ChevronLeft, ChevronDown, Check, CheckCircle2, X, Search, Sun, Moon } from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";

import { useQuizTheme, useQuizThemeControls } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";
import { TOPIC_ICONS, SUBJECT_DEFAULT_ICONS, MODE_DETAILS, ALPHABET, MacOsQuizStartStudioProps } from './seriesStart.model';

export function MacOsQuizStartStudio({
  subjectConfig,
  title,
  slug,
  routeBase,
  mode = "concept",
  groups,
  category,
  categoryCounts,
  examFilter,
  examOptions,
  selected,
  conceptCount,
  questionCount,
  search: externalSearch,
  selectedLetters,
  onToggleLetter,
  onSelectAllLetters,
  letterCounts,
  availableLetters: _availableLetters,
  onCategoryChange,
  onExamChange,
  onSearchChange,
  onToggleGroup,
  onStart,
  isLoading,
  groupingStatus,
}: MacOsQuizStartStudioProps) {
  const router = useRouter();
  const quizTheme = useQuizTheme();
  const { toggleTheme } = useQuizThemeControls();
  const [internalSearch, setInternalSearch] = useState("");
  const activeSearch = externalSearch !== undefined ? externalSearch : internalSearch;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
  };

  const fallbackSubjectIcon = SUBJECT_DEFAULT_ICONS[subjectConfig.subjectId] || Brain;
  const TopicIcon = TOPIC_ICONS[slug] || fallbackSubjectIcon;
  const modeInfo = MODE_DETAILS[mode] || MODE_DETAILS.concept;
  const ModeIcon = modeInfo.icon;

  const handleBack = useCallback(() => {
    router.replace(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
  }, [router, routeBase, subjectConfig.subjectId, slug]);

  // Global Keyboard Shortcuts (Enter = Start, Escape = Back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
        e.preventDefault();
        onStart();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStart, handleBack]);

  // Filter groups by search query and category
  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => {
        if (activeSearch.trim()) {
          const query = activeSearch.toLowerCase();
          const matchLabel = group.label.toLowerCase().includes(query);
          const matchConcepts = group.concepts.some((c) => c.toLowerCase().includes(query));
          if (!matchLabel && !matchConcepts) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (b.concepts?.length ?? 0) - (a.concepts?.length ?? 0) ||
          a.label.localeCompare(b.label),
      );
  }, [groups, activeSearch]);

  // Concept coverage calculations
  const selectedCount = selected.size;
  const coveragePercent =
    conceptCount > 0
      ? selectedCount === 0
        ? 100
        : Math.round((selectedCount / conceptCount) * 100)
      : 100;

  const isEnglishSynonymsFormula =
    subjectConfig.subjectId === "english" &&
    slug === "synonyms-antonyms" &&
    mode === "formula";

  // Select all / Clear all
  const handleSelectAll = () => {
    const allConcepts = groups.flatMap((g) => g.concepts);
    if (selected.size < allConcepts.length) {
      onToggleGroup(allConcepts.filter((c) => !selected.has(c)));
    }
  };

  const handleClearAll = () => {
    if (selected.size > 0) {
      onToggleGroup(Array.from(selected));
    }
  };

  const isAllSelected = selected.size === conceptCount || selected.size === 0;

  return (
    <div className={styles.macWindow}>
        {/* ── macOS Titlebar ── */}
        <div className={styles.titleBar}>
          <div className={styles.titleBarLeft}>
            <MacTrafficLights onClose={handleBack} />
            <button
              type="button"
              onClick={handleBack}
              className={styles.backBtn}
              title={`Return to ${subjectConfig.subjectLabel} Studio (Esc)`}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
              <span>Studio</span>
            </button>
          </div>

          <div className={styles.titleBarCenter}>
            <span className={styles.windowTitle}>
              {title} • {modeInfo.label} Setup
            </span>
            <span className={styles.titleModePill}>{modeInfo.badge}</span>
          </div>

          <div className={styles.titleBarRight}>
            <button
              type="button"
              onClick={toggleTheme}
              className={styles.themeBtn}
              title={`Switch to ${quizTheme === "dark" ? "Light" : "Dark"} mode`}
              aria-label="Toggle Theme"
            >
              {quizTheme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        {/* ── 2-Pane Studio Body ── */}
        <div className={styles.studioBody}>
          {/* ── Left Inspector Pane ── */}
          <aside className={styles.leftInspector}>
            {/* Topic Hero Card */}
            <div className={styles.heroCard}>
              <div className={styles.heroHeader}>
                <div className={styles.heroIconBox}>
                  <TopicIcon size={18} strokeWidth={2.2} />
                </div>
                <div className={styles.heroTitleGroup}>
                  <h2 className={styles.heroTitle}>{title}</h2>
                  <span className={styles.heroSub}>{modeInfo.sub}</span>
                </div>
              </div>
            </div>

            {/* Exam Target Selector */}
            <div className={styles.selectSection}>
              <span className={styles.sectionLabel}>Target Exam</span>
              <div className={styles.examSelectRow}>
                <Target size={14} className={styles.examSelectIcon} />
                <select
                  value={examFilter || "all"}
                  onChange={(e) => onExamChange(e.target.value === "all" ? "" : e.target.value)}
                  className={styles.examSelect}
                >
                  <option value="all">All Exams Combined</option>
                  {examOptions
                    .filter((ex) => ex !== "all")
                    .map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                </select>
                <ChevronDown size={13} className={styles.examChevron} />
              </div>
            </div>

            {/* Metrics Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Available Qs</span>
                <span className={styles.statValue}>{questionCount} Questions</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>
                  {isEnglishSynonymsFormula ? "Active Letter" : "Selected Concepts"}
                </span>
                <span className={styles.statValue}>
                  {isEnglishSynonymsFormula
                    ? selectedLetters && selectedLetters.size > 0
                      ? `Letter ${Array.from(selectedLetters).sort().join(", ")}`
                      : "All Letters"
                    : selectedCount === 0
                      ? "All"
                      : `${selectedCount} of ${conceptCount}`}
                </span>
              </div>
            </div>

            {/* Coverage Progress Bar */}
            {!isEnglishSynonymsFormula && (
              <div className={styles.coverageSection}>
                <div className={styles.coverageHeader}>
                  <span>Syllabus Coverage</span>
                  <span className={styles.coveragePct}>{coveragePercent}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${coveragePercent}%` }} />
                </div>
              </div>
            )}

            {/* Batch Action Buttons */}
            <div className={styles.batchActions}>
              {isEnglishSynonymsFormula ? (
                <button data-ui-button="state"
                  type="button"
                  onClick={onSelectAllLetters}
                  className={styles.batchBtn}
                  disabled={!selectedLetters || selectedLetters.size === 0}
                >
                  <CheckCircle2 size={12} />
                  <span>Show All Letters</span>
                </button>
              ) : (
                <>
                  <button data-ui-button="state"
                    type="button"
                    onClick={handleSelectAll}
                    className={styles.batchBtn}
                    disabled={isAllSelected}
                  >
                    <CheckCircle2 size={12} />
                    <span>Select All</span>
                  </button>
                  <button data-ui-button="state"
                    type="button"
                    onClick={handleClearAll}
                    className={styles.batchBtn}
                    disabled={selectedCount === 0}
                  >
                    <X size={12} />
                    <span>Clear All</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* ── Right Concept Canvas ── */}
          <main className={styles.rightCanvas}>
            {isEnglishSynonymsFormula ? (
              <div className={styles.letterBarSection} style={{ borderBottom: "none", padding: "20px 24px" }}>
                <div className={styles.letterBarHeader}>
                  <span style={{ fontSize: "13px" }}>Filter by Letter (A–Z)</span>
                  <span className={styles.letterBarCount} style={{ fontSize: "12px" }}>
                    {isLoading ? (
                      <span className="inline-flex items-center gap-1.5 opacity-90 animate-pulse text-[color:var(--quiz-accent,#3b82f6)]">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Loading...</span>
                      </span>
                    ) : selectedLetters && selectedLetters.size > 0 ? (
                      `Letter ${Array.from(selectedLetters).sort().join(", ")} (${questionCount} questions ready)`
                    ) : (
                      `All letters (${questionCount} questions ready)`
                    )}
                  </span>
                </div>
                <div className={styles.letterBarGrid} role="toolbar" aria-label="Alphabet filter">
                  <button data-ui-button="state"
                    type="button"
                    className={`${styles.letterBtn} ${styles.letterBtnAll} ${
                      !selectedLetters || selectedLetters.size === 0 ? styles.letterBtnActive : ""
                    }`}
                    onClick={onSelectAllLetters}
                  >
                    All
                  </button>
                  {ALPHABET.map((letter) => {
                    const count = letterCounts?.[letter] ?? 0;
                    const isSelected = selectedLetters?.has(letter);
                    const hasQuestions = count > 0;
                    return (
                      <button data-ui-button="state"
                        key={letter}
                        type="button"
                        className={`${styles.letterBtn} ${isSelected ? styles.letterBtnActive : ""} ${
                          !hasQuestions ? styles.letterBtnDisabled : ""
                        }`}
                        onClick={() => onToggleLetter && onToggleLetter(letter)}
                        title={hasQuestions ? `Letter ${letter} (${count} Qs)` : `Letter ${letter} (0 Qs)`}
                        disabled={!hasQuestions}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Top Filter & Search Toolbar */}
                <div className={styles.canvasToolbar}>
                  <div className={styles.chipsScroll} role="tablist">
                    <button data-ui-button="state"
                      type="button"
                      className={`${styles.chipBtn} ${category === "All" ? styles.chipBtnActive : ""}`}
                      onClick={() => onCategoryChange("All")}
                    >
                      <span className={styles.chipDot} />
                      <span>All</span>
                      <span className={styles.chipCount}>{conceptCount}</span>
                    </button>
                    {groups
                      .filter((item) => (categoryCounts[item.label] || 0) > 0)
                      .map((item) => (
                        <button data-ui-button="state"
                          key={item.id}
                          type="button"
                          className={`${styles.chipBtn} ${
                            category === item.label ? styles.chipBtnActive : ""
                          }`}
                          onClick={() => onCategoryChange(item.label)}
                        >
                          <span className={styles.chipDot} />
                          <span>{item.label}</span>
                          <span className={styles.chipCount}>{categoryCounts[item.label]}</span>
                        </button>
                      ))}
                  </div>

                  {/* Instant Search Bar */}
                  <div className={styles.searchBox}>
                    <Search size={12} className={styles.searchIcon} />
                    <input
                      type="text"
                      value={activeSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Filter concepts..."
                      className={styles.searchInput}
                     aria-label="Filter concepts..."/>
                    {activeSearch && (
                      <button data-ui-button="secondary"
                        type="button"
                        onClick={() => handleSearchChange("")}
                        className={styles.clearSearchBtn}
                        aria-label="Clear search"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Concept Groups Grid */}
                <div className={styles.conceptGrid}>
                  {filteredGroups.map((group) => {
                    const selectedInGroup = group.concepts.filter((concept) =>
                      selected.has(concept)
                    ).length;
                    const isSelected =
                      selectedInGroup === group.concepts.length && group.concepts.length > 0;
                    const isPartial = selectedInGroup > 0 && !isSelected;
                    const isExpanded = expandedGroups.has(group.id);

                    return (
                      <div
                        key={group.id}
                        className={`${styles.conceptCard} ${
                          isSelected || isPartial ? styles.conceptCardSelected : ""
                        }`}
                      >
                        <div className={styles.conceptCardHeader}>
                          <div
                            className={styles.conceptCardLeft}
                            onClick={() => onToggleGroup(group.concepts)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                onToggleGroup(group.concepts);
                              }
                            }}
                          >
                            <div className={styles.conceptIconBox}>
                              <ModeIcon size={15} strokeWidth={2.2} />
                            </div>
                            <div className={styles.conceptTextGroup}>
                              <span className={styles.conceptName}>{group.label}</span>
                              <span className={styles.conceptMeta}>
                                {group.concepts.length} concept
                                {group.concepts.length === 1 ? "" : "s"}
                                {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                              </span>
                            </div>
                          </div>

                          <div className={styles.conceptCardRight}>
                            <button
                              type="button"
                              className={`${styles.conceptExpandBtn} ${
                                isExpanded ? styles.conceptExpandBtnOpen : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandGroup(group.id);
                              }}
                              aria-label={
                                isExpanded
                                  ? `Hide concepts for ${group.label}`
                                  : `Show concepts for ${group.label}`
                              }
                              aria-expanded={isExpanded}
                              title={isExpanded ? "Collapse concepts" : "View concepts"}
                            >
                              <ChevronDown size={14} strokeWidth={2} />
                            </button>

                            <div
                              className={`${styles.conceptCheckbox} ${
                                isSelected || isPartial ? styles.conceptCheckboxChecked : ""
                              }`}
                              onClick={() => onToggleGroup(group.concepts)}
                              onKeyDown={event => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onToggleGroup(group.concepts);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Toggle all concepts in ${group.label}`}
                            >
                              {(isSelected || isPartial) && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        </div>

                        {/* Concept Dropdown */}
                        {isExpanded && (
                          <div className={styles.conceptDropdownGrid}>
                            {group.concepts.map((concept) => {
                              const isConceptSelected = selected.has(concept);
                              return (
                                <div
                                  key={concept}
                                  className={`${styles.conceptSubItem} ${
                                    isConceptSelected ? styles.conceptSubItemSelected : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleGroup([concept]);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={isConceptSelected}
                                  onKeyDown={(e) => {
                                    if (e.key === " " || e.key === "Enter") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onToggleGroup([concept]);
                                    }
                                  }}
                                >
                                  <span
                                    className={`${styles.conceptSubCheckbox} ${
                                      isConceptSelected ? styles.conceptCheckboxChecked : ""
                                    }`}
                                  >
                                    {isConceptSelected && <Check size={9} strokeWidth={3} />}
                                  </span>
                                  <span className={styles.conceptSubName}>{concept}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredGroups.length === 0 && (
                    <div className={styles.emptyState}>
                      <p role="status">{groupingStatus === "processing" ? "Organizing concepts into related groups… You can still start the quiz." : groupingStatus === "failed" ? "Concept groups are temporarily unavailable. You can still start the quiz." : "No concept groups match your filter."}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>

        {/* ── Bottom Dock / Sticky Launch Footer ── */}
        <footer data-ui-chrome="footer" className={styles.studioFooter}>
          <div className={styles.footerLeft}>
            <div className={styles.statusIndicator} />
            <span className={styles.statusText}>
              {isLoading ? (
                <span className="inline-flex items-center gap-2 animate-pulse text-[color:var(--quiz-accent,#3b82f6)]">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Loading...</span>
                </span>
              ) : (
                <>
                  <span className={styles.statusBold}>{questionCount} Questions</span> Ready •{" "}
                  {selectedCount === 0 ? "All Concepts" : `${selectedCount} Concepts`} Selected
                </>
              )}
            </span>
          </div>

          <button data-ui-button="primary"
            type="button"
            onClick={onStart}
            className={styles.startBtn}
            title="Launch Quiz (Enter)"
            disabled={isLoading || questionCount === 0}
          >
            {isLoading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Sparkles size={14} fill="currentColor" />
            )}
            <span>{isLoading ? "Loading..." : "Start Quiz"}</span>
            <kbd className={styles.returnKey}>↵</kbd>
          </button>
        </footer>
      </div>
  );
}
