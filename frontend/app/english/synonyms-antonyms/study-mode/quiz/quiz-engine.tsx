"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchQuestions } from "@/lib/api/questions";
import { Volume2, ListFilter } from "lucide-react";

type StudyModeMeaning = {
  pos?: string;
  definition?: string;
  translation?: string;
};

type StudyModeEntry = {
  id?: string;
  word?: string;
  meanings?: StudyModeMeaning[];
  synonyms?: Array<{ word?: string; translation?: string }>;
  antonyms?: Array<{ word?: string; translation?: string }>;
};

type StudyModeCard = {
  id: string;
  word: string;
  meanings: StudyModeMeaning[];
  synonyms: Array<{ word: string; translation?: string }>;
  antonyms: Array<{ word: string; translation?: string }>;
};

const DEMO_CARD: StudyModeCard = {
  id: "demo",
  word: "Abandon",
  meanings: [
    {
      pos: "v.",
      definition: "To leave or give up completely without intent to return.",
      translation: "ত্যাগ করা / সম্পূর্ণভাবে পরিত্যাগ করা",
    },
    {
      pos: "n.",
      definition: "A complete lack of restraint or inhibition.",
      translation: "উচ্ছৃঙ্খলতা / বেপরোয়া ভাব",
    },
  ],
  synonyms: [
    { word: "Desert", translation: "পরিত্যাগ করা" },
    { word: "Forsake", translation: "ত্যাগ করা" },
    { word: "Relinquish", translation: "ছেড়ে দেওয়া" },
    { word: "Leave", translation: "ছেড়ে যাওয়া" },
    { word: "Dereliction", translation: "অবহেলা" },
    { word: "Discontinue", translation: "বন্ধ করা" },
    { word: "Unrestraint", translation: "অসংযম" },
  ],
  antonyms: [
    { word: "Retain", translation: "ধরে রাখা" },
    { word: "Continue", translation: "চালিয়ে যাওয়া" },
    { word: "Keep", translation: "রাখা" },
    { word: "Adopt", translation: "গ্রহণ করা" },
    { word: "Constraint", translation: "সংযম" },
  ],
};

function toStudyModeCard(entry: StudyModeEntry, index: number): StudyModeCard | null {
  const word = String(entry.word ?? "").trim();
  if (!word) return null;

  const meanings = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => ({
          pos: meaning?.pos?.trim(),
          definition: meaning?.definition?.trim(),
          translation: meaning?.translation?.trim(),
        }))
        .filter((meaning) => Boolean(meaning.definition))
    : [];

  const synonyms = Array.isArray(entry.synonyms)
    ? entry.synonyms
        .map((item) => ({
          word: String(item?.word ?? "").trim(),
          translation: item?.translation?.trim(),
        }))
        .filter((item) => Boolean(item.word))
    : [];

  const antonyms = Array.isArray(entry.antonyms)
    ? entry.antonyms
        .map((item) => ({
          word: String(item?.word ?? "").trim(),
          translation: item?.translation?.trim(),
        }))
        .filter((item) => Boolean(item.word))
    : [];

  return {
    id: String(entry.id ?? index + 1),
    word,
    meanings,
    synonyms,
    antonyms,
  };
}

const TICKS = Array.from({ length: 12 });

function SpeakerBtn({ text, bengaliText, size = 22 }: { text: string; bengaliText?: string; size?: number }) {
  const [state, setState] = useState<"idle" | "loading" | "speaking">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Tap again to stop
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: text.trim(),
          bengaliText: bengaliText ? bengaliText.trim() : undefined
        }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay   = () => setState("speaking");
      audio.onended  = () => { setState("idle"); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror  = () => { setState("idle"); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch {
      setState("idle");
    }
  };

  const speaking = state === "speaking";
  const loading  = state === "loading";

  return (
    <button
      className={`dt-speaker-btn ${speaking ? "speaking" : ""} ${loading ? "loading" : ""}`}
      onClick={handleClick}
      aria-label="Speak"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.55} height={size * 0.55} fill="none">
        {loading ? (
          <g>
            {TICKS.map((_, i) => (
              <rect
                key={i}
                className="ios-tick"
                x="22.5"
                y="4"
                width="3"
                height="9"
                rx="1.5"
                fill="currentColor"
                transform={`rotate(${i * 30} 24 24)`}
                style={{ animationDelay: `${-1 + (i / 12)}s` }}
              />
            ))}
          </g>
        ) : (
          <g>
            {/* SF Symbols-style speaker cone */}
            <path
              d="M6 18v12h6.5l10.5 9.5V8.5L12.5 18H6z"
              fill="currentColor"
            />
            {/* wave arcs, drawn in one after another while speaking */}
            <path
              className={`ios-arc ios-arc-1 ${speaking ? "is-speaking" : ""}`}
              d="M29 17a10 10 0 0 1 0 14"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 0}
              style={!speaking ? { opacity: 0.3 } : undefined}
            />
            <path
              className={`ios-arc ios-arc-2 ${speaking ? "is-speaking" : ""}`}
              d="M34.5 11.5a18 18 0 0 1 0 25"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 100}
              style={!speaking ? { opacity: 0 } : undefined}
            />
            <path
              className={`ios-arc ios-arc-3 ${speaking ? "is-speaking" : ""}`}
              d="M40 6a26 26 0 0 1 0 36"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 100}
              style={!speaking ? { opacity: 0 } : undefined}
            />
          </g>
        )}
      </svg>
    </button>
  );
}

