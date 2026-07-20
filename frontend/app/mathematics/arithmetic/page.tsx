"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, ChevronRight, X } from "lucide-react";
import Link from "next/link";

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
  "very-high": { label: "Core",  color: "#0a84ff", bg: "rgba(10,132,255,0.15)",  dot: "#0a84ff" },
  "high":      { label: "High",  color: "#30d158", bg: "rgba(48,209,88,0.14)",   dot: "#30d158" },
  "medium":    { label: "Med",   color: "#bf5af2", bg: "rgba(191,90,242,0.14)",  dot: "#bf5af2" },
  "low":       { label: "Low",   color: "#64d2ff", bg: "rgba(100,210,255,0.13)", dot: "#64d2ff" },
  "least":     { label: "Least", color: "#636366", bg: "rgba(99,99,102,0.18)",   dot: "#636366" },
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
      className="row-item"
      style={{ animationDelay: `${index * 38}ms` }}
    >
      {/* Top row: icon + text + chevron */}
      <span className="row-card-top">
        <span className="row-icon" style={{ background: cfg.bg }}>
          <span className="row-emoji">{topic.icon}</span>
        </span>
        <span className="row-body">
          <span className="row-name">{topic.name}</span>
          <span className="row-meta">
            <span className="row-dot" style={{ background: cfg.dot }} />
            <span className="row-label" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="row-sep">·</span>
            <span className="row-q">{topic.questions} Qs</span>
          </span>
        </span>
        <ChevronRight className="row-chevron" size={17} strokeWidth={2.5} />
      </span>

      {/* Subtopics preview — desktop only via CSS display:none on mobile */}
      <span className="pc-subtopics">
        {topic.subtopics.slice(0, 3).map((s) => (
          <span key={s} className="pc-sub-tag">{s}</span>
        ))}
      </span>

      {/* Hairline separator — mobile only */}
      {!isLast && <span className="row-line" />}
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
    <main className="ios-page">

      {/* ── Navigation Bar ────────────────────────────────────────────── */}
      <header className="ios-nav">
        <button className="ios-back" onClick={() => router.back()} aria-label="Back">
          <ChevronLeft size={22} strokeWidth={2.3} />
          <span className="ios-back-label">Back</span>
        </button>
        <span className="ios-nav-title">Arithmetic</span>
        <span className="ios-nav-spacer" aria-hidden />
      </header>

      {/* ── Large title ───────────────────────────────────────────────── */}
      <div className="ios-large-title-wrap">
        <h1 className="ios-large-title">Topics</h1>
      </div>

      {/* ── Two-col layout wrapper (desktop) / stacked (mobile) ──────── */}
      <div className="ios-pc-layout">

        {/* ── Sidebar: search + filters ─────────────────────────────── */}
        <aside className="ios-pc-sidebar">
          <div className="ios-search-wrap">
            <div className="ios-search-bar">
              <Search className="ios-search-ico" size={15} strokeWidth={2.5} />
              <input
                type="text"
                className="ios-search-input"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search topics"
              />
              {search && (
                <button className="ios-search-clear" onClick={() => setSearch("")} aria-label="Clear">
                  <X size={12} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>

          <div className="ios-segment-wrap">
            <span className="ios-sidebar-label">Filter by priority</span>
            <div className="ios-segment-track">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`ios-seg-btn${activeTab === tab.id ? " ios-seg-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main: section header + cards/list ───────────────────────── */}
        <div className="ios-pc-main">
          <div className="ios-section-header">
            <span className="ios-section-label">
              {filtered.length} {filtered.length === 1 ? "topic" : "topics"}
            </span>
            {(search || activeTab !== "all") && (
              <button
                className="ios-section-action"
                onClick={() => { setSearch(""); setActiveTab("all"); }}
              >
                Reset
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="ios-empty">
              <span className="ios-empty-ico">🔍</span>
              <p className="ios-empty-title">No Results</p>
              <p className="ios-empty-sub">Try a different search or filter</p>
            </div>
          ) : (
            <div className="ios-group">
              {filtered.map((topic, i) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  index={i}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom safe area ──────────────────────────────────────────── */}
      <div className="ios-bottom-pad" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ═══════════════════════════════════════════════════════════════
           BASE
        ═══════════════════════════════════════════════════════════════ */
        .ios-page {
          min-height: 100dvh;
          background: #000;
          font-family: 'Inter', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          color: #fff;
          -webkit-font-smoothing: antialiased;
        }

        /* ══════════════════════════════════════════════════════════════
           MOBILE  (default — < 768px)
        ══════════════════════════════════════════════════════════════ */

        .ios-nav {
          position: sticky; top: 0; z-index: 50;
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; height: 52px; padding: 0 8px;
          background: rgba(28,28,30,0.78);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid rgba(255,255,255,0.1);
        }
        .ios-back {
          display: flex; align-items: center; gap: 2px;
          border: none; background: transparent; color: #0a84ff;
          font-size: 0.95rem; font-weight: 400; cursor: pointer;
          padding: 8px 6px; border-radius: 8px;
          transition: opacity 0.15s; -webkit-tap-highlight-color: transparent;
        }
        .ios-back:active { opacity: 0.5; }
        .ios-back-label { font-family: inherit; }
        .ios-nav-title {
          font-size: 0.94rem; font-weight: 600; color: #fff;
          letter-spacing: -0.01em; text-align: center;
        }
        .ios-nav-spacer { width: 1px; }

        .ios-large-title-wrap { padding: 8px 20px 2px; }
        .ios-large-title {
          font-size: 2rem; font-weight: 700;
          letter-spacing: -0.03em; color: #fff; line-height: 1.1;
        }

        /* On mobile, pc-layout is just a plain block */
        .ios-pc-layout { display: block; }
        /* Sidebar children show inline on mobile */
        .ios-pc-sidebar {}
        .ios-pc-main {}
        /* ios-sidebar-label hidden on mobile */
        .ios-sidebar-label { display: none; }

        .ios-search-wrap { padding: 10px 16px 8px; }
        .ios-search-bar {
          display: flex; align-items: center; gap: 8px;
          background: rgba(118,118,128,0.24);
          border-radius: 12px; padding: 9px 12px;
          transition: background 0.2s;
        }
        .ios-search-bar:focus-within { background: rgba(118,118,128,0.32); }
        .ios-search-ico { flex-shrink: 0; color: rgba(235,235,245,0.6); }
        .ios-search-input {
          flex: 1; border: none; background: transparent;
          font-size: 0.95rem; font-weight: 400; color: #fff;
          outline: none; font-family: inherit;
        }
        .ios-search-input::placeholder { color: rgba(235,235,245,0.48); }
        .ios-search-clear {
          flex-shrink: 0; width: 18px; height: 18px;
          border-radius: 50%; border: none;
          background: rgba(235,235,245,0.35); color: #000;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: opacity 0.15s;
        }
        .ios-search-clear:active { opacity: 0.6; }

        .ios-segment-wrap { padding: 0 16px 12px; overflow-x: auto; scrollbar-width: none; }
        .ios-segment-wrap::-webkit-scrollbar { display: none; }
        .ios-segment-track {
          display: inline-flex; gap: 6px;
          background: rgba(118,118,128,0.18);
          border-radius: 10px; padding: 3px; min-width: 100%;
        }
        .ios-seg-btn {
          flex: 1; min-width: fit-content; padding: 6px 12px;
          border: none; border-radius: 8px; background: transparent;
          color: rgba(235,235,245,0.7); font-size: 0.8rem; font-weight: 500;
          cursor: pointer; transition: background 0.2s, color 0.2s, transform 0.15s;
          white-space: nowrap; font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-seg-btn:active { transform: scale(0.95); }
        .ios-seg-active {
          background: #2c2c2e; color: #fff; font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        }

        .ios-section-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 20px 8px;
        }
        .ios-section-label {
          font-size: 0.78rem; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: rgba(235,235,245,0.5);
        }
        .ios-section-action {
          border: none; background: transparent; color: #0a84ff;
          font-size: 0.82rem; font-weight: 500;
          cursor: pointer; font-family: inherit;
        }

        .ios-group {
          margin: 0 16px; background: #1c1c1e;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.06);
        }

        /* Row item — mobile list style */
        .row-item {
          position: relative;
          display: flex; flex-direction: column; gap: 0;
          padding: 0; text-decoration: none;
          background: #1c1c1e; transition: background 0.12s;
          animation: iosSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both;
          -webkit-tap-highlight-color: transparent;
          min-height: 62px;
        }
        .row-item:active { background: rgba(255,255,255,0.06); }
        @keyframes iosSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* The top row inside each card */
        .row-card-top {
          display: flex; align-items: center; gap: 13px;
          padding: 11px 14px 11px 13px; width: 100%;
        }
        .row-icon {
          flex-shrink: 0; width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .row-emoji { font-size: 1.25rem; line-height: 1; }
        .row-body {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 3px;
        }
        .row-name {
          font-size: 0.95rem; font-weight: 500; color: #fff;
          letter-spacing: -0.01em; line-height: 1.2;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row-meta { display: flex; align-items: center; gap: 5px; }
        .row-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .row-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.01em; }
        .row-sep { font-size: 0.75rem; color: rgba(235,235,245,0.25); }
        .row-q { font-size: 0.75rem; color: rgba(235,235,245,0.45); font-weight: 400; }
        .row-chevron { flex-shrink: 0; color: rgba(235,235,245,0.28); }

        /* Subtopics — hidden on mobile */
        .pc-subtopics { display: none; }

        /* Hairline separator */
        .row-line {
          position: absolute; bottom: 0; left: 66px; right: 0;
          height: 0.5px; background: rgba(255,255,255,0.1); pointer-events: none;
        }

        .ios-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px; min-height: 240px; padding: 24px;
        }
        .ios-empty-ico { font-size: 2.4rem; margin-bottom: 4px; }
        .ios-empty-title { font-size: 1.05rem; font-weight: 600; color: #fff; }
        .ios-empty-sub { font-size: 0.88rem; color: rgba(235,235,245,0.45); text-align: center; }

        .ios-bottom-pad { height: 40px; }

        /* ══════════════════════════════════════════════════════════════
           DESKTOP  (≥ 768px)
        ══════════════════════════════════════════════════════════════ */
        @media (min-width: 768px) {

          .ios-page { background: #0d0d0f; }

          /* Nav */
          .ios-nav {
            height: 60px; padding: 0 40px;
            grid-template-columns: 200px 1fr 200px;
            background: rgba(15,15,17,0.88);
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .ios-back { font-size: 0.88rem; gap: 4px; }
          .ios-nav-title { font-size: 1rem; }

          /* Hero title */
          .ios-large-title-wrap {
            padding: 48px 40px 0;
            max-width: 1240px; margin: 0 auto; width: 100%;
          }
          .ios-large-title {
            font-size: 3rem; font-weight: 800; letter-spacing: -0.04em;
            background: linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          /* Two-column grid layout */
          .ios-pc-layout {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 0 36px;
            max-width: 1240px;
            margin: 32px auto 0;
            padding: 0 40px 72px;
            align-items: start;
          }
          .ios-pc-sidebar {
            grid-column: 1;
            position: sticky;
            top: 76px;
          }
          .ios-pc-main {
            grid-column: 2;
            min-width: 0;
          }

          /* Sidebar: search */
          .ios-search-wrap {
            padding: 0 0 16px;
          }
          .ios-search-bar {
            border-radius: 10px; padding: 10px 14px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
          }
          .ios-search-bar:focus-within {
            background: rgba(255,255,255,0.09);
            border-color: rgba(10,132,255,0.45);
            box-shadow: 0 0 0 3px rgba(10,132,255,0.12);
          }
          .ios-search-input { font-size: 0.9rem; }

          /* Sidebar: filter label */
          .ios-sidebar-label {
            display: block;
            font-size: 0.67rem; font-weight: 700;
            letter-spacing: 0.09em; text-transform: uppercase;
            color: rgba(235,235,245,0.3);
            margin-bottom: 8px;
          }

          /* Sidebar: segment — vertical list */
          .ios-segment-wrap {
            padding: 0 0 0;
            overflow-x: visible;
          }
          .ios-segment-track {
            display: flex; flex-direction: column; gap: 3px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px; padding: 6px;
            min-width: unset; width: 100%;
          }
          .ios-seg-btn {
            flex: none; width: 100%; text-align: left;
            padding: 9px 12px; border-radius: 8px;
            font-size: 0.85rem; font-weight: 500;
            color: rgba(235,235,245,0.5);
            transition: background 0.15s, color 0.15s;
          }
          .ios-seg-btn:hover:not(.ios-seg-active) {
            background: rgba(255,255,255,0.06);
            color: rgba(235,235,245,0.88);
          }
          .ios-seg-active {
            background: rgba(10,132,255,0.16);
            color: #0a84ff; font-weight: 600;
            box-shadow: none;
            border: 1px solid rgba(10,132,255,0.28);
          }

          /* Main: section header */
          .ios-section-header { padding: 0 0 16px; }
          .ios-section-label { font-size: 0.72rem; letter-spacing: 0.06em; }

          /* Main: card grid */
          .ios-group {
            margin: 0; background: transparent;
            border-radius: 0; overflow: visible; box-shadow: none;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }

          /* Card item */
          .row-item {
            flex-direction: column; gap: 14px;
            background: #1c1c1e;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.07);
            min-height: unset;
            animation: pcFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
            transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
                        box-shadow 0.22s ease, border-color 0.2s, background 0.15s;
          }
          .row-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 18px 44px rgba(0,0,0,0.5);
            border-color: rgba(255,255,255,0.13);
            background: #222224;
          }
          .row-item:active { transform: scale(0.975); background: #1c1c1e; }

          @keyframes pcFadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* Card top row */
          .row-card-top {
            display: flex; align-items: flex-start;
            gap: 14px; padding: 20px 20px 0; width: 100%;
          }

          /* Larger icon */
          .row-icon { width: 48px; height: 48px; border-radius: 13px; }
          .row-emoji { font-size: 1.5rem; }

          .row-body { gap: 5px; }
          .row-name {
            font-size: 1rem; font-weight: 600;
            white-space: normal; line-height: 1.35;
          }
          .row-meta { gap: 6px; }
          .row-dot { width: 7px; height: 7px; }
          .row-label { font-size: 0.77rem; }
          .row-q { font-size: 0.77rem; }

          /* Chevron top-right */
          .row-chevron {
            margin-left: auto; align-self: flex-start; margin-top: 2px;
            color: rgba(235,235,245,0.2);
          }

          /* Hide mobile separator */
          .row-line { display: none; }

          /* Subtopics — visible on desktop */
          .pc-subtopics {
            display: flex; flex-wrap: wrap; gap: 6px;
            padding: 0 20px 18px; width: 100%;
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 12px;
          }
          .pc-sub-tag {
            font-size: 0.71rem; font-weight: 500;
            color: rgba(235,235,245,0.42);
            background: rgba(255,255,255,0.05);
            border-radius: 6px; padding: 3px 8px;
            white-space: nowrap;
          }

          /* 3-column at XL */
          @media (min-width: 1120px) {
            .ios-group { grid-template-columns: repeat(3, 1fr); }
          }

          .ios-empty { grid-column: 1 / -1; }
          .ios-bottom-pad { height: 72px; }
        }
      `}</style>
    </main>
  );
}
