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
  Castle,
  Flag,
  Scale,
  Globe,
  Atom,
  FlaskConical,
  Dna,
  TrendingUp,
  Flame,
  BookOpenCheck,
  FileQuestion,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";
import { useThemeMode } from "@/hooks/useTheme";
import { useQuestions } from "@/hooks/useQuestions";
import {
  isFormulaQuestion,
  isMixedQuestion,
  isAiChallengeQuestion,
  isTopicMixQuestion,
  isTier2Question,
} from "@/components/quiz-engine/utils";
import styles from "@/components/SubjectHub.module.css";
import MicIcon from "@/components/MicIcon";
import { getGeneralAwarenessTopicGroup } from "@/lib/general-awareness-topic-groups";
import { TOPIC_META } from "./_shared/ranked-topic-group-page";

const PRIORITY_BADGE_STYLE: Record<string, { badgeBg: string; badgeColor: string }> = {
  Core: { badgeBg: "rgba(0, 113, 227, 0.12)", badgeColor: "var(--mac-blue, #0071e3)" },
  "Very High": { badgeBg: "rgba(0, 113, 227, 0.12)", badgeColor: "var(--mac-blue, #0071e3)" },
  High: { badgeBg: "rgba(16, 185, 129, 0.12)", badgeColor: "#059669" },
  Medium: { badgeBg: "rgba(245, 158, 11, 0.12)", badgeColor: "#d97706" },
  Lower: { badgeBg: "rgba(100, 116, 139, 0.12)", badgeColor: "#64748b" },
};

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

