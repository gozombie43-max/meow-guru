"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority = "very-high" | "high" | "medium" | "low" | "least";

import Link from "next/link";

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
  { id: 1, slug: "percentages", priority: "very-high", icon: "📊", name: "Percentages", questions: "3-4", subtopics: ["Percentage increase", "Percentage decrease", "Value changes", "Conversion"] },
  { id: 2, slug: "ratio-and-proportion", priority: "very-high", icon: "⚖️", name: "Ratio and Proportion", questions: "3-4", subtopics: ["Fundamental ratio", "Proportion rules", "Part-to-whole", "Mixture ratios"] },
  { id: 3, slug: "square-roots", priority: "high", icon: "√", name: "Square Roots", questions: "2-3", subtopics: ["Perfect squares", "Root simplification", "Estimation", "Radical operations"] },
  { id: 4, slug: "averages", priority: "high", icon: "➗", name: "Averages", questions: "2-3", subtopics: ["Arithmetic mean", "Weighted average", "Median and mode", "Group data"] },
  { id: 5, slug: "interest", priority: "very-high", icon: "💰", name: "Interest (Simple and Compound)", questions: "3-4", subtopics: ["Simple interest formula", "Compound interest formula", "CI compounding periods", "Rate/time changes"] },
  { id: 6, slug: "profit-and-loss", priority: "very-high", icon: "📈", name: "Profit and Loss", questions: "3-4", subtopics: ["Cost price/Selling price", "Profit percent", "Loss percent", "Markup and markdown"] },
  { id: 7, slug: "discount", priority: "high", icon: "🏷️", name: "Discount", questions: "2-3", subtopics: ["Single discount", "Successive discounts", "Net price", "Marked price"] },
  { id: 8, slug: "partnership", priority: "high", icon: "🤝", name: "Partnership Business", questions: "2-3", subtopics: ["Capital ratio", "Profit sharing", "Time-weighted share", "New partner"] },
  { id: 9, slug: "mixture-and-alligation", priority: "medium", icon: "🥣", name: "Mixture and Alligation", questions: "2-3", subtopics: ["Alligation rule", "Mixture ratio", "Cost price average", "Quantity problems"] },
  { id: 10, slug: "time-and-distance", priority: "medium", icon: "⏱️", name: "Time and Distance", questions: "3-4", subtopics: ["Speed, distance, time", "Relative speed", "Average speed", "Circular motion"] },
  { id: 11, slug: "time-and-work", priority: "medium", icon: "🛠️", name: "Time and Work", questions: "3-4", subtopics: ["Work rate", "Combined work", "Pipe problems", "Efficiency problems"] },
];

