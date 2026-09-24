"use client";

import { Dialog } from "@/components/ui/Dialog";
import React, { useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  Lock,
  Layers,
  Brain,
  Puzzle,
  TrendingUp,
  ArrowLeftRight,
  Filter,
  Users2,
  Compass,
  CircleDot,
  Scale,
  Calculator,
  Trophy,
  FileCheck,
  HelpCircle,
  Swords,
  Shapes,
  Scissors,
  FlipHorizontal,
  Box,
  Table2,
  SpellCheck,
  Heart,
  Share2,
  Type,
  FileQuestion,
  Sparkles,
  Zap,
  Target,
  ChevronLeft,
  ChevronDown,
  Check,
  CheckCircle2,
  X,
  Search,
  Flame,
  Shuffle,
  BookOpenCheck,
  Sun,
  Moon,
  Percent,
  Divide,
  Clock,
  Gauge,
  Variable,
  Orbit,
  Hash,
  BarChart3,
  Tag,
  FlaskConical,
  Radical,
  PieChart,
  Globe,
  Atom,
  Languages,
  Landmark,
  Coins,
  BookMarked,
  MessageSquare,
  Edit3,
  FileSpreadsheet,
  Newspaper,
  RefreshCw,
  MessageCircle,
  Navigation,
  FileText,
  Link2,
  Volume2,
  Layout,
  CheckSquare,
  UserCheck,
  AlignLeft,
  type LucideIcon,
} from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";
import { SubjectConfig, ClassificationGroup, QuizMode } from "@/features/quiz/model/types";
import { useQuizTheme, useQuizThemeControls } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";

