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
           BASE (iOS Light Theme by default)
        ═══════════════════════════════════════════════════════════════ */
        .ios-page {
          min-height: 100dvh;
          background: #f2f2f7;
          font-family: 'Inter', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          color: #1c1c1e;
          -webkit-font-smoothing: antialiased;
        }

        /* ═══════════════════════════════════════════════════════════════
           MOBILE  (default — < 768px)
        ═══════════════════════════════════════════════════════════════ */

        .ios-nav {
          position: sticky; top: 0; z-index: 50;
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; height: 52px; padding: 0 8px;
          background: rgba(249, 249, 251, 0.82);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
        }
        .ios-back {
          display: flex; align-items: center; gap: 2px;
          border: none; background: transparent; color: #007aff;
          font-size: 0.95rem; font-weight: 400; cursor: pointer;
          padding: 8px 6px; border-radius: 8px;
          transition: opacity 0.15s, background 0.15s; -webkit-tap-highlight-color: transparent;
        }
        .ios-back:active { opacity: 0.6; background: rgba(0, 122, 255, 0.08); }
        .ios-back-label { font-family: inherit; }
        .ios-nav-title {
          font-size: 0.94rem; font-weight: 600; color: #1c1c1e;
          letter-spacing: -0.01em; text-align: center;
        }
        .ios-nav-spacer { width: 1px; }

        .ios-large-title-wrap { padding: 12px 20px 4px; }
        .ios-large-title {
          font-size: 2rem; font-weight: 700;
          letter-spacing: -0.03em; color: #000000; line-height: 1.1;
        }

        /* On mobile, pc-layout is just a plain block */
        .ios-pc-layout { display: block; }
        .ios-sidebar-label { display: none; }

        .ios-search-wrap { padding: 10px 16px 12px; }
        .ios-search-bar {
          display: flex; align-items: center; gap: 8px;
          background: rgba(118, 118, 128, 0.12);
          border-radius: 12px; padding: 9px 12px;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .ios-search-bar:focus-within {
          background: rgba(118, 118, 128, 0.18);
          box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
        }
        .ios-search-ico { flex-shrink: 0; color: rgba(60, 60, 67, 0.5); }
        .ios-search-input {
          flex: 1; border: none; background: transparent;
          font-size: 0.95rem; font-weight: 400; color: #000000;
          outline: none; font-family: inherit;
        }
        .ios-search-input::placeholder { color: rgba(60, 60, 67, 0.45); }
        .ios-search-clear {
          flex-shrink: 0; width: 18px; height: 18px;
          border-radius: 50%; border: none;
          background: rgba(118, 118, 128, 0.22); color: rgba(60, 60, 67, 0.8);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: opacity 0.15s, background 0.15s;
        }
        .ios-search-clear:active { opacity: 0.6; }

        .ios-segment-wrap { padding: 0 16px 14px; overflow-x: auto; scrollbar-width: none; }
        .ios-segment-wrap::-webkit-scrollbar { display: none; }
        .ios-segment-track {
          display: inline-flex; gap: 4px;
          background: rgba(118, 118, 128, 0.14);
          border-radius: 10px; padding: 3px; min-width: 100%;
        }
        .ios-seg-btn {
          flex: 1; min-width: fit-content; padding: 6px 12px;
          border: none; border-radius: 7px; background: transparent;
          color: rgba(60, 60, 67, 0.75); font-size: 0.82rem; font-weight: 500;
          cursor: pointer; transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
          white-space: nowrap; font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-seg-btn:active { transform: scale(0.96); }
        .ios-seg-active {
          background: #ffffff; color: #000000; font-weight: 600;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .ios-section-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 20px 8px;
        }
        .ios-section-label {
          font-size: 0.78rem; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: rgba(60, 60, 67, 0.6);
        }
        .ios-section-action {
          border: none; background: transparent; color: #007aff;
          font-size: 0.82rem; font-weight: 500;
          cursor: pointer; font-family: inherit;
        }

        .ios-group {
          margin: 0 16px; background: #ffffff;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 0 rgba(0, 0, 0, 0.04);
          border: 0.5px solid rgba(60, 60, 67, 0.12);
        }

        /* Row item — mobile list style */
        .row-item {
          position: relative;
          display: flex; flex-direction: column; gap: 0;
          padding: 0; text-decoration: none;
          background: #ffffff; transition: background 0.15s;
          animation: iosSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both;
          -webkit-tap-highlight-color: transparent;
          min-height: 62px;
        }
        .row-item:active { background: rgba(0, 0, 0, 0.04); }
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
          font-size: 0.95rem; font-weight: 600; color: #1c1c1e;
          letter-spacing: -0.01em; line-height: 1.2;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row-meta { display: flex; align-items: center; gap: 5px; }
        .row-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .row-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.01em; }
        .row-sep { font-size: 0.75rem; color: rgba(60, 60, 67, 0.3); }
        .row-q { font-size: 0.75rem; color: rgba(60, 60, 67, 0.6); font-weight: 400; }
        .row-chevron { flex-shrink: 0; color: rgba(60, 60, 67, 0.3); }

        /* Subtopics — hidden on mobile */
        .pc-subtopics { display: none; }

        /* Hairline separator */
        .row-line {
          position: absolute; bottom: 0; left: 66px; right: 0;
          height: 0.5px; background: rgba(60, 60, 67, 0.12); pointer-events: none;
        }

        .ios-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px; min-height: 240px; padding: 24px;
        }
        .ios-empty-ico { font-size: 2.4rem; margin-bottom: 4px; }
        .ios-empty-title { font-size: 1.05rem; font-weight: 600; color: #1c1c1e; }
        .ios-empty-sub { font-size: 0.88rem; color: rgba(60, 60, 67, 0.6); text-align: center; }

        .ios-bottom-pad { height: 40px; }

        /* ══════════════════════════════════════════════════════════════
           DESKTOP  (≥ 768px)
        ══════════════════════════════════════════════════════════════ */
        @media (min-width: 768px) {

          .ios-page { background: #f2f2f7; }

          /* Nav */
          .ios-nav {
            height: 60px; padding: 0 40px;
            grid-template-columns: 200px 1fr 200px;
            background: rgba(255, 255, 255, 0.82);
            border-bottom: 1px solid rgba(60, 60, 67, 0.1);
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
            background: linear-gradient(135deg, #1c1c1e 30%, #48484a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          /* Two-column grid layout */
          .ios-pc-layout {
            display: grid;
            grid-template-columns: 240px 1fr;
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
            border-radius: 12px; padding: 10px 14px;
            background: #ffffff;
            border: 1px solid rgba(60, 60, 67, 0.12);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          }
          .ios-search-bar:focus-within {
            background: #ffffff;
            border-color: rgba(0, 122, 255, 0.5);
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
          }
          .ios-search-input { font-size: 0.9rem; }

          /* Sidebar: filter label */
          .ios-sidebar-label {
            display: block;
            font-size: 0.68rem; font-weight: 700;
            letter-spacing: 0.09em; text-transform: uppercase;
            color: rgba(60, 60, 67, 0.5);
            margin-bottom: 8px;
          }

          /* Sidebar: segment — vertical list */
          .ios-segment-wrap {
            padding: 0 0 0;
            overflow-x: visible;
          }
          .ios-segment-track {
            display: flex; flex-direction: column; gap: 3px;
            background: #ffffff;
            border: 1px solid rgba(60, 60, 67, 0.12);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
            border-radius: 14px; padding: 6px;
            min-width: unset; width: 100%;
          }
          .ios-seg-btn {
            flex: none; width: 100%; text-align: left;
            padding: 9px 12px; border-radius: 8px;
            font-size: 0.85rem; font-weight: 500;
            color: rgba(60, 60, 67, 0.7);
            transition: background 0.15s, color 0.15s, border-color 0.15s;
          }
          .ios-seg-btn:hover:not(.ios-seg-active) {
            background: rgba(118, 118, 128, 0.08);
            color: #1c1c1e;
          }
          .ios-seg-active {
            background: rgba(0, 122, 255, 0.1);
            color: #007aff; font-weight: 600;
            box-shadow: none;
            border: 1px solid rgba(0, 122, 255, 0.25);
          }

          /* Main: section header */
          .ios-section-header { padding: 0 0 16px; }
          .ios-section-label { font-size: 0.72rem; letter-spacing: 0.06em; color: rgba(60, 60, 67, 0.55); }

          /* Main: card grid */
          .ios-group {
            margin: 0; background: transparent;
            border-radius: 0; overflow: visible; box-shadow: none; border: none;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }

          /* Card item */
          .row-item {
            flex-direction: column; gap: 14px;
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid rgba(60, 60, 67, 0.1);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
            min-height: unset;
            animation: pcFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
            transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
                        box-shadow 0.22s ease, border-color 0.2s, background 0.15s;
          }
          .row-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 122, 255, 0.06);
            border-color: rgba(0, 122, 255, 0.3);
            background: #ffffff;
          }
          .row-item:active { transform: scale(0.98); background: #f9f9fb; }

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
            white-space: normal; line-height: 1.35; color: #1c1c1e;
          }
          .row-meta { gap: 6px; }
          .row-dot { width: 7px; height: 7px; }
          .row-label { font-size: 0.77rem; }
          .row-q { font-size: 0.77rem; color: rgba(60, 60, 67, 0.55); }

          /* Chevron top-right */
          .row-chevron {
            margin-left: auto; align-self: flex-start; margin-top: 2px;
            color: rgba(60, 60, 67, 0.25);
            transition: color 0.15s, transform 0.15s;
          }
          .row-item:hover .row-chevron {
            color: #007aff;
            transform: translateX(2px);
          }

          /* Hide mobile separator */
          .row-line { display: none; }

          /* Subtopics — visible on desktop */
          .pc-subtopics {
            display: flex; flex-wrap: wrap; gap: 6px;
            padding: 0 20px 18px; width: 100%;
            border-top: 1px solid rgba(60, 60, 67, 0.08);
            padding-top: 12px;
          }
          .pc-sub-tag {
            font-size: 0.71rem; font-weight: 500;
            color: rgba(60, 60, 67, 0.7);
            background: rgba(118, 118, 128, 0.08);
            border: 1px solid rgba(60, 60, 67, 0.06);
            border-radius: 6px; padding: 3px 8px;
            white-space: nowrap;
            transition: background 0.15s, color 0.15s;
          }
          .row-item:hover .pc-sub-tag {
            background: rgba(0, 122, 255, 0.06);
            color: #007aff;
          }

          /* 3-column at XL */
          @media (min-width: 1120px) {
            .ios-group { grid-template-columns: repeat(3, 1fr); }
          }

          .ios-empty { grid-column: 1 / -1; }
          .ios-bottom-pad { height: 72px; }
        }

        /* ══════════════════════════════════════════════════════════════
           DARK MODE OVERRIDE (for sites with body.theme-dark)
        ══════════════════════════════════════════════════════════════ */
        body.theme-dark .ios-page {
          background: #000;
          color: #fff;
        }
        body.theme-dark .ios-nav {
          background: rgba(28,28,30,0.78);
          border-bottom: 0.5px solid rgba(255,255,255,0.1);
        }
        body.theme-dark .ios-back { color: #0a84ff; }
        body.theme-dark .ios-nav-title { color: #fff; }
        body.theme-dark .ios-large-title {
          color: #fff;
          background: none;
          -webkit-text-fill-color: initial;
        }
        body.theme-dark .ios-search-bar {
          background: rgba(118,118,128,0.24);
          border: none;
          box-shadow: none;
        }
        body.theme-dark .ios-search-ico { color: rgba(235,235,245,0.6); }
        body.theme-dark .ios-search-input { color: #fff; }
        body.theme-dark .ios-search-input::placeholder { color: rgba(235,235,245,0.48); }
        body.theme-dark .ios-search-clear {
          background: rgba(235,235,245,0.35); color: #000;
        }
        body.theme-dark .ios-segment-track {
          background: rgba(118,118,128,0.18);
          border: none; box-shadow: none;
        }
        body.theme-dark .ios-seg-btn { color: rgba(235,235,245,0.7); }
        body.theme-dark .ios-seg-active {
          background: #2c2c2e; color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35); border: none;
        }
        body.theme-dark .ios-section-label { color: rgba(235,235,245,0.5); }
        body.theme-dark .ios-section-action { color: #0a84ff; }
        body.theme-dark .ios-group {
          background: #1c1c1e; border: none; box-shadow: 0 1px 0 rgba(255,255,255,0.06);
        }
        body.theme-dark .row-item { background: #1c1c1e; border: none; }
        body.theme-dark .row-item:active { background: rgba(255,255,255,0.06); }
        body.theme-dark .row-name { color: #fff; }
        body.theme-dark .row-sep { color: rgba(235,235,245,0.25); }
        body.theme-dark .row-q { color: rgba(235,235,245,0.45); }
        body.theme-dark .row-chevron { color: rgba(235,235,245,0.28); }
        body.theme-dark .row-line { background: rgba(255,255,255,0.1); }
        body.theme-dark .ios-empty-title { color: #fff; }
        body.theme-dark .ios-empty-sub { color: rgba(235,235,245,0.45); }

        @media (min-width: 768px) {
          body.theme-dark .ios-page { background: #0d0d0f; }
          body.theme-dark .ios-nav {
            background: rgba(15,15,17,0.88);
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          body.theme-dark .ios-large-title {
            background: linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          body.theme-dark .ios-search-bar {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
          }
          body.theme-dark .ios-sidebar-label { color: rgba(235,235,245,0.3); }
          body.theme-dark .ios-segment-track {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
          }
          body.theme-dark .ios-seg-btn { color: rgba(235,235,245,0.5); }
          body.theme-dark .ios-seg-btn:hover:not(.ios-seg-active) {
            background: rgba(255,255,255,0.06);
            color: rgba(235,235,245,0.88);
          }
          body.theme-dark .ios-seg-active {
            background: rgba(10,132,255,0.16);
            color: #0a84ff; border: 1px solid rgba(10,132,255,0.28);
          }
          body.theme-dark .ios-group { background: transparent; }
          body.theme-dark .row-item {
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.07);
            box-shadow: none;
          }
          body.theme-dark .row-item:hover {
            background: #222224;
            border-color: rgba(255,255,255,0.13);
            box-shadow: 0 18px 44px rgba(0,0,0,0.5);
          }
          body.theme-dark .row-item:hover .row-chevron { color: rgba(255,255,255,0.6); }
          body.theme-dark .pc-subtopics { border-top: 1px solid rgba(255,255,255,0.06); }
          body.theme-dark .pc-sub-tag {
            color: rgba(235,235,245,0.42);
            background: rgba(255,255,255,0.05);
            border: none;
          }
          body.theme-dark .row-item:hover .pc-sub-tag {
            background: rgba(255,255,255,0.09);
            color: rgba(235,235,245,0.8);
          }
        }
      `}</style>
    </main>
  );
}

