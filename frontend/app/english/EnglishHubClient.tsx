"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  ArrowLeftRight,
  BookMarked,
  MessageSquare,
  Edit3,
  FileSpreadsheet,
  Newspaper,
  RefreshCw,
  MessageCircle,
  Clock,
  Scale,
  Shuffle,
  Puzzle,
  SpellCheck,
  Navigation,
  FileText,
  Link2,
  Volume2,
  Layout,
  CheckSquare,
  UserCheck,
  Target,
  AlignLeft,
  BookOpenCheck,
  FileQuestion,
  Flame,
  CircleDot,
  Filter,
  Languages,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import MacTrafficLights from "@/components/MacTrafficLights";
import { useThemeMode } from "@/hooks/useTheme";
import { useQuestionCounts } from "@/hooks/useQuestionCounts";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import styles from "./english.module.css";
import MicIcon from "@/components/MicIcon";

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

// ── 23 SSC English Topics with Distinctly Colored SVG Icons ───────────────────
const TOPICS: Topic[] = [
  {
    id: 1,
    priority: "very-high",
    icon: ArrowLeftRight,
    color: "#38bdf8",
    name: "Synonyms & Antonyms",
    slug: "synonyms-antonyms",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Vocabulary mastery testing exact synonyms, opposite nuances, contextual meanings, and degrees of connotation.",
    subtopics: ["Synonym Selection", "Antonym Selection", "Contextual Usage", "Degree of Meaning", "Root Word Etymology"],
  },
  {
    id: 2,
    priority: "very-high",
    icon: BookMarked,
    color: "#a855f7",
    name: "One Word Substitution",
    slug: "one-word-substitution",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Concise vocabulary replacing phrases for professions, places, medical terms, philosophies, and behavior patterns.",
    subtopics: ["People & Professions", "Places & Institutions", "Phobias & Manias", "Sciences & Disciplines", "Government Terms"],
  },
  {
    id: 3,
    priority: "very-high",
    icon: MessageSquare,
    color: "#f59e0b",
    name: "Idioms & Phrases",
    slug: "idioms-phrases",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Figurative expressions, historical idioms, phrasal verbs, and contextual sentence placement.",
    subtopics: ["Meaning Identification", "Correct Usage in Sentences", "Fill with Idiom", "Origin & Context", "Color & Animal Idioms"],
  },
  {
    id: 4,
    priority: "very-high",
    icon: Search,
    color: "#ef4444",
    name: "Spot the Error",
    slug: "spot-the-error-error-detection",
    questions: "4-5",
    expectedMarks: "8-10 Marks",
    description: "Locating grammatical flaws, tense mismatches, subject-verb disagreements, and incorrect modifiers across sentence parts.",
    subtopics: ["Subject-Verb Inversion", "Tense Inconsistency", "Preposition Errors", "Pronoun Reference Flaws", "Part-wise Detection"],
  },
  {
    id: 5,
    priority: "very-high",
    icon: Edit3,
    color: "#10b981",
    name: "Sentence Improvement",
    slug: "sentence-correction-improvement",
    questions: "3-4",
    expectedMarks: "6-8 Marks",
    description: "Enhancing grammatical accuracy, conciseness, and stylistic flow by replacing underlined phrases.",
    subtopics: ["Replace Underlined Part", "Verb Tense Correction", "No Improvement Cases", "Idiomatic Precision", "Redundancy Elimination"],
  },
  {
    id: 6,
    priority: "very-high",
    icon: FileSpreadsheet,
    color: "#6366f1",
    name: "Cloze Test",
    slug: "cloze-test",
    questions: "5",
    expectedMarks: "10 Marks",
    description: "Contextual paragraph comprehension requiring grammar and vocabulary completions for missing blanks.",
    subtopics: ["Grammar Cloze", "Vocabulary Cloze", "Collocation Blanks", "Discourse Transition", "Contextual Inference"],
  },
  {
    id: 7,
    priority: "very-high",
    icon: Newspaper,
    color: "#06b6d4",
    name: "Reading Comprehension",
    slug: "reading-comprehension",
    questions: "5-10",
    expectedMarks: "10-20 Marks",
    description: "Extracting main themes, author's tone, factual details, inferential deductions, and contextual word definitions.",
    subtopics: ["Central Theme / Title", "Inference & Deduction", "Author Tone & Attitude", "Direct Fact Retrieval", "Contextual Vocab"],
  },
  {
    id: 8,
    priority: "high",
    icon: RefreshCw,
    color: "#f97316",
    name: "Active & Passive Voice",
    slug: "active-passive-voice",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Voice conversions across all 12 tenses, modal auxiliaries, interrogative structures, and imperative commands.",
    subtopics: ["Simple & Perfect Tenses", "Modal Verbs (Can/Must/Should)", "Interrogatives & 'Wh-' Questions", "Imperative Commands", "Prepositional Passive"],
  },
  {
    id: 9,
    priority: "high",
    icon: MessageCircle,
    color: "#8b5cf6",
    name: "Direct & Indirect Narration",
    slug: "direct-indirect-narration",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Reported speech transformations including tense backshifts, pronoun shifts, time-place changes, and exclamatory sentences.",
    subtopics: ["Assertive Statements", "Interrogative 'If/Whether'", "Imperative Orders & Requests", "Exclamations & Wishes", "Universal Truth Exceptions"],
  },
  {
    id: 10,
    priority: "high",
    icon: Clock,
    color: "#ec4899",
    name: "Tenses",
    slug: "tenses",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Timeline consistency, present perfect vs simple past, conditional clauses (If/When), and future time expressions.",
    subtopics: ["Present Perfect vs Simple Past", "Past Perfect Sequences", "Conditional Clauses (Type 1, 2, 3)", "Since/For Time Markers", "Continuous vs Stative Verbs"],
  },
  {
    id: 11,
    priority: "high",
    icon: Scale,
    color: "#3b82f6",
    name: "Subject-Verb Agreement",
    slug: "subject-verb-agreement",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Syntactic agreement rules with collective nouns, correlative pairs (Either/Or), indefinite pronouns, and inverted sentences.",
    subtopics: ["Either...Or / Neither...Nor", "Collective Nouns Plurality", "Intervening Prepositional Phrases", "Each / Every / None", "Inverted Verb Placement"],
  },
  {
    id: 12,
    priority: "high",
    icon: Shuffle,
    color: "#eab308",
    name: "Para-Jumbles",
    slug: "para-jumbles",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Logical reordering of shuffled sentences using opening identifiers, pronoun antecedents, and connecting transition words.",
    subtopics: ["Identifying Opening Sentence", "Pronoun Reference Links", "Chronological Flow", "Cause & Effect Connectors", "Concluding Summary"],
  },
  {
    id: 13,
    priority: "high",
    icon: Puzzle,
    color: "#14b8a6",
    name: "Fill in the Blanks",
    slug: "fill-in-the-blanks",
    questions: "2-3",
    expectedMarks: "4-6 Marks",
    description: "Sentence completions evaluating grammatical prepositions, verb agreements, and precise vocabulary nuances.",
    subtopics: ["Single Blank Grammar", "Double Blanks Logic", "Prepositional Collocations", "Vocabulary Precision", "Contextual Contrast"],
  },
  {
    id: 14,
    priority: "medium",
    icon: SpellCheck,
    color: "#d946ef",
    name: "Spelling & Misspelled Words",
    slug: "spelling-misspelled-words",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Identifying correctly or incorrectly spelled words with tricky double consonants, silent letters, and suffix additions.",
    subtopics: ["Double Consonant Words", "Silent Letter Words", "'-ible' vs '-able' Suffixes", "Commonly Confused Spellings", "Detect Incorrect Word"],
  },
  {
    id: 15,
    priority: "medium",
    icon: Navigation,
    color: "#06b6d4",
    name: "Prepositions",
    slug: "prepositions",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Fixed prepositions, directional movement, temporal indicators (In/On/At), and idiomatic phrasal preposition combinations.",
    subtopics: ["Fixed Preposition Rules", "Prepositions of Time & Place", "Movement & Direction (Into/Onto)", "Phrasal Prepositions", "Verbs without Prepositions"],
  },
  {
    id: 16,
    priority: "medium",
    icon: FileText,
    color: "#84cc16",
    name: "Articles",
    slug: "articles",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Indefinite articles (A/An) phonetic rules, definite article (The) usage with geographical/proper nouns, and zero article omissions.",
    subtopics: ["Vowel Sound Rules (A/An)", "Definite Article 'The' Usage", "Zero Article Omissions", "Articles with Superlatives", "Generic vs Specific Reference"],
  },
  {
    id: 17,
    priority: "medium",
    icon: Link2,
    color: "#f43f5e",
    name: "Conjunctions",
    slug: "conjunctions",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Coordinating conjunctions (FANBOYS), subordinating clauses, correlative pairs (Not only...but also), and conjunctive adverbs.",
    subtopics: ["Correlative Conjunction Pairs", "Lest...Should Rules", "No sooner...than / Hardly...when", "Although / Even Though Contrast", "Subordinating Clauses"],
  },
  {
    id: 18,
    priority: "medium",
    icon: Volume2,
    color: "#22d3ee",
    name: "Homonyms & Homophones",
    slug: "homonyms-homophones",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Differentiating words with identical pronunciation or spelling but divergent meanings, origins, and usages.",
    subtopics: ["Same Sound Different Spelling", "Same Spelling Different Meaning", "Contextual Selection", "Easily Confused Pairs"],
  },
  {
    id: 19,
    priority: "medium",
    icon: Layout,
    color: "#a855f7",
    name: "Sentence Structure & Clauses",
    slug: "sentence-structure",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Analyzing simple, compound, and complex sentences; identifying relative clauses; and transforming sentence clauses.",
    subtopics: ["Simple, Compound, Complex", "Noun & Adverb Clauses", "Relative Pronoun Clauses", "Transformation of Sentences", "Run-on Sentences & Fragments"],
  },
  {
    id: 20,
    priority: "low",
    icon: CheckSquare,
    color: "#10b981",
    name: "Para / Sentence Completion",
    slug: "para-sentence-completion",
    questions: "1-2",
    expectedMarks: "2-4 Marks",
    description: "Selecting the most logical opening, middle, or concluding sentence that sustains the author's tone and paragraph premise.",
    subtopics: ["Concluding Sentence Selection", "Opening Sentence Selection", "Tone & Flow Consistency", "Logical Deductions"],
  },
  {
    id: 21,
    priority: "low",
    icon: UserCheck,
    color: "#38bdf8",
    name: "Pronouns",
    slug: "pronouns",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Pronoun-antecedent agreement, subjective vs objective cases, reflexive vs emphatic pronouns, and relative pronouns.",
    subtopics: ["Subjective vs Objective Cases", "Reflexive & Emphatic Pronouns", "Relative Pronouns (Who/Whom/Which/That)", "Order of Pronouns (231 & 123)"],
  },
  {
    id: 22,
    priority: "low",
    icon: Target,
    color: "#fb7185",
    name: "Modifiers",
    slug: "modifiers",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Detecting and correcting misplaced modifiers, dangling participles, squinting modifiers, and adjective vs practical usages.",
    subtopics: ["Dangling Participles", "Misplaced Modifiers", "Adjective vs Adverb Choice", "Squinting Modifiers"],
  },
  {
    id: 23,
    priority: "low",
    icon: AlignLeft,
    color: "#f59e0b",
    name: "Parallelism",
    slug: "parallelism",
    questions: "1",
    expectedMarks: "2 Marks",
    description: "Ensuring parallel syntactic structures across series, comparisons with 'than'/'as', and correlative conjunction lists.",
    subtopics: ["Parallel Verb Forms", "Parallel Series & Lists", "Comparisons with 'Than' / 'As'", "Correlative Parallel Structures"],
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
  { id: "very-high", label: "Core", icon: Zap },
  { id: "high", label: "High", icon: TrendingUp },
  { id: "medium", label: "Medium", icon: CircleDot },
  { id: "low", label: "Low", icon: Filter },
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
    sub: "Words & grammar rules",
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
    icon: Navigation,
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

const STUDY_MODE_TOPICS = new Set([
  "synonyms-antonyms",
  "one-word-substitution",
  "idioms-phrases",
  "spelling-misspelled-words",
  "homonyms-homophones",
]);

export default function EnglishHubClient() {
  const router = useRouter();
  const { theme, toggleThemeMode } = useThemeMode();
  const isDark = theme === "dark";

  // States
  const [activeCategory, setActiveCategory] = useState<CategoryId>("very-high");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTopicId, setSelectedTopicId] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isListening, toggleVoiceSearch } = useVoiceSearch(setSearchQuery);
  // Filtered topics
  const filteredTopics = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchCat = t.priority === activeCategory;
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
    return (
      filteredTopics.find((t) => t.id === selectedTopicId) ||
      filteredTopics[0] ||
      TOPICS[0]
    );
  }, [selectedTopicId, filteredTopics]);

  const hasStudyMode = STUDY_MODE_TOPICS.has(selectedTopic.slug);

  const { counts: modeQuestionCounts } = useQuestionCounts({
    topic: selectedTopic.slug,
    subject: "english",
  });

  const topicPracticeModes = useMemo(() => {
    return PRACTICE_MODES.map((pm) => {
      if (pm.mode === "ai-challenge" && hasStudyMode) {
        return {
          key: "study-mode",
          title: "Study Mode",
          sub: "Interactive study deck",
          mode: "study-mode",
          href: `/english/${selectedTopic.slug}/study-mode`,
          icon: Sparkles,
          color: "#7c3aed",
          gradient: "linear-gradient(135deg, #f7f2fe 0%, #ede9fe 100%)",
          gradientDark: "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.08) 100%)",
          border: "rgba(124, 58, 237, 0.22)",
          borderDark: "rgba(124, 58, 237, 0.35)",
          shadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
        };
      }
      return {
        ...pm,
        href: `/english/${selectedTopic.slug}/quiz?mode=${pm.mode}`,
      };
    });
  }, [hasStudyMode, selectedTopic.slug]);

  // Current index in filtered list
  const currentIndex = useMemo(() => {
    return filteredTopics.findIndex((t) => t.id === selectedTopic.id);
  }, [filteredTopics, selectedTopic.id]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TOPICS.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return counts;
  }, []);

  // Stable state ref for keyboard navigation
  const stateRef = useRef({ currentIndex, filteredTopics, selectedTopic, searchQuery });
  useEffect(() => {
    stateRef.current = { currentIndex, filteredTopics, selectedTopic, searchQuery };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { currentIndex, filteredTopics, selectedTopic, searchQuery } = stateRef.current;
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
            router.push(`/english/${selectedTopic.slug}/quiz?mode=concept`);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

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
                onMaximize={() => router.push(`/english/${selectedTopic.slug}`)}
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
                  <Languages size={14} />
                </span>
                <span className={styles.windowTitle}>English Studio</span>
              </div>
            </div>

            {/* Titlebar Center: Spotlight Search */}
            <div className={styles.titlebarCenter}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search grammar rules, vocab, idioms... (⌘K)"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search english topics"
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
              aria-label="English Categories"
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
            <main className={styles.mainCanvas} aria-label="English Topics Matrix">
              {/* Matrix Viewport */}
              <div className={styles.canvasViewport}>
                {filteredTopics.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🔍</div>
                    <div className={styles.emptyStateTitle}>No english topics found</div>
                    <p className={styles.emptyStateDesc}>
                      No modules matched &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("very-high");
                      }}
                      style={{ marginTop: "8px" }}
                    >
                      Reset Filters
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
                                href={`/english/${topic.slug}`}
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

              {/* ── Interactive Study Mode Banner (for vocabulary topics) ── */}
              {STUDY_MODE_TOPICS.has(selectedTopic.slug) && (
                <div className={styles.studyModeBannerWrap}>
                  <Link
                    href={`/english/${selectedTopic.slug}/study-mode`}
                    className={styles.studyModeBanner}
                    title="Launch Interactive Study Suite"
                  >
                    <div className={styles.studyModeBannerLeft}>
                      <div className={styles.studyModeIconBox}>
                        <BookOpenCheck size={16} strokeWidth={2.4} />
                      </div>
                      <div className={styles.studyModeInfo}>
                        <span className={styles.studyModeKicker}>INTERACTIVE STUDY SUITE</span>
                        <span className={styles.studyModeTitle}>Vocabulary &amp; Flashcards Deck</span>
                        <span className={styles.studyModeSub}>Bilingual Bengali meanings &amp; audio</span>
                      </div>
                    </div>
                    <div className={styles.studyModeLaunchBtn}>
                      <span>Study</span>
                      <ChevronRight size={12} strokeWidth={2.4} />
                    </div>
                  </Link>
                </div>
              )}

              {/* ── Practice Modes (Single Column) ── */}
              <div className={styles.deckSection}>
                <div className={styles.deckSectionHeader}>
                  <span className={styles.deckSectionTitle}>Practice Modes</span>
                  <span className={styles.deckSectionBadge}>6 Modes</span>
                </div>

                <div className={styles.modesList}>
                  {topicPracticeModes.map((pm) => {
                    const ModeIcon = pm.icon;
                    const qCount = modeQuestionCounts[pm.mode] ?? 0;
                    const displayQs = `${qCount} Qs`;
                    return (
                      <Link
                        key={pm.key}
                        href={pm.href}
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
                  {STUDY_MODE_TOPICS.has(selectedTopic.slug) && (
                    <Link
                      href={`/english/${selectedTopic.slug}/study-mode`}
                      className={styles.resourceCard}
                      title="Open Interactive Study Suite"
                    >
                      <div className={styles.resourceCardLeft}>
                        <div className={styles.resourceCardIcon} style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8" }}>
                          <BookOpenCheck size={13} strokeWidth={2.2} />
                        </div>
                        <div className={styles.resourceCardInfo}>
                          <span className={styles.resourceCardTitle} style={{ color: "#38bdf8", fontWeight: 650 }}>
                            Interactive Study Mode
                          </span>
                          <span className={styles.resourceCardSub}>Vocabulary cards &amp; audio pronunciation</span>
                        </div>
                      </div>
                      <ChevronRight size={13} className={styles.resourceArrow} style={{ color: "#38bdf8" }} />
                    </Link>
                  )}

                  <Link
                    href={`/english/${selectedTopic.slug}/formula-notes`}
                    className={styles.resourceCard}
                    title="View Vocabulary & Rules Bank"
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <Sparkles size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>Vocabulary & Rules Bank</span>
                        <span className={styles.resourceCardSub}>Key shortcuts & cheat sheet</span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  <Link
                    href={`/english/${selectedTopic.slug}`}
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
          <span className={styles.mobileTopbarTitle}>English Topics</span>
          <div style={{ width: 34 }} />
        </header>

        <div className={styles.mobileBody}>
          {/* Search */}
          <div className={styles.mobileSearchRow}>
            <Search className={styles.mobileSearchIcon} size={16} />
            <input
              type="text"
              className={styles.mobileSearchInput}
              placeholder={isListening ? "Listening... speak topic" : "Search english topics…"}
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
            {/* Priority Tabs in Card Header */}
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

            {filteredTopics.map((topic) => {
              const TopicIcon = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={`/english/${topic.slug}`}
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
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