// ── Complete Topic Icon Mapping Across All 4 Subjects ────────────────────────
function IosExamPicker({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
    }, (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) ? 0 : 340);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  }, [handleClose]);




  return (
    <div className={styles.iosSelectWrapper}>
      <button
        ref={triggerRef}
        type="button"
        data-ui-button="state"
        className={styles.iosSelect}
        aria-label={`Select exam: ${value || "All Exams"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleOpen}
      >
        {value || "All Exams"}
      </button>
      <ChevronDown size={14} className={styles.iosSelectChevron} />

      {open && createPortal(
        <div
          ref={backdropRef}
          className={`${styles.iosSheetBackdrop} ${visible ? styles.iosSheetBackdropIn : ""}`}
          role="presentation"
          onClick={handleBackdropClick}
        >
          <Dialog onClose={handleClose}
            className={`${styles.examSheet} ${visible ? styles.examSheetIn : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className={styles.examSheetHandle} aria-hidden="true" />
            <header className={styles.examSheetHeader}>
              <div>
                <h2 id={titleId}>Select Exam</h2>
                <p>Choose which exam to practice</p>
              </div>
              <button type="button" data-ui-button="icon" aria-label="Close exam picker" onClick={handleClose}>
                <X size={20} />
              </button>
            </header>
            <div className={styles.examSheetOptions} role="group" aria-label="Exams">
              {options.map((exam) => (
                <button key={exam} type="button" data-ui-button="state"
                  className={styles.examSheetOption} aria-pressed={(value || "all") === exam}
                  onClick={() => { onChange(exam === "all" ? "" : exam); handleClose(); }}>
                  <span>{exam === "all" ? "All Exams" : exam}</span>
                  {(value || "all") === exam && <Check size={21} strokeWidth={2.7} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </Dialog>
        </div>,
        document.body,
      )}
    </div>
  );
}

const TOPIC_ICONS: Record<string, LucideIcon> = {
  // Reasoning topics
  "coding-decoding": Lock,
  "syllogism-inferences": Brain,
  "puzzle-seating-arrangement": Puzzle,
  series: TrendingUp,
  analogy: ArrowLeftRight,
  "classification-odd-one-out": Filter,
  "blood-relations": Users2,
  "direction-distance": Compass,
  "venn-diagram": CircleDot,
  inequalities: Scale,
  "mathematical-symbolic-operations": Calculator,
  "order-ranking": Trophy,
  "statement-conclusion": FileCheck,
  "statement-assumptions": HelpCircle,
  "statement-arguments": Swords,
  "problem-solving-critical-thinking": Brain,
  "non-verbal-figures": Shapes,
  "paper-folding-cutting": Scissors,
  "mirror-water-image": FlipHorizontal,
  "cube-dice": Box,
  matrix: Table2,
  "logical-sequence-of-words": SpellCheck,
  "emotional-intelligence": Heart,
  "social-intelligence": Share2,
  "word-building": Type,

  // Mathematics topics
  percentages: Percent,
  "ratio-and-proportion": Divide,
  "profit-and-loss": TrendingUp,
  interest: Landmark,
  "simple-interest": Landmark,
  "compound-interest": Coins,
  "time-and-work": Clock,
  "time-and-distance": Gauge,
  algebra: Variable,
  geometry: Compass,
  mensuration: Box,
  trigonometry: Orbit,
  "number-system": Hash,
  averages: BarChart3,
  discount: Tag,
  "mixture-and-alligation": FlaskConical,
  partnership: Users2,
  "square-roots": Radical,
  "statistics-probability": PieChart,

  // English topics
  "synonyms-antonyms": ArrowLeftRight,
  "one-word-substitution": BookMarked,
  "idioms-phrases": MessageSquare,
  "spot-the-error-error-detection": Search,
  "sentence-correction-improvement": Edit3,
  "cloze-test": FileSpreadsheet,
  "reading-comprehension": Newspaper,
  "active-passive-voice": RefreshCw,
  "direct-indirect-narration": MessageCircle,
  tenses: Clock,
  "subject-verb-agreement": Scale,
  "para-jumbles": Shuffle,
  "fill-in-the-blanks": Puzzle,
  "spelling-misspelled-words": SpellCheck,
  prepositions: Navigation,
  articles: FileText,
  conjunctions: Link2,
  "homonyms-homophones": Volume2,
  "sentence-structure": Layout,
  "para-sentence-completion": CheckSquare,
  pronouns: UserCheck,
  modifiers: Target,
  parallelism: AlignLeft,

  // General Awareness topics
  history: Landmark,
  polity: Scale,
  geography: Globe,
  "general-science": Atom,
  economics: TrendingUp,
  "current-affairs": Flame,
  "static-gk": BookOpenCheck,
};

// ── Subject Fallback Icons ───────────────────────────────────────────────────
const SUBJECT_DEFAULT_ICONS: Record<string, LucideIcon> = {
  mathematics: Calculator,
  english: Languages,
  "general-awareness": Globe,
  reasoning: Brain,
};

// ── Mode Metadata ─────────────────────────────────────────────────────────────
const MODE_DETAILS: Record<
  string,
  { label: string; sub: string; icon: LucideIcon; badge: string }
> = {
  concept: {
    label: "PYQ",
    sub: "Previous year exam questions organized by concept",
    icon: FileQuestion,
    badge: "PYQ",
  },
  formula: {
    label: "CareerWill",
    sub: "Core pattern, vocabulary, and formula shortcuts practice",
    icon: BookOpenCheck,
    badge: "CareerWill",
  },
  mixed: {
    label: "PW",
    sub: "Comprehensive mixture of all topic patterns",
    icon: Shuffle,
    badge: "PW",
  },
  "ai-challenge": {
    label: "Selection Way",
    sub: "Speed-focused adaptive assessment test",
    icon: Zap,
    badge: "Selection Way",
  },
  easy: {
    label: "Topic Mix",
    sub: "Foundation & standard difficulty patterns",
    icon: Compass,
    badge: "Topic Mix",
  },
  "topic-mix": {
    label: "Topic Mix",
    sub: "Foundation & standard difficulty patterns",
    icon: Compass,
    badge: "Topic Mix",
  },
  hard: {
    label: "Tier 2",
    sub: "Advanced multi-step problems & high-tier patterns",
    icon: Flame,
    badge: "Tier 2",
  },
  "study-mode": {
    label: "Study Mode",
    sub: "Interactive study deck and vocabulary practice",
    icon: Sparkles,
    badge: "Study Mode",
  },
};

// ── Alphabet definition for letter filtering ──────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ── macOS Unified Quiz Start Studio Component ─────────────────────────────────
interface MacOsQuizStartStudioProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode?: QuizMode;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  search?: string;
  selectedLetters?: Set<string>;
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: () => void;
  letterCounts?: Record<string, number>;
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}

function MacOsQuizStartStudio({
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

// ── iOS Mobile Quiz Start Component (< 768px) ─────────────────────────────────
interface IosQuizStartMobileProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode?: QuizMode;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  search?: string;
  selectedLetters?: Set<string>;
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: () => void;
  letterCounts?: Record<string, number>;
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}

function IosQuizStartMobile({
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
                          style={{ background: group.bg, color: group.accent }}
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

// ── Responsive Unified Wrapper ────────────────────────────────────────────────
function UnifiedQuizStartView(props: MacOsQuizStartStudioProps) {
  const quizTheme = useQuizTheme();

  return (
    <div className={styles.pageRoot} data-theme={quizTheme}>
      {/* Desktop PC View (macOS Studio Layout >= 768px) */}
      <div className={styles.desktopContainer}>
        <MacOsQuizStartStudio {...props} />
      </div>

      {/* Mobile Handheld View (iOS Style Layout < 768px) */}
      <div className={styles.mobileContainer}>
        <IosQuizStartMobile {...props} />
      </div>
    </div>
  );
}

export function SeriesConceptStart(props: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}) {
  return <UnifiedQuizStartView {...props} mode="concept" />;
}

export function SeriesFormulaStart(props: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode: QuizMode;
  examFilter: string;
  examOptions: string[];
  questionCount: number;
  onExamChange: (exam: string) => void;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  search?: string;
  selected: Set<string>;
  conceptCount: number;
  selectedLetters?: Set<string>;
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: () => void;
  letterCounts?: Record<string, number>;
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}) {
  return <UnifiedQuizStartView {...props} />;
}
