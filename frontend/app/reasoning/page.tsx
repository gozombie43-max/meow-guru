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
function TopicCard({ topic, onStart }: { topic: Topic; onStart: (topic: Topic) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CONFIG[topic.priority];
  return (
    <div
      className="w-full rounded-[16px] bg-white/60 backdrop-blur-md shadow-md mb-0 flex items-center px-4 py-4 gap-3"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 0, border: 'none' }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-12 h-12 rounded-[12px] bg-white/80 flex items-center justify-center text-[2rem] mr-2 border border-white/40">
        {topic.icon}
      </div>
      {/* Center: Title, meta, subtopics */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="block font-bold text-[19px] leading-[1.4] text-slate-900">
            {topic.name}
          </span>
          <span className={`text-[13px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-blue-700 border border-blue-200 ml-1`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2 mb-1 text-[15px] text-slate-600 font-medium">
          ~{topic.questions} questions
          <span className="text-slate-300">•</span>
          <button
            type="button"
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
            className="text-[15px] text-blue-500 hover:text-blue-700 font-medium px-1 py-0 rounded transition-colors focus:outline-none"
            style={{ minHeight: 36 }}
            aria-expanded={expanded}
          >
            {expanded ? "Hide subtopics ▲" : `${topic.subtopics.length} subtopics ▼`}
          </button>
        </div>
        {expanded && (
          <div className="overflow-hidden transition-all duration-200 bg-white/80 rounded-lg mt-2 px-2 py-2">
            <div className="flex flex-wrap gap-2">
              {topic.subtopics.map((sub) => (
                <span
                  key={sub}
                  className="text-[13px] bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Right: Start button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={e => { e.stopPropagation(); onStart(topic); }}
        className="ml-2 bg-blue-100 hover:bg-blue-200 active:scale-95 text-blue-700 font-bold text-[17px] px-5 py-2 rounded-full transition-all duration-150 shadow-sm"
        style={{ minHeight: 44, minWidth: 80 }}
      >
        Start
      </button>
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
      <div className="w-full max-w-[480px] mx-auto px-4 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-[16px] text-slate-600 hover:text-blue-700 mb-2 flex items-center gap-1 transition-colors min-h-[44px] font-medium"
            style={{ minHeight: 44 }}
          >
            ← Back
          </button>
          <h1 className="text-[27px] font-bold text-slate-900 leading-[1.2] mb-1">Reasoning Topics</h1>
          <p className="text-[16px] text-slate-700 mt-1 leading-[1.4] font-medium">
            SSC CGL Tier 2
          </p>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl select-none">🔍</span>
          <input
            type="text"
            placeholder="Search topics or subtopics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-12 py-3 rounded-full border border-slate-200 bg-white/80 shadow text-[16px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            style={{ minHeight: 44, fontWeight: 500 }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xl"
              aria-label="Clear search"
              style={{ minHeight: 44 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="-mx-4 px-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar" style={{ height: 44, minHeight: 44, whiteSpace: 'nowrap' }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-5 py-2 rounded-full text-[16px] font-semibold border-0 transition-all duration-150 shadow-sm ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white/70 text-slate-700 hover:bg-blue-100'
                  }`}
                  style={{ minHeight: 40, marginRight: 8 }}
                >
                  {tab.label}
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
            <p className="text-slate-400 text-[15px] mt-1">Try a different search term</p>
            <button
              onClick={() => { setSearch(""); setActiveTab("all"); }}
              className="mt-5 text-[15px] text-blue-500 hover:text-blue-700 font-semibold border border-blue-200 px-5 py-2 rounded-xl transition-colors"
              style={{ minHeight: 44 }}
            >
              Show all topics
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ gap: 16 }}>
            {filtered.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onStart={handleStart} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar removed for mobile-first design */}
    </div>
  );
}

// Add minimal CSS for expand animation and no-scrollbar utility
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    .expand-enter { max-height: 0; opacity: 0; }
    .expand-enter-active { max-height: 200px; opacity: 1; transition: max-height 180ms cubic-bezier(.4,0,.2,1), opacity 180ms; }
    .expand-exit { max-height: 200px; opacity: 1; }
    .expand-exit-active { max-height: 0; opacity: 0; transition: max-height 180ms cubic-bezier(.4,0,.2,1), opacity 180ms; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `;
  document.head.appendChild(style);
}