"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { fetchQuestions, type Question as ApiQuestion } from "@/lib/api/questions";

type StudyModeMeaning = {
  definition?: string;
  translation?: string;
};

type StudyModeEntry = ApiQuestion & {
  word?: string;
  meanings?: StudyModeMeaning[];
  prompt?: string;
  phrase?: string;
  answer?: string;
};

export type SubstitutionCard = {
  id: string;
  prompt: string;
  answer: string;
  definitionTranslation?: string;
  answerTranslation?: string;
  label?: string;
};

const DEMO_CARDS: SubstitutionCard[] = [
  {
    id: "demo",
    prompt:
      'An inscription on a tombstone in memory of the person who has died.\n\nMemory hook: "Epi-" (upon) + "taph" (tomb) - literally, words written upon a tomb.',
    answer: "Epitaph",
    definitionTranslation: "সমাধিফলকে মৃত ব্যক্তির স্মরণে লেখা অনুশোচনা বা প্রশস্তি",
    answerTranslation: "সমাধি-লেখ, স্মৃতি-লেখ",
    label: "Study of",
  },
  {
    id: "demo-bibliophile",
    prompt:
      'A person who loves and collects books.\n\nMemory hook: "Biblio-" (book) + "-phile" (lover) - same root as bibliography.',
    answer: "Bibliophile",
    definitionTranslation: "যে ব্যক্তি বই ভালোবাসে এবং সংগ্রহ করে",
    answerTranslation: "গ্রন্থপ্রেমী, বইপ্রেমী",
    label: "People",
  },
];

const promptFields = ["prompt", "phrase", "question", "definition", "meaning", "clue"];

