"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  LayoutGrid,
  List as ListIcon,
  Sun,
  Moon,
  ChevronRight,
  BookOpen,
  Zap,
  Sparkles,
  X,
  Sidebar as SidebarIcon,
  Lock,
  MessageSquareCode,
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
  Brain,
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
  BookOpenCheck,
  Shuffle,
  Flame,
  Layers,
  Play,
  type LucideIcon,
} from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";
import { useThemeMode } from "@/hooks/useTheme";
import styles from "./reasoning.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Priority = "very-high" | "high" | "medium" | "low" | "least";

export interface Topic {
  id: number;
  name: string;
  slug: string;
  subtopics: string[];
  priority: Priority;
  questions: string;
  icon: LucideIcon;
  description: string;
  expectedMarks: string;
}

// ── 25 SSC Reasoning Topics with Solid Monochrome SVG Icons ───────────────────
const TOPICS: Topic[] = [
  {
    id: 1,
    priority: "very-high",
    icon: Lock,
    name: "Coding & Decoding",
    slug: "coding-decoding",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Pattern deciphering based on alphabetical shifts, reverse letters, numerical positions, and symbol operations.",
    subtopics: ["Letter Coding", "Number Coding", "Symbolic Coding", "Numerical Operations", "Mixed Coding"],
  },
  {
    id: 2,
    priority: "very-high",
    icon: MessageSquareCode,
    name: "Syllogism & Inferences",
    slug: "syllogism-inferences",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Deductive reasoning testing validity of conclusions and possibilities from premise statements.",
    subtopics: ["Two Statement", "Three Statement", "Possibility Cases", "Drawing Inferences", "Either-Or Logic"],
  },
  {
    id: 3,
    priority: "very-high",
    icon: Puzzle,
    name: "Puzzle & Seating Arrangement",
    slug: "puzzle-seating-arrangement",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Constraint satisfaction problems involving linear, circular, floor, and multi-parameter arrangements.",
    subtopics: ["Linear Seating", "Circular Seating", "Floor Puzzle", "Box Puzzle", "Day/Month Puzzle"],
  },
  {
    id: 4,
    priority: "very-high",
    icon: TrendingUp,
    name: "Series",
    slug: "series",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Progressions based on arithmetic intervals, prime steps, letter gaps, and alternating logic.",
    subtopics: ["Number Series", "Letter Series", "Figural Series", "Alpha-Numeric Series", "Continuous Pattern"],
  },
  {
    id: 5,
    priority: "very-high",
    icon: ArrowLeftRight,
    name: "Analogy",
    slug: "analogy",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Identifying underlying relationships between pairs of words, numbers, letters, or geometric shapes.",
    subtopics: ["Semantic Analogy", "Symbolic/Number Analogy", "Figural Analogy", "Word Analogy"],
  },
  {
    id: 6,
    priority: "very-high",
    icon: Filter,
    name: "Classification (Odd One Out)",
    slug: "classification-odd-one-out",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Spotting anomalies among a set of entities using properties of squares, cubes, grammar, or semantics.",
    subtopics: ["Semantic Classification", "Figural Classification", "Symbolic Classification", "Number Based"],
  },
  {
    id: 7,
    priority: "high",
    icon: Users2,
    name: "Blood Relations",
    slug: "blood-relations",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Family tree decoding, generation leaps, gender deductions, and coded symbolic relations.",
    subtopics: ["Family Tree", "Coded Blood Relations", "Pointing to Photograph", "Statement Based"],
  },
  {
    id: 8,
    priority: "high",
    icon: Compass,
    name: "Direction & Distance",
    slug: "direction-distance",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Navigational trajectories, Pythagoras theorem applications, angle rotations, and shadow logic.",
    subtopics: ["Basic 8 Directions", "Distance Calculation", "Shadow Problems", "Space Orientation"],
  },
  {
    id: 9,
    priority: "high",
    icon: CircleDot,
    name: "Venn Diagram",
    slug: "venn-diagram",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Set theory visualizations representing subsets, intersections, and multi-circle population counts.",
    subtopics: ["Relationship Diagrams", "Finding Elements", "Shaded Region", "3-Circle Venn"],
  },
  {
    id: 10,
    priority: "high",
    icon: Scale,
    name: "Inequalities",
    slug: "inequalities",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Comparing quantities using algebraic inequality symbols (<, >, ≤, ≥, =) and chain statements.",
    subtopics: ["Direct Inequalities", "Coded Inequalities", "Mathematical Inequalities", "Chain Statements"],
  },
  {
    id: 11,
    priority: "high",
    icon: Calculator,
    name: "Mathematical Operations",
    slug: "mathematical-symbolic-operations",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Evaluating expressions via BODMAS rule after swapping operators, digits, or symbolic substitutions.",
    subtopics: ["BODMAS Based", "Symbol Substitution", "Sign Interchange", "Numerical Operations"],
  },
  {
    id: 12,
    priority: "high",
    icon: Trophy,
    name: "Order & Ranking",
    slug: "order-ranking",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Determining rank, position from ends, total people in a row, and position interchange deductions.",
    subtopics: ["Position from Top/Bottom", "Rank in Row/Column", "Height/Weight Ordering", "Overlapping Positions"],
  },
  {
    id: 13,
    priority: "medium",
    icon: FileCheck,
    name: "Statement & Conclusion",
    slug: "statement-conclusion",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Determining whether a given conclusion logically follows strictly from the premise.",
    subtopics: ["Follows/Does Not Follow", "Implicit Conclusions", "Critical Thinking"],
  },
  {
    id: 14,
    priority: "medium",
    icon: HelpCircle,
    name: "Statement & Assumptions",
    slug: "statement-assumptions",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Identifying unstated premises or implicit assumptions taken for granted before making a statement.",
    subtopics: ["Implicit Assumptions", "Explicit Assumptions", "Contextual Premises"],
  },
  {
    id: 15,
    priority: "medium",
    icon: Swords,
    name: "Statement & Arguments",
    slug: "statement-arguments",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Evaluating whether proposed arguments are strong (logical, practical) or weak (biased, superficial).",
    subtopics: ["Strong/Weak Arguments", "Course of Action", "Cause & Effect"],
  },
  {
    id: 16,
    priority: "medium",
    icon: Brain,
    name: "Critical Thinking",
    slug: "problem-solving-critical-thinking",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Multi-step contextual decision making, conditional rules, and applied logical inferences.",
    subtopics: ["Applied Logical Reasoning", "Step-based Problems", "Condition Based Logic"],
  },
  {
    id: 17,
    priority: "medium",
    icon: Shapes,
    name: "Non-Verbal Figures",
    slug: "non-verbal-figures",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Visual pattern analysis including embedded figures, figure completion, and counting shapes.",
    subtopics: ["Embedded Figures", "Figure Completion", "Counting Figures", "Figural Pattern"],
  },
  {
    id: 18,
    priority: "medium",
    icon: Scissors,
    name: "Paper Folding & Cutting",
    slug: "paper-folding-cutting",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Predicting symmetric hole patterns and punched cutouts upon unfolding folded sheets.",
    subtopics: ["Punched Hole", "Pattern Folding & Unfolding", "Symmetry Reflection"],
  },
  {
    id: 19,
    priority: "low",
    icon: FlipHorizontal,
    name: "Mirror & Water Image",
    slug: "mirror-water-image",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Lateral inversion (mirror image) and vertical inversion (water image) of alphanumeric strings and shapes.",
    subtopics: ["Letter/Number Mirror", "Clock Mirror Image", "Figural Mirror", "Water Image"],
  },
  {
    id: 20,
    priority: "low",
    icon: Box,
    name: "Cube & Dice",
    slug: "cube-dice",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Determining opposite faces from multiple rotations, unfolding standard/general dice, and painted cube cuts.",
    subtopics: ["Open/Closed Dice", "Face Opposite", "Cube Painting & Cutting", "3D Orientation"],
  },
  {
    id: 21,
    priority: "low",
    icon: Table2,
    name: "Matrix",
    slug: "matrix",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Row-column code lookups and missing numerical values calculated from horizontal/vertical logic.",
    subtopics: ["Missing Number/Letter", "Row-Column Coding", "Figure Matrix", "Grid Logic"],
  },
  {
    id: 22,
    priority: "low",
    icon: SpellCheck,
    name: "Logical Sequence of Words",
    slug: "logical-sequence-of-words",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Arranging terms in chronological, functional, developmental, or dictionary alphabetical order.",
    subtopics: ["Dictionary Order", "Process/Hierarchy Order", "Word Building", "Natural Sequence"],
  },
  {
    id: 23,
    priority: "least",
    icon: Heart,
    name: "Emotional Intelligence",
    slug: "emotional-intelligence",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Situational discernment regarding emotional self-awareness, empathy, and workplace composure.",
    subtopics: ["Recognising Emotions", "Empathy Based", "Situational EQ", "Self-awareness"],
  },
  {
    id: 24,
    priority: "least",
    icon: Share2,
    name: "Social Intelligence",
    slug: "social-intelligence",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Contextual problem-solving in interpersonal dynamics, civic duties, and ethical dilemmas.",
    subtopics: ["Socially Appropriate Responses", "Interpersonal Situations", "Group Behavior"],
  },
  {
    id: 25,
    priority: "least",
    icon: Type,
    name: "Word Building",
    slug: "word-building",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Forming meaningful English words or identifying impossible words from a master letter repository.",
    subtopics: ["Form Words from Letters", "Find Words Within Words", "Meaningful Word Formation"],
  },
];

