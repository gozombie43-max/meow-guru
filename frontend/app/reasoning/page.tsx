"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority = "very-high" | "high" | "medium" | "low" | "least";

interface Topic {
  id: number;
  name: string;
  subtopics: string[];
  priority: Priority;
  questions: string;
  icon: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  {
    id: 1, priority: "very-high", icon: "🔐",
    name: "Coding & Decoding",
    questions: "3-4",
    subtopics: ["Letter Coding", "Number Coding", "Symbolic Coding", "Numerical Operations", "Mixed Coding"],
  },
  {
    id: 2, priority: "very-high", icon: "💬",
    name: "Syllogism & Inferences",
    questions: "2-3",
    subtopics: ["Two Statement", "Three Statement", "Possibility Cases", "Drawing Inferences"],
  },
  {
    id: 3, priority: "very-high", icon: "🧩",
    name: "Puzzle & Seating Arrangement",
    questions: "3-4",
    subtopics: ["Linear Seating", "Circular Seating", "Floor Puzzle", "Box Puzzle", "Day/Month Puzzle"],
  },
  {
    id: 4, priority: "very-high", icon: "🔢",
    name: "Series",
    questions: "2-3",
    subtopics: ["Number Series", "Letter Series", "Figural Series", "Alpha-Numeric Series", "Trends"],
  },
  {
    id: 5, priority: "very-high", icon: "🔗",
    name: "Analogy",
    questions: "2-3",
    subtopics: ["Semantic Analogy", "Symbolic/Number Analogy", "Figural Analogy", "Word Analogy"],
  },
  {
    id: 6, priority: "very-high", icon: "🗂️",
    name: "Classification (Odd One Out)",
    questions: "2-3",
    subtopics: ["Semantic Classification", "Figural Classification", "Symbolic Classification", "Number Based"],
  },
  {
    id: 7, priority: "high", icon: "👨‍👩‍👧",
    name: "Blood Relations",
    questions: "1-2",
    subtopics: ["Family Tree", "Coded Blood Relations", "Statement Based"],
  },
  {
    id: 8, priority: "high", icon: "🧭",
    name: "Direction & Distance",
    questions: "1-2",
    subtopics: ["Basic 8 Directions", "Distance Calculation", "Shadow Problems", "Space Orientation"],
  },
  {
    id: 9, priority: "high", icon: "⭕",
    name: "Venn Diagram",
    questions: "1-2",
    subtopics: ["Relationship Diagrams", "Finding Elements", "Shaded Region", "3-Circle Venn"],
  },
  {
    id: 10, priority: "high", icon: "⚖️",
    name: "Inequalities",
    questions: "1-2",
    subtopics: ["Direct Inequalities", "Coded Inequalities", "Mathematical Inequalities"],
  },
  {
    id: 11, priority: "high", icon: "➕",
    name: "Mathematical & Symbolic Operations",
    questions: "1-2",
    subtopics: ["BODMAS Based", "Symbol Substitution", "Sign Interchange", "Numerical Operations"],
  },
  {
    id: 12, priority: "high", icon: "🏆",
    name: "Order & Ranking",
    questions: "1-2",
    subtopics: ["Position from Top/Bottom", "Rank in Row/Column", "Height/Weight Ordering"],
  },
  {
    id: 13, priority: "medium", icon: "📋",
    name: "Statement & Conclusion",
    questions: "1",
    subtopics: ["Follows/Does Not Follow", "Implicit Conclusions", "Critical Thinking"],
  },
  {
    id: 14, priority: "medium", icon: "🤔",
    name: "Statement & Assumptions",
    questions: "1",
    subtopics: ["Implicit Assumptions", "Explicit Assumptions"],
  },
  {
    id: 15, priority: "medium", icon: "⚔️",
    name: "Statement & Arguments",
    questions: "1",
    subtopics: ["Strong/Weak Arguments", "Course of Action", "Cause & Effect"],
  },
  {
    id: 16, priority: "medium", icon: "💡",
    name: "Problem Solving & Critical Thinking",
    questions: "1",
    subtopics: ["Applied Logical Reasoning", "Step-based Problems", "Condition Based"],
  },
  {
    id: 17, priority: "medium", icon: "🖼️",
    name: "Non-Verbal Figures",
    questions: "1-2",
    subtopics: ["Embedded Figures", "Figure Completion", "Counting Figures", "Figural Pattern"],
  },
  {
    id: 18, priority: "medium", icon: "📄",
    name: "Paper Folding & Cutting",
    questions: "1",
    subtopics: ["Punched Hole", "Pattern Folding & Unfolding", "Figural Pattern-folding"],
  },
  {
    id: 19, priority: "low", icon: "🪞",
    name: "Mirror & Water Image",
    questions: "1",
    subtopics: ["Letter/Number Mirror", "Clock Mirror Image", "Figural Mirror", "Water Image"],
  },
  {
    id: 20, priority: "low", icon: "🎲",
    name: "Cube & Dice",
    questions: "1",
    subtopics: ["Open/Closed Dice", "Face Opposite", "Cube Painting & Cutting", "3D Orientation"],
  },
  {
    id: 21, priority: "low", icon: "🔲",
    name: "Matrix",
    questions: "1",
    subtopics: ["Missing Number/Letter", "Row-Column Coding", "Figure Matrix"],
  },
  {
    id: 22, priority: "low", icon: "🔤",
    name: "Logical Sequence of Words",
    questions: "1",
    subtopics: ["Dictionary Order", "Process/Hierarchy Order", "Word Building"],
  },
  {
    id: 23, priority: "least", icon: "😊",
    name: "Emotional Intelligence",
    questions: "1",
    subtopics: ["Recognising Emotions", "Empathy Based", "Situational EQ", "Self-awareness"],
  },
  {
    id: 24, priority: "least", icon: "🤝",
    name: "Social Intelligence",
    questions: "1",
    subtopics: ["Socially Appropriate Responses", "Interpersonal Situations", "Group Behavior"],
  },
  {
    id: 25, priority: "least", icon: "🔡",
    name: "Word Building",
    questions: "1",
    subtopics: ["Form Words from Letters", "Find Words Within Words", "Meaningful Word Formation"],
  },
];

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  Priority,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    pill: string;
    dot: string;
    tabActive: string;
  }
