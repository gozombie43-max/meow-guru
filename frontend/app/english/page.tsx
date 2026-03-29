"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = "vocabulary" | "grammar" | "sentence-skills" | "passage-based" | "arrangement";

interface Topic {
  id: number;
  name: string;
  subtopics: string[];
  category: Category;
  questions: string;
  icon: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  // ── Vocabulary ──
  {
    id: 1, category: "vocabulary", icon: "🔤",
    name: "Synonyms & Antonyms",
    questions: "3-4",
    subtopics: ["Synonym Selection", "Antonym Selection", "Contextual Usage", "Degree of Meaning"],
  },
  {
    id: 2, category: "vocabulary", icon: "🔊",
    name: "Homonyms & Homophones",
    questions: "1-2",
    subtopics: ["Same Sound Different Meaning", "Same Spelling Different Meaning", "Contextual Disambiguation"],
  },
  {
    id: 3, category: "vocabulary", icon: "💡",
    name: "One Word Substitution",
    questions: "2-3",
    subtopics: ["People & Professions", "Places & Institutions", "Actions & Behaviors", "Science & Nature Terms"],
  },
  {
    id: 4, category: "vocabulary", icon: "🗣️",
    name: "Idioms & Phrases",
    questions: "2-3",
    subtopics: ["Meaning Identification", "Correct Usage", "Fill in the Blank with Idiom", "Origin & Context"],
  },
  {
    id: 5, category: "vocabulary", icon: "✅",
    name: "Spelling / Misspelled Words",
    questions: "1-2",
    subtopics: ["Detect the Misspelled Word", "Correct the Spelling", "Commonly Confused Words"],
  },

  // ── Grammar ──
  {
    id: 6, category: "grammar", icon: "🔄",
    name: "Active & Passive Voice",
    questions: "2-3",
    subtopics: ["Simple Tense Conversions", "Modal Voice Change", "Interrogative & Negative", "Complex Sentences"],
  },
  {
    id: 7, category: "grammar", icon: "💬",
    name: "Direct & Indirect Narration",
    questions: "2-3",
    subtopics: ["Statements", "Questions", "Commands & Requests", "Exclamations", "Tense Backshift Rules"],
  },
  {
    id: 8, category: "grammar", icon: "⚖️",
    name: "Subject-Verb Agreement",
    questions: "1-2",
    subtopics: ["Collective Nouns", "Indefinite Pronouns", "Either/Neither", "Intervening Phrases", "Inversion"],
  },
  {
    id: 9, category: "grammar", icon: "⏰",
    name: "Tenses",
    questions: "2-3",
    subtopics: ["Simple Tenses", "Continuous Tenses", "Perfect Tenses", "Perfect Continuous", "Mixed Tense Errors"],
  },
  {
    id: 10, category: "grammar", icon: "📌",
    name: "Articles",
    questions: "1-2",
    subtopics: ["A / An Usage", "The Usage", "Zero Article", "Articles with Proper Nouns"],
  },
  {
    id: 11, category: "grammar", icon: "🗺️",
    name: "Prepositions",
    questions: "1-2",
    subtopics: ["Place & Position", "Time Prepositions", "Direction & Movement", "Phrasal Prepositions", "Idiomatic Use"],
  },
  {
    id: 12, category: "grammar", icon: "🔗",
    name: "Conjunctions",
    questions: "1-2",
    subtopics: ["Coordinating", "Subordinating", "Correlative Pairs", "Conjunctive Adverbs"],
  },
  {
    id: 13, category: "grammar", icon: "🎯",
    name: "Modifiers",
    questions: "1",
    subtopics: ["Dangling Modifiers", "Misplaced Modifiers", "Squinting Modifiers", "Adjective vs Adverb"],
  },
  {
    id: 14, category: "grammar", icon: "👤",
    name: "Pronouns",
    questions: "1",
    subtopics: ["Pronoun-Antecedent Agreement", "Case of Pronouns", "Reflexive Pronouns", "Relative Pronouns"],
  },
  {
    id: 15, category: "grammar", icon: "🏗️",
    name: "Sentence Structure",
    questions: "1-2",
    subtopics: ["Simple / Compound / Complex", "Clause Types", "Phrase Types", "Transformation of Sentences"],
  },
  {
    id: 16, category: "grammar", icon: "⚡",
    name: "Parallelism",
    questions: "1",
    subtopics: ["Parallel Verbs", "Parallel Nouns & Phrases", "Correlative Parallelism", "List Parallelism"],
  },