// ── Priority Visual Config (Clean Monochrome) ─────────────────────────────────
const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; badgeBg: string; badgeColor: string }
> = {
  "very-high": {
    label: "Core",
    badgeBg: "rgba(0, 113, 227, 0.1)",
    badgeColor: "var(--mac-blue)",
  },
  high: {
    label: "High",
    badgeBg: "var(--mac-surface-hover)",
    badgeColor: "var(--mac-text-primary)",
  },
  medium: {
    label: "Medium",
    badgeBg: "var(--mac-surface-hover)",
    badgeColor: "var(--mac-text-secondary)",
  },
  low: {
    label: "Low",
    badgeBg: "var(--mac-surface-hover)",
    badgeColor: "var(--mac-text-secondary)",
  },
  least: {
    label: "Least",
    badgeBg: "var(--mac-surface-hover)",
    badgeColor: "var(--mac-text-tertiary)",
  },
};

const CATEGORIES = [
  { id: "all", label: "All Modules", icon: Layers },
  { id: "very-high", label: "Core", icon: Zap },
  { id: "high", label: "High", icon: TrendingUp },
  { id: "medium", label: "Medium", icon: CircleDot },
  { id: "low", label: "Low", icon: Filter },
  { id: "least", label: "Least", icon: Shapes },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export const PRACTICE_MODES = [
  {
    key: "concept",
    title: "PYQ Practice",
    sub: "Previous year Qs",
    mode: "concept",
    icon: FileQuestion,
  },
  {
    key: "formula",
    title: "Pattern Bank",
    sub: "Core formulas",
    mode: "formula",
    icon: BookOpenCheck,
  },
  {
    key: "mixed",
    title: "Mixed PW",
    sub: "Mixed practice",
    mode: "mixed",
    icon: Shuffle,
  },
  {
    key: "ai-challenge",
    title: "AI Challenge",
    sub: "Speed test",
    mode: "ai-challenge",
    icon: Zap,
  },
  {
    key: "easy",
    title: "Topic Mix",
    sub: "Foundation easy",
    mode: "easy",
    icon: Compass,
  },
  {
    key: "hard",
    title: "Tier 2 Hard",
    sub: "Advanced level",
    mode: "hard",
    icon: Flame,
  },
] as const;

export default function ReasoningPage() {
  const router = useRouter();
  const { theme, toggleThemeMode } = useThemeMode();
  const isDark = theme === "dark";

  // States
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTopicId, setSelectedTopicId] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchCat = activeCategory === "all" || t.priority === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  // Selected topic object
  const selectedTopic = useMemo(() => {
    return TOPICS.find((t) => t.id === selectedTopicId) || TOPICS[0];
  }, [selectedTopicId]);

  // Current index in filtered list
  const currentIndex = useMemo(() => {
    return filteredTopics.findIndex((t) => t.id === selectedTopicId);
  }, [filteredTopics, selectedTopicId]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TOPICS.length };
    TOPICS.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return counts;
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA"].includes(target?.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        else target.blur();
        return;
      }

      if (!isInput && filteredTopics.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          const nextIdx = (currentIndex + 1) % filteredTopics.length;
          setSelectedTopicId(filteredTopics[nextIdx].id);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          const prevIdx = (currentIndex - 1 + filteredTopics.length) % filteredTopics.length;
          setSelectedTopicId(filteredTopics[prevIdx].id);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedTopic) {
            router.push(`/reasoning/${selectedTopic.slug}/quiz?mode=concept`);
          }
        }
      }
    },
    [currentIndex, filteredTopics, selectedTopic, searchQuery, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // If filtered list changes and selected topic is no longer visible, auto-select first visible topic
  useEffect(() => {
    if (filteredTopics.length > 0 && !filteredTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(filteredTopics[0].id);
    }
  }, [filteredTopics, selectedTopicId]);

  const SelectedIcon = selectedTopic.icon;

  return (
    <div className={styles.pageRoot}>
      {/* =========================================================================
          DESKTOP PC VIEW (Zero-Scroll 100vh macOS Studio >= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <div className={styles.macWindow}>
          {/* ── Titlebar & Toolbar (44px) ── */}
          <header className={styles.titlebar}>
            <div className={styles.titlebarLeft}>
              {/* Traffic Lights */}
              <MacTrafficLights
                onClose={() => router.push("/")}
                onMinimize={() => setSidebarOpen((prev) => !prev)}
                onMaximize={() => router.push(`/reasoning/${selectedTopic.slug}`)}
              />

              {/* Navigation Arrows */}
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => router.back()}
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft size={13} />
              </button>

              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle Sidebar"
                title="Toggle Sidebar"
              >
                <SidebarIcon size={13} />
              </button>

              {/* Window Title */}
              <div className={styles.windowTitleGroup}>
                <span className={styles.windowIcon} aria-hidden="true">
                  <Brain size={14} />
                </span>
                <span className={styles.windowTitle}>Reasoning Studio</span>
              </div>
            </div>

            {/* Titlebar Center: Spotlight Search */}
            <div className={styles.titlebarCenter}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search topics, subtopics, rules... (⌘K)"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search reasoning topics"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear Search"
                  >
                    <X size={9} />
                  </button>
                ) : (
                  <kbd className={styles.searchShortcut}>⌘ K</kbd>
                )}
              </div>
            </div>

            {/* Titlebar Right: View Switchers & Controls */}
            <div className={styles.titlebarRight}>
              {/* Segmented View Mode Control */}
              <div className={styles.segmentedControl} role="group" aria-label="View Mode">
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${viewMode === "grid" ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid Matrix View"
                  title="Grid Matrix View"
                >
                  <LayoutGrid size={12} />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${viewMode === "list" ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List Table View"
                  title="List Table View"
                >
                  <ListIcon size={12} />
                  <span>List</span>
                </button>
              </div>

              {/* Dark/Light Theme Toggle */}
              <button
                type="button"
                className={styles.actionBtn}
                onClick={toggleThemeMode}
                aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            </div>
          </header>

          {/* ── 3-Pane Body ── */}
          <div className={styles.windowBody}>
            {/* Left Sidebar (200px) */}
            <aside
              className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarHidden : ""}`}
              aria-label="Reasoning Categories"
            >
              {/* Section: Categories */}
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarHeading}>Categories</div>
                {CATEGORIES.map((cat) => {
                  const active = activeCategory === cat.id;
                  const count = categoryCounts[cat.id] || 0;
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ""}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      <div className={styles.sidebarItemLeft}>
                        <span className={styles.sidebarItemIcon}>
                          <CatIcon size={12} />
                        </span>
                        <span>{cat.label}</span>
                      </div>
                      <span className={styles.sidebarItemCount}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Center Canvas: 25-Topics Dense Matrix / List */}
            <main className={styles.mainCanvas} aria-label="Reasoning Topics Matrix">
              {/* Canvas Header (30px) */}
              <div className={styles.canvasHeader}>
                <div className={styles.canvasHeaderTitle}>
                  <span>{CATEGORIES.find((c) => c.id === activeCategory)?.label}</span>
                  <span style={{ color: "var(--mac-text-tertiary)", fontWeight: 500 }}>
                    ({filteredTopics.length})
                  </span>
                </div>

                <div className={styles.canvasMeta}>
                  {(searchQuery || activeCategory !== "all") && (
                    <button
                      type="button"
                      className={styles.clearFilterLink}
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("all");
                      }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Matrix Viewport (Vertical scrolling) */}
              <div className={styles.canvasViewport}>
                {filteredTopics.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🔍</div>
                    <div className={styles.emptyStateTitle}>No reasoning topics found</div>
                    <p className={styles.emptyStateDesc}>
                      No modules matched &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("all");
                      }}
                      style={{ marginTop: "8px" }}
                    >
                      Show All Topics
                    </button>
                  </div>
                ) : viewMode === "grid" ? (
                  /* ── Square Monochrome Grid (Click to select) ── */
                  <div className={styles.denseGrid}>
                    {filteredTopics.map((topic) => {
                      const isSelected = selectedTopicId === topic.id;
                      const IconComp = topic.icon;
                      return (
                        <div
                          key={topic.id}
                          className={`${styles.compactTile} ${
                            isSelected ? styles.compactTileSelected : ""
                          }`}
                          onClick={() => setSelectedTopicId(topic.id)}
                        >
                          <div className={styles.tileIconBox}>
                            <IconComp size={22} strokeWidth={2} />
                          </div>
                          <div className={styles.tileBody}>
                            <span className={styles.tileName} title={topic.name}>
                              {topic.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Dense List Table View (Click to select) ── */
                  <table className={styles.denseTable}>
                    <thead>
                      <tr>
                        <th>Topic Name</th>
                        <th>Priority</th>
                        <th>Exam Weight</th>
                        <th>Subtopics</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTopics.map((topic) => {
                        const cfg = PRIORITY_CONFIG[topic.priority];
                        const isSelected = selectedTopicId === topic.id;
                        const IconComp = topic.icon;
                        return (
                          <tr
                            key={topic.id}
                            className={`${styles.denseTableRow} ${
                              isSelected ? styles.denseTableRowSelected : ""
                            }`}
                            onClick={() => setSelectedTopicId(topic.id)}
                          >
                            <td>
                              <div className={styles.tableTopicCell}>
                                <div className={styles.tableTopicIcon}>
                                  <IconComp size={13} strokeWidth={2.2} />
                                </div>
                                <span className={styles.tableTopicName}>{topic.name}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={styles.tablePriorityBadge}
                                style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td>
                              <span className={styles.tableWeightBadge}>
                                {topic.questions} Qs ({topic.expectedMarks})
                              </span>
                            </td>
                            <td>
                              <div
                                className={styles.tableSubtopics}
                                title={topic.subtopics.join(", ")}
                              >
                                {topic.subtopics.join(" • ")}
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link
                                href={`/reasoning/${topic.slug}`}
                                className={styles.tableActionBtn}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </main>

            {/* Right: Live Command Deck (320px) */}
            <aside className={styles.commandDeck} aria-label="Topic Command Deck">
              {/* ── Hero Topic Card ── */}
              <div className={styles.heroCard}>
                <div className={styles.heroCardHeader}>
                  <div className={styles.heroCardIconBox}>
                    <SelectedIcon size={20} strokeWidth={2.2} />
                  </div>
                  <div className={styles.heroCardTitleGroup}>
                    <h2 className={styles.heroCardTitle}>{selectedTopic.name}</h2>
                    <span
                      className={styles.heroPriorityPill}
                      style={{
                        background: PRIORITY_CONFIG[selectedTopic.priority].badgeBg,
                        color: PRIORITY_CONFIG[selectedTopic.priority].badgeColor,
                      }}
                    >
                      {PRIORITY_CONFIG[selectedTopic.priority].label} Priority
                    </span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className={styles.heroStatsGrid}>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>Exam Weight</span>
                    <span className={styles.heroStatValue}>{selectedTopic.questions} Qs</span>
                  </div>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>Score Potential</span>
                    <span className={styles.heroStatValue}>{selectedTopic.expectedMarks}</span>
                  </div>
                </div>
              </div>

              {/* ── Practice Modes (Single Column) ── */}
              <div className={styles.deckSection}>
                <div className={styles.deckSectionHeader}>
                  <span className={styles.deckSectionTitle}>Practice Modes</span>
                  <span className={styles.deckSectionBadge}>6 Modes</span>
                </div>

                <div className={styles.modesList}>
                  {PRACTICE_MODES.map((pm) => {
                    const ModeIcon = pm.icon;
                    return (
                      <Link
                        key={pm.key}
                        href={`/reasoning/${selectedTopic.slug}/quiz?mode=${pm.mode}`}
                        className={styles.modeCard}
                        title={`Start ${pm.title}`}
                      >
                        <div className={styles.modeCardLeft}>
                          <div className={styles.modeCardIcon}>
                            <ModeIcon size={14} strokeWidth={2.2} />
                          </div>
                          <div className={styles.modeCardInfo}>
                            <span className={styles.modeCardTitle}>{pm.title}</span>
                            <span className={styles.modeCardSub}>{pm.sub}</span>
                          </div>
                        </div>
                        <div className={styles.playBtnCircle} aria-hidden="true">
                          <Play size={10} fill="#ffffff" color="#ffffff" style={{ marginLeft: "1.5px" }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* ── Reference & Resources ── */}
              <div className={styles.deckSection} style={{ marginTop: "auto" }}>
                <div className={styles.deckSectionHeader}>
                  <span className={styles.deckSectionTitle}>Resources</span>
                </div>

                <div className={styles.resourceList}>
                  <Link
                    href={`/reasoning/${selectedTopic.slug}/formula-notes`}
                    className={styles.resourceCard}
                    title="View Formulas, Tricks & Key Notes"
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <Sparkles size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>Formula & Tricks Bank</span>
                        <span className={styles.resourceCardSub}>Key shortcuts & cheat sheet</span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  <Link
                    href={`/reasoning/${selectedTopic.slug}`}
                    className={styles.resourceCard}
                    title="Open Complete Module Hub"
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <BookOpen size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>Complete Module Hub</span>
                        <span className={styles.resourceCardSub}>Deep-dive lessons & notes</span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>
                </div>
              </div>
            </aside>
          </div>

          {/* ── Bottom Status Dock (26px) ── */}
          <footer className={styles.statusBar}>
            <div className={styles.statusLeft} />

            <div className={styles.statusRight}>
              <div className={styles.shortcutHint}>
                <kbd className={styles.shortcutKey}>↑↓←→</kbd>
                <span>Navigate</span>
              </div>
              <div className={styles.shortcutHint}>
                <kbd className={styles.shortcutKey}>Enter</kbd>
                <span>Start</span>
              </div>
              <div className={styles.shortcutHint}>
                <kbd className={styles.shortcutKey}>⌘K</kbd>
                <span>Search</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={styles.mobileContainer}>
        {/* Mobile Topbar */}
        <header className={styles.mobileTopbar}>
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <span className={styles.mobileTopbarTitle}>Reasoning Topics</span>
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={toggleThemeMode}
            aria-label={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        <div className={styles.mobileBody}>
          {/* Search */}
          <div className={styles.mobileSearchRow}>
            <Search className={styles.mobileSearchIcon} size={15} />
            <input
              type="text"
              className={styles.mobileSearchInput}
              placeholder="Search topics…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search topics"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClearBtn}
                style={{ right: "12px", top: "50%", transform: "translateY(-50%)" }}
                onClick={() => setSearchQuery("")}
                aria-label="Clear Search"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Priority Tabs */}
          <div className={styles.mobileTabsScroll}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.mobileTabBtn} ${
                  activeCategory === cat.id ? styles.mobileTabActive : ""
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Count Row */}
          <div className={styles.mobileCountRow}>
            <span className={styles.mobileCountText}>
              {filteredTopics.length} topic{filteredTopics.length !== 1 ? "s" : ""}
            </span>
            {(searchQuery || activeCategory !== "all") && (
              <button
                type="button"
                className={styles.mobileResetLink}
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Topic List */}
          <div className={styles.mobileTopicList}>
            {filteredTopics.map((topic) => {
              const TopicIcon = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={`/reasoning/${topic.slug}`}
                  className={styles.mobileTopicCard}
                >
                  <div className={styles.mobileTopicIconBox}>
                    <TopicIcon size={16} strokeWidth={2.2} />
                  </div>

                  <div className={styles.mobileTopicInfo}>
                    <div className={styles.mobileTopicName}>{topic.name}</div>
                  </div>

                  <ChevronRight size={14} className={styles.mobileChevron} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}