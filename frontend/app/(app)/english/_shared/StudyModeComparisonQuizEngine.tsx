'use client';
import { useMemo, useRef } from 'react';
import { ArrowLeft, LogOut, Volume2, X } from "lucide-react";
import { studyModeComparisonStyles, studyModeLoadingStyles } from "./study-mode-comparison.styles";
import { useNativeDialog } from "@/components/ui/Dialog";
import BackButton from "@/components/BackButton";
import { ComparisonWordIndex } from "./ComparisonWordIndex";
import { SpeakerBtn } from "./SpeakerBtn";

import type { StudyModeComparisonConfig } from './study-mode-comparison-model';
import { useStudyModeComparisonController } from "./useStudyModeComparisonController";
export type { StudyModeComparisonConfig, StudyModeComparisonItem } from './study-mode-comparison-model';

export default function StudyModeComparisonQuizEngine({ config }: { config: StudyModeComparisonConfig }) {
  const {
    cards,
    loading,
    error,
    retry,
    selectCard,
    activeSpeech,
    handleRowClick,
    theme,
    setTheme,
    currentPage,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    mobileTab,
    setMobileTab,
    isMobilePaletteOpen,
    setIsMobilePaletteOpen,
    showExitConfirm,
    setShowExitConfirm,
    mobileSheetSearch,
    setMobileSheetSearch,
    mobileSheetLetter,
    setMobileSheetLetter,
    selectedLetter,
    setSelectedLetter,
    stagedLetter,
    setStagedLetter,
    isLetterDropdownOpen,
    setIsLetterDropdownOpen,
    filteredCards,
    searchInputRef,
    touchStartXRef,
    touchStartYRef,
    handleConfirmExit,
    availableLetters,
    filteredSheetCards,
  } = useStudyModeComparisonController(config);
  const wordNumbers = useMemo(() => new Map(cards.map((card, index) => [card.id, index + 1])), [cards]);
  const paletteRef = useRef<HTMLDialogElement>(null);
  const exitRef = useRef<HTMLDialogElement>(null);
  useNativeDialog(paletteRef, isMobilePaletteOpen && !loading, () => setIsMobilePaletteOpen(false));
  useNativeDialog(exitRef, showExitConfirm && !loading, () => setShowExitConfirm(false));
  if (loading) {
    return (
      <main className="apple-dict-viewport" data-theme={theme}>
        <div className="loading-state">
          <div className="spinner" />
          <p role="status">Loading your vocabulary…</p>
          <BackButton href={`/english/${config.topic}/study-mode`} label="Back to study setup" />
        </div>
        <style jsx>{studyModeLoadingStyles}</style>
      </main>
    );
  }


  const totalCards = filteredCards.length;
  const activeCard = filteredCards[currentPage - 1] || { id: 'empty', word: 'No matching words', meanings: [], primaryItems: [], secondaryItems: [] };
  const posLabel = activeCard.meanings.map((m) => m.pos).filter(Boolean).join(" · ");

  return (
    <main className="apple-dict-viewport" data-theme={theme}>
      {/* Mini Middle Pop-up Exit Confirmation Modal */}
      {showExitConfirm && (
        <dialog ref={exitRef}
          className="exit-modal-backdrop"

          aria-modal="true"
          aria-labelledby="exit-modal-title"
        >
          <div className="exit-modal-card">
            <div className="exit-modal-icon-wrap">
              <LogOut size={22} className="exit-modal-icon" />
            </div>
            <h3 id="exit-modal-title" className="exit-modal-title">
              Want to exit?
            </h3>
            <p className="exit-modal-desc">
              Are you sure you want to leave study mode? You can return to the word library at any time.
            </p>
            <div className="exit-modal-actions">
              <button data-ui-button="secondary"
                type="button"
                className="exit-btn-cancel"
                onClick={() => setShowExitConfirm(false)}
              >
                Cancel
              </button>
              <button data-ui-button="primary"
                type="button"
                className="exit-btn-confirm"
                onClick={handleConfirmExit}
              >
                Confirm
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* ── Authentic macOS Apple Dictionary Window (Zero Scroll on PC) ── */}
      <div className="apple-app-window">

        {/* ── Left Master-Detail Navigation Sidebar (PC Exclusive) ── */}
        <aside className="macos-sidebar">
          {/* Traffic Lights + Letter Filter Button inside Sidebar */}
          <div
            className="traffic-lights"
            role="group"
            aria-label="Window controls"
          >
            <button
              type="button"
              data-ui-button="icon" className="sidebar-back"
              onClick={() => setShowExitConfirm(true)}
              aria-label="Close and return"
              title="Close to welcome screen"
            >
              <ArrowLeft size={20} />
            </button>
            {/* A-Z Letter Filter Button — upper right */}
            <div
              className="letter-filter-wrapper"
              onMouseDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              <button data-ui-button="state"
                type="button"
                className={`letter-filter-btn ${selectedLetter ? "active" : ""} ${isLetterDropdownOpen ? "open" : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={() => {
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
                <div className="letter-dropdown" onMouseDown={(e) => e.stopPropagation()} role="presentation">
                  <div className="letter-dropdown-header">
                    <span>Filter by letter</span>
                    {selectedLetter && (
                      <button data-ui-button="secondary"
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
                      <button data-ui-button="state"
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
                      <button data-ui-button="state" type="button" style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--item-hover)', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => { setStagedLetter(null); setSelectedLetter(null); setIsLetterDropdownOpen(false); setCurrentPage(1); }}>Reset</button>
                      <button data-ui-button="state" type="button" style={{ flex: 2, padding: '8px', borderRadius: '6px', background: '#007aff', color: '#fff', fontWeight: 600 }} onClick={() => { setSelectedLetter(stagedLetter); setIsLetterDropdownOpen(false); setCurrentPage(1); }}>
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
               aria-label="Search vocab (⌘F)"/>
              {searchQuery && (
                <button data-ui-button="secondary"
                  type="button"
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="sidebar-section-title">VOCABULARY INDEX ({filteredCards.length})</div>

          {/* Scrollable Wordlist */}
          <ComparisonWordIndex numbers={wordNumbers} cards={filteredCards} activeId={activeCard.id} compact onSelect={id => setCurrentPage(filteredCards.findIndex(card => card.id === id) + 1)} />

        </aside>

        {/* ── Main Dictionary Content Workspace ── */}
        <div className="macos-workspace">

          {/* Top Unified Toolbar */}
          <header data-ui-chrome="header" className="unified-toolbar">
            <div className="toolbar-left">
              {/* Mobile Back button to return to study mode */}
              <button data-ui-button="icon"
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
              <div className="apple-segmented-control" role="group">
                <button data-ui-button="state"
                  type="button"
                  className={`segment-item ${viewMode === "all" ? "active" : ""}`}
                  onClick={() => setViewMode("all")}
                >
                  All Tables
                </button>
                <button data-ui-button="state"
                  type="button"
                  className={`segment-item ${viewMode === "primary" ? "active" : ""}`}
                  onClick={() => setViewMode("primary")}
                >
                  {config.primaryLabel}
                </button>
                <button data-ui-button="state"
                  type="button"
                  className={`segment-item ${viewMode === "secondary" ? "active" : ""}`}
                  onClick={() => setViewMode("secondary")}
                >
                  {config.secondaryLabel}
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
              <button data-ui-button="state"
                type="button"
                className="mobile-counter-filter-btn"
                onClick={() => setIsMobilePaletteOpen(true)}
                aria-label="Filter vocabulary index"
                title="Filter words"
              >
                <span className="counter-curr">{totalCards ? currentPage : 0}</span>
                <span className="counter-sep">/</span>
                <span className="counter-tot">{totalCards}</span>
              </button>

              <button data-ui-button="state" data-ui-shape="icon"
                type="button"
                className="appearance-toggle"
                onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
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
            <dialog ref={paletteRef} className="mobile-full-modal" aria-modal="true" aria-label="Vocabulary Index Filter">
              {/* Modal Top Header Bar */}
              <div className="modal-top-bar" data-ui-chrome="header">
                <button data-ui-button="icon"
                  type="button"
                  className="modal-top-back-btn"
                  onClick={() => setIsMobilePaletteOpen(false)}
                  aria-label="Close Filter"
                >
                  <ArrowLeft size={20} />
                  <span>Done</span>
                </button>

                <div className="modal-top-title">
                  <span>Vocabulary Index</span>
                  <small>{cards.length.toLocaleString()} words</small>
                </div>

                {mobileSheetSearch || mobileSheetLetter ? (
                  <button data-ui-button="secondary"
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
                  <span className="modal-header-spacer" aria-hidden="true" />
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
                   aria-label="Search by word or meaning..."/>
                  {mobileSheetSearch && (
                    <button data-ui-button="secondary"
                      type="button"
                      className="modal-search-clear"
                      onClick={() => setMobileSheetSearch("")}
                      aria-label="Clear Search"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* A-Z Letter Filter Scroll Bar */}
              <div className="modal-letter-strip" role="group" aria-label="Filter by letter">
                <button data-ui-button="state"
                  type="button"
                  aria-pressed={!mobileSheetLetter} className={`modal-letter-chip ${!mobileSheetLetter ? "active" : ""}`}
                  onClick={() => setMobileSheetLetter(null)}
                >
                  All
                </button>
                {availableLetters.map((letter) => {
                  const isSelected = mobileSheetLetter === letter;
                  return (
                    <button data-ui-button="state"
                      key={letter}
                      type="button"
                      aria-pressed={isSelected} className={`modal-letter-chip ${isSelected ? "active" : ""}`}
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

              <ComparisonWordIndex numbers={wordNumbers} cards={filteredSheetCards} activeId={activeCard.id} onSelect={selectCard} />

            </dialog>
          )}

          {/* Main Dictionary Workspace Body */}
          <div className="dictionary-body-scroll" key={activeCard.id}>
            {error ? <div className="study-empty" role="alert"><h2>Couldn’t load your vocabulary</h2><p>Please try again.</p><button data-ui-button="primary" onClick={() => void retry()}>Try again</button></div> : totalCards === 0 ? <div className="study-empty" role="status"><h2>No matching words</h2><p>Try a different search or clear your filters.</p><button data-ui-button="secondary" onClick={() => { setSearchQuery(''); setSelectedLetter(null); }}>Clear filters</button></div> : <>

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
              {(viewMode === "all" || viewMode === "primary") && (
                <div className="ns-table-container">
                  <div className="table-header">
                    <span className="table-title">{config.primaryTitle}</span>
                    <span className="table-count">{activeCard.primaryItems.length} words</span>
                  </div>
                  <div className="table-body">
                    {activeCard.primaryItems.length === 0 ? (
                      <div className="table-empty">{config.primaryEmptyLabel}</div>
                    ) : (
                      activeCard.primaryItems.map((s, i) => (
                        <div key={i} className={`table-row ${i % 2 === 1 ? "alt-row" : ""}`} onClick={() => handleRowClick(s.word, s.translation)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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

              {(viewMode === "all" || viewMode === "secondary") && (
                <div className="ns-table-container">
                  <div className="table-header">
                    <span className="table-title">{config.secondaryTitle}</span>
                    <span className="table-count">{activeCard.secondaryItems.length} words</span>
                  </div>
                  <div className="table-body">
                    {activeCard.secondaryItems.length === 0 ? (
                      <div className="table-empty">{config.secondaryEmptyLabel}</div>
                    ) : (
                      activeCard.secondaryItems.map((a, i) => (
                        <div key={i} className={`table-row ${i % 2 === 1 ? "alt-row" : ""}`} onClick={() => handleRowClick(a.word, a.translation)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
                <button data-ui-button="state"
                  type="button"
                  aria-pressed={mobileTab === "primary"} className={`m-tab ${mobileTab === "primary" ? "active" : ""}`}
                  onClick={() => setMobileTab("primary")}
                >
                  <span>{config.primaryLabel}</span>
                  <span className="m-tab-badge">{activeCard.primaryItems.length}</span>
                </button>
                <button data-ui-button="state"
                  type="button"
                  aria-pressed={mobileTab === "secondary"} className={`m-tab ${mobileTab === "secondary" ? "active" : ""}`}
                  onClick={() => setMobileTab("secondary")}
                >
                  <span>{config.secondaryLabel}</span>
                  <span className="m-tab-badge">{activeCard.secondaryItems.length}</span>
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
                  if (dx < 0 && mobileTab === "primary") setMobileTab("secondary");
                  if (dx > 0 && mobileTab === "secondary") setMobileTab("primary");
                }}
              >
                <div className="ns-table-container">
                  <div className="table-body">
                    {mobileTab === "primary" ? (
                      activeCard.primaryItems.length === 0 ? (
                        <div className="table-empty">{config.primaryEmptyLabel}</div>
                      ) : (
                        activeCard.primaryItems.map((s, i) => (
                          <div key={i} className="table-row" onClick={() => handleRowClick(s.word, s.translation)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                            <span className="cell-term" style={{ display: 'flex', alignItems: 'center' }}>
                              {s.word}
                              {activeSpeech === s.word && <Volume2 size={16} style={{ marginLeft: 8, color: '#007aff' }} />}
                            </span>
                            <span className="cell-trans">{s.translation || "—"}</span>
                          </div>
                        ))
                      )
                    ) : (
                      activeCard.secondaryItems.length === 0 ? (
                        <div className="table-empty">{config.secondaryEmptyLabel}</div>
                      ) : (
                        activeCard.secondaryItems.map((a, i) => (
                          <div key={i} className="table-row" onClick={() => handleRowClick(a.word, a.translation)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
            </>}
          </div>

          {/* ── Mobile Floating Navigation Buttons ── */}
          <div className="mobile-nav-footer">
            <button data-ui-button="secondary"
              type="button"
              className="mobile-footer-btn prev"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={!totalCards || currentPage === 1}
              aria-label="Previous Word"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Previous</span>
            </button>

            <button data-ui-button="state"
              type="button"
              className="mobile-footer-btn next"
              onClick={() => setCurrentPage((prev) => Math.min(totalCards, prev + 1))}
              disabled={!totalCards || currentPage >= totalCards}
              aria-label="Next Word"
            >
              <span>Next</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

        </div>
      </div>

      <style jsx>{studyModeComparisonStyles}</style>
    </main>
  );
}
