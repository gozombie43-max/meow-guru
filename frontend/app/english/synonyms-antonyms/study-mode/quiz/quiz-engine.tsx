"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchQuestions } from "@/lib/api/questions";
import { Volume2, ArrowLeft, LogOut } from "lucide-react";
import { useThemeMode } from "@/hooks/useTheme";

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
  const { theme, toggleThemeMode } = useThemeMode();
  const [cards, setCards] = useState<StudyModeCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "synonyms" | "antonyms">("all");
  const [mobileTab, setMobileTab] = useState<"synonyms" | "antonyms">("synonyms");
  const [loading, setLoading] = useState(true);
  const [isHoveringLights, setIsHoveringLights] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [mobileSheetSearch, setMobileSheetSearch] = useState("");
  const [mobileSheetLetter, setMobileSheetLetter] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [stagedLetter, setStagedLetter] = useState<string | null>(null);
  const [isLetterDropdownOpen, setIsLetterDropdownOpen] = useState(false);
  
  const [mobileSheetVisibleCount, setMobileSheetVisibleCount] = useState(50);
  useEffect(() => { setMobileSheetVisibleCount(50); }, [mobileSheetSearch, mobileSheetLetter]);

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

  // Default to Synonyms tab whenever navigating between words
  useEffect(() => {
    setMobileTab("synonyms");
  }, [currentPage]);

  // Desktop Keyboard navigation & Cmd+F Search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (showExitConfirm) {
          setShowExitConfirm(false);
          return;
        }
        if (isMobilePaletteOpen) {
          setIsMobilePaletteOpen(false);
          return;
        }
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

  const isPaletteOpenRef = useRef(false);
  const isExitConfirmRef = useRef(false);

  const allowExitRef = useRef(false);

  useEffect(() => {
    isPaletteOpenRef.current = isMobilePaletteOpen;
  }, [isMobilePaletteOpen]);

  useEffect(() => {
    isExitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    // Push an initial history entry to trap real back navigation
    window.history.pushState(null, "", window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      if (allowExitRef.current) return;

      if (isExitConfirmRef.current) {
        setShowExitConfirm(false);
        window.history.pushState(null, "", window.location.href);
        return;
      }

      if (isPaletteOpenRef.current) {
        setIsMobilePaletteOpen(false);
        window.history.pushState(null, "", window.location.href);
        return;
      }

      setShowExitConfirm(true);
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleConfirmExit = () => {
    allowExitRef.current = true;
    setShowExitConfirm(false);
    
    // Pop the trap state natively first
    window.history.back();
    
    // Replace the original quiz state with the target page
    setTimeout(() => {
      router.replace("/english/synonyms-antonyms");
    }, 10);
  };

  // Derive the set of letters that actually exist in the word list (memoized)
  // MUST be before any conditional return to obey Rules of Hooks
  const availableLetters = useMemo(
    () =>
      Array.from(
        new Set(cards.map((c) => c.word[0]?.toUpperCase()).filter(Boolean))
      ).sort(),
    [cards]
  );

  // Derived filtered cards for the mobile full-page filter modal
  const filteredSheetCards = useMemo(() => {
    const q = mobileSheetSearch.trim().toLowerCase();
    return cards.filter((c) => {
      const matchSearch =
        !q ||
        c.word.toLowerCase().includes(q) ||
        c.meanings.some(
          (m) =>
            m.translation?.toLowerCase().includes(q) ||
            m.definition?.toLowerCase().includes(q)
        );
      const matchLetter =
        !mobileSheetLetter || c.word[0]?.toUpperCase() === mobileSheetLetter;
      return matchSearch && matchLetter;
    });
  }, [cards, mobileSheetSearch, mobileSheetLetter]);

  // If filteredCards changes and currentPage is out of bounds, adjust it
  useEffect(() => {
    if (filteredCards.length > 0 && currentPage > filteredCards.length) {
      setCurrentPage(1);
    }
  }, [filteredCards.length, currentPage]);

  // Scroll to active card when mobile palette opens
  useEffect(() => {
    if (isMobilePaletteOpen) {
      const activeCardFallback = filteredCards[Math.min(currentPage - 1, Math.max(0, filteredCards.length - 1))];
      if (activeCardFallback) {
        const activeIdx = filteredSheetCards.findIndex(c => c.id === activeCardFallback.id);
        if (activeIdx !== -1) {
          // Ensure visible count includes the active index + some buffer
          if (activeIdx >= mobileSheetVisibleCount) {
            setMobileSheetVisibleCount(activeIdx + 20);
          }
          
          // Wait for DOM to render the new count, then scroll
          setTimeout(() => {
            const activeEl = document.querySelector('.modal-word-item.active');
            if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
          }, 50);
        }
      }
    }
  }, [isMobilePaletteOpen]); // Only run when palette open state changes

  if (loading) {
    return (
      <main className="apple-dict-viewport" data-theme={theme}>
        <div className="loading-state">
          <div className="spinner" />
          <p>Indexing Apple Dictionary...</p>
        </div>
        <style jsx>{`
          .apple-dict-viewport {
            min-height: 100dvh;
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
      {/* Mini Middle Pop-up Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          className="exit-modal-backdrop"
          onClick={() => setShowExitConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
        >
          <div className="exit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="exit-modal-icon-wrap">
              <LogOut size={22} className="exit-modal-icon" />
            </div>
            <h3 id="exit-modal-title" className="exit-modal-title">
              Want to exit?
            </h3>
            <p className="exit-modal-desc">
              Are you sure you want to leave study mode? Your session progress is saved.
            </p>
            <div className="exit-modal-actions">
              <button
                type="button"
                className="exit-btn-cancel"
                onClick={() => setShowExitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="exit-btn-confirm"
                onClick={handleConfirmExit}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => setShowExitConfirm(true)}
              aria-label="Close and return"
              title="Close to welcome screen"
            >
              {isHoveringLights && <span className="symbol">×</span>}
            </button>
            <button
              type="button"
              className="light yellow"
              onClick={() => setShowExitConfirm(true)}
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
              {/* Mobile Back button to return to study mode */}
              <button
                type="button"
                className="mobile-back-btn"
                onClick={() => setShowExitConfirm(true)}
                aria-label="Back to Study Mode"
                title="Back to Study Mode"
              >
                <ArrowLeft size={15} />
                <span className="mobile-back-text">Back</span>
              </button>
            </div>

            <div className="toolbar-center">
              {/* Apple Segmented View Switcher (PC only) */}
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

              {/* Mobile title: just the given word */}
              <div className="mobile-toolbar-title">
                <span className="mobile-toolbar-word">{activeCard.word}</span>
                {posLabel && <span className="mobile-toolbar-pos">({posLabel})</span>}
              </div>
            </div>

            <div className="toolbar-right">
              {/* Rectangular Counter Box acting as Filter button */}
              <button
                type="button"
                className="mobile-counter-filter-btn"
                onClick={() => setIsMobilePaletteOpen(true)}
                aria-label="Filter vocabulary index"
                title="Filter words"
              >
                <span className="counter-curr">{currentPage}</span>
                <span className="counter-sep">/</span>
                <span className="counter-tot">{totalCards}</span>
              </button>

              <button
                type="button"
                className="appearance-toggle"
                onClick={toggleThemeMode}
                aria-label="Toggle theme appearance"
                title="Toggle Theme"
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

          {/* Mobile Full-Page Filter Modal */}
          {isMobilePaletteOpen && (
            <div className="mobile-full-modal" role="dialog" aria-modal="true" aria-label="Vocabulary Index Filter">
              {/* Modal Top Header Bar */}
              <div className="modal-top-bar">
                <button
                  type="button"
                  className="modal-top-back-btn"
                  onClick={() => setIsMobilePaletteOpen(false)}
                  aria-label="Close Filter"
                >
                  <ArrowLeft size={16} />
                  <span>Done</span>
                </button>

                <div className="modal-top-title">
                  <span>Vocabulary Index</span>
                </div>

                {mobileSheetSearch || mobileSheetLetter ? (
                  <button
                    type="button"
                    className="modal-top-reset-btn"
                    onClick={() => {
                      setMobileSheetSearch("");
                      setMobileSheetLetter(null);
                    }}
                  >
                    Reset
                  </button>
                ) : (
                  <span className="modal-top-counter">
                    {cards.length} Words
                  </span>
                )}
              </div>

              {/* Search Bar (WITHOUT autoFocus so keyboard doesn't open immediately) */}
              <div className="modal-search-wrapper">
                <div className="modal-search-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="modal-search-ico">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="search"
                    className="modal-search-input"
                    placeholder="Search by word or meaning..."
                    value={mobileSheetSearch}
                    onChange={(e) => setMobileSheetSearch(e.target.value)}
                  />
                  {mobileSheetSearch && (
                    <button
                      type="button"
                      className="modal-search-clear"
                      onClick={() => setMobileSheetSearch("")}
                      aria-label="Clear Search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* A-Z Letter Filter Scroll Bar */}
              <div className="modal-letter-strip" role="tablist" aria-label="Filter by letter">
                <button
                  type="button"
                  className={`modal-letter-chip ${!mobileSheetLetter ? "active" : ""}`}
                  onClick={() => setMobileSheetLetter(null)}
                >
                  All
                </button>
                {availableLetters.map((letter) => {
                  const isSelected = mobileSheetLetter === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      className={`modal-letter-chip ${isSelected ? "active" : ""}`}
                      onClick={() => setMobileSheetLetter(isSelected ? null : letter)}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Filter Status Summary Bar */}
              <div className="modal-status-bar">
                <span>
                  Showing {filteredSheetCards.length} {filteredSheetCards.length === 1 ? "word" : "words"}
                  {mobileSheetLetter && ` • Letter "${mobileSheetLetter}"`}
                  {mobileSheetSearch && ` • "${mobileSheetSearch}"`}
                </span>
              </div>

              {/* Scrollable Word List */}
              <div 
                className="modal-word-list"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
                    if (mobileSheetVisibleCount < filteredSheetCards.length) {
                      setMobileSheetVisibleCount(c => c + 50);
                    }
                  }
                }}
              >
                {filteredSheetCards.length === 0 ? (
                  <div className="modal-empty-state">
                    <div className="empty-ico">🔍</div>
                    <div className="empty-title">No vocabulary words found</div>
                    <div className="empty-sub">Try searching with a different keyword or starting letter</div>
                    <button
                      type="button"
                      className="btn-clear-all"
                      onClick={() => {
                        setMobileSheetSearch("");
                        setMobileSheetLetter(null);
                      }}
                    >
                      Show All Words
                    </button>
                  </div>
                ) : (
                  filteredSheetCards.slice(0, mobileSheetVisibleCount).map((card) => {
                    const isActive = activeCard.id === card.id;
                    const pos = card.meanings[0]?.pos || "v.";
                    const trans = card.meanings[0]?.translation || "";
                    const origIndex = cards.findIndex((c) => c.id === card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`modal-word-item ${isActive ? "active" : ""}`}
                        onClick={() => {
                          const targetIdx = cards.findIndex((c) => c.id === card.id);
                          setCurrentPage(targetIdx !== -1 ? targetIdx + 1 : 1);
                          setIsMobilePaletteOpen(false);
                        }}
                      >
                        <div className="word-item-left">
                          <span className="word-item-idx">#{origIndex !== -1 ? origIndex + 1 : 1}</span>
                          <div className="word-item-text">
                            <div className="word-name-row">
                              <span className="word-term">{card.word}</span>
                              <span className="word-pos-tag">{pos}</span>
                            </div>
                            {trans && <div className="word-trans-preview">{trans}</div>}
                          </div>
                        </div>

                        {isActive && (
                          <span className="word-active-badge">Active</span>
                        )}
                      </button>
                    );
                  })
                )}
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
                  className={`m-tab ${mobileTab === "synonyms" ? "active" : ""}`}
                  onClick={() => setMobileTab("synonyms")}
                >
                  <span>Synonyms</span>
                  <span className="m-tab-badge">{activeCard.synonyms.length}</span>
                </button>
                <button
                  type="button"
                  className={`m-tab ${mobileTab === "antonyms" ? "active" : ""}`}
                  onClick={() => setMobileTab("antonyms")}
                >
                  <span>Antonyms</span>
                  <span className="m-tab-badge">{activeCard.antonyms.length}</span>
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

          {/* ── Mobile Floating Navigation Buttons ── */}
          <div className="mobile-nav-footer">
            <button
              type="button"
              className="mobile-footer-btn prev"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="Previous Word"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
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
          --sidebar-bg: rgba(30, 30, 35, 0.85);
          --workspace-bg: #000000;
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

          min-height: 100dvh;
          height: 100dvh;
          max-height: 100dvh;
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
          height: 100dvh;
          max-height: 100dvh;
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
          height: calc(48px + var(--safe-top));
          border-bottom: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--safe-top) 10px 0;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 40;
          gap: 6px;
        }

        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .mobile-back-btn {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 30px;
          padding: 0 8px 0 6px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.07);
          color: var(--system-blue);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .mobile-back-btn {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .mobile-back-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }
        .mobile-back-text {
          line-height: 1;
        }

        .apple-segmented-control {
          display: none;
        }

        .mobile-toolbar-title {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
          max-width: 140px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .mobile-toolbar-word {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .mobile-toolbar-pos {
          font-size: 11.5px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .mobile-counter-filter-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: rgba(255, 255, 255, 0.07);
          color: var(--system-blue);
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          height: 28px;
          padding: 0 8px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .mobile-counter-filter-btn {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .mobile-counter-filter-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }
        .counter-curr { font-weight: 700; }
        .counter-sep { opacity: 0.7; font-weight: 800; }
        .counter-tot { opacity: 0.85; font-weight: 600; }

        .appearance-toggle {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .appearance-toggle {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .appearance-toggle:active {
          transform: scale(0.94);
        }

        .icon-theme { width: 14px; height: 14px; }

        /* ── Mobile Floating Navigation Buttons ── */
        .mobile-nav-footer {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px max(14px, env(safe-area-inset-bottom, 14px));
          background: transparent;
          border: none;
          box-shadow: none;
          pointer-events: none;
          flex-shrink: 0;
        }

        .mobile-footer-btn {
          flex: 1;
          height: 42px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          pointer-events: auto;
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.07);
          color: #ffffff;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
          color: #1d1d1f;
        }

        .mobile-footer-btn:active:not(:disabled) {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn:active:not(:disabled) {
          background: rgba(0, 0, 0, 0.1);
          border-color: rgba(0, 0, 0, 0.25);
        }

        .mobile-footer-btn:disabled {
          opacity: 0.4;
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: none;
          cursor: not-allowed;
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn:disabled {
          border-color: rgba(0, 0, 0, 0.08);
          color: rgba(0, 0, 0, 0.35);
          background: rgba(0, 0, 0, 0.02);
        }

        /* Dictionary Body Content Area */
        .dictionary-body-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px 88px;
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
        .mobile-suite {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .mobile-seg-control {
          display: flex;
          border-bottom: 1px solid var(--divider);
          position: relative;
        }

        .m-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px 11px;
          border: none;
          background: transparent;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          position: relative;
          transition: color 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .m-tab.active {
          color: var(--text-primary);
          font-weight: 700;
        }

        .m-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 12%;
          right: 12%;
          height: 3px;
          background: #007aff;
          border-radius: 3px 3px 0 0;
          box-shadow: 0 1px 6px rgba(0, 122, 255, 0.45);
        }

        .m-tab-badge {
          font-size: 11.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          background: var(--item-hover);
          color: var(--text-secondary);
          padding: 1px 7px;
          border-radius: 9999px;
          border: 0.5px solid var(--divider);
          transition: all 0.15s ease;
        }

        .m-tab.active .m-tab-badge {
          background: rgba(0, 122, 255, 0.14);
          color: #007aff;
          border-color: rgba(0, 122, 255, 0.3);
        }

        .ns-table-container {
          border: 1px solid var(--divider);
          border-radius: 14px;
          background: var(--item-hover);
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .apple-dict-viewport[data-theme="light"] .ns-table-container {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .table-body {
          display: flex;
          flex-direction: column;
        }

        .table-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          border-bottom: 0.5px solid var(--divider);
          font-size: 14.5px;
          transition: background 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:active {
          background: rgba(255, 255, 255, 0.08);
        }

        .apple-dict-viewport[data-theme="light"] .table-row:active {
          background: rgba(0, 0, 0, 0.06);
        }

        .cell-term {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .cell-trans {
          font-size: 14px;
          color: var(--text-secondary);
          text-align: right;
          max-width: 50%;
        }

        .table-empty {
          padding: 32px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }

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

        /* ── Full Page Mobile Filter Modal ── */
        .mobile-full-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: var(--workspace-bg);
          display: flex;
          flex-direction: column;
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          animation: modal-slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modal-slide-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-top-bar {
          height: 48px;
          border-bottom: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          flex-shrink: 0;
        }

        .modal-top-back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 32px;
          padding: 0 10px 0 6px;
          border-radius: 8px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--system-blue);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-top-back-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }

        .modal-top-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .modal-top-reset-btn {
          height: 28px;
          padding: 0 10px;
          border-radius: 7px;
          border: none;
          background: rgba(255, 59, 48, 0.12);
          color: #ff3b30;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-top-reset-btn:active {
          background: rgba(255, 59, 48, 0.22);
        }

        .modal-top-counter {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--item-hover);
          padding: 3px 8px;
          border-radius: 6px;
          border: 0.5px solid var(--divider);
        }

        .modal-search-wrapper {
          padding: 8px 12px 6px;
          flex-shrink: 0;
        }

        .modal-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          border-radius: 9px;
          padding: 7px 10px;
        }

        .modal-search-ico {
          width: 14px;
          height: 14px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .modal-search-input {
          flex: 1;
          border: none;
          background: none;
          font-size: 14px;
          color: var(--text-primary);
          outline: none;
        }
        .modal-search-input::placeholder {
          color: var(--text-muted);
        }

        .modal-search-clear {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
        }

        .modal-letter-strip {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          padding: 4px 12px 8px;
          flex-shrink: 0;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .modal-letter-strip::-webkit-scrollbar {
          display: none;
        }

        .modal-letter-chip {
          flex-shrink: 0;
          height: 28px;
          min-width: 30px;
          padding: 0 8px;
          border-radius: 7px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-letter-chip:active {
          transform: scale(0.94);
        }
        .modal-letter-chip.active {
          background: var(--system-blue);
          color: #ffffff;
          border-color: var(--system-blue);
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.35);
        }

        .modal-status-bar {
          padding: 4px 12px 6px;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
          border-bottom: 0.5px solid var(--divider);
          flex-shrink: 0;
        }

        .modal-word-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 10px calc(24px + env(safe-area-inset-bottom, 16px));
          display: flex;
          flex-direction: column;
          gap: 5px;
          -webkit-overflow-scrolling: touch;
        }

        .modal-word-item {
          width: 100%;
          padding: 9px 11px;
          border-radius: 9px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background 0.12s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
          text-align: left;
        }
        .modal-word-item:active {
          transform: scale(0.985);
          background: rgba(0, 122, 255, 0.1);
        }
        .modal-word-item.active {
          background: rgba(0, 122, 255, 0.12);
          border-color: rgba(0, 122, 255, 0.4);
        }

        .word-item-left {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .word-item-idx {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          padding-top: 2px;
          flex-shrink: 0;
          min-width: 24px;
        }

        .word-item-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-width: 0;
        }

        .word-name-row {
          display: flex;
          align-items: baseline;
          gap: 5px;
          flex-wrap: wrap;
        }

        .word-term {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .modal-word-item.active .word-term {
          color: var(--system-blue);
        }

        .word-pos-tag {
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .word-trans-preview {
          font-size: 12px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .word-active-badge {
          font-size: 10px;
          font-weight: 700;
          background: var(--system-blue);
          color: #ffffff;
          padding: 2.5px 7px;
          border-radius: 9999px;
          flex-shrink: 0;
          margin-left: 6px;
        }

        .modal-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          text-align: center;
          gap: 6px;
        }
        .empty-ico {
          font-size: 28px;
          margin-bottom: 2px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .empty-sub {
          font-size: 12.5px;
          color: var(--text-secondary);
          max-width: 250px;
        }
        .btn-clear-all {
          margin-top: 8px;
          padding: 7px 14px;
          border-radius: 7px;
          border: none;
          background: var(--system-blue);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Mini Middle Pop-Up Exit Modal ── */
        .exit-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: exit-fade-in 0.18s ease-out;
        }

        @keyframes exit-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .exit-modal-card {
          width: 100%;
          max-width: 300px;
          background: var(--sidebar-bg);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 0.5px solid var(--divider);
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
          padding: 22px 20px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: exit-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes exit-scale-in {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .exit-modal-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 59, 48, 0.12);
          color: #ff3b30;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .exit-modal-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .exit-modal-desc {
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
          margin: 0 0 18px;
        }

        .exit-modal-actions {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .exit-btn-cancel {
          flex: 1;
          height: 40px;
          border-radius: 10px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .exit-btn-cancel:active {
          transform: scale(0.97);
          background: rgba(255, 255, 255, 0.12);
        }

        .exit-btn-confirm {
          flex: 1;
          height: 40px;
          border-radius: 10px;
          border: none;
          background: #ff3b30;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(255, 59, 48, 0.35);
          transition: background 0.15s ease, transform 0.1s ease, filter 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .exit-btn-confirm:active {
          transform: scale(0.97);
          filter: brightness(0.92);
        }

        /* ════════════════════════════════════════════════════
           PC DESKTOP ZERO-SCROLL MASTER-DETAIL SUITE (min-width: 900px)
           ════════════════════════════════════════════════════ */
        @media (min-width: 900px) {
          .apple-dict-viewport {
            height: 100dvh;
            max-height: 100dvh;
            overflow: hidden; /* ABSOLUTELY ZERO PAGE SCROLLING! */
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .apple-app-window {
            width: 100vw;
            max-width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
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

          .mobile-back-btn { display: none; }
          .mobile-toolbar-title { display: none; }
          .mobile-grid-btn { display: none; }
          .mobile-suite { display: none; }
          .mobile-counter-filter-btn { display: none; }
          .mobile-full-modal { display: none; }
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