> = {
  "very-high": {
    label: "Very High",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    pill: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    tabActive: "bg-red-500 text-white border-red-500 shadow-red-200",
  },
  high: {
    label: "High",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    pill: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    tabActive: "bg-orange-500 text-white border-orange-500 shadow-orange-200",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    pill: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
    tabActive: "bg-yellow-500 text-white border-yellow-500 shadow-yellow-200",
  },
  low: {
    label: "Low",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    pill: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
    tabActive: "bg-green-500 text-white border-green-500 shadow-green-200",
  },
  least: {
    label: "Least",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    pill: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
    tabActive: "bg-blue-400 text-white border-blue-400 shadow-blue-200",
  },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all",       label: "All"       },
  { id: "very-high", label: "🔴 High"   },
  { id: "high",      label: "🟠 Good"   },
  { id: "medium",    label: "🟡 Medium" },
  { id: "low",       label: "🟢 Low"    },
  { id: "least",     label: "🔵 Least"  },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({
  topic,
  onStart,
}: {
  topic: Topic;
  onStart: (topic: Topic) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CONFIG[topic.priority];

  return (
    <div
      className={`rounded-2xl border ${cfg.border} bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Icon */}
        <span className="text-2xl flex-shrink-0 w-10 text-center">{topic.icon}</span>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm leading-tight">
              {topic.name}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pill}`}
            >
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-400">~{topic.questions} questions</span>
            <span className="text-slate-200">•</span>
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
            >
              {expanded
                ? "Hide ▲"
                : `${topic.subtopics.length} subtopics ▼`}
            </button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={() => onStart(topic)}
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 shadow-sm"
        >
          Start
        </button>
      </div>

      {/* Subtopics */}
      {expanded && (
        <div className={`px-4 pb-4 pt-2 ${cfg.bg} border-t ${cfg.border}`}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Subtopics
          </p>
          <div className="flex flex-wrap gap-2">
            {topic.subtopics.map((sub) => (
              <span
                key={sub}
                className="text-xs bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg shadow-sm"
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReasoningTopicsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  // Counts per priority
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: TOPICS.length };
    TOPICS.forEach((t) => {
      c[t.priority] = (c[t.priority] ?? 0) + 1;
    });
    return c;
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchTab = activeTab === "all" || t.priority === activeTab;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [activeTab, search]);

  function handleStart(topic: Topic) {
    router.push(
      `/reasoning/quiz?topic=${encodeURIComponent(topic.name)}&mode=concept`
    );
  }

  function handlePracticeAll() {
    router.push("/reasoning/quiz?mode=mixed");
  }

  return (
    <div
      className="min-h-screen bg-[#f0f4fb]"
      style={{ fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif" }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">

        {/* ── Header ── */}
        <div className="mb-5">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-400 hover:text-slate-600 mb-3 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Reasoning Topics</h1>
          <p className="text-sm text-slate-500 mt-1">
            SSC CGL Tier 2 · {TOPICS.length} topics · 30 questions · 90 marks
          </p>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base select-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search topics or subtopics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-base"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="-mx-4 px-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1.5"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const priorityCfg =
                tab.id !== "all"
                  ? PRIORITY_CONFIG[tab.id as Priority]
                  : null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 shadow-sm ${
                    isActive
                      ? priorityCfg
                        ? `${priorityCfg.tabActive} shadow-md`
                        : "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {counts[tab.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Priority pills (All tab only) ── */}
        {activeTab === "all" && !search && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              Object.entries(PRIORITY_CONFIG) as [
                Priority,
                (typeof PRIORITY_CONFIG)[Priority]
              ][]
            ).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as TabId)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${cfg.pill} transition-all hover:scale-105 active:scale-95`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label} ({counts[key] ?? 0})
              </button>
            ))}
          </div>
        )}

        {/* ── Results count ── */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            {filtered.length} topic{filtered.length !== 1 ? "s" : ""} found
          </span>
          {(search || activeTab !== "all") && (
            <button
              onClick={() => { setSearch(""); setActiveTab("all"); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Topic list ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-5xl">🔍</span>
            <p className="text-slate-600 mt-4 font-semibold text-base">No topics found</p>
            <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
            <button
              onClick={() => { setSearch(""); setActiveTab("all"); }}
              className="mt-5 text-sm text-blue-500 hover:text-blue-700 font-semibold border border-blue-200 px-5 py-2 rounded-xl transition-colors"
            >
              Show all topics
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onStart={handleStart} />
            ))}
          </div>
        )}
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Stats */}
          <div className="flex gap-5">
            <div className="text-center">
              <div className="text-base font-bold text-slate-800">30</div>
              <div className="text-[10px] text-slate-400 font-medium">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-slate-800">90</div>
              <div className="text-[10px] text-slate-400 font-medium">Marks</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-red-500">−1</div>
              <div className="text-[10px] text-slate-400 font-medium">Negative</div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handlePracticeAll}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-blue-200"
          >
            Practice All →
          </button>
        </div>
      </div>
    </div>
  );
}