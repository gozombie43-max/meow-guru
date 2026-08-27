"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
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
  BookOpen,
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
import { useThemeMode } from "@/hooks/useTheme";
import { SubjectConfig, ClassificationGroup, QuizMode } from "../types";
import { useQuizTheme, toggleQuizTheme } from "../utils";
import styles from "./SeriesStartViews.module.css";

// ── Complete Topic Icon Mapping Across All 4 Subjects ────────────────────────
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
  availableLetters,
  onCategoryChange,
  onExamChange,
  onSearchChange,
  onToggleGroup,
  onStart,
}: MacOsQuizStartStudioProps) {
  const router = useRouter();
  const { theme } = useThemeMode();
  const quizTheme = useQuizTheme();
  const [internalSearch, setInternalSearch] = useState("");
  const activeSearch = externalSearch !== undefined ? externalSearch : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
  };

  const fallbackSubjectIcon = SUBJECT_DEFAULT_ICONS[subjectConfig.subjectId] || Brain;
  const TopicIcon = TOPIC_ICONS[slug] || fallbackSubjectIcon;
  const modeInfo = MODE_DETAILS[mode] || MODE_DETAILS.concept;
  const ModeIcon = modeInfo.icon;

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
    }
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
    return groups.filter((group) => {
      if (activeSearch.trim()) {
        const query = activeSearch.toLowerCase();
        const matchLabel = group.label.toLowerCase().includes(query);
        const matchConcepts = group.concepts.some((c) => c.toLowerCase().includes(query));
        if (!matchLabel && !matchConcepts) return false;
      }
      return true;
    });
  }, [groups, activeSearch]);

  // Concept coverage calculations
  const selectedCount = selected.size;
  const coveragePercent =
    conceptCount > 0
      ? selectedCount === 0
        ? 100
        : Math.round((selectedCount / conceptCount) * 100)
      : 100;

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
              onClick={toggleQuizTheme}
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
                <span className={styles.statLabel}>Selected Concepts</span>
                <span className={styles.statValue}>
                  {selectedCount === 0 ? "All" : selectedCount} of {conceptCount}
                </span>
              </div>
            </div>

            {/* Coverage Progress Bar */}
            <div className={styles.coverageSection}>
              <div className={styles.coverageHeader}>
                <span>Syllabus Coverage</span>
                <span className={styles.coveragePct}>{coveragePercent}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${coveragePercent}%` }} />
              </div>
            </div>

            {/* Batch Action Buttons */}
            <div className={styles.batchActions}>
              <button
                type="button"
                onClick={handleSelectAll}
                className={styles.batchBtn}
                disabled={isAllSelected}
              >
                <CheckCircle2 size={12} />
                <span>Select All</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className={styles.batchBtn}
                disabled={selectedCount === 0}
              >
                <X size={12} />
                <span>Clear All</span>
              </button>
            </div>
          </aside>

          {/* ── Right Concept Canvas ── */}
          <main className={styles.rightCanvas}>
            {/* Top Filter & Search Toolbar */}
            <div className={styles.canvasToolbar}>
              <div className={styles.chipsScroll} role="tablist">
                <button
                  type="button"
                  className={`${styles.chipBtn} ${category === "All" ? styles.chipBtnActive : ""}`}
                  onClick={() => onCategoryChange("All")}
                >
                  <span className={styles.chipDot} />
                  <span>All</span>
                  <span className={styles.chipCount}>{conceptCount}</span>
                </button>
                {subjectConfig.classificationCategories
                  .filter((item) => (categoryCounts[item.label] || 0) > 0)
                  .map((item) => (
                    <button
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
                />
                {activeSearch && (
                  <button
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

            {/* Alphabet / Letter Filter Bar for Synonyms & Antonyms in Formula / Vocabulary Mode */}
            {subjectConfig.subjectId === "english" && slug === "synonyms-antonyms" && mode === "formula" && (
              <div className={styles.letterBarSection}>
                <div className={styles.letterBarHeader}>
                  <span>Filter by Letter (A–Z)</span>
                  <span className={styles.letterBarCount}>
                    {selectedLetters && selectedLetters.size > 0
                      ? `${selectedLetters.size} letter${selectedLetters.size > 1 ? "s" : ""} active (${Array.from(selectedLetters).sort().join(", ")})`
                      : "All letters"}
                  </span>
                </div>
                <div className={styles.letterBarScroll} role="toolbar" aria-label="Alphabet filter">
                  <button
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
            )}

            {/* Concept Groups Grid */}
            <div className={styles.conceptGrid}>
              {filteredGroups.map((group) => {
                const selectedInGroup = group.concepts.filter((concept) =>
                  selected.has(concept)
                ).length;
                const isSelected =
                  selectedInGroup === group.concepts.length && group.concepts.length > 0;
                const isPartial = selectedInGroup > 0 && !isSelected;

                return (
                  <div
                    key={group.id}
                    className={`${styles.conceptCard} ${
                      isSelected || isPartial ? styles.conceptCardSelected : ""
                    }`}
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
                    <div className={styles.conceptCardLeft}>
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

                    <div
                      className={`${styles.conceptCheckbox} ${
                        isSelected || isPartial ? styles.conceptCheckboxChecked : ""
                      }`}
                    >
                      {(isSelected || isPartial) && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}

              {filteredGroups.length === 0 && (
                <div className={styles.emptyState}>
                  <p>No concept modules matched your filter.</p>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Bottom Dock / Sticky Launch Footer ── */}
        <footer className={styles.studioFooter}>
          <div className={styles.footerLeft}>
            <div className={styles.statusIndicator} />
            <span className={styles.statusText}>
              <span className={styles.statusBold}>{questionCount} Questions</span> Ready •{" "}
              {selectedCount === 0 ? "All Concepts" : `${selectedCount} Concepts`} Selected
            </span>
          </div>

          <button
            type="button"
            onClick={onStart}
            className={styles.startBtn}
            title="Launch Quiz (Enter)"
          >
            <Sparkles size={14} fill="currentColor" />
            <span>Start Quiz</span>
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
}

function IosQuizStartMobile({
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
  availableLetters,
  onCategoryChange,
  onExamChange,
  onSearchChange,
  onToggleGroup,
  onStart,
}: IosQuizStartMobileProps) {
  const router = useRouter();
  const { theme } = useThemeMode();
  const [internalSearch, setInternalSearch] = useState("");
  const activeSearch = externalSearch !== undefined ? externalSearch : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
  };

  const modeInfo = MODE_DETAILS[mode] || MODE_DETAILS.concept;
  const selectedCount = selected.size;
  const selectedQuestionLabel =
    selectedCount === 0
      ? "all concepts"
      : `${selectedCount} concept${selectedCount === 1 ? "" : "s"}`;

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
    }
  }, [router, routeBase, subjectConfig.subjectId, slug]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (activeSearch.trim()) {
        const query = activeSearch.toLowerCase();
        const matchLabel = group.label.toLowerCase().includes(query);
        const matchConcepts = group.concepts.some((c) => c.toLowerCase().includes(query));
        if (!matchLabel && !matchConcepts) return false;
      }
      return true;
    });
  }, [groups, activeSearch]);

  const subjectAccent = theme === "dark" ? "#0a84ff" : "#0071e3";

  return (
    <div
      className={styles.iosScreen}
      data-theme={theme}
      style={{ "--ios-accent": subjectAccent } as React.CSSProperties}
    >
      {/* ── Top Navigation Bar ── */}
      <header className={styles.iosNav}>
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
        {/* Select Exam Target */}
        <p className={styles.iosHeading}>Select Exam Target</p>
        <div className={styles.iosDropdownContainer}>
          <div className={styles.iosDropdownRow}>
            <span className={styles.iosTargetIconBox}>
              <Target size={15} />
            </span>
            <span className={styles.iosDropdownLabel}>Exam Name</span>
            <div className={styles.iosSelectWrapper}>
              <select
                value={examFilter || "all"}
                onChange={(e) => onExamChange(e.target.value === "all" ? "" : e.target.value)}
                className={styles.iosSelect}
              >
                {examOptions.map((ex) => (
                  <option key={ex} value={ex === "all" ? "all" : ex}>
                    {ex === "all" ? "All Exams" : ex}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.iosSelectChevron} />
            </div>
          </div>
        </div>

        {/* Category Chips */}
        <div className={styles.iosChipsScroll} aria-label="Concept category filters">
          <button
            type="button"
            className={`${styles.iosChip} ${category === "All" ? styles.iosChipActive : ""}`}
            onClick={() => onCategoryChange("All")}
          >
            <i className={styles.iosChipDot} style={{ background: subjectAccent }} />
            <span>All</span>
            <span className={styles.iosChipCount}>{conceptCount}</span>
          </button>
          {subjectConfig.classificationCategories
            .filter((item) => (categoryCounts[item.label] ?? 0) > 0)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.iosChip} ${
                  category === item.label ? styles.iosChipActive : ""
                }`}
                onClick={() => onCategoryChange(item.label)}
              >
                <i className={styles.iosChipDot} style={{ background: item.accent }} />
                <span>{item.label}</span>
                <span className={styles.iosChipCount}>{categoryCounts[item.label]}</span>
              </button>
            ))}
        </div>

        {/* Alphabet / Letter Filter for English Synonyms Formula Mode */}
        {subjectConfig.subjectId === "english" && slug === "synonyms-antonyms" && mode === "formula" && (
          <div className={styles.iosLetterSection}>
            <div className={styles.iosLetterHeader}>
              <p className={styles.iosLetterHeading}>Filter by Letter</p>
              <span className={styles.iosLetterActiveLabel}>
                {selectedLetters && selectedLetters.size > 0
                  ? Array.from(selectedLetters).sort().join(", ")
                  : "All Letters"}
              </span>
            </div>
            <div className={styles.iosLetterScroll} aria-label="Alphabet filters">
              <button
                type="button"
                className={`${styles.iosLetterPill} ${
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
                  <button
                    key={letter}
                    type="button"
                    className={`${styles.iosLetterPill} ${isSelected ? styles.iosLetterPillActive : ""} ${
                      !hasQuestions ? styles.iosLetterPillDisabled : ""
                    }`}
                    onClick={() => onToggleLetter && onToggleLetter(letter)}
                    disabled={!hasQuestions}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            />
            {activeSearch && (
              <button
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

            return (
              <button
                key={group.id}
                type="button"
                className={styles.iosConceptRow}
                onClick={() => onToggleGroup(group.concepts)}
                aria-pressed={isSelected}
              >
                <span
                  className={`${styles.iosCheckCircle} ${
                    isSelected || isPartial ? styles.iosCheckCircleChecked : ""
                  }`}
                >
                  {(isSelected || isPartial) && <Check size={12} strokeWidth={3} />}
                </span>

                <span
                  className={styles.iosGroupTile}
                  style={{ background: group.bg, color: group.accent }}
                >
                  {group.icon}
                </span>

                <span className={styles.iosRowCopy}>
                  <strong className={styles.iosGroupTitle}>{group.label}</strong>
                  <small className={styles.iosGroupMeta}>
                    {group.concepts.length} concept{group.concepts.length === 1 ? "" : "s"}
                    {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                  </small>
                </span>
              </button>
            );
          })}

          {filteredGroups.length === 0 && (
            <p className={styles.iosEmptyText}>No concept groups match your filter.</p>
          )}
        </section>
      </main>

      {/* ── Fixed Bottom Launch Toolbar ── */}
      <footer className={styles.iosToolbar}>
        <p className={styles.iosToolbarText}>
          <b>{questionCount}</b> questions ready · <span>{selectedQuestionLabel}</span>
        </p>
        <button type="button" onClick={onStart} className={styles.iosStartBtn}>
          <Sparkles size={16} fill="currentColor" />
          <span>Start Quiz</span>
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

// ── Exported Wrapper Components for QuizEngine ─────────────────────────────────
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
}) {
  return <UnifiedQuizStartView {...props} />;
}
