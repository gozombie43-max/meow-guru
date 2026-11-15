"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, ChevronDown, Check, X, Search } from "lucide-react";
import TopicThumbnail from "@/components/subject-hub/TopicThumbnail";
import { chapterImage } from "@/lib/topic-images";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";
import { MODE_DETAILS, ALPHABET, MacOsQuizStartStudioProps } from "./seriesStart.model";

export function MacOsQuizStartStudio({
  subjectConfig,
  title,
  slug,
  routeBase,
  mode = "concept",
  groups,
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
  onExamChange,
  onSearchChange,
  onToggleGroup,
  onStart,
  isLoading,
  groupingStatus,
}: MacOsQuizStartStudioProps) {
  const router = useRouter();
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

  const baseModeInfo = MODE_DETAILS[mode] || MODE_DETAILS.concept;
  const label = subjectConfig.modeLabels?.[mode];
  const modeInfo = label ? { ...baseModeInfo, label, badge: label } : baseModeInfo;
  const thumbnailSrc = chapterImage(slug, slug);

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

  // Filter groups by search query
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
      {/* ── Top Workspace Bar (56px) ── */}
      <header className={styles.titleBar}>
        <div className={styles.titleBarLeft}>
          <button
            type="button"
            onClick={handleBack}
            className={styles.backBtn}
            aria-label="Back to topic"
            title={`Back to ${title} (Esc)`}
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </button>

          <span className={styles.titleBarDivider} aria-hidden="true" />

          <div className={styles.titleBarHeadingGroup}>
            <h1 className={styles.windowTitle}>{title}</h1>
            <span className={styles.titleModePill}>{modeInfo.badge}</span>
            <span className={styles.windowMeta}>
              {questionCount.toLocaleString()} questions · {conceptCount.toLocaleString()} concepts
            </span>
          </div>
        </div>
      </header>

      {/* ── 2-Pane Workspace Body ── */}
      <div className={styles.studioBody}>
        <div className={styles.studioWorkspace}>
          {/* ── Left Configuration Card ── */}
          <aside className={styles.leftInspector}>
            {/* Topic Summary */}
            <div className={styles.heroCard}>
              <div className={styles.heroHeader}>
                <div className={styles.heroIconBox}>
                  <TopicThumbnail src={thumbnailSrc} size={48} priority />
                </div>
                <div className={styles.heroTitleGroup}>
                  <h2 className={styles.heroTitle}>{title}</h2>
                  <span className={styles.heroSub}>{modeInfo.sub}</span>
                </div>
              </div>
            </div>

            {/* Target Exam Selector */}
            <div className={styles.selectSection}>
              <span className={styles.sectionLabel}>Target exam</span>
              <div className={styles.examSelectRow}>
                <Target size={15} strokeWidth={1.75} className={styles.examSelectIcon} />
                <select
                  value={examFilter || "all"}
                  aria-label="Filter by exam"
                  onChange={(e) => onExamChange(e.target.value === "all" ? "" : e.target.value)}
                  className={styles.examSelect}
                >
                  <option value="all">All exams combined</option>
                  {examOptions
                    .filter((ex) => ex !== "all")
                    .map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                </select>
                <ChevronDown size={14} strokeWidth={1.75} className={styles.examChevron} />
              </div>
            </div>

            {/* Session Metrics */}
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Available questions</span>
                <span className={styles.statValue}>{questionCount.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>
                  {isEnglishSynonymsFormula ? "Active letters" : "Selected concepts"}
                </span>
                <span className={styles.statValue}>
                  {isEnglishSynonymsFormula
                    ? selectedLetters && selectedLetters.size > 0
                      ? Array.from(selectedLetters).sort().join(", ")
                      : "All letters"
                    : selectedCount === 0
                      ? `All (${conceptCount})`
                      : `${selectedCount} of ${conceptCount}`}
                </span>
              </div>
            </div>

            {/* Syllabus Coverage Bar */}
            {!isEnglishSynonymsFormula && (
              <div className={styles.coverageSection}>
                <div className={styles.coverageHeader}>
                  <span>Syllabus coverage</span>
                  <span className={styles.coveragePct}>{coveragePercent}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${coveragePercent}%` }} />
                </div>
              </div>
            )}

            {/* Batch Actions */}
            <div className={styles.batchActions}>
              {isEnglishSynonymsFormula ? (
                <button
                  data-ui-button="state"
                  type="button"
                  onClick={onSelectAllLetters}
                  className={styles.batchBtn}
                  disabled={!selectedLetters || selectedLetters.size === 0}
                >
                  <span>Show all letters</span>
                </button>
              ) : (
                <>
                  <button
                    data-ui-button="state"
                    type="button"
                    onClick={handleSelectAll}
                    className={styles.batchBtn}
                    disabled={isAllSelected}
                  >
                    <span>Select all</span>
                  </button>
                  <button
                    data-ui-button="state"
                    type="button"
                    onClick={handleClearAll}
                    className={styles.batchBtn}
                    disabled={selectedCount === 0}
                  >
                    <span>Clear selection</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* ── Right Concept Selection Panel ── */}
          <main className={styles.rightCanvas}>
            {isEnglishSynonymsFormula ? (
              <div className={styles.letterBarSection}>
                <div className={styles.letterBarHeader}>
                  <span>Filter by letter (A–Z)</span>
                  <span className={styles.letterBarCount}>
                    {isLoading ? (
                      "Loading..."
                    ) : selectedLetters && selectedLetters.size > 0 ? (
                      `Letter ${Array.from(selectedLetters).sort().join(", ")} · ${questionCount} questions ready`
                    ) : (
                      `All letters · ${questionCount} questions ready`
                    )}
                  </span>
                </div>
                <div className={styles.letterBarGrid} role="toolbar" aria-label="Alphabet filter">
                  <button
                    data-ui-button="state"
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
                      <button
                        data-ui-button="state"
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
                {/* Concept Panel Toolbar */}
                <div className={styles.canvasToolbar}>
                  <div className={styles.canvasTitleGroup}>
                    <h2 className={styles.canvasHeading}>Concept groups</h2>
                    <span className={styles.canvasCountBadge}>{filteredGroups.length}</span>
                  </div>

                  {/* Search Input */}
                  <div className={styles.searchBox}>
                    <Search size={14} strokeWidth={1.75} className={styles.searchIcon} />
                    <input
                      type="search"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                      value={activeSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Filter concepts..."
                      className={styles.searchInput}
                      aria-label="Filter concepts..."
                    />
                    {activeSearch && (
                      <button
                        data-ui-button="secondary"
                        type="button"
                        onClick={() => handleSearchChange("")}
                        className={styles.clearSearchBtn}
                        aria-label="Clear search"
                      >
                        <X size={13} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Concept Groups List */}
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
                            <span
                              className={`${styles.conceptCheckbox} ${
                                isSelected || isPartial ? styles.conceptCheckboxChecked : ""
                              }`}
                              aria-hidden="true"
                            >
                              {(isSelected || isPartial) && <Check size={12} strokeWidth={2.75} />}
                            </span>
                            <span className={styles.conceptName}>{group.label}</span>
                          </div>

                          <div className={styles.conceptCardRight}>
                            <span className={styles.conceptMeta}>
                              {group.concepts.length}{" "}
                              {group.concepts.length === 1 ? "concept" : "concepts"}
                              {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                            </span>

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
                              <ChevronDown size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Sub-concepts */}
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
                                    {isConceptSelected && <Check size={10} strokeWidth={2.75} />}
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
                      <p role="status">
                        {groupingStatus === "processing"
                          ? "Organizing concepts into related groups… You can still start the quiz."
                          : groupingStatus === "failed"
                            ? "Concept groups are temporarily unavailable. You can still start the quiz."
                            : "No concept groups match your filter."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Sticky Bottom Launch Bar ── */}
      <footer data-ui-chrome="footer" className={styles.studioFooter}>
        <div className={styles.studioFooterInner}>
          <div className={styles.footerLeft}>
            <span className={styles.statusIndicator} aria-hidden="true" />
            <span className={styles.statusText}>
              {isLoading ? (
                "Loading questions..."
              ) : (
                <>
                  <span className={styles.statusBold}>{questionCount.toLocaleString()} questions</span>{" "}
                  ready · {selectedCount === 0 ? "All concepts selected" : `${selectedCount} concepts selected`}
                </>
              )}
            </span>
          </div>

          <button
            data-ui-button="primary"
            type="button"
            onClick={onStart}
            className={styles.startBtn}
            title="Start Quiz (Enter)"
            disabled={isLoading || questionCount === 0}
          >
            <span>{isLoading ? "Loading..." : "Start Quiz"}</span>
            <kbd className={styles.returnKey}>↵</kbd>
          </button>
        </div>
      </footer>
    </div>
  );
}
