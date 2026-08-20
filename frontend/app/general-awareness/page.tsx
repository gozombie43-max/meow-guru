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
  Landmark,
  Scale,
  Globe,
  Atom,
  TrendingUp,
  Flame,
  BookOpenCheck,
  FileQuestion,
  Shuffle,
  Layers,
  CircleDot,
  Filter,
  Play,
  type LucideIcon,
} from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";
import { useThemeMode } from "@/hooks/useTheme";
import styles from "./general-awareness.module.css";

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
  color: string;
  description: string;
  expectedMarks: string;
}

// ── 7 Core SSC General Awareness Topics with Distinctly Colored SVG Icons ─────
const TOPICS: Topic[] = [
  {
    id: 1,
    priority: "very-high",
    icon: Landmark,
    color: "#f59e0b",
    name: "History",
    slug: "history",
    questions: "4-5",
    expectedMarks: "8-10 Marks",
    description: "Chronological coverage of ancient civilizations, medieval empires, Mughal administration, British colonialism, and the Indian freedom struggle.",
    subtopics: [
      "Indus Valley & Vedic Age",
      "Buddhism, Jainism & Maurya Empire",
      "Delhi Sultanate & Mughal Era",
      "Maratha Empire & Bhakti Movement",
      "Revolt of 1857 & Social Reforms",
      "Freedom Struggle & Gandhian Movements",
    ],
  },
  {
    id: 2,
    priority: "very-high",
    icon: Scale,
    color: "#3b82f6",
    name: "Polity & Constitution",
    slug: "polity",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Constitutional articles, fundamental rights and duties, parliamentary procedures, judiciary powers, emergency provisions, and key amendments.",
    subtopics: [
      "Preamble & Constitutional Sources",
      "Fundamental Rights (Art 12-35) & Duties",
      "President, Prime Minister & Council",
      "Parliament (Lok Sabha / Rajya Sabha)",
      "Supreme Court & High Courts",
      "Constitutional Bodies & Amendments",
    ],
  },
  {
    id: 3,
    priority: "very-high",
    icon: Globe,
    color: "#10b981",
    name: "Geography",
    slug: "geography",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Physical geography, Indian river systems, mountain ranges, monsoon climate, mineral resources, agriculture, and global landforms.",
    subtopics: [
      "Indian Rivers & Drainage Basins",
      "Himalayan & Peninsular Mountains",
      "Climate, Monsoons & Soil Types",
      "Agriculture, Crops & Minerals",
      "National Parks & Biosphere Reserves",
      "World Continents, Straits & Oceans",
    ],
  },
  {
    id: 4,
    priority: "very-high",
    icon: Atom,
    color: "#06b6d4",
    name: "General Science",
    slug: "general-science",
    questions: "4-6",
    expectedMarks: "8-12 Marks",
    description: "Everyday physics principles, chemical formulas and reactions, human biology, vitamins and diseases, botany, and scientific discoveries.",
    subtopics: [
      "Physics: Motion, Light, Heat & Electricity",
      "Chemistry: Periodic Table, Acids, Bases & Metals",
      "Biology: Human Organ Systems & Nutrients",
      "Human Diseases, Pathogens & Vaccines",
      "Plant Physiology & Genetics",
      "Scientific Discoveries & Inventions",
    ],
  },
  {
    id: 5,
    priority: "high",
    icon: TrendingUp,
    color: "#8b5cf6",
    name: "Economics",
    slug: "economics",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Indian economic framework, GDP/GNP concepts, Union Budget, RBI monetary policies, inflation indices, banking terms, and government schemes.",
    subtopics: [
      "National Income, GDP & Per Capita",
      "Union Budget & Direct/Indirect Taxes",
      "RBI Monetary Policy & Repo Rates",
      "Inflation (CPI, WPI) & Market Types",
      "Five Year Plans & NITI Aayog",
      "Flagship Government Schemes",
    ],
  },
  {
    id: 6,
    priority: "high",
    icon: Flame,
    color: "#f43f5e",
    name: "Current Affairs",
    slug: "current-affairs",
    questions: "4-5",
    expectedMarks: "8-10 Marks",
    description: "Last 12 months of national and international news, sports championships, summits, awards, key appointments, and government indexes.",
    subtopics: [
      "National & International Summits",
      "Sports Tournaments & Olympic/Cricket News",
      "Nobel Prizes, Padma & National Awards",
      "Global Indices & India's Rankings",
      "Appointments, Resignations & Obits",
      "Government Portals & Treaties",
    ],
  },
  {
    id: 7,
    priority: "high",
    icon: BookOpenCheck,
    color: "#ec4899",
    name: "Static GK",
    slug: "static-gk",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Classical and folk dances, cultural festivals, heritage sites, national symbols, first in India/World, famous books, and global organizations.",
    subtopics: [
      "Classical & Folk Dances of Indian States",
      "Festivals & Cultural Heritage Fairs",
      "UNESCO World Heritage Sites & Temples",
      "First in India & World (Male/Female)",
      "Important National/International Days",
      "Famous Books, Authors & Headquarters",
    ],
  },
];