  // ── Sentence Skills ──
  {
    id: 17, category: "sentence-skills", icon: "🔍",
    name: "Spot the Error / Error Detection",
    questions: "4-5",
    subtopics: ["Grammar Errors", "Word Choice Errors", "Punctuation Errors", "Part-wise Error Spotting"],
  },
  {
    id: 18, category: "sentence-skills", icon: "✏️",
    name: "Sentence Correction / Improvement",
    questions: "3-4",
    subtopics: ["Replace Underlined Part", "Rewrite Correctly", "Choose Best Alternative", "No Improvement Cases"],
  },
  {
    id: 19, category: "sentence-skills", icon: "🧩",
    name: "Fill in the Blanks",
    questions: "2-3",
    subtopics: ["Grammar Based", "Vocabulary Based", "Double Blanks", "Contextual Inference"],
  },

  // ── Passage Based ──
  {
    id: 20, category: "passage-based", icon: "📖",
    name: "Cloze Test",
    questions: "5",
    subtopics: ["Vocabulary Cloze", "Grammar Cloze", "Contextual Cloze", "Discourse Cloze"],
  },
  {
    id: 21, category: "passage-based", icon: "📰",
    name: "Reading Comprehension",
    questions: "10-15",
    subtopics: ["Main Idea / Title", "Inference Questions", "Vocabulary in Context", "Author's Tone & Purpose", "Factual Detail", "Editorial / Current Affairs Passage", "Story-Based Passage"],
  },

