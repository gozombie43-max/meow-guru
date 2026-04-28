"use client";

import { useState, useEffect } from "react";
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
  Triangle,
  FileText
} from "lucide-react";
import { fetchWithRetry } from "@/lib/api/http";

const tabs = ["Notes", "Formula", "Extra", "DPP"];

const defaultNotes = [
  {
    id: "default-1",
    title: "Trigonometric Ratios",
    subtitle: "Basic sine, cosine, tangent relations",
    time: "9:41 AM",
    icon: Triangle,
  },
  {
    id: "default-2",
    title: "Standard Angles",
    subtitle: "Value tables for 0°, 30°, 45°, 60°, 90°",
    time: "9:41 AM",
    icon: Ruler,
  },
  {
    id: "default-3",
    title: "Important Identities",
    subtitle: "Pythagorean, sum and difference formulas",
    time: "9:41 AM",
    icon: Calculator,
  },
  {
    id: "default-4",
    title: "Quadrants & Signs",
    subtitle: "ASTC rule and angle transformations",
    time: "9:41 AM",
    icon: Compass,
  },
  {
    id: "default-5",
    title: "Multiple Angles",
    subtitle: "Formulas for 2θ, 3θ, and half angles",
    time: "8:30 AM",
    icon: Layers,
  },
  {
    id: "default-6",
    title: "Heights & Distances",
    subtitle: "Angles of elevation and depression",
    time: "7:15 AM",
    icon: MoveDiagonal,
  },
  {
    id: "default-7",
    title: "Maxima & Minima",
    subtitle: "Finding peak values of trigonometric expressions",
    time: "7:15 AM",
    icon: Activity,
  },
];

type ApiNote = {
  id?: string | number;
  title?: string;
  topic?: string;
  type?: string;
  updatedAt?: string;
  createdAt?: string;
};

export default function TrigonometryFormulaNotesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Notes");
  const [apiNotes, setApiNotes] = useState<ApiNote[]>([]);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetchWithRetry(`${API}/api/notes?topic=trigonometry`);
        if (res.ok) {
          const data = (await res.json()) as ApiNote[];
          setApiNotes(data);
        }
      } catch (err) {
        console.error("Failed to load notes", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [API]);

  // Merge default notes with API notes. Give API notes a generic icon.
  const mergedNotes = [
    ...apiNotes.map((n) => ({
      ...n,
      title: n.title || "Untitled Note",
      subtitle: n.topic || "Trigonometry",
      time: new Date(n.updatedAt || n.createdAt || 0).toLocaleDateString(),
      icon: n.type === "formula" ? Calculator : FileText,
      isApiRecord: true,
    })),
    ...defaultNotes,
  ];
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
            <p className="subtitle">Trigonometry insights wrapped in a liquid glass layout.</p>
          </div>
          <button className="search-button" type="button" aria-label="Search notes">
            <Search className="icon" />
          </button>
        </header>

        <div className="tab-row" role="tablist" aria-label="Trigonometry note categories">
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
              const Icon = note.icon;
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
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(0,0,0,0.5)' }}>No notes found.</div>
          )}
          {showSyncing ? (
            <div style={{ textAlign: 'center', padding: '0.6rem 0', color: 'rgba(0,0,0,0.45)', fontSize: '0.75rem' }}>
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
          outline-offset: 3px;
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
            0 4px 12px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(255, 255, 255, 0.3);
          border: 0.5px solid var(--glass-edge);
        }

        .note-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 20px;
          border: none;
          text-align: left;
          cursor: pointer;
          animation: fade-up 0.5s ease both;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .note-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.06),
            0 6px 16px rgba(0, 0, 0, 0.08);
        }

        .note-icon-bg {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.5) 100%);
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0.5px solid var(--glass-edge);
          flex-shrink: 0;
        }

        .note-icon {
          width: 20px;
          height: 20px;
          color: rgba(0, 0, 0, 0.65);
        }

        .note-main {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .note-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: rgba(0, 0, 0, 0.85);
          letter-spacing: -0.01em;
        }

        .note-subtitle {
          font-size: 0.75rem;
          color: rgba(0, 0, 0, 0.45);
          margin-top: 1px;
          line-height: 1.3;
        }

        .note-time {
          font-size: 0.7rem;
          color: rgba(0, 0, 0, 0.35);
          font-weight: 500;
          white-space: nowrap;
        }

        .fab-button {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 20px;
          border: none;
          background: linear-gradient(135deg, #007aff 0%, #0060d0 100%);
          color: white;
          box-shadow:
            0 8px 24px rgba(0, 122, 255, 0.35),
            0 2px 4px rgba(0, 122, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-radius 0.15s ease;
          animation: float 4s ease-in-out infinite;
          z-index: 10;
        }

        .fab-button:active {
          transform: scale(0.92);
          box-shadow:
            0 4px 12px rgba(0, 122, 255, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          border-radius: 24px;
        }

        .fab-icon {
          width: 24px;
          height: 24px;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.25));
        }

        @keyframes fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </main>
  );
}
