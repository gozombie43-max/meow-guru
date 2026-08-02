'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './page.module.css';

const IDIOMS = [
  {idiom:"Add fuel to fire", meaning:"To make a bad situation worse", bengali:"আগুনে ঘি ঢালা", example:"Criticizing him in public just added fuel to fire."},
  {idiom:"A bolt from the blue", meaning:"A sudden, unexpected event", bengali:"বিনা মেঘে বজ্রপাত", example:"His resignation was a bolt from the blue for the team."},
  {idiom:"Back out", meaning:"To withdraw from a commitment", bengali:"পিছিয়ে যাওয়া", example:"He backed out of the deal at the last moment."},
  {idiom:"Beat around the bush", meaning:"To avoid the main topic", bengali:"রাখঢাক করে কথা বলা", example:"Stop beating around the bush and tell me the truth."},
  {idiom:"Bite the bullet", meaning:"To face a difficult situation bravely", bengali:"সাহস করে কঠিন পরিস্থিতির মুখোমুখি হওয়া", example:"She decided to bite the bullet and take the exam early."},
  {idiom:"Break the ice", meaning:"To initiate conversation in a social setting", bengali:"কথোপকথন শুরু করা", example:"He told a joke to break the ice at the meeting."},
  {idiom:"Call it a day", meaning:"To stop working for the day", bengali:"কাজ বন্ধ করা", example:"We finished the report, so let's call it a day."},
  {idiom:"Cut corners", meaning:"To do something cheaply or carelessly to save effort", bengali:"খরচ বা মান কমিয়ে কাজ করা", example:"The builder cut corners and used poor material."},
  {idiom:"Face the music", meaning:"To accept the consequences of one's actions", bengali:"নিজের কাজের পরিণতি মেনে নেওয়া", example:"He finally faced the music after the audit."},
  {idiom:"Get cold feet", meaning:"To become nervous before an important event", bengali:"ভয় পেয়ে পিছিয়ে যাওয়া", example:"She got cold feet before her interview."},
  {idiom:"Hit the sack", meaning:"To go to bed", bengali:"ঘুমাতে যাওয়া", example:"It's late, I'm going to hit the sack."},
  {idiom:"In the nick of time", meaning:"Just in time; at the last possible moment", bengali:"ঠিক সময়ে", example:"The doctor arrived in the nick of time."},
  {idiom:"Kill two birds with one stone", meaning:"To achieve two things with a single action", bengali:"এক ঢিলে দুই পাখি মারা", example:"By walking to work he saves money and stays fit — killing two birds with one stone."},
  {idiom:"Let the cat out of the bag", meaning:"To reveal a secret accidentally", bengali:"অসাবধানে গোপন কথা ফাঁস করা", example:"She let the cat out of the bag about the surprise party."},
  {idiom:"Once in a blue moon", meaning:"Very rarely", bengali:"কালেভদ্রে", example:"He visits his hometown once in a blue moon."},
  {idiom:"Piece of cake", meaning:"A very easy task", bengali:"খুব সহজ কাজ", example:"The test was a piece of cake for her."},
  {idiom:"Pull someone's leg", meaning:"To joke or tease someone", bengali:"ঠাট্টা করা", example:"Relax, I was just pulling your leg."},
  {idiom:"Rain cats and dogs", meaning:"To rain very heavily", bengali:"প্রবল বৃষ্টি হওয়া", example:"It was raining cats and dogs when we left."},
  {idiom:"See eye to eye", meaning:"To fully agree with someone", bengali:"সম্পূর্ণ একমত হওয়া", example:"The partners finally saw eye to eye on the budget."},
  {idiom:"Spill the beans", meaning:"To reveal secret information", bengali:"গোপন কথা ফাঁস করা", example:"He spilled the beans about the merger."},
  {idiom:"Take with a grain of salt", meaning:"To not accept something as entirely true", bengali:"পুরোপুরি বিশ্বাস না করে গ্রহণ করা", example:"Take his promises with a grain of salt."},
  {idiom:"Under the weather", meaning:"Feeling slightly unwell", bengali:"অসুস্থ বোধ করা", example:"I'm feeling a bit under the weather today."},
  {idiom:"Burn the midnight oil", meaning:"To work or study late into the night", bengali:"গভীর রাত পর্যন্ত পরিশ্রম করা", example:"Students burn the midnight oil before board exams."},
  {idiom:"A blessing in disguise", meaning:"A good thing that initially seemed bad", bengali:"যা প্রথমে খারাপ মনে হলেও পরে আশীর্বাদ প্রমাণিত হয়", example:"Losing that job was a blessing in disguise."},
  {idiom:"Actions speak louder than words", meaning:"What you do matters more than what you say", bengali:"কাজই কথার চেয়ে বড় প্রমাণ", example:"He proved that actions speak louder than words by helping without being asked."},
  {idiom:"Add insult to injury", meaning:"To make a bad situation worse by adding offense", bengali:"অপমানের ওপর অপমান করা", example:"Losing the match and then being fined added insult to injury."},
  {idiom:"At the drop of a hat", meaning:"Immediately, without hesitation", bengali:"তৎক্ষণাৎ, বিনা দ্বিধায়", example:"He agrees to help at the drop of a hat."},
  {idiom:"Barking up the wrong tree", meaning:"Pursuing a mistaken course of action", bengali:"ভুল পথে সমাধান খোঁজা", example:"If you think I took your pen, you're barking up the wrong tree."},
  {idiom:"Behind the eight ball", meaning:"In a difficult or disadvantaged position", bengali:"কঠিন বা প্রতিকূল পরিস্থিতিতে থাকা", example:"After missing the deadline, he was behind the eight ball."},
  {idiom:"Bite off more than you can chew", meaning:"To take on more responsibility than one can handle", bengali:"সাধ্যের অতিরিক্ত দায়িত্ব নেওয়া", example:"Taking three certifications at once, she bit off more than she could chew."}
];

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2.5" x2="12" y2="4.8"/><line x1="12" y1="19.2" x2="12" y2="21.5"/><line x1="4.2" y1="4.2" x2="5.9" y2="5.9"/><line x1="18.1" y1="18.1" x2="19.8" y2="19.8"/><line x1="2.5" y1="12" x2="4.8" y2="12"/><line x1="19.2" y1="12" x2="21.5" y2="12"/><line x1="4.2" y1="19.8" x2="5.9" y2="18.1"/><line x1="18.1" y1="5.9" x2="19.8" y2="4.2"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 14.5A8.5 8.5 0 1 1 9.5 3.2a7 7 0 0 0 11.3 11.3z"/>
  </svg>
);