  // ── Arrangement ──
  {
    id: 22, category: "arrangement", icon: "🔀",
    name: "Para-Jumbles",
    questions: "2-3",
    subtopics: ["Identify Opening Sentence", "Logical Sequence", "Connector Words", "Pronoun Reference Links"],
  },
  {
    id: 23, category: "arrangement", icon: "🧲",
    name: "Para / Sentence Completion",
    questions: "1-2",
    subtopics: ["Choose Best Concluding Sentence", "Opening Sentence Completion", "Contextual Fit", "Tone Matching"],
  },
];

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<Category, { label: string; iconAccent: string; badge: string }> = {
  "vocabulary":      { label: "Vocabulary",      iconAccent: "#e8f0fe", badge: "#4f80f7" },
  "grammar":         { label: "Grammar",          iconAccent: "#e8f5f0", badge: "#34a87a" },
  "sentence-skills": { label: "Sentence Skills",  iconAccent: "#f0eefe", badge: "#7c5cbf" },
  "passage-based":   { label: "Passage Based",    iconAccent: "#fff4e6", badge: "#d97706" },
  "arrangement":     { label: "Arrangement",      iconAccent: "#fdf2f8", badge: "#c026a0" },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all",             label: "All"            },
  { id: "vocabulary",      label: "Vocabulary"     },
  { id: "grammar",         label: "Grammar"        },
  { id: "sentence-skills", label: "Sentence Skills"},
  { id: "passage-based",   label: "Passage Based"  },
  { id: "arrangement",     label: "Arrangement"    },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Topic Pill Card ───────────────────────────────────────────────────────────
function TopicPill({ topic, index }: { topic: Topic; index: number }) {
  const cfg = CATEGORY_CONFIG[topic.category];
  return (
    <div className="pill-card" style={{ animationDelay: `${index * 45}ms` }}>
      <span className="pill-icon" style={{ background: cfg.iconAccent }}>
        {topic.icon}
      </span>
      <div className="pill-middle">
        <span className="pill-name">{topic.name}</span>
      </div>
      <span className="pill-badge" style={{ background: cfg.iconAccent, color: cfg.badge }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EnglishTopicsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchTab = activeTab === "all" || t.category === activeTab;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [activeTab, search]);

  return (
    <main className="page">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          className="back-btn"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>
        <span className="topbar-title">English Topics</span>
        <span className="topbar-spacer" aria-hidden />
      </header>

      <div className="body">
        {/* ── Search ── */}
        <div className="search-row">
          <Search className="search-ico" size={16} />
          <input
            type="text"
            className="search-field"
            placeholder="Search topics or subtopics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search topics"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
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

        {/* ── Count row ── */}
        <div className="count-row">
          <span className="count-text">{filtered.length} topic{filtered.length !== 1 ? "s" : ""}</span>
          {(search || activeTab !== "all") && (
            <button className="clear-btn" onClick={() => { setSearch(""); setActiveTab("all"); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-ico">🔍</span>
            <p className="empty-title">No topics found</p>
            <p className="empty-sub">Try a different search term</p>
          </div>
        ) : (
          <div className="pill-list">
            {filtered.map((topic, i) => (
              <TopicPill key={topic.id} topic={topic} index={i} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100dvh;
          background: #f4f6fb;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          color: #0f172a;
        }

        /* ── Topbar ── */
        .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(244,246,251,0.93);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(15,23,42,0.07);
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          align-items: center;
          padding: 0 12px;
          height: 56px;
        }

        .back-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: none;
          background: transparent;
          display: flex; align-items: center; justify-content: center;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.15s;
        }
        .back-btn:hover { background: #e8edf4; }

        .topbar-title {
          text-align: center;
          font-size: 0.97rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #0f172a;
        }

        .topbar-spacer { width: 36px; }

        /* ── Body ── */
        .body {
          max-width: 520px;
          margin: 0 auto;
          padding: 16px 14px 48px;
        }

        /* ── Search ── */
        .search-row {
          position: relative;
          margin-bottom: 14px;
        }

        .search-ico {
          position: absolute;
          left: 14px; top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-field {
          width: 100%;
          height: 46px;
          border: none;
          outline: none;
          border-radius: 999px;
          background: #fff;
          padding: 0 40px 0 40px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.93rem;
          color: #0f172a;
          box-shadow: 0 2px 12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06);
          transition: box-shadow 0.2s;
        }
        .search-field::placeholder { color: #94a3b8; }
        .search-field:focus {
          box-shadow: 0 4px 18px rgba(15,23,42,0.11), 0 0 0 2px rgba(79,128,247,0.22);
        }

        .search-clear {
          position: absolute;
          right: 13px; top: 50%;
          transform: translateY(-50%);
          background: #e2e8f0;
          border: none; border-radius: 50%;
          width: 22px; height: 22px;
          font-size: 0.9rem; color: #64748b;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .search-clear:hover { background: #cbd5e1; }

        /* ── Tabs ── */
        .tabs-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin-bottom: 14px;
          scrollbar-width: none;
        }
        .tabs-scroll::-webkit-scrollbar { display: none; }

        .tab-btn {
          flex-shrink: 0;
          height: 36px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.86rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
        }
        .tab-btn:hover { background: #eef2ff; border-color: #c7d7fd; color: #4f80f7; }
        .tab-active {
          background: #4f80f7 !important;
          border-color: #4f80f7 !important;
          color: #fff !important;
          box-shadow: 0 3px 10px rgba(79,128,247,0.28);
        }

        /* ── Count row ── */
        .count-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .count-text {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
        }
        .clear-btn {
          font-size: 0.8rem;
          color: #4f80f7;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
          padding: 0;
        }

        /* ── Pill list ── */
        .pill-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        /* ── Pill card ── */
        .pill-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff;
          border-radius: 18px;
          padding: 11px 14px 11px 11px;
          box-shadow: 0 2px 10px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.045);
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

        /* ── Icon bubble ── */
        .pill-icon {
          flex-shrink: 0;
          width: 44px; height: 44px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem;
        }

        /* ── Middle (name + subtopics) ── */
        .pill-middle {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        /* ── Name ── */
        .pill-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        /* ── Subtopics preview ── */
        .pill-subs {
          font-size: 0.74rem;
          color: #94a3b8;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Badge ── */
        .pill-badge {
          flex-shrink: 0;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        /* ── Empty state ── */
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 6px;
        }
        .empty-ico { font-size: 2.8rem; }
        .empty-title { font-size: 1rem; font-weight: 700; color: #334155; margin-top: 8px; }
        .empty-sub { font-size: 0.88rem; color: #94a3b8; }
      `}</style>
    </main>
  );
}