// ── Core SSC General Awareness Topics with Distinctly Colored SVG Icons ───────
const TOPICS: Topic[] = [
  {
    id: 1,
    priority: "very-high",
    icon: Landmark,
    color: "#f59e0b",
    name: "Ancient History",
    slug: "ancient-history",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Ancient civilizations, religious movements, empires, literature, art, architecture, education, and science.",
    subtopics: [
      "Jainism & Buddhism",
      "Mauryan Empire",
      "Indus Valley Civilization",
      "Gupta Empire",
      "Vedic Age",
      "Ancient Indian Art & Science",
    ],
  },
  {
    id: 2,
    priority: "very-high",
    icon: Castle,
    color: "#8b5cf6",
    name: "Medieval History",
    slug: "medieval-history",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Delhi Sultanate, Mughal rule, regional kingdoms, religious movements, administration, art, and architecture.",
    subtopics: [
      "Mughal Empire",
      "Delhi Sultanate",
      "Bhakti & Sufi Movements",
      "Marathas & Shivaji",
      "Vijayanagara & Bahmani Kingdoms",
      "Sikh Gurus & Khalsa",
    ],
  },
  {
    id: 3,
    priority: "very-high",
    icon: Flag,
    color: "#2563eb",
    name: "Modern History",
    slug: "modern-history",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "British expansion, constitutional development, social reform, national movements, and the freedom struggle.",
    subtopics: [
      "Gandhian Era",
      "Indian National Congress",
      "British Conquest & Expansion",
      "Governor-Generals & Viceroys",
      "Revolt of 1857",
      "Final Phase of Freedom Struggle",
    ],
  },
  {
    id: 4,
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
    id: 5,
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
    id: 6,
    priority: "very-high",
    icon: Atom,
    color: "#0284c7",
    name: "Physics",
    slug: "physics",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Measurements, mechanics, heat, sound, light, electricity, magnetism, fluids, machines, energy, electronics, and atomic physics.",
    subtopics: [
      "Units & Measurements",
      "Motion & Force",
      "Work, Energy & Power",
      "Heat, Sound & Light",
      "Electricity & Magnetism",
      "Atomic & Nuclear Physics",
    ],
  },
  {
    id: 7,
    priority: "very-high",
    icon: FlaskConical,
    color: "#0891b2",
    name: "Chemistry",
    slug: "chemistry",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Matter, atoms, periodic classification, reactions, bonding, acids, metals, carbon, electrochemistry, fuels, and everyday chemistry.",
    subtopics: [
      "Matter & Atomic Structure",
      "Periodic Table",
      "Acids, Bases & Salts",
      "Metals & Non-Metals",
      "Chemical Reactions",
      "Carbon & Its Compounds",
    ],
  },
  {
    id: 8,
    priority: "very-high",
    icon: Dna,
    color: "#059669",
    name: "Biology",
    slug: "biology",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Human systems, diseases, nutrition, cells, genetics, plant and animal life, reproduction, ecology, evolution, and biotechnology.",
    subtopics: [
      "Human Body Systems",
      "Diseases & Immunity",
      "Nutrition & Vitamins",
      "Cell & Genetics",
      "Plant Physiology",
      "Ecology & Evolution",
    ],
  },
  {
    id: 9,
    priority: "high",
    icon: TrendingUp,
    color: "#8b5cf6",
    name: "Economy",
    slug: "economy",
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
    id: 10,
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
    id: 11,
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
  { id: "core", label: "Core", icon: Zap },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

const PRACTICE_MODES = [
  {
    key: "concept",
    title: "PYQ",
    sub: "Previous year Qs",
    mode: "concept",
    icon: FileQuestion,
    color: "#0d9488",
    gradient: "linear-gradient(135deg, #e6f7f2 0%, #d4f3eb 100%)",
    gradientDark: "linear-gradient(135deg, rgba(13, 148, 136, 0.2) 0%, rgba(13, 148, 136, 0.08) 100%)",
    border: "rgba(13, 148, 136, 0.22)",
    borderDark: "rgba(13, 148, 136, 0.35)",
    shadow: "0 2px 8px rgba(13, 148, 136, 0.08)",
  },
  {
    key: "formula",
    title: "CareerWill",
    sub: "Core facts & dates",
    mode: "formula",
    icon: BookOpenCheck,
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #edf4fe 0%, #dbeafe 100%)",
    gradientDark: "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(37, 99, 235, 0.08) 100%)",
    border: "rgba(37, 99, 235, 0.22)",
    borderDark: "rgba(37, 99, 235, 0.35)",
    shadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
  },
  {
    key: "mixed",
    title: "PW",
    sub: "Comprehensive mixture",
    mode: "mixed",
    icon: Shuffle,
    color: "#4f46e5",
    gradient: "linear-gradient(135deg, #f1f3fd 0%, #e0e7ff 100%)",
    gradientDark: "linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(79, 70, 229, 0.08) 100%)",
    border: "rgba(79, 70, 229, 0.22)",
    borderDark: "rgba(79, 70, 229, 0.35)",
    shadow: "0 2px 8px rgba(79, 70, 229, 0.08)",
  },
  {
    key: "ai-challenge",
    title: "Selection Way",
    sub: "Speed test",
    mode: "ai-challenge",
    icon: Zap,
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #f7f2fe 0%, #ede9fe 100%)",
    gradientDark: "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.08) 100%)",
    border: "rgba(124, 58, 237, 0.22)",
    borderDark: "rgba(124, 58, 237, 0.35)",
    shadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
  },
  {
    key: "easy",
    title: "Topic Mix",
    sub: "Foundation easy",
    mode: "easy",
    icon: Globe,
    color: "#0284c7",
    gradient: "linear-gradient(135deg, #edf9ff 0%, #e0f2fe 100%)",
    gradientDark: "linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(2, 132, 199, 0.08) 100%)",
    border: "rgba(2, 132, 199, 0.22)",
    borderDark: "rgba(2, 132, 199, 0.35)",
    shadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
  },
  {
    key: "hard",
    title: "Tier 2",
    sub: "Advanced level",
    mode: "hard",
    icon: Flame,
    color: "#e11d48",
    gradient: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
    gradientDark: "linear-gradient(135deg, rgba(225, 29, 72, 0.2) 0%, rgba(225, 29, 72, 0.08) 100%)",
    border: "rgba(225, 29, 72, 0.22)",
    borderDark: "rgba(225, 29, 72, 0.35)",
    shadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
  },
] as const;

export default function GeneralAwarenessPage() {
  const router = useRouter();
  const { theme, toggleThemeMode } = useThemeMode();
  const isDark = theme === "dark";

  // States
  const [activeCategory, setActiveCategory] = useState<CategoryId>("core");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTopicId, setSelectedTopicId] = useState<number>(1);
  const [selectedChapterSlug, setSelectedChapterSlug] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePriority, setMobilePriority] = useState<"Core" | "High">("Core");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setSearchQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Filtered topics (all topics under General Awareness)
  const filteredTopics = useMemo(() => {
    return TOPICS;
  }, []);

  const mobileFilteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TOPICS.filter((t) => {
      const matchesQuery =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q);

      const topicTier = t.priority === "very-high" ? "Core" : "High";
      const matchesTier = q !== "" || topicTier === mobilePriority;

      return matchesQuery && matchesTier;
    });
  }, [searchQuery, mobilePriority]);

  // Selected topic object
  const selectedTopic = useMemo(() => {
    return (
      TOPICS.find((t) => t.id === selectedTopicId) ||
      TOPICS[0]
    );
  }, [selectedTopicId]);

  // Topic Group & Chapters
  const currentGroup = useMemo(() => {
    return getGeneralAwarenessTopicGroup(selectedTopic.slug);
  }, [selectedTopic.slug]);

  const rawChapters = useMemo(() => {
    if (currentGroup) {
      return currentGroup.topics;
    }
    return selectedTopic.subtopics.map((sub, idx) => ({
      rank: idx + 1,
      title: sub,
      slug: sub.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      priority: "Core" as const,
    }));
  }, [currentGroup, selectedTopic]);

  const chapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawChapters;
    return rawChapters.filter((ch) => ch.title.toLowerCase().includes(q));
  }, [rawChapters, searchQuery]);

  // Currently active/highlighted chapter in the middle pane
  const selectedChapter = useMemo(() => {
    if (!chapters.length) return null;
    return (
      chapters.find((c) => c.slug === selectedChapterSlug) ||
      chapters[0] ||
      null
    );
  }, [chapters, selectedChapterSlug]);

  // Real available questions for current chapter or topic
  const targetQuestionTopic = selectedChapter ? selectedChapter.title : selectedTopic.name;
  const { questions: topicQuestions } = useQuestions({
    topic: targetQuestionTopic,
    subject: "general-awareness",
  });

  const modeQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      concept: 0,
      formula: 0,
      mixed: 0,
      "ai-challenge": 0,
      easy: 0,
      hard: 0,
    };

    if (!topicQuestions || !Array.isArray(topicQuestions)) {
      return counts;
    }

    topicQuestions.forEach((q) => {
      if (isFormulaQuestion(q)) {
        counts.formula += 1;
      } else if (isAiChallengeQuestion(q)) {
        counts["ai-challenge"] += 1;
      } else if (isTier2Question(q)) {
        counts.hard += 1;
      } else if (isTopicMixQuestion(q)) {
        counts.easy += 1;
      } else if (isMixedQuestion(q)) {
        counts.mixed += 1;
      } else {
        counts.concept += 1;
      }
    });

    return counts;
  }, [topicQuestions]);

  // Stable state ref for keyboard navigation
  const stateRef = useRef({ chapters, selectedChapter, selectedTopic, searchQuery, currentGroup });
  useEffect(() => {
    stateRef.current = { chapters, selectedChapter, selectedTopic, searchQuery, currentGroup };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { chapters, selectedChapter, selectedTopic, searchQuery, currentGroup } = stateRef.current;
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

      if (!isInput && chapters.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          const currentIdx = chapters.findIndex((c) => c.slug === selectedChapter?.slug);
          const nextIdx = (currentIdx + 1) % chapters.length;
          setSelectedChapterSlug(chapters[nextIdx].slug);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          const currentIdx = chapters.findIndex((c) => c.slug === selectedChapter?.slug);
          const prevIdx = (currentIdx - 1 + chapters.length) % chapters.length;
          setSelectedChapterSlug(chapters[prevIdx].slug);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedChapter) {
            const href = currentGroup
              ? `/general-awareness/${selectedTopic.slug}/${selectedChapter.slug}/quiz?mode=concept`
              : `/general-awareness/${selectedTopic.slug}/quiz?mode=concept`;
            router.push(href);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const SelectedIcon = selectedTopic.icon;
  const chapterMeta = selectedChapter ? TOPIC_META[selectedChapter.slug] : null;
  const ActiveItemIcon = chapterMeta?.icon || selectedTopic.icon;
  const activeItemColor = chapterMeta?.color || selectedTopic.color;
  const activePriority = selectedChapter?.priority || (selectedTopic.priority === "very-high" ? "Core" : "High");
  const activeBadgeStyle = PRIORITY_BADGE_STYLE[activePriority] || PRIORITY_BADGE_STYLE.Core;
  const chapterBaseHref = selectedChapter && currentGroup
    ? `/general-awareness/${selectedTopic.slug}/${selectedChapter.slug}`
    : `/general-awareness/${selectedTopic.slug}`;

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
              <Link
                href="/"
                className={styles.navBtn}
                aria-label="Back to Home"
                title="Back to Home"
              >
                <ArrowLeft size={13} />
              </Link>

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
                  placeholder={`Search ${selectedTopic.name} chapters... (⌘K)`}
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search chapters"
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
              aria-label="General Awareness Topics"
            >
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarHeading}>Topics ({TOPICS.length})</div>
                {TOPICS.map((topic) => {
                  const active = selectedTopic.id === topic.id;
                  const TopicIcon = topic.icon;
                  const group = getGeneralAwarenessTopicGroup(topic.slug);
                  const chapterCount = group ? group.topics.length : topic.subtopics.length;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ""}`}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        setSelectedChapterSlug("");
                      }}
                      title={`${topic.name} (${chapterCount} chapters)`}
                    >
                      <div className={styles.sidebarItemLeft}>
                        <span className={styles.sidebarItemIcon} style={{ color: active ? "#ffffff" : topic.color }}>
                          <TopicIcon size={13} strokeWidth={2.4} />
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {topic.name}
                        </span>
                      </div>
                      <span className={styles.sidebarItemCount}>{chapterCount}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Center Canvas: Chapters Matrix / List */}
            <main className={styles.mainCanvas} aria-label={`${selectedTopic.name} Chapters`}>
              <div className={styles.canvasHeader}>
                <div className={styles.canvasHeaderTitle}>
                  <SelectedIcon size={13} style={{ color: selectedTopic.color }} />
                  <span>{selectedTopic.name} &bull; Chapters</span>
                </div>
                <div className={styles.canvasMeta}>
                  <span>{chapters.length} chapters</span>
                  {searchQuery && (
                    <button
                      type="button"
                      className={styles.clearFilterLink}
                      onClick={() => setSearchQuery("")}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>

              {/* Matrix Viewport */}
              <div className={styles.canvasViewport}>
                {chapters.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🔍</div>
                    <div className={styles.emptyStateTitle}>No chapters found</div>
                    <p className={styles.emptyStateDesc}>
                      No chapters in {selectedTopic.name} matched &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() => setSearchQuery("")}
                      style={{ marginTop: "8px" }}
                    >
                      Reset Search
                    </button>
                  </div>
                ) : viewMode === "grid" ? (
                  /* ── Square Launchpad Chapter Cards ── */
                  <div className={styles.denseGrid}>
                    {chapters.map((chapter) => {
                      const isSelected = selectedChapter?.slug === chapter.slug;
                      const meta = TOPIC_META[chapter.slug];
                      const ChapterIcon = meta?.icon || selectedTopic.icon;
                      const iconColor = meta?.color || selectedTopic.color;
                      const pBadge = PRIORITY_BADGE_STYLE[chapter.priority] || PRIORITY_BADGE_STYLE.Core;
                      const chapterHref = currentGroup
                        ? `/general-awareness/${selectedTopic.slug}/${chapter.slug}`
                        : `/general-awareness/${selectedTopic.slug}`;

                      return (
                        <div
                          key={chapter.slug}
                          className={`${styles.compactTile} ${
                            isSelected ? styles.compactTileSelected : ""
                          }`}
                          onClick={() => setSelectedChapterSlug(chapter.slug)}
                          onDoubleClick={() => router.push(chapterHref)}
                          title={`${chapter.title} (Double-click to open)`}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 8,
                              fontSize: 10,
                              fontWeight: 700,
                              color: isSelected ? "var(--mac-blue)" : "var(--mac-text-tertiary)",
                            }}
                          >
                            #{chapter.rank}
                          </div>

                          <div className={styles.tileIconBox}>
                            <ChapterIcon
                              size={20}
                              strokeWidth={2.3}
                              color={isSelected ? "#ffffff" : iconColor}
                              style={{
                                filter: isSelected
                                  ? undefined
                                  : `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${iconColor}80)`,
                              }}
                            />
                          </div>
                          <div className={styles.tileBody}>
                            <span className={styles.tileName} title={chapter.title}>
                              {chapter.title}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Dense List Table View for Chapters ── */
                  <table className={styles.denseTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>#</th>
                        <th>Chapter Name</th>
                        <th>Priority</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.map((chapter) => {
                        const isSelected = selectedChapter?.slug === chapter.slug;
                        const meta = TOPIC_META[chapter.slug];
                        const ChapterIcon = meta?.icon || selectedTopic.icon;
                        const iconColor = meta?.color || selectedTopic.color;
                        const pBadge = PRIORITY_BADGE_STYLE[chapter.priority] || PRIORITY_BADGE_STYLE.Core;
                        const chapterHref = currentGroup
                          ? `/general-awareness/${selectedTopic.slug}/${chapter.slug}`
                          : `/general-awareness/${selectedTopic.slug}`;

                        return (
                          <tr
                            key={chapter.slug}
                            className={`${styles.denseTableRow} ${
                              isSelected ? styles.denseTableRowSelected : ""
                            }`}
                            onClick={() => setSelectedChapterSlug(chapter.slug)}
                          >
                            <td>
                              <span style={{ fontWeight: 700, color: "var(--mac-text-tertiary)", fontSize: 11 }}>
                                #{chapter.rank}
                              </span>
                            </td>
                            <td>
                              <div className={styles.tableTopicCell}>
                                <div className={styles.tableTopicIcon}>
                                  <ChapterIcon
                                    size={14}
                                    strokeWidth={2.4}
                                    color={iconColor}
                                    style={{
                                      filter: `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 5px ${iconColor}80)`,
                                    }}
                                  />
                                </div>
                                <span className={styles.tableTopicName}>{chapter.title}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={styles.tablePriorityBadge}
                                style={{ background: pBadge.badgeBg, color: pBadge.badgeColor }}
                              >
                                {chapter.priority}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <Link
                                  href={`${chapterHref}/quiz?mode=concept`}
                                  className={styles.tableActionBtn}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Start Practice Quiz"
                                >
                                  Practice
                                </Link>
                                <Link
                                  href={chapterHref}
                                  className={styles.tableActionBtn}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ background: "transparent", border: "1px solid var(--mac-border)" }}
                                  title="Open Chapter Hub"
                                >
                                  Hub
                                </Link>
                              </div>
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
            <aside className={styles.commandDeck} aria-label="Chapter Command Deck">
              {/* ── Hero Chapter Card ── */}
              <div className={styles.heroCard}>
                <div className={styles.heroCardHeader}>
                  <div className={styles.heroCardIconBox}>
                    <ActiveItemIcon
                      size={20}
                      strokeWidth={2.4}
                      color={activeItemColor}
                      style={{
                        filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${activeItemColor}80)`,
                      }}
                    />
                  </div>
                  <div className={styles.heroCardTitleGroup}>
                    <h2 className={styles.heroCardTitle}>
                      {selectedChapter ? selectedChapter.title : selectedTopic.name}
                    </h2>
                    <span
                      className={styles.heroPriorityPill}
                      style={{
                        background: activeBadgeStyle.badgeBg,
                        color: activeBadgeStyle.badgeColor,
                      }}
                    >
                      {activePriority} Priority
                    </span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className={styles.heroStatsGrid}>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>Chapter Rank</span>
                    <span className={styles.heroStatValue}>
                      {selectedChapter ? `#${selectedChapter.rank}` : "Core"}
                    </span>
                  </div>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>Topic Chapters</span>
                    <span className={styles.heroStatValue}>{rawChapters.length} Total</span>
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
                    const qCount = modeQuestionCounts[pm.mode] ?? 0;
                    const displayQs = `${qCount} Qs`;
                    return (
                      <Link
                        key={pm.key}
                        href={`${chapterBaseHref}/quiz?mode=${pm.mode}`}
                        className={styles.modeCard}
                        style={
                          {
                            "--card-gradient": pm.gradient,
                            "--card-gradient-dark": pm.gradientDark,
                            "--card-border": pm.border,
                            "--card-border-dark": pm.borderDark,
                            "--card-accent": pm.color,
                            "--card-shadow": pm.shadow,
                          } as React.CSSProperties
                        }
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
                        <div className={styles.modeCardTab} aria-hidden="true">
                          <svg
                            className={styles.tabBgSvg}
                            viewBox="0 0 88 46"
                            preserveAspectRatio="none"
                          >
                            <path
                              d="M28 0 C28 10, 0 13, 0 23 C0 33, 28 36, 28 46 L88 46 L88 0 Z"
                              fill="#ffffff"
                            />
                          </svg>
                          <div className={styles.tabActionIconWrap}>
                            <span className={styles.modeCardQsText}>
                              {displayQs}
                            </span>
                          </div>
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
                    href={`${chapterBaseHref}/formula-notes`}
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
                    href={chapterBaseHref}
                    className={styles.resourceCard}
                    title={selectedChapter ? "Open Chapter Hub" : "Open Complete Module Hub"}
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <BookOpen size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>
                          {selectedChapter ? "Complete Chapter Hub" : "Complete Module Hub"}
                        </span>
                        <span className={styles.resourceCardSub}>Syllabus, weightage & deep-dive</span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  {selectedChapter && currentGroup && (
                    <Link
                      href={`/general-awareness/${selectedTopic.slug}`}
                      className={styles.resourceCard}
                      title={`Open All ${selectedTopic.name} Chapters`}
                    >
                      <div className={styles.resourceCardLeft}>
                        <div className={styles.resourceCardIcon}>
                          <SelectedIcon size={13} strokeWidth={2.2} />
                        </div>
                        <div className={styles.resourceCardInfo}>
                          <span className={styles.resourceCardTitle}>
                            All {selectedTopic.name} Chapters
                          </span>
                          <span className={styles.resourceCardSub}>
                            Full list of {rawChapters.length} chapters
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className={styles.resourceArrow} />
                    </Link>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={styles.mobileContainer}>
        {/* Dark Theme: Background SVG placed in the middle of mobile screen */}
        <div className={styles.mobileDarkBgSvgWrapper} aria-hidden="true">
          <img
            src="/general-knowledge-gk.svg"
            alt=""
            className={styles.mobileDarkBgSvg}
          />
        </div>

        {/* Mobile Topbar */}
        <header className={styles.mobileTopbar}>
          <Link
            href="/"
            className={styles.mobileBackBtn}
            aria-label="Back to Home"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Link>
          <span className={styles.mobileTopbarTitle}>General Awareness Topics</span>
          <div style={{ width: 34 }} />
        </header>

        <div className={styles.mobileBody}>
          {/* Search */}
          <div className={styles.mobileSearchRow}>
            <Search className={styles.mobileSearchIcon} size={16} />
            <input
              type="text"
              className={styles.mobileSearchInput}
              placeholder={isListening ? "Listening... speak topic" : "Search general awareness topics…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search topics"
            />
            <div className={styles.mobileSearchRightActions}>
              {searchQuery && (
                <button
                  type="button"
                  className={styles.mobileSearchClearBtn}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              )}
              <span className={styles.mobileSearchDivider} aria-hidden="true" />
              <button
                type="button"
                className={`${styles.mobileMicBtn} ${isListening ? styles.mobileMicBtnListening : ""}`}
                onClick={toggleVoiceSearch}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
                title={isListening ? "Listening..." : "Voice search"}
              >
                <MicIcon size={16} />
              </button>
            </div>
          </div>

          {/* TOPICS Section Header */}
          <div className={styles.mobileTopicsTitle}>TOPICS</div>

          {/* iOS Grouped Card Container with Filter Header */}
          <div className={styles.mobileTopicGroup}>
            {/* Priority Tabs in Card Header - Core and High */}
            <div className={styles.mobileTabsScroll} role="tablist" aria-label="Filter by priority">
              {(["Core", "High"] as const).map((tier) => {
                const isActive = mobilePriority === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.mobileTabBtn} ${isActive ? styles.mobileTabActive : ""}`}
                    onClick={() => setMobilePriority(tier)}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>

            {mobileFilteredTopics.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--mac-text-secondary, #8E8E93)", fontSize: "0.9rem" }}>
                No general awareness topics found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              mobileFilteredTopics.map((topic) => {
                const TopicIcon = topic.icon;
                return (
                  <Link
                    key={topic.id}
                    href={`/general-awareness/${topic.slug}`}
                    className={styles.mobileTopicRow}
                  >
                    <div className={styles.mobileTopicRowLeft}>
                      <div
                        className={styles.mobileTopicIconBox}
                        style={{ background: topic.color }}
                      >
                        <TopicIcon
                          size={18}
                          strokeWidth={2.2}
                          color="#ffffff"
                        />
                      </div>

                      <span className={styles.mobileTopicName}>{topic.name}</span>
                    </div>

                    <ChevronRight size={16} strokeWidth={2.4} className={styles.mobileChevron} />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
