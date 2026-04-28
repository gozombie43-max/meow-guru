"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  Calculator,
  Circle,
  Compass,
  Layers,
  MoveDiagonal,
  Plus,
  Ruler,
  Search,
  Sparkles,
  Triangle,
  FileText
} from "lucide-react";
import { fetchWithRetry } from "@/lib/api/http";

const tabs = ["Notes", "Formula", "Extra", "DPP"];

const TOPIC_LABELS: Record<string, string> = {
  arithmetic: "Arithmetic",
  algebra: "Algebra",
  geometry: "Geometry",
  mensuration: "Mensuration",
  trigonometry: "Trigonometry",
  "statistics-probability": "Statistics & Probability",
  "number-system": "Number System",
};

const TOPIC_DEFAULT_NOTES: Record<string, ApiNote[]> = {
  algebra: [
    {
      id: "default-1",
      title: "Linear Equations",
      subtitle: "Solve variables, graphs and intercept shortcuts",
      time: "9:41 AM",
      icon: Calculator,
    },
    {
      id: "default-2",
      title: "Polynomial Patterns",
      subtitle: "Factor, expand, and simplify with confidence",
      time: "9:41 AM",
      icon: Activity,
    },
    {
      id: "default-3",
      title: "Quadratic Formula",
      subtitle: "Root-finding and discriminant tricks",
      time: "9:41 AM",
      icon: Triangle,
    },
    {
      id: "default-4",
      title: "Functions & Graphs",
      subtitle: "Domain, range and shape summaries",
      time: "8:30 AM",
      icon: Circle,
    },
    {
      id: "default-5",
      title: "Identity Shortcuts",
      subtitle: "Common transformations and formula reuse",
      time: "7:15 AM",
      icon: BookOpen,
    },
  ],
  geometry: [
    {
      id: "default-1",
      title: "Triangle Essentials",
      subtitle: "Area, similarity and angle relations",
      time: "9:41 AM",
      icon: Triangle,
    },
    {
      id: "default-2",
      title: "Circle Rules",
      subtitle: "Arc length, sectors, and chord formulas",
      time: "9:41 AM",
      icon: Ruler,
    },
    {
      id: "default-3",
      title: "Coordinate Geometry",
      subtitle: "Distance, slope and midpoint formulas",
      time: "9:41 AM",
      icon: Compass,
    },
    {
      id: "default-4",
      title: "Polygon Properties",
      subtitle: "Interior angle sums and area shortcuts",
      time: "8:30 AM",
      icon: Layers,
    },
    {
      id: "default-5",
      title: "Transformations",
      subtitle: "Reflection, rotation and scaling rules",
      time: "7:15 AM",
      icon: Sparkles,
    },
  ],
  arithmetic: [
    {
      id: "default-1",
      title: "Percentage Rules",
      subtitle: "Increase, decrease and conversion formulas",
      time: "9:41 AM",
      icon: Calculator,
    },
    {
      id: "default-2",
      title: "Ratio & Proportion",
      subtitle: "Direct, inverse and mixture shortcuts",
      time: "9:41 AM",
      icon: Activity,
    },
    {
      id: "default-3",
      title: "Interest Formulas",
      subtitle: "Simple and compound interest made easy",
      time: "8:30 AM",
      icon: BookOpen,
    },
    {
      id: "default-4",
      title: "Profit & Loss",
      subtitle: "Cost price, selling price and margin rules",
      time: "7:15 AM",
      icon: Circle,
    },
  ],
};

type ApiNote = {
  id?: string | number;
  title?: string;
  subtitle?: string;
  time?: string;
  icon?: ComponentType<any>;
  topic?: string;
  type?: string;
  updatedAt?: string;
  createdAt?: string;
};

