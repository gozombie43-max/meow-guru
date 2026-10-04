"use client";

import React, { useState, useMemo, useCallback } from "react";

import { useRouter } from "next/navigation";
import { Layers, Sparkles, Target, ChevronLeft, ChevronDown, Check, X, Search } from "lucide-react";

import { useQuizTheme } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";
import { MODE_DETAILS, ALPHABET, IosQuizStartMobileProps } from './seriesStart.model';
import { IosExamPicker } from './IosExamPicker';
export function IosQuizStartMobile({
  subjectConfig,
  title,
  slug,
  routeBase,
  mode = "concept",
  groups,
  examFilter,
  examOptions,
  selected,
  questionCount,
  search: externalSearch,
  selectedLetters,
  onToggleLetter,
  onSelectAllLetters,
  letterCounts,
  availableLetters: _availableLetters,
  onExamChange,
  onSearchChange,
  onToggleGroup,
  onStart,
  isLoading,
  groupingStatus,
}: IosQuizStartMobileProps) {
  const router = useRouter();
  const quizTheme = useQuizTheme();
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

  const modeInfo = MODE_DETAILS[mode] || MODE_DETAILS.concept;
  const selectedCount = selected.size;
  const isEnglishSynonymsFormula =
    subjectConfig.subjectId === "english" &&
    slug === "synonyms-antonyms" &&
    mode === "formula";

  const selectedQuestionLabel = isEnglishSynonymsFormula
    ? selectedLetters && selectedLetters.size > 0
      ? `Letter ${Array.from(selectedLetters).sort().join(", ")}`
      : "all letters"
    : selectedCount === 0
      ? "all concepts"
      : `${selectedCount} concept${selectedCount === 1 ? "" : "s"}`;

  const handleBack = useCallback(() => {
    router.replace(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
  }, [router, routeBase, subjectConfig.subjectId, slug]);

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

  const subjectAccent = quizTheme === "dark" ? "#0a84ff" : "#0071e3";

  return (
    <div
      className={styles.iosScreen}
      data-theme={quizTheme}
      style={{ "--ios-accent": subjectAccent } as React.CSSProperties}
    >
      {/* ── Top Navigation Bar ── */}
      <header data-ui-chrome="header" className={styles.iosNav}>
        <button
          type="button"
          onClick={handleBack}
          className={styles.iosBackBtn}
          aria-label="Back"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>
        <strong className={styles.iosNavTitle}>
          {mode === "concept" ? title : `${title} - ${modeInfo.label}`}
        </strong>
        <span className={styles.iosNavSpacer} />
      </header>

      {/* ── Scrollable Body ── */}
      <main className={styles.iosContent}>
        {isEnglishSynonymsFormula ? (
          <>
            <div className={styles.iosDropdownContainer}>
              <div className={styles.iosDropdownRow}>
                <span className={styles.iosTargetIconBox}>
                  <Target size={15} />
                </span>
                <span className={styles.iosDropdownLabel}>Select Exam</span>
                <IosExamPicker value={examFilter} options={examOptions} onChange={onExamChange} />
              </div>
            </div>

            <div className={styles.iosLetterSection}>
              <div className={styles.iosLetterHeader}>
                <p className={styles.iosLetterHeading}>Filter by Letter</p>
                <span className={styles.iosLetterActiveLabel}>
                  {selectedLetters && selectedLetters.size > 0
                    ? `Letter ${Array.from(selectedLetters).sort().join(", ")}`
                    : "All Letters"}
                </span>
              </div>
              <div className={styles.iosLetterGrid} aria-label="Alphabet filters">
                <button data-ui-button="state"
                  type="button"
                  className={`${styles.iosLetterPill} ${styles.iosLetterPillWide} ${
                    !selectedLetters || selectedLetters.size === 0 ? styles.iosLetterPillActive : ""
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
                      className={`${styles.iosLetterPill} ${isSelected ? styles.iosLetterPillActive : ""} ${
                        !hasQuestions ? styles.iosLetterPillDisabled : ""
                      }`}
                      onClick={() => onToggleLetter && onToggleLetter(letter)}
                      disabled={!hasQuestions}
                      title={hasQuestions ? `Letter ${letter} (${count} questions)` : `Letter ${letter} (0 questions)`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.iosDropdownContainer}>
              <div className={styles.iosDropdownRow}>
                <span className={styles.iosTargetIconBox}>
                  <Target size={15} />
                </span>
                <span className={styles.iosDropdownLabel}>Select Exam</span>
                <IosExamPicker value={examFilter} options={examOptions} onChange={onExamChange} />
              </div>
            </div>

            {/* Optional Search */}
            {(onSearchChange !== undefined || Boolean(activeSearch)) && (
              <div className={styles.iosSearchRow}>
                <Search size={14} className={styles.iosSearchIcon} />
                <input
                  type="text"
                  value={activeSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search concept groups..."
                  className={styles.iosSearchInput}
                 aria-label="Search concept groups..."/>
                {activeSearch && (
                  <button data-ui-button="secondary"
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className={styles.iosClearSearch}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Concept Groups */}
            <p className={styles.iosHeading}>Concept Groups</p>
            <section className={styles.iosConceptList} aria-label="Concept groups">
              {filteredGroups.map((group) => {
                const selectedInGroup = group.concepts.filter((c) => selected.has(c)).length;
                const isSelected =
                  selectedInGroup === group.concepts.length && group.concepts.length > 0;
                const isPartial = selectedInGroup > 0 && !isSelected;
                const isExpanded = expandedGroups.has(group.id);

                return (
                  <div key={group.id} className={styles.iosConceptGroupContainer}>
                    <div className={styles.iosConceptRow}>
                      <div
                        className={styles.iosConceptRowContent}
                        onClick={() => toggleExpandGroup(group.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-label={`${group.label}, ${isExpanded ? "collapse concepts" : "expand concepts"}`}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggleExpandGroup(group.id);
                          }
                        }}
                      >
                        <span
                          className={styles.iosGroupTile}
                          style={{ background: group.bg, color: group.accent, "--group-accent": group.accent } as React.CSSProperties}
                        >
                          <Layers size={16} aria-hidden="true" />
                        </span>

                        <span className={styles.iosRowCopy}>
                          <strong className={styles.iosGroupTitle}>{group.label}</strong>
                          <small className={styles.iosGroupMeta}>
                            {group.concepts.length} concept{group.concepts.length === 1 ? "" : "s"}
                            {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                          </small>
                        </span>
                      </div>

                      <div className={styles.iosConceptRowActions}>
                        <button
                          type="button"
                          className={`${styles.iosExpandBtn} ${
                            isExpanded ? styles.iosExpandBtnOpen : ""
                          }`}
                          onClick={() => toggleExpandGroup(group.id)}
                          aria-label={
                            isExpanded
                              ? `Hide concepts for ${group.label}`
                              : `Show concepts for ${group.label}`
                          }
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown size={17} strokeWidth={2.2} />
                        </button>

                        <button
                          type="button"
                          className={`${styles.iosCheckCircle} ${
                            isSelected || isPartial ? styles.iosCheckCircleChecked : ""
                          }`}
                          onClick={() => onToggleGroup(group.concepts)}
                          aria-label={`Toggle all concepts in ${group.label}`}
                        >
                          {(isSelected || isPartial) && <Check size={12} strokeWidth={3} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.iosConceptDropdown}>
                        {group.concepts.map((concept) => {
                          const isConceptSelected = selected.has(concept);
                          return (
                            <div
                              key={concept}
                              className={`${styles.iosSubConceptRow} ${
                                isConceptSelected ? styles.iosSubConceptRowSelected : ""
                              }`}
                              onClick={() => onToggleGroup([concept])}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isConceptSelected}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                  e.preventDefault();
                                  onToggleGroup([concept]);
                                }
                              }}
                            >
                              <span className={styles.iosSubConceptName}>{concept}</span>
                              <span
                                className={`${styles.iosSubCheckCircle} ${
                                  isConceptSelected ? styles.iosCheckCircleChecked : ""
                                }`}
                              >
                                {isConceptSelected && <Check size={11} strokeWidth={3} />}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredGroups.length === 0 && (
                <p className={styles.iosEmptyText} role="status">{groupingStatus === "processing" ? "Organizing concepts into related groups… You can still start the quiz." : groupingStatus === "failed" ? "Concept groups are temporarily unavailable. You can still start the quiz." : "No concept groups match your filter."}</p>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Fixed Bottom Launch Toolbar ── */}
      <footer data-ui-chrome="footer" className={styles.iosToolbar}>
        <p className={styles.iosToolbarText}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2 animate-pulse text-[color:var(--quiz-accent,#3b82f6)]">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Loading...</span>
            </span>
          ) : (
            <>
              <b>{questionCount}</b> questions ready · <span>{selectedQuestionLabel}</span>
            </>
          )}
        </p>
        <button data-ui-button="primary"
          type="button"
          onClick={onStart}
          className={styles.iosStartBtn}
          disabled={isLoading || questionCount === 0}
        >
          {isLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Sparkles size={16} fill="currentColor" />
          )}
          <span>{isLoading ? "Loading..." : "Start Quiz"}</span>
        </button>
      </footer>
    </div>
  );
}
