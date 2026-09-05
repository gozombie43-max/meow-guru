"use client";

import { useStudyModeTerms, type StudyModeTermCard } from "./useStudyModeTerms";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpeakerBtn } from "./SpeakerBtn";

export interface StudyModeTermsConfig {
  topic: string;
  storagePrefix: string;
  demoCards: StudyModeTermCard[];
  title: string;
}

function SwipeableCard({ card, isBookmarked, onToggleBookmark }: { card: StudyModeTermCard; isBookmarked: boolean; onToggleBookmark: (id: string) => void }) {
  const [swiped, setSwiped] = useState(false);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const [definition] = useMemo(() => {
    const [def] = card.prompt.split(/Memory hook:/i);
    return [def?.trim() ?? ""];
  }, [card.prompt]);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || startXRef.current === null) return;
    const currentX = e.clientX - startXRef.current;
    if (Math.abs(currentX) > 6) movedRef.current = true;
    
    let clamped = Math.min(0, Math.max(currentX, -84));
    if (swiped) clamped = Math.min(0, Math.max(currentX - 84, -84));
    
    if (cardRef.current) cardRef.current.style.transform = `translateX(${clamped}px)`;
    currentXRef.current = currentX;
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (cardRef.current) {
      cardRef.current.style.transition = '';
      cardRef.current.style.transform = '';
    }
    const totalDrag = swiped ? currentXRef.current - 84 : currentXRef.current;
    setSwiped(totalDrag < -40);
    currentXRef.current = 0;
    startXRef.current = null;
  };

  return (
    <div className="ows-row relative overflow-hidden border-b border-[var(--divider)] last:border-b-0">
      <div className="swipe-action absolute top-0 right-0 h-full w-[84px] flex flex-col items-center justify-center bg-[var(--mint)] text-white text-[11.5px] font-semibold gap-[3px] cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(card.id); setSwiped(false); }}>
        <svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} className="w-[19px] h-[19px]">
          <path d="M6 3h12v18l-6-4.5L6 21V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {isBookmarked ? 'Saved' : 'Save'}
      </div>
      <div ref={cardRef} className={`ows-card bg-[var(--card)] p-[15px_16px] relative will-change-transform cursor-pointer transition-transform duration-[0.28s] ease-[cubic-bezier(.22,1,.36,1)] ${swiped ? 'translate-x-[-84px]' : 'translate-x-0'} active:bg-[color-mix(in_srgb,var(--card)_90%,var(--ink)_4%)]`}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={() => { if (movedRef.current) { movedRef.current = false; return; } if (swiped) setSwiped(false); else onToggleBookmark(card.id); }}>
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