export default function StudyModeQuizEngine() {
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRowClick = async (word: string, translation?: string) => {
    if (activeSpeech === word && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setActiveSpeech(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setActiveSpeech(word);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: word.trim(),
          bengaliText: translation ? translation.trim() : undefined
        }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setActiveSpeech(null); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = () => { setActiveSpeech(null); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch {
      setActiveSpeech(null);
    }
  };

  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [cards, setCards] = useState<StudyModeCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "synonyms" | "antonyms">("all");
  const [mobileTab, setMobileTab] = useState<"synonyms" | "antonyms">("synonyms");
  const [loading, setLoading] = useState(true);
  const [isHoveringLights, setIsHoveringLights] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [mobileSheetSearch, setMobileSheetSearch] = useState("");
  const [mobileSheetLetter, setMobileSheetLetter] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [stagedLetter, setStagedLetter] = useState<string | null>(null);
  const [isLetterDropdownOpen, setIsLetterDropdownOpen] = useState(false);

  // Filter cards by search + selected letter (memoized)
  const filteredCards = useMemo(
    () =>
      cards.filter((c) => {
        const matchSearch = c.word.toLowerCase().includes(searchQuery.toLowerCase());
        const matchLetter = !selectedLetter || c.word[0]?.toUpperCase() === selectedLetter;
        return matchSearch && matchLetter;
      }),
    [cards, searchQuery, selectedLetter]
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchQuestions({
      subject: "english",
      topic: "synonyms-antonyms",
      questionType: "study-mode",
      useCache: false,
    })
      .then((data) => {
        if (!active) return;
        const normalized = (Array.isArray(data) ? data : [])
          .map((entry, idx) => toStudyModeCard(entry as StudyModeEntry, idx))
          .filter((card): card is StudyModeCard => card !== null)
          .sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }));

        if (normalized.length > 0) {
          setCards(normalized);
        } else {
          setCards([DEMO_CARD]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setCards([DEMO_CARD]);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cards.length > 0 && currentPage > cards.length) {
      setCurrentPage(cards.length);
    }
  }, [cards.length, currentPage]);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("study-mode-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("study-mode-theme", theme);
    } catch {
      // Ignore storage access issues.
    }
  }, [theme]);

  // Desktop Keyboard navigation & Cmd+F Search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
        return;
      }
      if (e.key === "ArrowLeft" && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else if (e.key === "ArrowRight" && currentPage < filteredCards.length) {
        setCurrentPage((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, filteredCards.length]);

  // Close letter dropdown when clicking outside
  useEffect(() => {
    if (!isLetterDropdownOpen) return;
    const close = (e: MouseEvent) => {
      // ignore clicks inside the wrapper (handled by stopPropagation on the wrapper div)
      setIsLetterDropdownOpen(false);
    };
    // Use mousedown so it fires before the button's onClick can re-open
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [isLetterDropdownOpen]);

  // Derive the set of letters that actually exist in the word list (memoized)
  // MUST be before any conditional return to obey Rules of Hooks
  const availableLetters = useMemo(
    () =>
      Array.from(
        new Set(cards.map((c) => c.word[0]?.toUpperCase()).filter(Boolean))
      ).sort(),
    [cards]
  );

  // If filteredCards changes and currentPage is out of bounds, adjust it
  useEffect(() => {
    if (filteredCards.length > 0 && currentPage > filteredCards.length) {
      setCurrentPage(1);
    }
  }, [filteredCards.length, currentPage]);

  if (loading) {
    return (
      <main className="apple-dict-viewport" data-theme={theme}>
        <div className="loading-state">
          <div className="spinner" />
          <p>Indexing Apple Dictionary...</p>
        </div>
        <style jsx>{`
          .apple-dict-viewport {
            min-height: 100vh;
            background: #000000;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
          }
          .apple-dict-viewport[data-theme="light"] {
            background: #e5e5eb;
            color: #1d1d1f;
          }
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .spinner {
            width: 38px;
            height: 38px;
            border: 3px solid rgba(0, 122, 255, 0.2);
            border-top-color: #007aff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }


  const totalCards = filteredCards.length || 1;
  const activeCard = filteredCards[Math.min(currentPage - 1, totalCards - 1)] || DEMO_CARD;
  const posLabel = activeCard.meanings.map((m) => m.pos).filter(Boolean).join(" · ");

  return (
    <main className="apple-dict-viewport" data-theme={theme}>
      {/* ── Authentic macOS Apple Dictionary Window (Zero Scroll on PC) ── */}
      <div className="apple-app-window">
        
        {/* ── Left Master-Detail Navigation Sidebar (PC Exclusive) ── */}
        <aside className="macos-sidebar">
          {/* Traffic Lights + Letter Filter Button inside Sidebar */}
          <div
            className="traffic-lights"
            onMouseEnter={() => setIsHoveringLights(true)}
            onMouseLeave={() => setIsHoveringLights(false)}
          >
            <button
              type="button"
              className="light red"
              onClick={() => router.push("/english/synonyms-antonyms/study-mode")}
              aria-label="Close and return"
              title="Close to welcome screen"
            >
              {isHoveringLights && <span className="symbol">×</span>}
            </button>
            <button
              type="button"
              className="light yellow"
              onClick={() => router.push("/english/synonyms-antonyms/study-mode")}
              aria-label="Minimize"
              title="Minimize to topic"
            >
              {isHoveringLights && <span className="symbol">-</span>}
            </button>
            <button
              type="button"
              className="light green"
              onClick={() => {}}
              aria-label="Zoom window"
              title="Full screen view"
            >
              {isHoveringLights && <span className="symbol">+</span>}
            </button>

            {/* A-Z Letter Filter Button — upper right */}
            <div
              className="letter-filter-wrapper"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`letter-filter-btn ${selectedLetter ? "active" : ""} ${isLetterDropdownOpen ? "open" : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setStagedLetter(selectedLetter);
                  setIsLetterDropdownOpen((v) => !v);
                }}
                aria-label="Filter by letter"
                title="Filter vocabulary by starting letter"
              >
                {selectedLetter ?? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="14" y2="12" />
                    <line x1="4" y1="18" x2="10" y2="18" />
                  </svg>
                )}
              </button>

              {/* Dropdown panel */}
              {isLetterDropdownOpen && (
                <div className="letter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="letter-dropdown-header">
                    <span>Filter by letter</span>
                    {selectedLetter && (
                      <button
                        type="button"
                        className="letter-clear-btn"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => { setSelectedLetter(null); setStagedLetter(null); setIsLetterDropdownOpen(false); setCurrentPage(1); }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="letter-grid">
                    {availableLetters.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        className={`letter-tile ${stagedLetter === letter ? "active" : ""}`}
                        onClick={() => {
                          setStagedLetter(stagedLetter === letter ? null : letter);
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  {stagedLetter && (
                    <div className="dropdown-actions" style={{ display: 'flex', gap: '8px', padding: '10px 14px', borderTop: '0.5px solid var(--divider)' }}>
                      <button type="button" style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--item-hover)', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => { setStagedLetter(null); setSelectedLetter(null); setIsLetterDropdownOpen(false); setCurrentPage(1); }}>Reset</button>
                      <button type="button" style={{ flex: 2, padding: '8px', borderRadius: '6px', background: '#007aff', color: '#fff', fontWeight: 600 }} onClick={() => { setSelectedLetter(stagedLetter); setIsLetterDropdownOpen(false); setCurrentPage(1); }}>
                        Show {cards.filter(c => c.word[0]?.toUpperCase() === stagedLetter).length} results
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Apple Search Field */}
          <div className="sidebar-search">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="search-icon">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                className="search-input"
                placeholder="Search vocab (⌘F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="sidebar-section-title">VOCABULARY INDEX ({filteredCards.length})</div>

          {/* Scrollable Wordlist */}
          <div className="sidebar-word-list">
            {filteredCards.length === 0 ? (
              <div className="sidebar-empty">No matching terms</div>
            ) : (
              filteredCards.map((card, idx) => {
                const pageNum = idx + 1;
                const isSelected = currentPage === pageNum;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`word-row ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setCurrentPage(pageNum);
                    }}
                  >
                    <span className="row-word">{card.word}</span>
                    <span className="row-badge">{card.meanings[0]?.pos || "v."}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Main Dictionary Content Workspace ── */}
        <div className="macos-workspace">
          
          {/* Top Unified Toolbar */}
          <header className="unified-toolbar">
            <div className="toolbar-left">
              {/* Nav arrows hidden on mobile — shown in fixed footer instead */}
              <button
                type="button"
                className="nav-arrow nav-arrow-pc"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="Previous Word"
                title="Previous word (Left Arrow)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="nav-arrow nav-arrow-pc"
                onClick={() => setCurrentPage((prev) => Math.min(totalCards, prev + 1))}
                disabled={currentPage === totalCards}
                aria-label="Next Word"
                title="Next word (Right Arrow)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="toolbar-center">
              {/* Apple Segmented View Switcher (PC) */}
              <div className="apple-segmented-control" role="tablist">
                <button
                  type="button"
                  className={`segment-item ${viewMode === "all" ? "active" : ""}`}
                  onClick={() => setViewMode("all")}
                >
                  All Tables
                </button>
                <button
                  type="button"
                  className={`segment-item ${viewMode === "synonyms" ? "active" : ""}`}
                  onClick={() => setViewMode("synonyms")}
                >
                  Synonyms
                </button>
                <button
                  type="button"
                  className={`segment-item ${viewMode === "antonyms" ? "active" : ""}`}
                  onClick={() => setViewMode("antonyms")}
                >
                  Antonyms
                </button>
              </div>

              {/* Mobile title */}
              <div className="mobile-toolbar-title">{activeCard.word}</div>
            </div>

            <div className="toolbar-right">
              <span className="mobile-counter-top">
                {currentPage}/{totalCards}
              </span>

              <button
                type="button"
                className="mobile-filter-top"
                onClick={() => setIsMobilePaletteOpen(true)}
                aria-label="Filter words"
              >
                <ListFilter size={16} />
              </button>

              <button
                type="button"
                className="appearance-toggle"
                onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
                aria-label="Toggle theme appearance"
              >
                {theme === "dark" ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="icon-theme">
                    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-theme">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Mobile Word Palette Sheet Modal */}
          {isMobilePaletteOpen && (
            <div className="mobile-modal-backdrop" onClick={() => { setIsMobilePaletteOpen(false); setMobileSheetSearch(""); setMobileSheetLetter(null); }}>
              <div className="mobile-modal-sheet" onClick={(e) => e.stopPropagation()}>

                {/* Sheet Handle */}
                <div className="sheet-handle" />

                {/* Header */}
                <div className="sheet-header">
                  <span className="sheet-title">
                    Vocabulary Index ({cards.filter(c => {
                      const ms = !mobileSheetSearch || c.word.toLowerCase().includes(mobileSheetSearch.toLowerCase());
                      const ml = !mobileSheetLetter || c.word[0]?.toUpperCase() === mobileSheetLetter;
                      return ms && ml;
                    }).length})
                  </span>
                  <button type="button" className="btn-close" onClick={() => { setIsMobilePaletteOpen(false); setMobileSheetSearch(""); setMobileSheetLetter(null); }}>✕</button>
                </div>

                {/* Search */}
                <div className="sheet-search-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="sheet-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="search"
                    className="sheet-search-input"
                    placeholder="Search words…"
                    value={mobileSheetSearch}
                    onChange={(e) => { setMobileSheetSearch(e.target.value); setMobileSheetLetter(null); }}
                    autoFocus
                  />
                  {mobileSheetSearch && (
                    <button type="button" className="sheet-search-clear" onClick={() => setMobileSheetSearch("")}>✕</button>
                  )}
                </div>

                {/* A-Z Letter Filter Row */}
                <div className="sheet-letter-row">
                  {availableLetters.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className={`sheet-letter-btn ${mobileSheetLetter === letter ? "active" : ""}`}
                      onClick={() => { setMobileSheetLetter(mobileSheetLetter === letter ? null : letter); setMobileSheetSearch(""); }}
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                {/* Filter Actions */}
                {mobileSheetLetter && (
                  <div className="sheet-filter-actions" style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderBottom: '0.5px solid var(--divider)' }}>
                    <button type="button" style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--item-hover)', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => { setMobileSheetLetter(null); setSelectedLetter(null); setCurrentPage(1); }}>Reset</button>
                    <button type="button" style={{ flex: 2, padding: '10px', borderRadius: '8px', background: '#007aff', color: '#fff', fontWeight: 600 }} onClick={() => { setSelectedLetter(mobileSheetLetter); setIsMobilePaletteOpen(false); setCurrentPage(1); }}>
                      Show {cards.filter(c => c.word[0]?.toUpperCase() === mobileSheetLetter).length} results
                    </button>
                  </div>
                )}

                {/* Word List */}
                <div className="sheet-word-list">
                  {(() => {
                    const sheetCards = cards.filter(c => {
                      const ms = !mobileSheetSearch || c.word.toLowerCase().includes(mobileSheetSearch.toLowerCase());
                      const ml = !mobileSheetLetter || c.word[0]?.toUpperCase() === mobileSheetLetter;
                      return ms && ml;
                    });
                    if (sheetCards.length === 0) {
                      return <div className="sheet-empty">No matching words</div>;
                    }
                    return sheetCards.map((card) => {
                      const isActive = activeCard.id === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          className={`sheet-word-row ${isActive ? "active" : ""}`}
                          onClick={() => {
                            setSearchQuery(mobileSheetSearch);
                            setSelectedLetter(mobileSheetLetter);
                            const idx = sheetCards.findIndex((c) => c.id === card.id);
                            setCurrentPage(idx !== -1 ? idx + 1 : 1);
                            setIsMobilePaletteOpen(false);
                            setMobileSheetSearch("");
                            setMobileSheetLetter(null);
                          }}
                        >
                          <span className="sheet-word-name">{card.word}</span>
                          <span className="sheet-word-pos">{card.meanings[0]?.pos || "v."}</span>
                        </button>
                      );
                    });
                  })()}
                </div>

              </div>
            </div>
          )}

          {/* Main Dictionary Workspace Body */}
          <div className="dictionary-body-scroll">
            
            {/* Centerpiece Word Profile */}
            <section className="dict-word-profile">
              <div className="word-heading-line">
                <h1 className="dict-main-word">{activeCard.word}</h1>
                <SpeakerBtn text={activeCard.word} bengaliText={activeCard.meanings[0]?.translation} size={34} />
                {posLabel && <span className="grammar-tag">{posLabel}</span>}
              </div>

              <div className="meanings-container">
                {activeCard.meanings.map((m, idx) => (
                  <div key={idx} className="dict-meaning-block">
                    <div className="meaning-eng" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        {m.pos && <strong className="pos-inline">{m.pos} </strong>}
                        {m.definition}
                      </div>
                      <SpeakerBtn text={m.definition || ''} bengaliText={m.translation} size={22} />
                    </div>
                    {m.translation && (
                      <blockquote className="meaning-bng-quote">
                        <span className="quote-icon">❝</span>
                        <span>{m.translation}</span>
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* PC Split Comparison Tables (NSTableView Style) */}
            <section className="apple-tables-grid">
              {(viewMode === "all" || viewMode === "synonyms") && (
                <div className="ns-table-container">
                  <div className="table-header">
                    <span className="table-title">SYNONYMS</span>
                    <span className="table-count">{activeCard.synonyms.length} words</span>
                  </div>
                  <div className="table-body">
                    {activeCard.synonyms.length === 0 ? (
                      <div className="table-empty">No documented synonyms</div>
                    ) : (
                      activeCard.synonyms.map((s, i) => (
                        <div key={i} className={`table-row ${i % 2 === 1 ? "alt-row" : ""}`} onClick={() => handleRowClick(s.word, s.translation)} style={{ cursor: "pointer" }}>
                          <span className="cell-term" style={{ display: 'flex', alignItems: 'center' }}>
                            {s.word}
                            {activeSpeech === s.word && <Volume2 size={16} style={{ marginLeft: 8, color: '#007aff' }} />}
                          </span>
                          <span className="cell-trans">{s.translation || "—"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {(viewMode === "all" || viewMode === "antonyms") && (
                <div className="ns-table-container">
                  <div className="table-header">
                    <span className="table-title">ANTONYMS</span>
                    <span className="table-count">{activeCard.antonyms.length} words</span>
                  </div>
                  <div className="table-body">
                    {activeCard.antonyms.length === 0 ? (
                      <div className="table-empty">No documented antonyms</div>
                    ) : (
                      activeCard.antonyms.map((a, i) => (
                        <div key={i} className={`table-row ${i % 2 === 1 ? "alt-row" : ""}`} onClick={() => handleRowClick(a.word, a.translation)} style={{ cursor: "pointer" }}>
                          <span className="cell-term" style={{ display: 'flex', alignItems: 'center' }}>
                            {a.word}
                            {activeSpeech === a.word && <Volume2 size={16} style={{ marginLeft: 8, color: '#007aff' }} />}
                          </span>
                          <span className="cell-trans">{a.translation || "—"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Mobile Swipe Segmented Suite (<900px) */}
            <section className="mobile-suite">
              <div className="mobile-seg-control">
                <button
                  type="button"
                  className={`m-tab ${mobileTab === "synonyms" ? "active m-syn" : ""}`}
                  onClick={() => setMobileTab("synonyms")}
                >
                  Synonyms ({activeCard.synonyms.length})
                </button>
                <button
                  type="button"
                  className={`m-tab ${mobileTab === "antonyms" ? "active m-ant" : ""}`}
                  onClick={() => setMobileTab("antonyms")}
                >
                  Antonyms ({activeCard.antonyms.length})
                </button>
              </div>

              <div
                className="mobile-swipe-viewport"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  touchStartXRef.current = t?.clientX ?? null;
                  touchStartYRef.current = t?.clientY ?? null;
                }}
                onTouchEnd={(e) => {
                  const t = e.changedTouches[0];
                  const sx = touchStartXRef.current;
                  const sy = touchStartYRef.current;
                  if (sx === null || sy === null || !t) return;
                  const dx = t.clientX - sx;
                  const dy = t.clientY - sy;
                  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
                  if (dx < 0 && mobileTab === "synonyms") setMobileTab("antonyms");
                  if (dx > 0 && mobileTab === "antonyms") setMobileTab("synonyms");
                }}
              >
                <div className="ns-table-container">
                  <div className="table-body">
                    {mobileTab === "synonyms" ? (
                      activeCard.synonyms.length === 0 ? (
                        <div className="table-empty">No documented synonyms</div>
                      ) : (
                        activeCard.synonyms.map((s, i) => (
                          <div key={i} className="table-row" onClick={() => handleRowClick(s.word, s.translation)} style={{ cursor: "pointer" }}>
                            <span className="cell-term" style={{ display: 'flex', alignItems: 'center' }}>
                              {s.word}
                              {activeSpeech === s.word && <Volume2 size={16} style={{ marginLeft: 8, color: '#007aff' }} />}
                            </span>
                            <span className="cell-trans">{s.translation || "—"}</span>
                          </div>
                        ))
                      )
                    ) : (
                      activeCard.antonyms.length === 0 ? (
                        <div className="table-empty">No documented antonyms</div>
                      ) : (
                        activeCard.antonyms.map((a, i) => (
                          <div key={i} className="table-row" onClick={() => handleRowClick(a.word, a.translation)} style={{ cursor: "pointer" }}>
                            <span className="cell-term" style={{ display: 'flex', alignItems: 'center' }}>
                              {a.word}
                              {activeSpeech === a.word && <Volume2 size={16} style={{ marginLeft: 8, color: '#007aff' }} />}
                            </span>
                            <span className="cell-trans">{a.translation || "—"}</span>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Mobile Fixed Bottom Navigation Footer ── */}
          <div className="mobile-nav-footer">
            <button
              type="button"
              className="mobile-footer-btn prev"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="Previous Word"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Previous</span>
            </button>

            <button
              type="button"
              className="mobile-footer-btn next"
              onClick={() => setCurrentPage((prev) => Math.min(totalCards, prev + 1))}
              disabled={currentPage === totalCards}
              aria-label="Next Word"
            >
              <span>Next</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

        </div>
      </div>

      <style jsx>{`
        /* ════════════════════════════════════════════════════
           AUTHENTIC APPLE DICTIONARY MATERIALS & SYSTEM COLOR TOKENS
           ════════════════════════════════════════════════════ */
        .apple-dict-viewport {
          --desktop-bg: #000000;
          --sidebar-bg: rgba(30, 30, 35, 0.88);
          --workspace-bg: rgba(24, 24, 28, 0.96);
          --window-border: rgba(255, 255, 255, 0.16);
          --divider: rgba(255, 255, 255, 0.09);
          --text-primary: #ffffff;
          --text-secondary: #98989d;
          --text-muted: #636366;
          --item-hover: rgba(255, 255, 255, 0.06);
          --table-header: rgba(255, 255, 255, 0.03);
          --table-alt: rgba(255, 255, 255, 0.02);
          --quote-bg: rgba(255, 255, 255, 0.04);
          --quote-border: #007aff;
          --system-blue: #007aff;

          min-height: 100vh;
          height: 100vh;
          max-height: 100vh;
          overflow: hidden;
          background: var(--desktop-bg);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Arial, sans-serif;
          display: flex;
          flex-direction: column;
          padding: 0;
        }

        .apple-dict-viewport[data-theme="light"] {
          --desktop-bg: #e5e5eb;
          --sidebar-bg: rgba(235, 235, 240, 0.92);
          --workspace-bg: #ffffff;
          --window-border: rgba(0, 0, 0, 0.15);
          --divider: rgba(0, 0, 0, 0.08);
          --text-primary: #1d1d1f;
          --text-secondary: #6e6e73;
          --text-muted: #86868b;
          --item-hover: rgba(0, 0, 0, 0.04);
          --table-header: rgba(0, 0, 0, 0.025);
          --table-alt: rgba(0, 0, 0, 0.015);
          --quote-bg: rgba(0, 0, 0, 0.03);
          --quote-border: #007aff;
          --system-blue: #007aff;
        }

        /* ── macOS Application Window Frame ── */
        .apple-app-window {
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          max-height: 100vh;
          background: var(--workspace-bg);
          border: none;
          box-shadow: none;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: 0;
        }

        .apple-dict-viewport[data-theme="light"] .apple-app-window {
          box-shadow: none;
        }

        /* ── Left Navigation Sidebar (Default hidden on Mobile) ── */
        .macos-sidebar {
          display: none;
        }

        /* ── Main Workspace Area ── */
        .macos-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Top Unified Toolbar */
        .unified-toolbar {
          height: 48px;
          border-bottom: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          backdrop-filter: blur(30px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
        }

        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Hide PC-only nav arrows on mobile */
        .nav-arrow-pc { display: none; }

        /* ── Mobile Fixed Bottom Navigation Footer ── */
        .mobile-nav-footer {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px env(safe-area-inset-bottom, 14px);
          background: var(--sidebar-bg);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border-top: 0.5px solid var(--divider);
          flex-shrink: 0;
        }

        .mobile-footer-btn {
          flex: 1;
          height: 46px;
          border-radius: 12px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .mobile-footer-btn:active:not(:disabled) {
          background: rgba(0,122,255,0.15);
        }
        .mobile-footer-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .mobile-footer-counter {
          flex-shrink: 0;
          min-width: 72px;
          height: 36px;
          border-radius: 8px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-arrow {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: var(--item-hover);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .nav-arrow:disabled {
          color: var(--text-muted);
          opacity: 0.4;
          cursor: not-allowed;
        }

        .nav-arrow svg { width: 16px; height: 16px; }


        .apple-segmented-control {
          display: none;
        }

        .mobile-toolbar-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .mobile-counter-top {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--item-hover);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          height: 28px;
          padding: 0 10px;
          border-radius: 6px;
          margin-right: 8px;
          border: 0.5px solid var(--divider);
        }

        .mobile-filter-top {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--item-hover);
          color: var(--text-primary);
          height: 28px;
          width: 28px;
          border-radius: 6px;
          margin-right: 8px;
          border: 0.5px solid var(--divider);
          cursor: pointer;
        }

        .appearance-toggle {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .icon-theme { width: 16px; height: 16px; }

        /* Dictionary Body Content Area */
        .dictionary-body-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Centerpiece Word Profile */
        .dict-word-profile {
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-bottom: 0.5px solid var(--divider);
          padding-bottom: 20px;
        }

        .word-heading-line {
          display: flex;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dict-main-word {
          font-size: clamp(2.2rem, 4vw, 3.2rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          margin: 0;
          color: var(--text-primary);
        }

        .grammar-tag {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-secondary);
          font-style: italic;
        }

        .meanings-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dict-meaning-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .meaning-eng {
          font-size: 16px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .pos-inline { color: var(--system-blue); font-weight: 600; }

        .meaning-bng-quote {
          margin: 0;
          padding: 8px 14px;
          border-left: 3px solid var(--quote-border);
          background: var(--quote-bg);
          border-radius: 0 8px 8px 0;
          font-size: 15px;
          font-weight: 500;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .quote-icon { font-size: 14px; color: var(--system-blue); opacity: 0.8; }

        /* PC Apple Tables Grid (Hidden on Mobile) */
        .apple-tables-grid { display: none; }

        /* Mobile Touch Suite */
        .mobile-suite { display: flex; flex-direction: column; gap: 14px; }
        .mobile-seg-control {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: var(--item-hover);
          padding: 3px;
          border-radius: 8px;
          border: 0.5px solid var(--divider);
        }

        .m-tab {
          padding: 8px;
          border: none;
          background: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .m-tab.active { background: var(--workspace-bg); color: var(--text-primary); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }

        .ns-table-container {
          border: 0.5px solid var(--divider);
          border-radius: 10px;
          overflow: hidden;
        }

        .table-body { display: flex; flex-direction: column; }
        .table-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-bottom: 0.5px solid var(--divider);
          font-size: 14.5px;
        }

        .table-row:last-child { border-bottom: none; }
        .alt-row { background: var(--table-alt); }
        .cell-term { font-weight: 600; color: var(--text-primary); }
        .cell-trans { color: var(--text-secondary); }
        .table-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 14px; }

        /* Bottom Status Bar */
        .macos-status-bar {
          height: 44px;
          border-top: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-center { display: none; }
        .status-btn {
          padding: 6px 14px;
          border-radius: 6px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
        }

        .status-btn:disabled { opacity: 0.4; }

        /* Mobile Palette Sheet */
        .mobile-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: flex-end;
        }

        .mobile-modal-sheet {
          background: var(--workspace-bg);
          width: 100%;
          height: 85vh;
          border-radius: 20px 20px 0 0;
          padding: 0 0 env(safe-area-inset-bottom, 20px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sheet-handle {
          width: 36px;
          height: 4px;
          background: var(--divider);
          border-radius: 2px;
          margin: 10px auto 0;
          flex-shrink: 0;
        }

        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px 10px;
          flex-shrink: 0;
          border-bottom: 0.5px solid var(--divider);
        }

        .sheet-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .btn-close {
          border: none;
          background: none;
          font-size: 17px;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
        }

        /* Sheet Search */
        .sheet-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 12px 8px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          border-radius: 10px;
          padding: 8px 12px;
          flex-shrink: 0;
        }
        .sheet-search-icon { width: 15px; height: 15px; color: var(--text-muted); flex-shrink: 0; }
        .sheet-search-input {
          flex: 1;
          border: none;
          background: none;
          font-size: 15px;
          color: var(--text-primary);
          outline: none;
        }
        .sheet-search-input::placeholder { color: var(--text-muted); }
        .sheet-search-clear {
          border: none; background: none;
          color: var(--text-muted); font-size: 14px; cursor: pointer; padding: 0;
        }

        /* Sheet Letter Filter Row */
        .sheet-letter-row {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          padding: 0 12px 8px;
          flex-shrink: 0;
          scrollbar-width: none;
        }
        .sheet-letter-row::-webkit-scrollbar { display: none; }

        .sheet-letter-btn {
          flex-shrink: 0;
          height: 30px;
          min-width: 30px;
          padding: 0 8px;
          border-radius: 7px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .sheet-letter-btn.active {
          background: var(--system-blue);
          color: #fff;
          border-color: var(--system-blue);
        }

        /* Sheet Word List */
        .sheet-word-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 4px 8px 16px;
          gap: 2px;
        }
        .sheet-word-list::-webkit-scrollbar { width: 4px; }
        .sheet-word-list::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 10px; }

        .sheet-word-row {
          width: 100%;
          height: 44px;
          padding: 0 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background 0.1s;
        }
        .sheet-word-row:active { background: var(--item-hover); }
        .sheet-word-row.active {
          background: var(--system-blue);
        }
        .sheet-word-name {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary);
          text-align: left;
        }
        .sheet-word-row.active .sheet-word-name { color: #fff; font-weight: 600; }
        .sheet-word-pos {
          font-size: 13px;
          color: var(--text-secondary);
          font-style: italic;
        }
        .sheet-word-row.active .sheet-word-pos { color: rgba(255,255,255,0.8); }
        .sheet-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }

        /* ════════════════════════════════════════════════════
           PC DESKTOP ZERO-SCROLL MASTER-DETAIL SUITE (min-width: 900px)
           ════════════════════════════════════════════════════ */
        @media (min-width: 900px) {
          .apple-dict-viewport {
            height: 100vh;
            max-height: 100vh;
            overflow: hidden; /* ABSOLUTELY ZERO PAGE SCROLLING! */
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .apple-app-window {
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
            border: none;
            box-shadow: none;
            flex-direction: row;
            margin: 0;
          }

          /* ── Left Navigation Sidebar (Master List) ── */
          .macos-sidebar {
            width: 285px;
            display: flex;
            flex-direction: column;
            background: var(--sidebar-bg);
            backdrop-filter: blur(40px);
            border-right: 0.5px solid var(--divider);
            flex-shrink: 0;
            user-select: none;
          }

          .traffic-lights {
            padding: 16px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
          }

          /* ── Letter Filter Button ── */
          .letter-filter-wrapper {
            margin-left: auto;
            position: relative;
          }

          .letter-filter-btn {
            width: 26px;
            height: 26px;
            border-radius: 6px;
            border: 0.5px solid var(--divider);
            background: var(--item-hover);
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
            letter-spacing: 0;
          }

          .letter-filter-btn:hover {
            background: rgba(0, 122, 255, 0.12);
            border-color: var(--system-blue);
            color: var(--system-blue);
          }

          .letter-filter-btn.active {
            background: var(--system-blue);
            border-color: var(--system-blue);
            color: #ffffff;
          }

          .letter-filter-btn.open {
            background: rgba(0, 122, 255, 0.15);
            border-color: var(--system-blue);
            color: var(--system-blue);
          }

          /* ── Letter Dropdown Panel ── */
          .letter-dropdown {
            position: absolute;
            top: calc(100% + 6px);
            right: 0;
            z-index: 200;
            width: 240px;
            background: var(--sidebar-bg);
            border: 0.5px solid var(--divider);
            border-radius: 10px;
            padding: 10px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(30px);
          }

          .apple-dict-viewport[data-theme="light"] .letter-dropdown {
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
          }

          .letter-dropdown-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin-bottom: 8px;
            padding: 0 2px;
          }

          .letter-clear-btn {
            font-size: 11px;
            font-weight: 600;
            color: var(--system-blue);
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            text-transform: none;
          }

          .letter-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
          }

          .letter-tile {
            height: 28px;
            border-radius: 5px;
            border: 0.5px solid var(--divider);
            background: var(--item-hover);
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.1s, color 0.1s;
          }

          .letter-tile:hover {
            background: rgba(0, 122, 255, 0.15);
            color: var(--system-blue);
            border-color: var(--system-blue);
          }

          .letter-tile.active {
            background: var(--system-blue);
            color: #ffffff;
            border-color: var(--system-blue);
          }

          .light {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
          }

          .red { background: #ff5f56; border: 0.5px solid #e0443e; }
          .yellow { background: #ffbd2e; border: 0.5px solid #dea123; }
          .green { background: #27c93f; border: 0.5px solid #1aab29; }
          .symbol { font-size: 8px; font-weight: 800; color: rgba(0, 0, 0, 0.7); line-height: 1; }

          .sidebar-search {
            padding: 0 12px 12px;
          }

          .search-box {
            background: rgba(0, 0, 0, 0.16);
            border: 0.5px solid var(--divider);
            border-radius: 8px;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            gap: 6px;
          }

          .apple-dict-viewport[data-theme="light"] .search-box {
            background: rgba(0, 0, 0, 0.05);
          }

          .search-icon { width: 14px; height: 14px; color: var(--text-muted); }
          .search-input {
            border: none;
            background: none;
            font-size: 13px;
            color: var(--text-primary);
            width: 100%;
            outline: none;
          }
          .search-input::placeholder { color: var(--text-muted); }

          .clear-search { border: none; background: none; color: var(--text-muted); font-size: 12px; cursor: pointer; }

          .sidebar-section-title {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            padding: 6px 16px;
            letter-spacing: 0.03em;
          }

          .sidebar-word-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 8px 16px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .sidebar-word-list::-webkit-scrollbar { width: 5px; }
          .sidebar-word-list::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }

          .word-row {
            height: 34px;
            padding: 0 10px;
            border-radius: 6px;
            border: none;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            transition: background 0.1s ease;
          }

          .word-row:hover:not(.selected) {
            background: var(--item-hover);
          }

          .word-row.selected {
            background: var(--system-blue);
            color: #ffffff;
          }

          .row-word { font-size: 13.5px; font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
          .word-row.selected .row-word { font-weight: 600; }

          .row-badge { font-size: 11.5px; color: var(--text-secondary); font-style: italic; }
          .word-row.selected .row-badge { color: rgba(255, 255, 255, 0.85); }

          .sidebar-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

          /* ── Main Workspace ── */

          .mobile-toolbar-title { display: none; }
          .mobile-grid-btn { display: none; }
          .mobile-suite { display: none; }
          .mobile-counter-top { display: none; }
          .mobile-filter-top { display: none; }
          .mobile-nav-footer { display: none; }
          .nav-arrow-pc { display: flex; }

          .apple-segmented-control {
            display: inline-flex;
            background: var(--item-hover);
            border: 0.5px solid var(--divider);
            padding: 2px;
            border-radius: 7px;
          }

          .segment-item {
            padding: 4px 14px;
            border: none;
            background: none;
            border-radius: 5px;
            font-size: 12.5px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
          }

          .segment-item.active {
            background: var(--workspace-bg);
            color: var(--text-primary);
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          }

          .dictionary-body-scroll {
            padding: 32px 40px;
          }

          .dictionary-body-scroll::-webkit-scrollbar { width: 6px; }
          .dictionary-body-scroll::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }

          .dict-word-profile {
            flex-direction: row;
            align-items: flex-start;
            gap: 40px;
          }

          .word-heading-line {
            flex: 0 0 auto;
            max-width: 35%;
          }

          .meanings-container {
            flex: 1 1 auto;
          }

          /* Apple Tables Grid */
          .apple-tables-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
          }

          .ns-table-container {
            border: 0.5px solid var(--divider);
            border-radius: 8px;
            background: var(--item-hover);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .table-header {
            padding: 8px 14px;
            background: var(--table-header);
            border-bottom: 0.5px solid var(--divider);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .table-title { font-size: 11.5px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; }
          .table-count { font-size: 11.5px; color: var(--text-muted); }

          .table-row {
            padding: 9px 14px;
            font-size: 13.5px;
          }

          .macos-status-bar {
            height: 28px;
            padding: 0 16px;
            font-size: 11.5px;
          }

          .status-center {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          kbd {
            background: var(--item-hover);
            border: 0.5px solid var(--divider);
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .status-right { display: none; }
        }

        .dt-speaker-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--system-blue) 40%, transparent); background: transparent; color: var(--system-blue); cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none; opacity: 0.85; -webkit-tap-highlight-color: transparent; }
        .dt-speaker-btn:hover { opacity: 1; transform: scale(1.08); border-color: color-mix(in srgb, var(--system-blue) 70%, transparent); }
        .dt-speaker-btn:active { transform: scale(0.88); opacity: 0.7; }
        .dt-speaker-btn.speaking { opacity: 1; }
        .dt-speaker-btn.loading { opacity: 0.8; cursor: wait; }
        
        .ios-tick { animation: ios-tick-fade 1s steps(1) infinite; }
        @keyframes ios-tick-fade {
          0%   { opacity: 1; }
          8.3% { opacity: 0.85; }
          16.6%{ opacity: 0.7; }
          25%  { opacity: 0.55; }
          33.3%{ opacity: 0.42; }
          41.6%{ opacity: 0.32; }
          50%  { opacity: 0.24; }
          58.3%{ opacity: 0.18; }
          66.6%{ opacity: 0.15; }
          100% { opacity: 0.15; }
        }

        .ios-arc { opacity: 0; }
        .ios-arc.is-speaking { animation-duration: 2s; animation-timing-function: ease; animation-iteration-count: infinite; }
        .ios-arc-1.is-speaking { animation-name: ios-draw-1; }
        .ios-arc-2.is-speaking { animation-name: ios-draw-2; }
        .ios-arc-3.is-speaking { animation-name: ios-draw-3; }

        @keyframes ios-draw-1 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          16%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
        @keyframes ios-draw-2 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          16%  { stroke-dashoffset: 100; opacity: 0; }
          32%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
        @keyframes ios-draw-3 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          32%  { stroke-dashoffset: 100; opacity: 0; }
          48%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
      `}</style>
    </main>
  );
}