function getTopicLabel(topic: string) {
  return TOPIC_LABELS[topic] ?? topic
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getDefaultNotes(topic: string) {
  const label = getTopicLabel(topic);
  return TOPIC_DEFAULT_NOTES[topic] ?? [
    {
      id: "default-1",
      title: `${label} Formula Notes`,
      subtitle: "Essential formulas and quick-reference tricks",
      time: "9:41 AM",
      icon: Calculator,
    },
    {
      id: "default-2",
      title: "Must-Know Shortcuts",
      subtitle: "Exam-ready techniques for fast solving",
      time: "9:41 AM",
      icon: BookOpen,
    },
    {
      id: "default-3",
      title: "Quick Reference",
      subtitle: "All key equations in one place",
      time: "8:30 AM",
      icon: Ruler,
    },
  ];
}

interface FormulaNotesClientProps {
  topic: string;
}

export default function FormulaNotesClient({ topic }: FormulaNotesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Notes");
  const [apiNotes, setApiNotes] = useState<ApiNote[]>([]);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const topicLabel = getTopicLabel(topic);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!topic) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetchWithRetry(`${API}/api/notes?topic=${encodeURIComponent(topic)}`);
        if (!res.ok) {
          setApiNotes([]);
          return;
        }

        const data = (await res.json()) as ApiNote[];
        setApiNotes(data);
      } catch (err) {
        console.error("Failed to load notes", err);
        setApiNotes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [API, topic]);

  const mergedNotes = apiNotes.length > 0
    ? apiNotes.map((n) => ({
        ...n,
        title: n.title || "Untitled Note",
        subtitle: n.topic || topicLabel,
        time: new Date(n.updatedAt || n.createdAt || 0).toLocaleDateString(),
        icon: n.type === "formula" ? Calculator : FileText,
        isApiRecord: true,
      }))
    : getDefaultNotes(topic);

  const showSyncing = loading && apiNotes.length === 0;

  return (
    <main className="formula-notes-page">
      <div className="background-orb orb-1" aria-hidden="true" />
      <div className="background-orb orb-2" aria-hidden="true" />

      <div className="page-shell">
        <header className="top-bar">
          <div className="title-block">
            <p className="eyebrow">Mathematics</p>
            <h1>Notes Formula &amp; Tricks</h1>
            <p className="subtitle">{topicLabel} insights wrapped in a liquid glass layout.</p>
          </div>
          <button className="search-button" type="button" aria-label="Search notes">
            <Search className="icon" />
          </button>
        </header>

        <div className="tab-row" role="tablist" aria-label={`${topicLabel} note categories`}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-pill${tab === activeTab ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={tab === activeTab}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <section className="glass-container">
          {mergedNotes.length > 0 ? (
            mergedNotes.map((note, index) => {
              const Icon = note.icon ?? FileText;
              return (
                <button
                  key={note.id || note.title}
                  onClick={() => {
                    if ("isApiRecord" in note && note.isApiRecord) {
                      router.push(`/notes/edit?id=${note.id}`);
                    }
                  }}
                  type="button"
                  className="glass-card note-card"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="note-icon-bg" aria-hidden="true">
                    <Icon className="note-icon" />
                  </span>
                  <span className="note-main">
                    <span className="note-title">{note.title}</span>
                    <span className="note-subtitle">{note.subtitle}</span>
                  </span>
                  <span className="note-time">{note.time}</span>
                </button>
              );
            })
          ) : (
            <div style={{ textAlign: "center", padding: "1rem", color: "rgba(0,0,0,0.5)" }}>No notes found.</div>
          )}
          {showSyncing ? (
            <div style={{ textAlign: "center", padding: "0.6rem 0", color: "rgba(0,0,0,0.45)", fontSize: "0.75rem" }}>
              Syncing notes...
            </div>
          ) : null}
        </section>
      </div>

      <button
        className="fab-button"
        type="button"
        aria-label="Create new note"
        onClick={() => router.push("/notes/new")}
      >
        <Plus className="fab-icon" />
      </button>

      <style jsx global>{`
        @import url("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap");
      `}</style>

      <style jsx>{`
        .formula-notes-page {
          --primary-blue: #007aff;
          --bg-start: #f0f0f5;
          --bg-end: #e8e8f0;
          --text-primary: rgba(0, 0, 0, 0.8);
          --text-secondary: rgba(0, 0, 0, 0.4);
          --glass-edge: rgba(255, 255, 255, 0.7);
          min-height: 100vh;
          background: linear-gradient(180deg, var(--bg-start) 0%, var(--bg-end) 100%);
          color: var(--text-primary);
          font-family: "General Sans", "SF Pro Display", "Segoe UI", sans-serif;
          padding: 28px 18px 92px;
          position: relative;
          overflow: hidden;
        }

        .background-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(40px);
          opacity: 0.7;
          pointer-events: none;
        }

        .orb-1 {
          width: 220px;
          height: 220px;
          background: rgba(0, 122, 255, 0.22);
          top: -70px;
          right: -50px;
        }

        .orb-2 {
          width: 280px;
          height: 280px;
          background: rgba(255, 255, 255, 0.7);
          bottom: -140px;
          left: -120px;
        }

        .page-shell {
          max-width: 560px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .top-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .title-block h1 {
          margin: 6px 0 4px;
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .eyebrow {
          margin: 0;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-secondary);
        }

        .search-button {
          border: none;
          background: rgba(255, 255, 255, 0.9);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .search-button:active {
          transform: scale(0.98);
        }

        .search-button:focus-visible {
          outline: 2px solid rgba(0, 122, 255, 0.5);
        }

        .icon {
          width: 18px;
          height: 18px;
          color: rgba(0, 0, 0, 0.5);
        }

        .tab-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding-bottom: 6px;
          margin-bottom: 18px;
          scrollbar-width: none;
        }

        .tab-row::-webkit-scrollbar {
          display: none;
        }

        .tab-pill {
          border: none;
          background: rgba(255, 255, 255, 0.75);
          color: rgba(0, 0, 0, 0.55);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 8px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .tab-pill.is-active {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.9) 0%, rgba(0, 100, 220, 0.95) 100%);
          box-shadow:
            0 2px 8px rgba(0, 122, 255, 0.35),
            0 1px 3px rgba(0, 122, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }

        .tab-pill:active {
          transform: scale(0.98);
        }

        .glass-container {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.25) 100%);
          backdrop-filter: blur(60px) saturate(2);
          -webkit-backdrop-filter: blur(60px) saturate(2);
          box-shadow:
            0 2px 20px rgba(0, 0, 0, 0.06),
            0 0 0 0.5px rgba(255, 255, 255, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border: 0.5px solid rgba(255, 255, 255, 0.5);
          border-radius: 26px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .glass-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.6) 40%, rgba(255, 255, 255, 0.75) 100%);
          backdrop-filter: blur(40px) saturate(1.8);
          -webkit-backdrop-filter: blur(40px) saturate(1.8);
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 0 0 0.5px rgba(255, 255, 255, 0.55);
          border-radius: 20px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.55);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .glass-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
        }

        .note-card {
          min-height: 84px;
        }

        .note-icon-bg {
          flex-shrink: 0;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: rgba(0, 122, 255, 0.12);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .note-icon {
          width: 20px;
          height: 20px;
          color: rgba(0, 92, 255, 0.88);
        }

        .note-main {
          display: grid;
          gap: 6px;
          text-align: left;
          flex: 1;
        }

        .note-title {
          font-weight: 700;
          font-size: 0.98rem;
          color: rgba(0, 0, 0, 0.85);
        }

        .note-subtitle {
          font-size: 0.86rem;
          color: rgba(0, 0, 0, 0.45);
          line-height: 1.4;
        }

        .note-time {
          font-size: 0.82rem;
          color: rgba(0, 0, 0, 0.4);
          min-width: 60px;
          text-align: right;
        }

        .fab-button {
          position: fixed;
          right: 22px;
          bottom: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #007aff 0%, #004ed4 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 36px rgba(0, 122, 255, 0.24);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .fab-button:active {
          transform: scale(0.96);
        }

        .fab-icon {
          width: 24px;
          height: 24px;
        }
      `}</style>
    </main>
  );
}