function MobileQuizView({ config, cards, bookmarked, toggleBookmark, theme, setTheme, categories }: any) {
  const [query, setQuery] = useState("");
  const [miniQuery, setMiniQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [activeLetters, setActiveLetters] = useState<Set<string>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [catSectionCollapsed, setCatSectionCollapsed] = useState(false);
  const [lettersSectionCollapsed, setLettersSectionCollapsed] = useState(false);
  const [statusSectionCollapsed, setStatusSectionCollapsed] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const categoryCounts = useMemo(() => {
    return categories.map((cat: string) => ({
      cat,
      count: cards.filter((d: StudyModeTermCard) => (d.label || "General") === cat).length
    })).sort((a: any, b: any) => b.count - a.count);
  }, [categories, cards]);

  const filteredCards = useMemo(() => {
    let items = cards as StudyModeTermCard[];
    if (bookmarkedOnly) items = items.filter(d => bookmarked.has(d.id));
    if (activeCats.size > 0) items = items.filter(d => activeCats.has(d.label || "General"));
    if (activeLetters.size > 0) items = items.filter(d => activeLetters.has(d.answer.charAt(0).toUpperCase()));
    const q = (query || miniQuery).trim().toLowerCase();
    if (q) items = items.filter(d => d.answer.toLowerCase().includes(q) || d.prompt.toLowerCase().includes(q));
    return items;
  }, [cards, bookmarkedOnly, activeCats, activeLetters, query, miniQuery, bookmarked]);

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
  const filterBadgeCount = activeCats.size + activeLetters.size + (bookmarkedOnly ? 1 : 0);

  return (
    <div className="ows-app" data-theme={theme}>
      <div className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-row">
          <div className="nav-left">
            <div className="mini-search">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <input type="text" placeholder="Search terms" value={miniQuery} onChange={e => handleSearchChange(e.target.value)} />
            </div>
            <button className={`mini-filter-btn ${filterBadgeCount > 0 ? 'has-active' : ''}`} onClick={() => setIsSheetOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              {filterBadgeCount > 0 && <span className="filter-badge mini-filter-badge">{filterBadgeCount}</span>}
            </button>
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
      </div>
      <div className="large-title"><h1>{config.title}</h1><p>Swipe left to save a term</p></div>
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
      <div className="segment-scroll">
        <div className={`ows-chip ${activeSegment === 'all' ? 'active' : ''}`} onClick={() => handleSegmentClick('all')}>All · {cards.length}</div>
        <div className={`ows-chip ${activeSegment === 'bookmarked' ? 'active' : ''}`} onClick={() => handleSegmentClick('bookmarked')}>Bookmarked</div>
        {categories.map((cat: string) => <div key={cat} className={`ows-chip ${activeSegment === cat ? 'active' : ''}`} onClick={() => handleSegmentClick(cat)}>{cat}</div>)}
      </div>
      <div className="list-label">Terms</div>
      <div className="list">
        {filteredCards.length > 0 ? filteredCards.map((card: StudyModeTermCard) => <SwipeableCard key={card.id} card={card} isBookmarked={bookmarked.has(card.id)} onToggleBookmark={toggleBookmark} />) : <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ink-faint)', fontSize: '14px' }}>No terms match.</div>}
      </div>
      <footer className="spacer" />
      <div className={`sheet-overlay ${isSheetOpen ? 'open' : ''}`} onClick={() => setIsSheetOpen(false)} />
      <div className={`filter-sheet ${isSheetOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h2>Filters</h2><button className="sheet-close" onClick={() => setIsSheetOpen(false)}><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
        <div className="sheet-body">
          <div className={`sheet-section ${catSectionCollapsed ? 'collapsed' : ''}`}>
            <div className="sheet-section-head"><span>Category</span><button className="section-toggle" onClick={() => setCatSectionCollapsed(!catSectionCollapsed)}>{catSectionCollapsed ? '+' : '—'}</button></div>
            <div className="chip-grid">
              {categoryCounts.map(({cat, count}: any) => {
                return <div key={cat} className={`ows-chip ${activeCats.has(cat) ? 'active' : ''}`} onClick={() => toggleCat(cat)}>{cat} · {count}</div>;
              })}
            </div>
          </div>
          <div className={`sheet-section ${lettersSectionCollapsed ? 'collapsed' : ''}`}>
            <div className="sheet-section-head"><span>First Letter</span><button className="section-toggle" onClick={() => setLettersSectionCollapsed(!lettersSectionCollapsed)}>{lettersSectionCollapsed ? '+' : '—'}</button></div>
            <div className="chip-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: '8px' }}>
              {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(letter => {
                return (
                  <div key={letter}
                    className={`ows-chip ${activeLetters.has(letter) ? 'active' : ''}`}
                    onClick={() => {
                      const next = new Set(activeLetters);
                      if (next.has(letter)) next.delete(letter); else next.add(letter);
                      setActiveLetters(next);
                    }}
                    style={{ padding: '8px 0', textAlign: 'center', borderRadius: '10px' }}
                  >
                    {letter}
                  </div>
                )
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
          <button className="reset-btn" onClick={() => { setActiveCats(new Set()); setActiveLetters(new Set()); setBookmarkedOnly(false); }}>Reset</button>
          <button className="done-btn" onClick={() => setIsSheetOpen(false)}>Show {filteredCards.length} results</button>
        </div>
      </div>
    </div>
  );
}

export default function StudyModeTermsQuizEngine({ config }: { config: StudyModeTermsConfig }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const studyCards = useStudyModeTerms(config.topic, config.demoCards);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(`${config.storagePrefix}-theme`);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      const savedBms = window.localStorage.getItem(`${config.storagePrefix}-bookmarks`);
      if (savedBms) setBookmarked(new Set(JSON.parse(savedBms)));
    } catch {}
  }, [config.storagePrefix]);

  useEffect(() => { try { window.localStorage.setItem(`${config.storagePrefix}-theme`, theme); } catch {} }, [theme, config.storagePrefix]);
  useEffect(() => { try { window.localStorage.setItem(`${config.storagePrefix}-bookmarks`, JSON.stringify([...bookmarked])); } catch {} }, [bookmarked, config.storagePrefix]);

  const categories = Array.from(new Set(studyCards.map(c => c.label || "General")));

  const toggleBookmark = useCallback((id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const sharedProps = { config, cards: studyCards, bookmarked, toggleBookmark, theme, setTheme, categories };

  return (
    <>
      <div className="mobile-view-container">
        <MobileQuizView {...sharedProps} />
      </div>
      <div className="desktop-view-container">
        {/* DesktopQuizView would go here */}
      </div>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap');

        /* Toggle display based on screen size */
        .desktop-view-container { display: none; }
        .mobile-view-container { display: block; }
        
        @media (min-width: 861px) {
          .desktop-view-container { display: block; height: 100dvh; overflow: hidden; }
          .mobile-view-container { display: none; }
        }

        .bn { font-family: "Noto Sans Bengali", -apple-system, sans-serif !important; line-height: 1.6 !important; }

        /* MOBILE STYLES */
        .ows-app[data-theme="light"] { --bg: #F2F1F7; --card: #FFFFFF; --ink: #1C1C29; --ink-soft: #6B6B78; --ink-faint: #A6A6B2; --line: rgba(28,28,41,0.07); --divider: rgba(28,28,41,0.14); --accent: #4A55E1; --accent-soft: #EEEFFC; --mint: #2FB876; --mint-soft: #E4F6EC; --amber: #E0982E; --amber-soft: #FBF0DD; --radius-card: 20px; --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
        .ows-app[data-theme="dark"] { --bg: #0B0B10; --card: #17171F; --ink: #F2F2F5; --ink-soft: #9797A3; --ink-faint: #5C5C66; --line: rgba(255,255,255,0.08); --divider: rgba(255,255,255,0.16); --accent: #7C86FF; --accent-soft: #1D1F3B; --mint: #3FD98E; --mint-soft: #12291F; --amber: #F0AC4A; --amber-soft: #2E2413; --radius-card: 20px; --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
        .ows-app { max-width: 520px; margin: 0 auto; min-height: 100dvh; position: relative; background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; color: var(--ink); transition: background .35s ease, color .35s ease; overflow-x: hidden; -webkit-font-smoothing: antialiased; overscroll-behavior-y: none; }
        .navbar { position: sticky; top: 0; z-index: 30; padding-top: calc(var(--safe-top) + 10px); background: color-mix(in srgb, var(--bg) 82%, transparent); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); border-bottom: 0.5px solid transparent; transition: border-color .2s ease; }
        .navbar.scrolled { border-bottom-color: var(--line); }
        .navbar-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 16px 10px; }
        .nav-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; opacity: 0; transform: translateY(6px); pointer-events: none; transition: opacity .2s ease, transform .2s ease; }
        .navbar.scrolled .nav-left { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .mini-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; background: var(--card); border: 0.5px solid var(--line); border-radius: 10px; padding: 6px 10px; }
        .mini-search svg { width: 14px; height: 14px; color: var(--ink-faint); flex-shrink: 0; }
        .mini-search input { border: none; outline: none; background: transparent; width: 100%; font-size: 14px; color: var(--ink); font-family: inherit; }
        .mini-search input::placeholder { color: var(--ink-faint); }
        .mini-filter-btn { position: relative; flex-shrink: 0; width: 30px; height: 30px; border-radius: 10px; background: var(--card); border: 0.5px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--ink); cursor: pointer; }
        .mini-filter-btn svg { width: 15px; height: 15px; }
        .mini-filter-btn.has-active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .mini-filter-badge { display: none; }
        .mini-filter-btn.has-active .mini-filter-badge { display: flex; }
        .nav-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .progress-pill { display: flex; align-items: center; gap: 6px; background: var(--card); border: 0.5px solid var(--line); border-radius: 20px; padding: 5px 12px 5px 6px; font-size: 13px; font-weight: 600; color: var(--ink); font-style: normal; }
        .progress-svg { width: 20px; height: 20px; transform: rotate(-90deg); border: none !important; background: transparent !important; box-shadow: none !important; outline: none !important; margin: 0; padding: 0; }
        .progress-svg-bg { fill: none; stroke: var(--line); stroke-width: 3; }
        .progress-svg-fg { fill: none; stroke: var(--mint); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset .6s cubic-bezier(.22,1,.36,1); }
        .theme-toggle { width: 34px; height: 34px; border-radius: 50%; background: var(--card) !important; border: 0.5px solid var(--line) !important; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink); padding: 0; margin: 0; outline: none; box-shadow: none !important; }
        .theme-toggle svg { width: 17px; height: 17px; }
        .large-title { padding: 2px 16px 14px; }
        .large-title h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.6px; margin: 0 0 2px; }
        .large-title p { margin: 0; font-size: 14px; color: var(--ink-soft); font-weight: 400; }
        .search-wrap { padding: 0 16px 12px; display: flex; align-items: center; gap: 8px; }
        .search-bar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: var(--card); border-radius: 12px; padding: 9px 12px; border: 0.5px solid var(--line); }
        .search-bar svg { width: 17px; height: 17px; color: var(--ink-faint); flex-shrink: 0; }
        .search-bar input { border: none; outline: none; background: transparent; width: 100%; font-size: 15px; color: var(--ink); font-family: inherit; }
        .search-bar input::placeholder { color: var(--ink-faint); }
        .filter-btn { position: relative; flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; background: var(--card); border: 0.5px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--ink); cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .filter-btn svg { width: 18px; height: 18px; }
        .filter-btn.has-active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .filter-badge { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--mint); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg); }
        .segment-scroll { display: flex; gap: 8px; padding: 2px 16px 16px; overflow-x: auto; scrollbar-width: none; }
        .segment-scroll::-webkit-scrollbar { display: none; }
        .ows-chip { flex-shrink: 0; padding: 8px 15px; border-radius: 18px; font-size: 13.5px; font-weight: 600; border: 0.5px solid var(--line); background: var(--card); color: var(--ink-soft); cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; user-select: none; }
        .ows-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
        .list-label { padding: 4px 16px 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.4px; }
        .list { margin: 0 16px 8px; padding: 0; display: flex; flex-direction: column; background: var(--card); border: 0.5px solid var(--line); border-radius: var(--radius-card); overflow: hidden; }
        .ows-row { position: relative; overflow: hidden; }
        .ows-row:not(:last-child) { border-bottom: 1px solid var(--divider); }
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
        .filter-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; max-width: 520px; margin: 0 auto; background: var(--card); border-radius: 20px 20px 0 0; transform: translateY(100%); transition: transform .32s cubic-bezier(.22,1,.36,1); max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 -8px 30px rgba(0,0,0,0.18); }
        .filter-sheet.open { transform: translateY(0); }
        .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--line); margin: 10px auto 2px; }
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
        .sheet-footer { display: flex; gap: 10px; padding: 12px 18px calc(14px + var(--safe-bottom)); border-top: 0.5px solid var(--line); }
        .reset-btn { flex: 0 0 auto; padding: 0 18px; border-radius: 14px; background: transparent; border: none; color: var(--ink-soft); font-size: 15px; font-weight: 600; cursor: pointer; }
        .done-btn { flex: 1; padding: 14px; border-radius: 14px; background: var(--ink); color: var(--bg); border: none; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity .15s ease; }
        .done-btn:active { opacity: 0.85; }
        @media (max-width: 480px) { .large-title h1 { font-size: 26px; } .large-title p { font-size: 13px; } .term { font-size: 16px; } .bengali { font-size: 13.5px; } .definition { font-size: 13.5px; } .definition-bn { font-size: 12.5px; } .ows-card { padding: 12px 14px; } .nav-right { gap: 6px; } .progress-pill { padding: 4px 10px 4px 5px; font-size: 12px; } .spacer { height: calc(36px + var(--safe-bottom)); } }
      `}</style>
    </>
  );
}