const TICKS = Array.from({ length: 12 });

function SpeakerBtn({ text, size = 22 }: { text: string; size?: number }) {
  const [state, setState] = useState<"idle" | "loading" | "speaking">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
            <path d="M6 18v12h6.5l10.5 9.5V8.5L12.5 18H6z" fill="currentColor" />
            <path className={`ios-arc ios-arc-1 ${speaking ? "is-speaking" : ""}`} d="M29 17a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" fill="none" pathLength="100" strokeDasharray="100" strokeDashoffset={speaking ? undefined : 0} style={!speaking ? { opacity: 0.3 } : undefined} />
            <path className={`ios-arc ios-arc-2 ${speaking ? "is-speaking" : ""}`} d="M34.5 11.5a18 18 0 0 1 0 25" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" fill="none" pathLength="100" strokeDasharray="100" strokeDashoffset={speaking ? undefined : 100} style={!speaking ? { opacity: 0 } : undefined} />
            <path className={`ios-arc ios-arc-3 ${speaking ? "is-speaking" : ""}`} d="M40 6a26 26 0 0 1 0 36" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" fill="none" pathLength="100" strokeDasharray="100" strokeDashoffset={speaking ? undefined : 100} style={!speaking ? { opacity: 0 } : undefined} />
          </g>
        )}
      </svg>
    </button>
  );
}

