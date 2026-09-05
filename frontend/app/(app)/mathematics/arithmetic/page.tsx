"use client";

import { ChevronLeft,ChevronRight,Search,X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo,useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority = "very-high" | "high" | "medium" | "low" | "least";

interface Topic {
  id: number;
  slug: string;
  name: string;
  subtopics: string[];
  priority: Priority;
  questions: string;
  icon: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  { id: 1,  slug: "percentages",            priority: "very-high", icon: "📊", name: "Percentages",                  questions: "3-4", subtopics: ["Percentage increase", "Percentage decrease", "Value changes", "Conversion"] },
  { id: 2,  slug: "ratio-and-proportion",   priority: "very-high", icon: "⚖️", name: "Ratio and Proportion",         questions: "3-4", subtopics: ["Fundamental ratio", "Proportion rules", "Part-to-whole", "Mixture ratios"] },
  { id: 3,  slug: "square-roots",           priority: "high",      icon: "√",  name: "Square Roots",                 questions: "2-3", subtopics: ["Perfect squares", "Root simplification", "Estimation", "Radical operations"] },
  { id: 4,  slug: "averages",               priority: "high",      icon: "➗", name: "Averages",                     questions: "2-3", subtopics: ["Arithmetic mean", "Weighted average", "Median and mode", "Group data"] },
  { id: 5,  slug: "interest",               priority: "very-high", icon: "💰", name: "Interest (Simple & Compound)", questions: "3-4", subtopics: ["Simple interest formula", "Compound interest formula", "CI compounding periods", "Rate/time changes"] },
  { id: 6,  slug: "profit-and-loss",        priority: "very-high", icon: "📈", name: "Profit and Loss",              questions: "3-4", subtopics: ["Cost price/Selling price", "Profit percent", "Loss percent", "Markup and markdown"] },
  { id: 7,  slug: "discount",               priority: "high",      icon: "🏷️", name: "Discount",                    questions: "2-3", subtopics: ["Single discount", "Successive discounts", "Net price", "Marked price"] },
  { id: 8,  slug: "partnership",            priority: "high",      icon: "🤝", name: "Partnership Business",         questions: "2-3", subtopics: ["Capital ratio", "Profit sharing", "Time-weighted share", "New partner"] },
  { id: 9,  slug: "mixture-and-alligation", priority: "medium",    icon: "🥣", name: "Mixture and Alligation",       questions: "2-3", subtopics: ["Alligation rule", "Mixture ratio", "Cost price average", "Quantity problems"] },
  { id: 10, slug: "time-and-distance",      priority: "medium",    icon: "⏱️", name: "Time and Distance",            questions: "3-4", subtopics: ["Speed, distance, time", "Relative speed", "Average speed", "Circular motion"] },
  { id: 11, slug: "time-and-work",          priority: "medium",    icon: "🛠️", name: "Time and Work",               questions: "3-4", subtopics: ["Work rate", "Combined work", "Pipe problems", "Efficiency problems"] },
];

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  "very-high": { label: "Core",  color: "#007aff", bg: "rgba(0,122,255,0.1)",   dot: "#007aff" },
  "high":      { label: "High",  color: "#34c759", bg: "rgba(52,199,89,0.12)",  dot: "#34c759" },
  "medium":    { label: "Med",   color: "#af52de", bg: "rgba(175,82,222,0.12)", dot: "#af52de" },
  "low":       { label: "Low",   color: "#00a2c7", bg: "rgba(0,162,199,0.12)",  dot: "#00a2c7" },
  "least":     { label: "Least", color: "#8e8e93", bg: "rgba(142,142,147,0.14)",dot: "#8e8e93" },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all",       label: "All"   },
  { id: "very-high", label: "Core"  },
  { id: "high",      label: "High"  },
  { id: "medium",    label: "Med"   },
  { id: "low",       label: "Low"   },
  { id: "least",     label: "Least" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Topic card / row (shared on both mobile and desktop) ──────────────────────
function TopicRow({ topic, index, isLast }: { topic: Topic; index: number; isLast: boolean }) {
  const cfg = PRIORITY_CONFIG[topic.priority];
  return (
    <Link
      href={`/mathematics/arithmetic/${topic.slug}`}
      className="group flex flex-col p-4 relative hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.05] dark:active:bg-white/[0.06] transition-colors"
      style={{ animationDelay: `${index * 38}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 font-medium" style={{ background: cfg.bg }}>
          <span className="leading-none">{topic.icon}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {topic.name}
          </span>
          <div className="flex items-center gap-1.5 text-[13px]">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
            <span className="font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="text-[#8e8e93]">·</span>
            <span className="text-[#8e8e93]">{topic.questions} Qs</span>
          </div>
        </div>
        <ChevronRight className="text-[#c7c7cc] dark:text-[#48484a] group-hover:text-[#8e8e93] transition-colors" size={17} strokeWidth={2.5} />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5 sm:pl-[52px]">
        {topic.subtopics.slice(0, 3).map((s) => (
          <span key={s} className="text-[12px] bg-[#f2f2f7] dark:bg-white/[0.08] text-[#636366] dark:text-[#ebebf5]/70 px-2 py-0.5 rounded-md">
            {s}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ArithmeticTopicsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

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

  return (
    <main className="min-h-screen bg-[#f2f2f7] dark:bg-[#000000] text-black dark:text-white pb-24 font-sans antialiased">
      {/* ── Navigation Bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#f2f2f7]/85 dark:bg-[#161618]/85 backdrop-blur-xl border-b border-black/10 dark:border-white/10">
        <button
          className="flex items-center gap-1 text-[#007aff] dark:text-[#0a84ff] text-[17px] font-normal hover:opacity-80 transition-opacity bg-transparent border-none p-0 cursor-pointer"
          onClick={() => router.push("/mathematics")}
          aria-label="Back"
        >
          <ChevronLeft size={22} strokeWidth={2.3} />
          <span className="tracking-tight">Mathematics</span>
        </button>
        <span className="text-[17px] font-semibold tracking-tight">Arithmetic</span>
        <span className="w-12" aria-hidden />
      </header>

      {/* ── Desktop & Mobile Header Title ── */}
      <div className="max-w-[900px] mx-auto px-5 pt-4 pb-2">
        <h1 className="text-[28px] font-bold tracking-tight m-0">Arithmetic Topics</h1>
        <p className="text-[14px] text-[#8e8e93] mt-1 mb-0">SSC Foundation & Commercial Mathematics Modules</p>
      </div>

      {/* ── Search Bar ── */}
      <div className="max-w-[900px] mx-auto px-5 py-2">
        <div className="flex items-center gap-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-xl px-3 py-2 text-[15px]">
          <Search size={15} strokeWidth={2.2} className="text-[#8e8e93] shrink-0" />
          <input
            type="text"
            className="flex-1 border-none bg-transparent outline-none text-[15px] text-inherit placeholder:text-[#8e8e93]"
            placeholder="Search topics or subtopics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="bg-black/10 dark:bg-white/10 border-none rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-[#8e8e93] p-0"
              onClick={() => setSearch("")}
              aria-label="Clear"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs / Segments ── */}
      <div className="max-w-[900px] mx-auto px-5 pt-1.5 pb-3.5">
        <div className="flex bg-black/[0.08] dark:bg-white/[0.08] p-0.5 rounded-lg gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-1.5 px-3 border-none text-[13px] font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white dark:bg-[#2c2c2e] text-black dark:text-white shadow-sm"
                  : "bg-transparent text-[#3c3c43] dark:text-[#ebebf5]/60 hover:text-black dark:hover:text-white"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Topics List / Grid ── */}
      <div className="max-w-[900px] mx-auto px-5">
        {filtered.length > 0 ? (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10">
            {filtered.map((topic, idx) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                index={idx}
                isLast={idx === filtered.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-5">
            <p className="text-[17px] font-semibold m-0 mb-1.5 text-gray-900 dark:text-white">No topics found</p>
            <p className="text-[14px] text-[#8e8e93] m-0">Try searching with a different keyword</p>
          </div>
        )}
      </div>
    </main>
  );
}