function getFirstString(entry: unknown, keys: string[]): string {
  if (!entry || typeof entry !== "object") return "";
  const record = entry as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toSubstitutionCard(entry: StudyModeEntry, index: number): SubstitutionCard | null {
  const promptFromMeaning = Array.isArray(entry.meanings)
    ? entry.meanings.map((m) => String(m?.definition ?? "").trim()).filter(Boolean)[0] ?? ""
    : "";

  const prompt = getFirstString(entry, promptFields) || promptFromMeaning;
  const answer = String(entry.word || entry.correctAnswer || entry.answer || entry.solution || "").trim();

  if (!prompt || !answer) return null;

  const translation = Array.isArray(entry.meanings)
    ? entry.meanings.map((m) => String(m?.translation ?? "").trim()).filter(Boolean)[0]
    : "";

  const answerTranslation = getFirstString(entry, ["answerTranslation", "wordTranslation", "translation"]);
  let label = entry.concept ? String(entry.concept).trim() : "General";
  
  if (label.toLowerCase() === "one-word substitution") label = "General";

  return {
    id: String(entry.id ?? index + 1),
    prompt,
    answer,
    definitionTranslation: translation,
    answerTranslation,
    label,
  };
}

// -------------------------------------------------------------
// MOBILE VIEW COMPONENTS
// -------------------------------------------------------------
function StudyCard({ card, isBookmarked, onToggleBookmark }: { card: SubstitutionCard; isBookmarked: boolean; onToggleBookmark: (id: string) => void }) {
  const [definition] = useMemo(() => {
    const [def] = card.prompt.split(/Memory hook:/i);
    return [def?.trim() ?? ""];
  }, [card.prompt]);

  return (
    <div className="ows-row relative overflow-hidden border-b border-[var(--divider)] last:border-b-0">
      <div className="ows-card bg-[var(--card)] p-[15px_16px] relative cursor-pointer active:bg-[color-mix(in_srgb,var(--card)_90%,var(--ink)_4%)]"
        onClick={() => onToggleBookmark(card.id)}>
        <div className="flex items-start justify-between gap-[10px]">
          <div className="flex items-center gap-[8px] min-w-0">
            {isBookmarked && <span className="w-[6px] h-[6px] rounded-full bg-[var(--amber)] shrink-0" />}
            <span className="text-[17px] font-semibold tracking-[-0.2px] whitespace-nowrap overflow-hidden text-ellipsis text-[var(--ink)]">{card.answer}</span>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex"><SpeakerBtn text={card.answer} size={26} /></div>
          </div>
          {card.answerTranslation && <span className="bengali bn text-[14.5px] font-medium text-[var(--ink-soft)] text-right shrink-0 whitespace-nowrap">{card.answerTranslation}</span>}
        </div>
        <div className="flex items-start justify-between gap-[10px] mt-[5px]">
          <div className="text-[14px] text-[var(--accent)] leading-[1.42]">{definition}</div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex mt-[2px]"><SpeakerBtn text={definition} size={22} /></div>
        </div>
        {card.definitionTranslation && <div className="definition-bn bn text-[13.5px] text-[var(--ink-soft)] leading-[1.4] mt-[4px] max-w-[92%]">{card.definitionTranslation}</div>}
        <div className="flex gap-[6px] mt-[9px]">
          <span className="text-[11px] font-semibold px-[8px] py-[3px] rounded-[8px] bg-[var(--accent-soft)] text-[var(--ink-soft)]">{card.label}</span>
        </div>
      </div>
    </div>
  );
}

function MobileQuizView({ cards, bookmarked, toggleBookmark, theme, setTheme, categories }: any) {
  const [query, setQuery] = useState("");
  const [miniQuery, setMiniQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [catSectionCollapsed, setCatSectionCollapsed] = useState(false);
  const [statusSectionCollapsed, setStatusSectionCollapsed] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredCards = useMemo(() => {
    let items = cards as SubstitutionCard[];
    if (bookmarkedOnly) items = items.filter(d => bookmarked.has(d.id));
    if (activeCats.size > 0) items = items.filter(d => activeCats.has(d.label || "General"));
    const q = (query || miniQuery).trim().toLowerCase();
    if (q) items = items.filter(d => d.answer.toLowerCase().includes(q) || d.prompt.toLowerCase().includes(q));
    return items;
  }, [cards, bookmarkedOnly, activeCats, query, miniQuery, bookmarked]);

  const toggleCat = (cat: string) => {
    setActiveCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleSegmentClick = (filter: string) => {
    if (filter === "all") { setActiveCats(new Set()); setBookmarkedOnly(false); }
    else if (filter === "bookmarked") { setActiveCats(new Set()); setBookmarkedOnly(true); }
    else { setActiveCats(new Set([filter])); setBookmarkedOnly(false); }
  };

  let activeSegment = "all";
  if (bookmarkedOnly && activeCats.size === 0) activeSegment = "bookmarked";
  else if (!bookmarkedOnly && activeCats.size === 1) activeSegment = [...activeCats][0];
  else if (activeCats.size > 0) activeSegment = "custom";

  const handleSearchChange = (val: string) => { setQuery(val); setMiniQuery(val); };
  const circ = 2 * Math.PI * 8;
  const offset = cards.length === 0 ? circ : circ - (bookmarked.size / cards.length) * circ;
  const filterBadgeCount = activeCats.size + (bookmarkedOnly ? 1 : 0);

  return (
    <div className="ows-app" data-theme={theme}>
      <div className="mobile-header-fixed">
        <div className="ows-navbar-row">
          <div className="nav-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>One word substitution</span>
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Tap a term to save it</span>
            </div>
            <div className="nav-right">
              <div className="progress-pill">
                <svg className="progress-svg" viewBox="0 0 20 20">
                  <circle className="progress-svg-bg" cx="10" cy="10" r="8"/>
                  <circle className="progress-svg-fg" cx="10" cy="10" r="8" strokeDasharray={circ} strokeDashoffset={offset}/>
                </svg>
                <span style={{ fontStyle: 'normal', fontWeight: 600 }}>{bookmarked.size}/{cards.length}</span>
              </div>
              <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <svg viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8"/></svg>}
              </button>
            </div>
        </div>
        <div className="search-wrap">
          <div className="search-bar">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Search terms" value={query} onChange={e => handleSearchChange(e.target.value)} />
          </div>
          <button className={`filter-btn ${filterBadgeCount > 0 ? 'has-active' : ''}`} onClick={() => setIsSheetOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {filterBadgeCount > 0 && <span className="filter-badge">{filterBadgeCount}</span>}
          </button>
        </div>
      </div>

      <div className="mobile-list-scrollable">
        <div className="list">
          {filteredCards.length > 0 ? filteredCards.map((card: SubstitutionCard) => <StudyCard key={card.id} card={card} isBookmarked={bookmarked.has(card.id)} onToggleBookmark={toggleBookmark} />) : <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ink-faint)', fontSize: '14px' }}>No terms match.</div>}
        </div>
        <footer className="spacer" />
      </div>
      <div className={`sheet-overlay ${isSheetOpen ? 'open' : ''}`} onClick={() => setIsSheetOpen(false)} />
      <div className={`filter-sheet ${isSheetOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h2>Filters</h2><button className="sheet-close" onClick={() => setIsSheetOpen(false)}><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
        <div className="sheet-body">
          <div className={`sheet-section ${catSectionCollapsed ? 'collapsed' : ''}`}>
            <div className="sheet-section-head"><span>Category</span><button className="section-toggle" onClick={() => setCatSectionCollapsed(!catSectionCollapsed)}>{catSectionCollapsed ? '+' : '—'}</button></div>
            <div className="chip-grid">
              {categories.map((cat: string) => {
                const count = cards.filter((d: SubstitutionCard) => (d.label || "General") === cat).length;
                return <div key={cat} className={`ows-chip ${activeCats.has(cat) ? 'active' : ''}`} onClick={() => toggleCat(cat)}>{cat} · {count}</div>;
              })}
            </div>
          </div>
          <div className={`sheet-section ${statusSectionCollapsed ? 'collapsed' : ''}`}>
            <div className="sheet-section-head"><span>Status</span><button className="section-toggle" onClick={() => setStatusSectionCollapsed(!statusSectionCollapsed)}>{statusSectionCollapsed ? '+' : '—'}</button></div>
            <div className="check-list">
              <div className={`check-row ${bookmarkedOnly ? 'checked' : ''}`} onClick={() => setBookmarkedOnly(!bookmarkedOnly)}>
                <span className="check-box"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                <span className="check-label">Bookmarked only</span><span className="check-count">{bookmarked.size}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="sheet-footer">
          <button className="reset-btn" onClick={() => { setActiveCats(new Set()); setBookmarkedOnly(false); }}>Reset</button>
          <button className="done-btn" onClick={() => setIsSheetOpen(false)}>Show {filteredCards.length} results</button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DESKTOP VIEW COMPONENT
// -------------------------------------------------------------

const TICKS = Array.from({ length: 12 });

function SpeakerBtn({ text, size = 22 }: { text: string; size?: number }) {
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
        body: JSON.stringify({ text: text.trim() }),
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

function DesktopQuizView({ cards, bookmarked, toggleBookmark, theme, setTheme, categories }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id || null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visibleSidebarData = useMemo(() => {
    let items = cards as SubstitutionCard[];
    if (bookmarkedOnly) items = items.filter(d => bookmarked.has(d.id));
    if (activeCats.size > 0) items = items.filter(d => activeCats.has(d.label || "General"));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(d => d.answer.toLowerCase().includes(q) || d.prompt.toLowerCase().includes(q));
    }
    return items;
  }, [cards, searchQuery, bookmarkedOnly, activeCats, bookmarked]);

  // Sync selectedId if missing
  useEffect(() => {
    if (cards.length > 0 && (!selectedId || !cards.find((c: SubstitutionCard) => c.id === selectedId))) {
      setSelectedId(cards[0].id);
    }
  }, [cards, selectedId]);

  const selectedIndex = cards.findIndex((c: SubstitutionCard) => c.id === selectedId);
  const activeCard = cards[selectedIndex] || cards[0];

  const goPrev = () => { if (selectedIndex > 0) setSelectedId(cards[selectedIndex - 1].id); };
  const goNext = () => { if (selectedIndex < cards.length - 1) setSelectedId(cards[selectedIndex + 1].id); };

  // Scroll active sidebar item into view automatically when selected via prev/next
  useEffect(() => {
    if (sidebarListRef.current && selectedId) {
      const activeEl = sidebarListRef.current.querySelector('.active');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId]);

  const getAbbr = (cat: string) => {
    if (cat.toLowerCase().includes('noun') || cat === 'People' || cat === 'Study of') return 'n.';
    if (cat.toLowerCase().includes('verb')) return 'v.';
    if (cat.toLowerCase().includes('adj')) return 'adj.';
    return '';
  };

  const isBookmarked = activeCard ? bookmarked.has(activeCard.id) : false;

  return (
    <div className="dt-app" data-theme={theme}>
      <div className="dt-shell">
        <aside className="dt-sidebar">
          <div className="dt-traffic"><span className="r"></span><span className="y"></span><span className="g"></span></div>
          <div style={{ margin: '0 14px 16px', display: 'flex', gap: '8px' }}>
            <div className="dt-search-box" style={{ margin: 0, flex: 1 }}>
              <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <input ref={searchInputRef} type="text" placeholder="Search vocab" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <span className="kbd">⌘F</span>
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              style={{ width: '32px', borderRadius: '8px', background: (activeCats.size > 0 || bookmarkedOnly) ? 'var(--dt-blue)' : 'var(--dt-bg-main)', border: '1px solid ' + ((activeCats.size > 0 || bookmarkedOnly) ? 'var(--dt-blue)' : 'var(--dt-border)'), color: (activeCats.size > 0 || bookmarkedOnly) ? '#fff' : 'var(--dt-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: '16px', height: '16px' }}><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="dt-idx-label">VOCABULARY INDEX ({visibleSidebarData.length})</div>
          <div className="dt-sidebar-list" ref={sidebarListRef}>
            {visibleSidebarData.map(d => (
              <div key={d.id} className={`dt-sidebar-item ${d.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(d.id)}>
                <span className="dt-term">{d.answer}</span>
                <span className="dt-pos">{getAbbr(d.label || '')}</span>
              </div>
            ))}
          </div>
        </aside>
        <main className="dt-main">
          <div className="dt-topbar">
            <div className="dt-nav-arrows">
              <button disabled={selectedIndex <= 0} onClick={goPrev} aria-label="Previous">‹</button>
              <button disabled={selectedIndex >= cards.length - 1} onClick={goNext} aria-label="Next">›</button>
            </div>

            <button className="dt-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? <svg viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8"/></svg>}
            </button>
          </div>
          <div className="dt-content-scroll">
            {activeCard && (
              <div className="dt-hero">
                <div className="dt-hero-word-row">
                  <h1>{activeCard.answer}</h1>
                  <span className="dt-pos-italic">{getAbbr(activeCard.label || '')}</span>
                  <SpeakerBtn text={activeCard.answer} size={34} />
                  <button className={`dt-save-btn ${isBookmarked ? 'saved' : ''}`} onClick={() => toggleBookmark(activeCard.id)}>
                    <svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} className="w-[19px] h-[19px]">
                      <path d="M6 3h12v18l-6-4.5L6 21V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                    {isBookmarked ? 'Saved' : 'Save'}
                  </button>
                </div>
                <div className="dt-hero-meta-line" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span><b style={{ color: 'var(--dt-blue)', fontWeight: 700, fontStyle: 'italic', marginRight: 4 }}>{getAbbr(activeCard.label || '')}</b> {activeCard.prompt.split(/Memory hook:/i)[0]?.trim()}</span>
                  <SpeakerBtn text={activeCard.prompt.split(/Memory hook:/i)[0]?.trim() ?? ''} size={26} />
                </div>
                {(activeCard.answerTranslation || activeCard.definitionTranslation) && (
                  <div className="dt-quote-box">
                    <span className="dt-qmark">&ldquo;</span>
                    <span className="bn">{activeCard.answerTranslation} {activeCard.answerTranslation && activeCard.definitionTranslation ? '/' : ''} {activeCard.definitionTranslation}</span>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      <div className={`sheet-overlay ${isFilterOpen ? 'open' : ''}`} onClick={() => setIsFilterOpen(false)} style={{ zIndex: 100 }} />
      <div className={`filter-sheet ${isFilterOpen ? 'open' : ''}`} style={{ zIndex: 101, backgroundColor: 'var(--dt-bg-main)' }}>
        <div className="sheet-header">
          <h2 style={{ color: 'var(--dt-ink)' }}>Filters</h2>
          <button className="sheet-close" onClick={() => setIsFilterOpen(false)} style={{ background: 'var(--dt-bg-sidebar)', color: 'var(--dt-ink)' }}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="sheet-body">
          <div className="sheet-section">
            <div className="sheet-section-head" style={{ color: 'var(--dt-ink)' }}><span>Category</span></div>
            <div className="chip-grid">
              {categories.map((cat: string) => {
                const count = cards.filter((d: SubstitutionCard) => (d.label || "General") === cat).length;
                return (
                  <div key={cat} 
                    className={`ows-chip ${activeCats.has(cat) ? 'active' : ''}`} 
                    onClick={() => {
                      const next = new Set(activeCats);
                      if (next.has(cat)) next.delete(cat); else next.add(cat);
                      setActiveCats(next);
                    }}
                    style={{ background: activeCats.has(cat) ? 'var(--dt-blue)' : 'var(--dt-bg-sidebar)', color: activeCats.has(cat) ? '#fff' : 'var(--dt-ink)', borderColor: activeCats.has(cat) ? 'var(--dt-blue)' : 'var(--dt-border)' }}
                  >
                    {cat} · {count}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sheet-section" style={{ borderBottom: 'none' }}>
            <div className="sheet-section-head" style={{ color: 'var(--dt-ink)' }}><span>Status</span></div>
            <div className="check-list">
              <div className={`check-row ${bookmarkedOnly ? 'checked' : ''}`} onClick={() => setBookmarkedOnly(!bookmarkedOnly)}>
                <span className="check-box" style={{ background: bookmarkedOnly ? 'var(--dt-blue)' : 'transparent', borderColor: bookmarkedOnly ? 'var(--dt-blue)' : 'var(--dt-border)' }}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="check-label" style={{ color: 'var(--dt-ink)' }}>Bookmarked only</span>
                <span className="check-count" style={{ color: 'var(--dt-ink-faint)' }}>{bookmarked.size}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="sheet-footer" style={{ borderTop: '0.5px solid var(--dt-border)' }}>
          <button className="reset-btn" onClick={() => { setActiveCats(new Set()); setBookmarkedOnly(false); }} style={{ color: 'var(--dt-ink-soft)' }}>Reset</button>
          <button className="done-btn" onClick={() => setIsFilterOpen(false)} style={{ background: 'var(--dt-blue)', color: '#fff' }}>Show {visibleSidebarData.length} results</button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN HYBRID COMPONENT
// -------------------------------------------------------------
export default function StudyModeQuizEngine() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [cards, setCards] = useState<SubstitutionCard[]>([]);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("ows-theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      const savedBms = window.localStorage.getItem("ows-bookmarks");
      if (savedBms) setBookmarked(new Set(JSON.parse(savedBms)));
    } catch {}
  }, []);

  useEffect(() => { try { window.localStorage.setItem("ows-theme", theme); } catch {} }, [theme]);
  useEffect(() => { try { window.localStorage.setItem("ows-bookmarks", JSON.stringify([...bookmarked])); } catch {} }, [bookmarked]);

  useEffect(() => {
    let active = true;
    fetchQuestions({ subject: "english", topic: "one-word-substitution", questionType: "study-mode" })
      .then((data) => {
        if (!active) return;
        const mapped = data.map((entry, index) => toSubstitutionCard(entry as StudyModeEntry, index)).filter(Boolean) as SubstitutionCard[];
        setCards(mapped.length ? mapped : DEMO_CARDS);
      })
      .catch(() => { if (active) setCards(DEMO_CARDS); });
    return () => { active = false; };
  }, []);

  const studyCards = cards.length ? cards : DEMO_CARDS;
  const categories = Array.from(new Set(studyCards.map(c => c.label || "General")));

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sharedProps = { cards: studyCards, bookmarked, toggleBookmark, theme, setTheme, categories };

  return (
    <>
      <div className="mobile-view-container">
        <MobileQuizView {...sharedProps} />
      </div>
      <div className="desktop-view-container">
        <DesktopQuizView {...sharedProps} />
      </div>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap');

        /* Toggle display based on screen size */
        .desktop-view-container { display: none; }
        .mobile-view-container { display: block; }
        
        @media (min-width: 861px) {
          .desktop-view-container { display: block; height: 100vh; overflow: hidden; }
          .mobile-view-container { display: none; }
        }

        .bn { font-family: "Noto Sans Bengali", -apple-system, sans-serif !important; line-height: 1.6 !important; }

        /* -------------------------------------------
           MOBILE STYLES (from previous implementation)
           ------------------------------------------- */
        .ows-app[data-theme="light"] { --bg: #F2F1F7; --card: #FFFFFF; --ink: #1C1C29; --ink-soft: #6B6B78; --ink-faint: #A6A6B2; --line: rgba(28,28,41,0.07); --divider: rgba(28,28,41,0.14); --accent: #4A55E1; --accent-soft: #EEEFFC; --mint: #2FB876; --mint-soft: #E4F6EC; --amber: #E0982E; --amber-soft: #FBF0DD; --radius-card: 20px; --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
        .ows-app[data-theme="dark"] { --bg: #0B0B10; --card: #17171F; --ink: #F2F2F5; --ink-soft: #9797A3; --ink-faint: #5C5C66; --line: rgba(255,255,255,0.08); --divider: rgba(255,255,255,0.16); --accent: #7C86FF; --accent-soft: #1D1F3B; --mint: #3FD98E; --mint-soft: #12291F; --amber: #F0AC4A; --amber-soft: #2E2413; --radius-card: 20px; --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
        .ows-app { max-width: 520px; margin: 0 auto; height: 100dvh; display: flex; flex-direction: column; position: relative; background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; color: var(--ink); transition: background .35s ease, color .35s ease; overflow: hidden; -webkit-font-smoothing: antialiased; }
        .mobile-header-fixed { flex-shrink: 0; z-index: 30; background: color-mix(in srgb, var(--bg) 82%, transparent); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); padding-top: calc(var(--safe-top) + 8px); border-bottom: 0.5px solid var(--line); transition: background .35s ease, border-color .35s ease; }
        .mobile-list-scrollable { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-top: 6px; }
        .ows-navbar-row { display: flex; align-items: center; justify-content: space-between; padding: 0 16px 8px; }
        .nav-left { display: flex; align-items: flex-start; justify-content: center; gap: 0; flex: 1; min-width: 0; opacity: 1; }
        .nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .progress-pill { display: flex; align-items: center; gap: 5px; background: var(--card); border: 0.5px solid var(--line); border-radius: 16px; padding: 4px 10px 4px 5px; font-size: 12px; font-weight: 600; color: var(--ink); font-style: normal; transition: background .35s ease, border-color .35s ease, color .35s ease; }
        .progress-svg { width: 16px; height: 16px; transform: rotate(-90deg); border: none !important; background: transparent !important; box-shadow: none !important; outline: none !important; margin: 0; padding: 0; }
        .progress-svg-bg { fill: none; stroke: var(--line); stroke-width: 3; }
        .progress-svg-fg { fill: none; stroke: var(--mint); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset .6s cubic-bezier(.22,1,.36,1); }
        .theme-toggle { width: 30px; height: 30px; border-radius: 50%; background: var(--card) !important; border: 0.5px solid var(--line) !important; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink); padding: 0; margin: 0; outline: none; box-shadow: none !important; transition: background .35s ease, border-color .35s ease, color .35s ease; }
        .theme-toggle svg { width: 15px; height: 15px; }
        .search-wrap { padding: 0 16px 10px; display: flex; align-items: center; gap: 8px; }
        .search-bar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: var(--card); border-radius: 10px; padding: 6px 10px; border: 0.5px solid var(--line); transition: background .35s ease, border-color .35s ease; }
        .search-bar svg { width: 15px; height: 15px; color: var(--ink-faint); flex-shrink: 0; }
        .search-bar input { border: none; outline: none; background: transparent; width: 100%; font-size: 14px; color: var(--ink); font-family: inherit; }
        .search-bar input::placeholder { color: var(--ink-faint); }
        .filter-btn { position: relative; flex-shrink: 0; width: 33px; height: 33px; border-radius: 10px; background: var(--card); border: 0.5px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--ink); cursor: pointer; transition: background .35s ease, border-color .35s ease, color .35s ease; }
        .filter-btn svg { width: 16px; height: 16px; }
        .filter-btn.has-active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .filter-badge { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--mint); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg); }
        .segment-scroll { display: flex; gap: 8px; padding: 2px 16px 16px; overflow-x: auto; scrollbar-width: none; }
        .segment-scroll::-webkit-scrollbar { display: none; }
        .ows-chip { flex-shrink: 0; padding: 8px 15px; border-radius: 18px; font-size: 13.5px; font-weight: 600; border: 0.5px solid var(--line); background: var(--card); color: var(--ink-soft); cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; user-select: none; }
        .ows-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
        .list { margin: 0 16px 8px; padding: 0; display: flex; flex-direction: column; background: var(--card); border: 0.5px solid var(--line); border-radius: var(--radius-card); overflow: hidden; transition: background .35s ease, border-color .35s ease; }
        .ows-row { position: relative; overflow: hidden; }
        .ows-row:not(:last-child) { border-bottom: 1px solid var(--divider); transition: border-color .35s ease; }
        .swipe-action { position: absolute; top: 0; right: 0; height: 100%; width: 84px; display: flex; align-items: center; justify-content: center; background: var(--mint); color: #fff; flex-direction: column; gap: 3px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
        .swipe-action svg { width: 19px; height: 19px; }
        .ows-card { background: var(--card); padding: 15px 16px; position: relative; transform: translateX(0); transition: transform .28s cubic-bezier(.22,1,.36,1), background .35s ease; will-change: transform; cursor: pointer; user-select: none; touch-action: pan-y; }
        .ows-card.swiped { transform: translateX(-84px) !important; }
        .ows-card:active { background: color-mix(in srgb, var(--card) 90%, var(--ink) 4%); }
        .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .term-block { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .term { font-size: 17px; font-weight: 600; letter-spacing: -0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bookmark-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); flex-shrink: 0; display: none; }
        .ows-card.bookmarked .bookmark-dot { display: block; }
        .definition { font-size: 14px; color: var(--accent); line-height: 1.42; margin-top: 5px; max-width: 92%; }
        .tag-row { display: flex; gap: 6px; margin-top: 9px; }
        .tag { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 8px; background: var(--accent-soft); color: var(--ink-soft); }
        .spacer { height: calc(24px + var(--safe-bottom)); }
        .sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; pointer-events: none; transition: opacity .25s ease; z-index: 40; }
        .sheet-overlay.open { opacity: 1; pointer-events: auto; }
        .filter-sheet { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -45%); z-index: 41; width: calc(100% - 40px); max-width: 400px; margin: 0; background: var(--card); border-radius: 20px; opacity: 0; pointer-events: none; transition: transform .25s cubic-bezier(.22,1,.36,1), opacity .25s ease; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.25); }
        .filter-sheet.open { transform: translate(-50%, -50%); opacity: 1; pointer-events: auto; }
        .sheet-handle { display: none; }
        .sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px 8px; }
        .sheet-header h2 { font-size: 19px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
        .sheet-close { width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); border: none; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .sheet-close svg { width: 14px; height: 14px; }
        .sheet-body { overflow-y: auto; padding: 4px 18px 8px; }
        .sheet-section { padding: 14px 0; border-bottom: 0.5px solid var(--line); }
        .sheet-section:last-child { border-bottom: none; }
        .sheet-section-head { display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 12px; }
        .section-toggle { width: 26px; height: 26px; border-radius: 50%; background: var(--accent-soft); border: none; color: var(--accent); font-size: 16px; font-weight: 700; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .sheet-section.collapsed .chip-grid, .sheet-section.collapsed .check-list { display: none; }
        .sheet-section.collapsed .section-toggle { transform: rotate(45deg); }
        .chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip-grid .ows-chip { border-radius: 12px; padding: 9px 14px; }
        .chip-grid .ows-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
        .check-list { display: flex; flex-direction: column; gap: 2px; }
        .check-row { display: flex; align-items: center; gap: 12px; padding: 9px 2px; cursor: pointer; user-select: none; }
        .check-box { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; border: 1.5px solid var(--ink-faint); background: transparent; display: flex; align-items: center; justify-content: center; transition: background .15s ease, border-color .15s ease; }
        .check-box svg { width: 12px; height: 12px; opacity: 0; transition: opacity .12s ease; }
        .check-row.checked .check-box { background: var(--accent); border-color: var(--accent); }
        .check-row.checked .check-box svg { opacity: 1; }
        .check-label { font-size: 15px; color: var(--ink); flex: 1; }
        .check-count { font-size: 13px; color: var(--ink-faint); font-weight: 500; }
        .sheet-footer { display: flex; gap: 10px; padding: 14px 18px 18px; border-top: 0.5px solid var(--line); }
        .reset-btn { flex: 0 0 auto; padding: 0 18px; border-radius: 14px; background: transparent; border: none; color: var(--ink-soft); font-size: 15px; font-weight: 600; cursor: pointer; }
        .done-btn { flex: 1; padding: 14px; border-radius: 14px; background: var(--ink); color: var(--bg); border: none; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity .15s ease; }
        .done-btn:active { opacity: 0.85; }
        @media (max-width: 480px) { .term { font-size: 16px; } .bengali { font-size: 13.5px; } .definition { font-size: 13.5px; } .definition-bn { font-size: 12.5px; } .ows-card { padding: 12px 14px; } .spacer { height: calc(36px + var(--safe-bottom)); } }

        /* -------------------------------------------
           DESKTOP STYLES
           ------------------------------------------- */
        .dt-app[data-theme="light"] { --dt-bg-app:#EDEDF0; --dt-bg-sidebar:#F5F5F7; --dt-bg-main:#FFFFFF; --dt-bg-row-alt:#F7F7F9; --dt-bg-head:#F5F5F7; --dt-ink:#1D1D1F; --dt-ink-soft:#6E6E73; --dt-ink-faint:#AEAEB2; --dt-border:#E3E3E7; --dt-blue:#0A84FF; --dt-blue-soft:#E8F2FF; --dt-radius:12px; }
        .dt-app[data-theme="dark"] { --dt-bg-app:#000000; --dt-bg-sidebar:#1C1C1E; --dt-bg-main:#232326; --dt-bg-row-alt:#2A2A2D; --dt-bg-head:#28282B; --dt-ink:#F2F2F5; --dt-ink-soft:#9A9AA0; --dt-ink-faint:#5C5C60; --dt-border:#38383B; --dt-blue:#3A9AFF; --dt-blue-soft:#0F2338; }
        .dt-shell { display: flex; height: 100vh; padding: 14px; gap: 14px; background: var(--dt-bg-app); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; color: var(--dt-ink); transition: background .3s ease, color .3s ease; }
        .dt-sidebar { width: 280px; flex-shrink: 0; background: var(--dt-bg-sidebar); border-radius: var(--dt-radius); display: flex; flex-direction: column; overflow: hidden; }
        .dt-traffic { display: flex; gap: 8px; padding: 16px 16px 14px; }
        .dt-traffic span { width: 12px; height: 12px; border-radius: 50%; display: block; }
        .dt-traffic .r { background: #FF5F57; }
        .dt-traffic .y { background: #FEBC2E; }
        .dt-traffic .g { background: #28C840; }
        .dt-search-box { margin: 0 14px 16px; display: flex; align-items: center; gap: 7px; background: var(--dt-bg-main); border: 1px solid var(--dt-border); border-radius: 8px; padding: 7px 10px; }
        .dt-search-box svg { width: 14px; height: 14px; color: var(--dt-ink-faint); flex-shrink: 0; }
        .dt-search-box input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; color: var(--dt-ink); font-family: inherit; }
        .dt-search-box input::placeholder { color: var(--dt-ink-faint); }
        .dt-search-box .kbd { font-size: 11px; color: var(--dt-ink-faint); background: var(--dt-bg-sidebar); border: 1px solid var(--dt-border); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; }
        .dt-idx-label { padding: 0 16px 8px; font-size: 11px; font-weight: 700; color: var(--dt-ink-faint); letter-spacing: 0.5px; }
        .dt-sidebar-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
        .dt-sidebar-list::-webkit-scrollbar { width: 0; }
        .dt-sidebar-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 10px; border-radius: 8px; margin-bottom: 1px; cursor: pointer; font-size: 14px; }
        .dt-sidebar-item:hover { background: var(--dt-bg-main); }
        .dt-sidebar-item .dt-term { font-weight: 600; color: var(--dt-ink); }
        .dt-sidebar-item .dt-pos { font-size: 12.5px; font-style: italic; color: var(--dt-ink-faint); flex-shrink: 0; margin-left: 8px; }
        .dt-sidebar-item.active { background: var(--dt-blue); }
        .dt-sidebar-item.active .dt-term { color: #fff; }
        .dt-sidebar-item.active .dt-pos { color: rgba(255,255,255,0.8); }
        
        .dt-main { flex: 1; min-width: 0; background: var(--dt-bg-main); border-radius: var(--dt-radius); display: flex; flex-direction: column; overflow: hidden; }
        .dt-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--dt-border); flex-shrink: 0; }
        .dt-nav-arrows { display: flex; gap: 6px; }
        .dt-nav-arrows button { width: 28px; height: 28px; border-radius: 8px; background: var(--dt-bg-sidebar); border: 1px solid var(--dt-border); color: var(--dt-ink-soft); font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; outline: none; }
        .dt-nav-arrows button:disabled { opacity: 0.35; cursor: default; }
        .dt-nav-arrows button:not(:disabled):hover { background: var(--dt-border); }
        .dt-tabs { display: flex; background: var(--dt-bg-sidebar); border-radius: 9px; padding: 3px; gap: 2px; }
        .dt-tab { border: none; background: transparent; padding: 6px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--dt-ink-soft); cursor: pointer; outline: none; }
        .dt-tab.active { background: var(--dt-bg-main); color: var(--dt-ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
        .dt-theme-toggle { width: 28px; height: 28px; border-radius: 50%; background: var(--dt-bg-sidebar); border: 1px solid var(--dt-border); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--dt-ink); padding: 0; outline: none; }
        .dt-theme-toggle svg { width: 14px; height: 14px; }
        .dt-content-scroll { flex: 1; overflow-y: auto; padding: 40px 44px 50px; }
        
        .dt-hero-meta-line { text-align: left; font-size: 17px; color: var(--dt-ink); margin: 0 0 22px; line-height: 1.5; }
        .dt-hero-meta-line b { color: var(--dt-blue); font-weight: 700; font-style: italic; margin-right: 4px; }
        .dt-hero-word-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; }
        .dt-hero-word-row h1 { font-size: 56px; font-weight: 800; letter-spacing: -1.5px; margin: 0; line-height: 1; }
        .dt-pos-italic { font-size: 19px; font-style: italic; color: var(--dt-ink-faint); font-weight: 500; }
        
        .dt-save-btn { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 600; border: 1.5px solid var(--dt-border); background: var(--dt-bg-sidebar); color: var(--dt-ink); cursor: pointer; transition: all 0.2s; outline: none; }
        .dt-save-btn.saved { border-color: var(--dt-blue); background: var(--dt-blue); color: #fff; }

        .dt-speaker-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--dt-blue) 40%, transparent); background: transparent; color: var(--dt-blue); cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none; opacity: 0.85; -webkit-tap-highlight-color: transparent; }
        .dt-speaker-btn:hover { opacity: 1; transform: scale(1.08); border-color: color-mix(in srgb, var(--dt-blue) 70%, transparent); }
        .dt-speaker-btn:active { transform: scale(0.88); opacity: 0.7; }
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

        .dt-quote-box { display: flex; align-items: center; gap: 12px; background: var(--dt-bg-sidebar); border-left: 3px solid var(--dt-blue); border-radius: 0 8px 8px 0; padding: 14px 18px; font-size: 16px; color: var(--dt-ink); }
        .dt-qmark { color: var(--dt-blue); font-size: 20px; font-weight: 800; }
        
        .dt-tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 38px; }
        .dt-tables-grid.single { grid-template-columns: 1fr; }
        .dt-table-card { border: 1px solid var(--dt-border); border-radius: 10px; overflow: hidden; }
        .dt-table-head { display: flex; align-items: center; justify-content: space-between; background: var(--dt-bg-head); padding: 10px 16px; font-size: 11.5px; font-weight: 700; color: var(--dt-ink-soft); letter-spacing: 0.6px; border-bottom: 1px solid var(--dt-border); }
        .dt-table-head span:last-child { font-weight: 500; letter-spacing: 0; color: var(--dt-ink-faint); }
        .dt-table-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; cursor: pointer; border-bottom: 1px solid var(--dt-border); }
        .dt-table-row:last-child { border-bottom: none; }
        .dt-table-row:nth-child(even) { background: var(--dt-bg-row-alt); }
        .dt-table-row:hover { background: var(--dt-blue-soft); }
        .dt-table-row.active { background: var(--dt-blue-soft); }
        .dt-table-row .dt-term { font-weight: 700; font-size: 14.5px; }
        .dt-table-row .dt-bn-word { font-size: 14.5px; color: var(--dt-ink-soft); }

        @media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
      `}</style>
    </>
  );
}