// ── Priority Visual Config ───────────────────────────────────────────────────
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
    title: "Fact Bank",
    sub: "Core facts & dates",
    mode: "formula",
    icon: BookOpenCheck,
  },
  {
    key: "mixed",
    title: "Mixed PW",
    sub: "Comprehensive mixture",
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
    icon: Globe,
  },
  {
    key: "hard",
    title: "Tier 2 Hard",
    sub: "Advanced level",
    mode: "hard",
    icon: Flame,
  },
] as const;

export default function GeneralAwarenessPage() {
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
            router.push(`/general-awareness/${selectedTopic.slug}/quiz?mode=concept`);
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
                onMaximize={() => router.push(`/general-awareness/${selectedTopic.slug}`)}
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
                  <Globe size={14} />
                </span>
                <span className={styles.windowTitle}>General Awareness Studio</span>
              </div>
            </div>

            {/* Titlebar Center: Spotlight Search */}
            <div className={styles.titlebarCenter}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search history, polity, science, GK... (⌘K)"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search general awareness topics"
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
            {/* Left Sidebar (210px) */}
            <aside
              className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarHidden : ""}`}
              aria-label="General Awareness Categories"
            >
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

            {/* Center Canvas: Dense Matrix / List */}
            <main className={styles.mainCanvas} aria-label="General Awareness Topics Matrix">
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

              {/* Matrix Viewport */}
              <div className={styles.canvasViewport}>
                {filteredTopics.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🔍</div>
                    <div className={styles.emptyStateTitle}>No general awareness topics found</div>
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
                            <IconComp
                              size={22}
                              strokeWidth={2.4}
                              color={topic.color}
                              style={{
                                filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${topic.color}80)`,
                              }}
                            />
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
                                  <IconComp
                                    size={14}
                                    strokeWidth={2.4}
                                    color={topic.color}
                                    style={{
                                      filter: `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 5px ${topic.color}80)`,
                                    }}
                                  />
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
                                href={`/general-awareness/${topic.slug}`}
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

            {/* Right: Live Command Deck (320px) ── */}
            <aside className={styles.commandDeck} aria-label="Topic Command Deck">
              {/* ── Hero Topic Card ── */}
              <div className={styles.heroCard}>
                <div className={styles.heroCardHeader}>
                  <div className={styles.heroCardIconBox}>
                    <SelectedIcon
                      size={20}
                      strokeWidth={2.4}
                      color={selectedTopic.color}
                      style={{
                        filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${selectedTopic.color}80)`,
                      }}
                    />
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
                        href={`/general-awareness/${selectedTopic.slug}/quiz?mode=${pm.mode}`}
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
                    href={`/general-awareness/${selectedTopic.slug}/fact-notes`}
                    className={styles.resourceCard}
                    title="View Facts, Dates & Summary Bank"
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <Sparkles size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>Fact & Summary Bank</span>
                        <span className={styles.resourceCardSub}>Key shortcuts & cheat sheet</span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  <Link
                    href={`/general-awareness/${selectedTopic.slug}`}
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
          <span className={styles.mobileTopbarTitle}>General Awareness Topics</span>
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
              placeholder="Search general awareness topics…"
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
                  href={`/general-awareness/${topic.slug}`}
                  className={styles.mobileTopicCard}
                >
                  <div className={styles.mobileTopicIconBox}>
                    <TopicIcon
                      size={17}
                      strokeWidth={2.4}
                      color={topic.color}
                      style={{
                        filter: `drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 6px ${topic.color}80)`,
                      }}
                    />
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