// ── Priority config — no red/yellow ──────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; iconAccent: string; badge: string }> = {
  "very-high": { label: "Core", iconAccent: "#e8f0fe", badge: "#4f80f7" },
  "high": { label: "High", iconAccent: "#e8f5f0", badge: "#34a87a" },
  "medium": { label: "Medium", iconAccent: "#f0eefe", badge: "#7c5cbf" },
  "low": { label: "Low", iconAccent: "#e8f6fd", badge: "#3b9ecb" },
  "least": { label: "Least", iconAccent: "#f0f4f8", badge: "#8896a8" },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all", label: "All" },
  { id: "very-high", label: "Core" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "least", label: "Least" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Topic Pill Card ───────────────────────────────────────────────────────────
function TopicPill({ topic, index }: { topic: Topic; index: number }) {
  const cfg = PRIORITY_CONFIG[topic.priority];
  return (
    <Link href={`/mathematics/arithmetic/${topic.slug}`} className="pill-card" style={{ animationDelay: `${index * 45}ms` }}>
      <span className="pill-icon" style={{ background: cfg.iconAccent }}>{topic.icon}</span>
      <span className="pill-name">{topic.name}</span>
      <span className="pill-badge" style={{ background: cfg.iconAccent, color: cfg.badge }}>{cfg.label}</span>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ArithmeticTopicsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchTab = activeTab === "all" || t.priority === activeTab;
      const q = search.trim().toLowerCase();
      const matchSearch = q === "" || t.name.toLowerCase().includes(q) || t.subtopics.some((s) => s.toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [activeTab, search]);

  return (
    <main className="page">
      <header className="topbar">
        <button className="back-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <span className="topbar-title">Arithmetic Topics</span>
        <span className="topbar-spacer" aria-hidden />
      </header>

      <div className="body">
        <div className="search-row">
          <Search className="search-ico" size={16} />
          <input
            type="text"
            className="search-field"
            placeholder="Search topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search topics"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">×</button>
          )}
        </div>

        <div className="tabs-scroll">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? " tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="count-row">
          <span className="count-text">{filtered.length} topic{filtered.length !== 1 ? "s" : ""}</span>
          {(search || activeTab !== "all") && (
            <button className="clear-btn" onClick={() => { setSearch(""); setActiveTab("all"); }}>Clear filters</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-ico">🔍</span>
            <p className="empty-title">No topics found</p>
            <p className="empty-sub">Try a different search term</p>
          </div>
        ) : (
          <div className="pill-list">
            {filtered.map((topic, i) => <TopicPill key={topic.id} topic={topic} index={i} />)}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .page { min-height: 100dvh; background: #f4f6fb; font-family: 'DM Sans', 'Segoe UI', sans-serif; color: #0f172a; }
        .topbar { position: sticky; top: 0; z-index: 40; background: rgba(244,246,251,0.93); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(15,23,42,0.07); display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; padding: 0 12px; height: 56px; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; display: flex; align-items: center; justify-content: center; color: #0f172a; cursor: pointer; transition: background 0.15s; }
        .back-btn:hover { background: rgba(15,23,42,0.05); }
        .topbar-title { text-align: center; font-size: 1rem; font-weight: 700; }
        .topbar-spacer { width: 1px; }
        .body { padding: 16px; }
        .search-row { display: grid; grid-template-columns: 28px 1fr 24px; gap: 8px; align-items: center; margin-bottom: 12px; }
        .search-ico { stroke: #7c3aed; }
        .search-field { width: 100%; min-height: 40px; border-radius: 10px; border: 1px solid #dbeafe; padding: 0 12px; font-size: 0.95rem; background: #fff; color: #0f172a; }
        .search-clear { width: 24px; height: 24px; border: none; background: transparent; color: #64748b; cursor: pointer; font-weight: 700; }
        .tabs-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; margin-bottom: 12px; }
        .tab-btn { flex: 0 0 auto; border-radius: 999px; border: 1px solid #dbeafe; background: #fff; color: #334155; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; cursor: pointer; }
        .tab-active { border-color: #7c3aed; color: #7c3aed; background: #f5f3ff; }
        .count-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .count-text { font-size: 0.9rem; color: #475569; }
        .clear-btn { border: none; background: transparent; color: #7c3aed; font-weight: 600; cursor: pointer; }
        .pill-list { display: flex; flex-direction: column; gap: 9px; }
        .pill-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff;
          border-radius: 999px;
          padding: 9px 14px 9px 9px;
          box-shadow: 0 2px 10px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.045);
          text-decoration: none;
          animation: fadeUp 0.32s ease both;
          transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
          cursor: pointer;
        }
        .pill-card:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 20px rgba(15,23,42,0.11), 0 0 0 1px rgba(15,23,42,0.045);
        }
        .pill-card:active { transform: scale(0.98); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .pill-icon { flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
        .pill-name { flex: 1; font-size: 0.95rem; font-weight: 600; color: #0f172a; letter-spacing: -0.01em; line-height: 1.3; }
        .pill-badge { border-radius: 999px; padding: 4px 10px; font-size: 0.7rem; font-weight: 700; }
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 220px; color: #64748b; }
        .empty-ico { font-size: 1.6rem; }
        .empty-title { font-size: 1rem; font-weight: 700; }
        .empty-sub { font-size: 0.9rem; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }}
      `}</style>
    </main>
  );
}