// -------------------------------------------------------------
// MOBILE VIEW
// -------------------------------------------------------------
function MobileIdiomsView({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) {
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState<number[]>(() => IDIOMS.map((_, i) => i));
  const [pos, setPos] = useState(0);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'az' | 'za'>('default');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setIsSortMenuOpen(false);
    if (isSortMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isSortMenuOpen]);

  useEffect(() => {
    if (isSheetOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 320);
    } else {
      document.body.style.overflow = '';
      searchInputRef.current?.blur();
    }
  }, [isSheetOpen]);

  const handleNext = () => setPos(p => (p + 1) % IDIOMS.length);
  const handlePrev = () => setPos(p => (p - 1 + IDIOMS.length) % IDIOMS.length);
  const handleShuffle = () => {
    const newOrder = [...order];
    for(let i = newOrder.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
    }
    setOrder(newOrder);
    setPos(0);
  };

  const getVisibleItems = () => {
    let items = IDIOMS.map((item, idx) => ({ item, idx }));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(({ item }) =>
        item.idiom.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q)
      );
    }
    if (sortMode === 'az') items.sort((a, b) => a.item.idiom.localeCompare(b.item.idiom));
    else if (sortMode === 'za') items.sort((a, b) => b.item.idiom.localeCompare(a.item.idiom));
    return items;
  };

  const visibleItems = getVisibleItems();
  const currentIdx = order[pos];
  const currentItem = IDIOMS[currentIdx];

  const sortLabels = { default: 'Default', az: 'A to Z', za: 'Z to A' };

  return (
    <div className={styles.container} data-theme={theme}>
      {!started ? (
        <div className={styles.startScreen}>
          <div className={styles.startTop}>
            <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === 'light' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <div className={styles.startIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div className={styles.startTitle}>Idioms &amp; Phrases</div>
          <div className={styles.startSubtitle}>30 essential idioms for SSC CGL &amp; CAT prep, with clear meanings and Bengali translations.</div>
          <div className={styles.featureList}>
            <div className={styles.featureRow}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
              </div>
              <div className={styles.featureText}><b>30 curated idioms</b> pulled from real SSC exam papers</div>
            </div>
            <div className={styles.featureRow}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7M4 5c0 4 2 7 5 8M9 5c0 4-2 7-5 8M12 20l3-8 3 8M13.5 17h3"/></svg>
              </div>
              <div className={styles.featureText}>Meaning in <b>English and বাংলা</b>, plus example sentences</div>
            </div>
            <div className={styles.featureRow}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div className={styles.featureText}><b>Search, sort &amp; shuffle</b> to study your own way</div>
            </div>
          </div>
          <button className={styles.startCta} onClick={() => setStarted(true)}>Start Studying</button>
          <div className={styles.startHint}>Tap any idiom later to jump straight to it</div>
        </div>
      ) : (
        <>
          <div className={styles.nav}>
            <div className={styles.navRow}>
              <div className={styles.navTitle}>Idioms &amp; Phrases</div>
              <div className={styles.navActions}>
                <button className={styles.menuBtn} onClick={() => setIsSheetOpen(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                  All
                </button>
                <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle dark mode">
                  {theme === 'light' ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            </div>
          </div>
          <div className={styles.content}>
            <div className={styles.progressLabel}>
              <span>Card {pos + 1} of {IDIOMS.length}</span>
            </div>
            <div className={styles.flashOuter}>
              <div className={styles.flashcard}>
                <div className={styles.eyebrow}>Idiom</div>
                <div className={styles.idiomText}>{currentItem.idiom}</div>
                <hr className={styles.cardDivider} />
                <div className={styles.sectionLabel}>Meaning</div>
                <div className={styles.meaningText}>{currentItem.meaning}</div>
                <div className={styles.bengaliBlock}>
                  <div className={styles.sectionLabel}>বাংলা অর্থ</div>
                  <div className={styles.bengaliText}>{currentItem.bengali}</div>
                </div>
                <div className={styles.exampleBlock}>
                  <div className={styles.sectionLabel}>Example</div>
                  <div className={styles.exampleText}>{currentItem.example}</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.controls}>
            <button className={styles.btn} onClick={handlePrev}>Previous</button>
            <button className={styles.btn} onClick={handleShuffle}>Shuffle</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext}>Next</button>
          </div>
          <div 
            className={`${styles.sheetBackdrop} ${isSheetOpen ? styles.open : ''}`} 
            onClick={() => setIsSheetOpen(false)}
          ></div>
          <div className={`${styles.modal} ${isSheetOpen ? styles.open : ''}`}>
            <div className={styles.sheetTitleRow}>
              <div className={styles.sheetTitle}>All idioms</div>
              <button className={styles.sheetDone} onClick={() => setIsSheetOpen(false)}>Done</button>
            </div>
            <div className={styles.searchRow}>
              <div className={styles.searchField}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  type="text" 
                  ref={searchInputRef}
                  placeholder="Search idioms" 
                  autoComplete="off" 
                  autoCorrect="off" 
                  autoCapitalize="off" 
                  spellCheck="false"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  className={`${styles.clearBtn} ${searchQuery ? styles.clearBtnVisible : ''}`} 
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  aria-label="Clear search"
                >✕</button>
              </div>
            </div>
            <div className={styles.toolbarRow}>
              <div className={styles.resultCount}>
                {visibleItems.length} idiom{visibleItems.length !== 1 ? 's' : ''}
              </div>
              <div className={styles.sortWrap}>
                <button 
                  className={`${styles.sortBtn} ${isSortMenuOpen ? styles.open : ''}`} 
                  onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(prev => !prev); }}
                >
                  <span className={styles.sortLabel}>Sort: {sortLabels[sortMode]}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div className={`${styles.sortMenu} ${isSortMenuOpen ? styles.open : ''}`}>
                  {(['default', 'az', 'za'] as const).map(mode => (
                    <div 
                      key={mode}
                      className={`${styles.sortOption} ${sortMode === mode ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortMode(mode);
                        setIsSortMenuOpen(false);
                      }}
                    >
                      {sortLabels[mode]} {mode === 'default' ? 'order' : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.paletteList}>
              {visibleItems.length === 0 ? (
                <div className={styles.noResults}>No idioms match your search.</div>
              ) : (
                visibleItems.map(({ item, idx }) => {
                  const selected = idx === currentIdx;
                  return (
                    <div 
                      key={idx}
                      className={`${styles.row} ${selected ? styles.selected : ''}`}
                      onClick={() => {
                        const foundPos = order.indexOf(idx);
                        if (foundPos !== -1) {
                          setPos(foundPos);
                        } else {
                          const newPos = order.indexOf(idx);
                          setPos(newPos !== -1 ? newPos : 0);
                        }
                        setIsSheetOpen(false);
                      }}
                    >
                      <span className={styles.rowText}>{item.idiom}</span>
                      <svg className={styles.checkmark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// DESKTOP VIEW
// -------------------------------------------------------------
function DesktopIdiomsView({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
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
    const items = IDIOMS.map((item, idx) => ({ item, idx }));
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(d => 
      d.item.idiom.toLowerCase().includes(q) || 
      d.item.meaning.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Sync selectedIdx if it gets filtered out
  useEffect(() => {
    if (visibleSidebarData.length > 0 && !visibleSidebarData.find(d => d.idx === selectedIdx)) {
      setSelectedIdx(visibleSidebarData[0].idx);
    }
  }, [visibleSidebarData, selectedIdx]);

  const activeCard = IDIOMS[selectedIdx] || IDIOMS[0];

  const goPrev = () => { if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1); };
  const goNext = () => { if (selectedIdx < IDIOMS.length - 1) setSelectedIdx(selectedIdx + 1); };

  // Scroll active sidebar item into view automatically
  useEffect(() => {
    if (sidebarListRef.current) {
      const activeEl = sidebarListRef.current.querySelector('.active');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  return (
    <div className="dt-app" data-theme={theme}>
      <div className="dt-shell">
        <aside className="dt-sidebar">
          <div className="dt-traffic"><span className="r"></span><span className="y"></span><span className="g"></span></div>
          <div className="dt-search-box">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <input ref={searchInputRef} type="text" placeholder="Search idioms" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <span className="kbd">⌘F</span>
          </div>
          <div className="dt-idx-label">IDIOMS INDEX ({visibleSidebarData.length})</div>
          <div className="dt-sidebar-list" ref={sidebarListRef}>
            {visibleSidebarData.map(d => (
              <div key={d.idx} className={`dt-sidebar-item ${d.idx === selectedIdx ? 'active' : ''}`} onClick={() => setSelectedIdx(d.idx)}>
                <span className="dt-term">{d.item.idiom}</span>
              </div>
            ))}
          </div>
        </aside>
        <main className="dt-main">
          <div className="dt-topbar">
            <div className="dt-nav-arrows">
              <button disabled={selectedIdx <= 0} onClick={goPrev} aria-label="Previous">‹</button>
              <button disabled={selectedIdx >= IDIOMS.length - 1} onClick={goNext} aria-label="Next">›</button>
            </div>
            <div className="dt-tabs">
              <button className="dt-tab active">Idioms &amp; Phrases</button>
            </div>
            <button className="dt-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <div className="dt-content-scroll">
            {activeCard && (
              <div className="dt-hero">
                <div className="dt-hero-word-row">
                  <h1>{activeCard.idiom}</h1>
                  <SpeakerBtn text={activeCard.idiom} size={34} />
                </div>
                <div className="dt-meaning-line">
                  <span className="dt-meaning-text">{activeCard.meaning}</span>
                  <SpeakerBtn text={activeCard.meaning} size={26} />
                </div>

                <div className="dt-cards-grid">
                  {activeCard.bengali && (
                    <div className="dt-info-card">
                      <div className="dt-info-label">বাংলা অর্থ</div>
                      <div className="dt-info-value bn">{activeCard.bengali}</div>
                    </div>
                  )}
                  {activeCard.example && (
                    <div className="dt-info-card">
                      <div className="dt-info-label">Example</div>
                      <div className="dt-info-value dt-example-text">"{activeCard.example}"</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN ENGINE COMPONENT
// -------------------------------------------------------------
export default function StudyModeEngine() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("idioms-theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try { window.localStorage.setItem("idioms-theme", nextTheme); } catch {}
  };

  return (
    <>
      <div className="mobile-view-container">
        <MobileIdiomsView theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className="desktop-view-container">
        <DesktopIdiomsView theme={theme} toggleTheme={toggleTheme} />
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
        .dt-sidebar-item.active { background: var(--dt-blue); }
        .dt-sidebar-item.active .dt-term { color: #fff; }
        
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
        
        .bn { font-family: "Noto Sans Bengali", -apple-system, sans-serif !important; line-height: 1.6 !important; }

        .dt-hero-word-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; }
        .dt-hero-word-row h1 { font-size: 56px; font-weight: 800; letter-spacing: -1.5px; margin: 0; line-height: 1; }

        .dt-meaning-line { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 32px; }
        .dt-meaning-text { font-size: 22px; color: var(--dt-blue); font-weight: 500; line-height: 1.4; }

        .dt-cards-grid { display: flex; flex-direction: column; gap: 16px; }
        .dt-info-card { background: var(--dt-bg-sidebar); border-radius: 16px; padding: 20px 24px; border: 1px solid var(--dt-border); }
        .dt-info-label { font-size: 12px; font-weight: 700; color: var(--dt-ink-faint); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .dt-info-value { font-size: 16px; color: var(--dt-ink); line-height: 1.5; }
        .dt-info-value.bn { font-size: 18px; font-weight: 500; letter-spacing: 0.2px; }
        .dt-example-text { font-style: italic; color: var(--dt-ink-soft); }

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
        .ios-arc.is-speaking { animation: ios-arc-pulse 1.2s infinite ease-out; }
        .ios-arc-1 { animation-delay: 0s; }
        .ios-arc-2 { animation-delay: 0.2s; }
        .ios-arc-3 { animation-delay: 0.4s; }
        
        @keyframes ios-arc-pulse {
          0% { stroke-dashoffset: 100; opacity: 0; }
          20% { stroke-dashoffset: 0; opacity: 1; }
          80% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>
    </>
  );
}
