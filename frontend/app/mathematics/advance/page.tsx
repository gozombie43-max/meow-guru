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

// ── Advance Maths Topics ──────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  {
    id: 1,
    slug: "algebra",
    priority: "very-high",
    icon: "𝑥",
    name: "Algebra",
    questions: "3-4",
    subtopics: [
      "Symmetric Polynomial Identities",
      "x + 1/x Family Values",
      "Quadratic Roots & Discriminant",
      "Component-Dividendo (C&D)",
      "Linear Equations & Graphs",
    ],
  },
  {
    id: 2,
    slug: "geometry",
    priority: "very-high",
    icon: "🧭",
    name: "Geometry",
    questions: "3-4",
    subtopics: [
      "Triangle Congruence & Similarity",
      "Centers of Triangle",
      "Circle Tangent & Secant Theorems",
      "Cyclic Quadrilateral Rules",
      "Chords & Arc Properties",
    ],
  },
  {
    id: 3,
    slug: "mensuration",
    priority: "very-high",
    icon: "📦",
    name: "Mensuration 2D & 3D",
    questions: "2-3",
    subtopics: [
      "2D Polygons Area & Perimeter",
      "Cylinder, Cone & Sphere Volume",
      "Prisms & Pyramids",
      "Frustum of Cone",
      "Cutting & Melting of 3D Solids",
    ],
  },
  {
    id: 4,
    slug: "trigonometry",
    priority: "very-high",
    icon: "📐",
    name: "Trigonometry",
    questions: "3-4",
    subtopics: [
      "Fundamental Identities",
      "Heights & Distances",
      "Complementary Angles Transformation",
      "Value Substitution Methods",
      "Min/Max of Trig Functions",
    ],
  },
  {
    id: 5,
    slug: "number-system",
    priority: "high",
    icon: "#️⃣",
    name: "Number System",
    questions: "2-3",
    subtopics: [
      "Divisibility Rules (7, 11, 13, 72, 88)",
      "Unit Digit & Cyclicity",
      "Remainders Theorems",
      "Number of Factors & Sum",
      "LCM & HCF Advanced Word Problems",
    ],
  },
];

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  "very-high": { label: "Core", color: "#007aff", bg: "rgba(0,122,255,0.1)", dot: "#007aff" },
  high: { label: "High", color: "#34c759", bg: "rgba(52,199,89,0.12)", dot: "#34c759" },
  medium: { label: "Med", color: "#af52de", bg: "rgba(175,82,222,0.12)", dot: "#af52de" },
  low: { label: "Low", color: "#00a2c7", bg: "rgba(0,162,199,0.12)", dot: "#00a2c7" },
  least: { label: "Least", color: "#8e8e93", bg: "rgba(142,142,147,0.14)", dot: "#8e8e93" },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all", label: "All" },
  { id: "very-high", label: "Core" },
  { id: "high", label: "High" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Topic card / row ──────────────────────────────────────────────────────────
function TopicRow({ topic, index, isLast }: { topic: Topic; index: number; isLast: boolean }) {
  const cfg = PRIORITY_CONFIG[topic.priority];
  return (
    <Link
      href={`/mathematics/advance/${topic.slug}`}
      className="row-item"
      style={{ animationDelay: `${index * 38}ms` }}
    >
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

      <span className="pc-subtopics">
        {topic.subtopics.slice(0, 3).map((s) => (
          <span key={s} className="pc-sub-tag">{s}</span>
        ))}
      </span>

      {!isLast && <span className="row-line" />}
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdvanceTopicsPage() {
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
      {/* ── Navigation Bar ── */}
      <header className="ios-nav">
        <button className="ios-back" onClick={() => router.push("/mathematics")} aria-label="Back">
          <ChevronLeft size={22} strokeWidth={2.3} />
          <span className="ios-back-label">Mathematics</span>
        </button>
        <span className="ios-nav-title">Advance Maths</span>
        <span className="ios-nav-spacer" aria-hidden />
      </header>

      {/* ── Desktop & Mobile Header Title ── */}
      <div className="ios-header-content">
        <h1 className="ios-large-title">Advance Mathematics</h1>
        <p className="ios-subtitle">SSC CGL / CHSL / CPO High-Yield Advance Modules</p>
      </div>

      {/* ── Search Bar ── */}
      <div className="ios-search-wrap">
        <div className="ios-search-bar">
          <Search size={15} strokeWidth={2.2} className="ios-search-icon" />
          <input
            type="text"
            className="ios-search-input"
            placeholder="Search topics or subtopics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="ios-clear" onClick={() => setSearch("")} aria-label="Clear">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs / Segments ── */}
      <div className="ios-tabs-wrap">
        <div className="ios-segment-track">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`ios-seg-btn ${activeTab === tab.id ? "ios-seg-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Topics List / Grid ── */}
      <div className="ios-list-container">
        {filtered.length > 0 ? (
          <div className="ios-group">
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
          <div className="ios-empty">
            <p className="ios-empty-title">No topics found</p>
            <p className="ios-empty-sub">Try searching with a different keyword</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .ios-page {
          min-height: 100vh;
          background: #f2f2f7;
          padding-bottom: 80px;
          color: #000;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif;
        }
        .ios-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          position: sticky;
          top: 0;
          z-index: 30;
          background: rgba(242, 242, 247, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .ios-back {
          display: flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: #007aff;
          font-size: 17px;
          cursor: pointer;
          padding: 0;
        }
        .ios-back-label {
          font-size: 17px;
          letter-spacing: -0.4px;
        }
        .ios-nav-title {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.4px;
        }
        .ios-nav-spacer {
          width: 50px;
        }
        .ios-header-content {
          padding: 16px 20px 8px;
          max-width: 900px;
          margin: 0 auto;
        }
        .ios-large-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.6px;
          margin: 0;
        }
        .ios-subtitle {
          font-size: 14px;
          color: #8e8e93;
          margin: 4px 0 0;
        }
        .ios-search-wrap {
          padding: 8px 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        .ios-search-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(142, 142, 147, 0.12);
          border-radius: 10px;
          padding: 8px 12px;
        }
        .ios-search-icon {
          color: #8e8e93;
        }
        .ios-search-input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 15px;
          color: inherit;
        }
        .ios-clear {
          background: rgba(0, 0, 0, 0.1);
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #8e8e93;
        }
        .ios-tabs-wrap {
          padding: 6px 20px 14px;
          max-width: 900px;
          margin: 0 auto;
        }
        .ios-segment-track {
          display: flex;
          background: rgba(142, 142, 147, 0.15);
          padding: 2px;
          border-radius: 8px;
          gap: 2px;
        }
        .ios-seg-btn {
          flex: 1;
          padding: 6px 12px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          color: #3c3c43;
          transition: all 0.2s ease;
        }
        .ios-seg-active {
          background: #ffffff;
          color: #000000;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }
        .ios-list-container {
          padding: 0 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        .ios-group {
          background: #ffffff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .row-item {
          display: flex;
          flex-direction: column;
          padding: 14px 16px;
          text-decoration: none;
          color: inherit;
          position: relative;
          transition: background 0.15s ease;
        }
        .row-item:active {
          background: rgba(0, 0, 0, 0.04);
        }
        .row-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .row-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .row-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .row-name {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.3px;
        }
        .row-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }
        .row-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .row-label {
          font-weight: 500;
        }
        .row-sep {
          color: #8e8e93;
        }
        .row-q {
          color: #8e8e93;
        }
        .row-chevron {
          color: #c7c7cc;
        }
        .pc-subtopics {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
          padding-left: 52px;
        }
        .pc-sub-tag {
          font-size: 12px;
          background: #f2f2f7;
          color: #636366;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .row-line {
          position: absolute;
          bottom: 0;
          left: 68px;
          right: 0;
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
        }
        .ios-empty {
          text-align: center;
          padding: 40px 20px;
        }
        .ios-empty-title {
          font-size: 17px;
          font-weight: 600;
          margin: 0 0 6px;
        }
        .ios-empty-sub {
          font-size: 14px;
          color: #8e8e93;
          margin: 0;
        }

        :global(body.theme-dark) .ios-page {
          background: #000000;
          color: #ffffff;
        }
        :global(body.theme-dark) .ios-nav {
          background: rgba(22, 22, 24, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        :global(body.theme-dark) .ios-group {
          background: #1c1c1e;
        }
        :global(body.theme-dark) .row-item:active {
          background: rgba(255, 255, 255, 0.06);
        }
        :global(body.theme-dark) .pc-sub-tag {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(235, 235, 245, 0.6);
        }
        :global(body.theme-dark) .row-line {
          background: rgba(255, 255, 255, 0.1);
        }
        :global(body.theme-dark) .ios-segment-track {
          background: rgba(255, 255, 255, 0.08);
        }
        :global(body.theme-dark) .ios-seg-active {
          background: #2c2c2e;
          color: #ffffff;
        }
        :global(body.theme-dark) .ios-seg-btn {
          color: rgba(235, 235, 245, 0.6);
        }
        :global(body.theme-dark) .ios-search-bar {
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </main>
  );
}
