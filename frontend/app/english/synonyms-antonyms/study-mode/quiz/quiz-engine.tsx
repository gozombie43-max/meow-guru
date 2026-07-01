"use client";

import { useEffect, useState } from "react";

const DEMO_CARD = {
  word: "Abandon",
  pos: "VERB / NOUN",
  meaningVerb: "To leave or give up completely.",
  meaningNoun: "A complete lack of restraint.",
  bengaliVerb: "ত্যাগ করা / পরিত্যাগ করা",
  bengaliNoun: "উচ্ছৃঙ্খলতা / বেপরোয়া ভাব",
  synonyms: [
    ["Desert", "পরিত্যাগ করা"],
    ["Forsake", "ত্যাগ করা"],
    ["Relinquish", "ছেড়ে দেওয়া"],
    ["Leave", "ছেড়ে যাওয়া"],
    ["Dereliction", "অবহেলা"],
    ["Discontinue", "বন্ধ করা"],
    ["Unrestraint", "অসংযম"],
  ],
  antonyms: [
    ["Retain", "ধরে রাখা"],
    ["Continue", "চালিয়ে যাওয়া"],
    ["Keep", "রাখা"],
    ["Adopt", "গ্রহণ করা"],
    ["Constraint", "সংযম"],
  ],
} as const;

export default function StudyModeQuizEngine() {
  const [slideIndex, setSlideIndex] = useState<0 | 1>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const slideTitle = slideIndex === 0 ? "SYNONYMS" : "ANTONYMS";

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

  return (
    <main className="quiz-page" data-theme={theme}>
      <div className="desktop-header">
        <div className="desktop-header-copy">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open question palette"
            aria-expanded={isPaletteOpen}
            onClick={() => setIsPaletteOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <div className="desktop-header-kicker">English</div>
            <div className="desktop-header-title">Study Mode</div>
          </div>
        </div>

        <div className="desktop-header-meta">
          <span className="question-count">{currentPage}/13</span>

          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          >
            <span className="theme-toggle-label">{theme === "dark" ? "Light" : "Dark"}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {theme === "dark" ? (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              ) : (
                <>
                  <path d="M12 3v2" />
                  <path d="M12 19v2" />
                  <path d="M5.64 5.64l1.42 1.42" />
                  <path d="M16.94 16.94l1.42 1.42" />
                  <path d="M3 12h2" />
                  <path d="M19 12h2" />
                  <path d="M5.64 18.36l1.42-1.42" />
                  <path d="M16.94 7.06l1.42-1.42" />
                  <circle cx="12" cy="12" r="4" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="mobile-header">
        <div className="mobile-header-copy">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open question palette"
            aria-expanded={isPaletteOpen}
            onClick={() => setIsPaletteOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <div className="mobile-header-kicker">English</div>
            <div className="mobile-header-title">Study Mode</div>
          </div>
        </div>

          <div className="mobile-header-meta">
            <span className="question-count">{currentPage}/13</span>

            <button
              type="button"
              className="theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            >
              <span className="theme-toggle-label">{theme === "dark" ? "Light" : "Dark"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {theme === "dark" ? (
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                ) : (
                  <>
                    <path d="M12 3v2" />
                    <path d="M12 19v2" />
                    <path d="M5.64 5.64l1.42 1.42" />
                    <path d="M16.94 16.94l1.42 1.42" />
                    <path d="M3 12h2" />
                    <path d="M19 12h2" />
                    <path d="M5.64 18.36l1.42-1.42" />
                    <path d="M16.94 7.06l1.42-1.42" />
                    <circle cx="12" cy="12" r="4" />
                  </>
                )}
              </svg>
            </button>
          </div>
      </div>

      <div className="card">
        {isPaletteOpen && (
          <button
            type="button"
            className="palette-backdrop"
            aria-label="Close question palette"
            onClick={() => setIsPaletteOpen(false)}
          />
        )}

        {isPaletteOpen && (
          <section className="question-palette" aria-label="Question palette">
            <div className="question-palette-head">
              <div>
                <div className="question-palette-kicker">Navigation</div>
                <div className="question-palette-title">Question Palette</div>
              </div>
              <button
                type="button"
                className="palette-close"
                aria-label="Close question palette"
                onClick={() => setIsPaletteOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="question-palette-grid" role="list" aria-label="Question numbers">
              {Array.from({ length: 13 }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`palette-pill ${currentPage === page ? "active" : ""}`}
                  onClick={() => {
                    setCurrentPage(page);
                    setIsPaletteOpen(false);
                  }}
                  aria-pressed={currentPage === page}
                >
                  {page}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="word-zone">
          <div className="word">{DEMO_CARD.word}</div>
          <div className="pos">{DEMO_CARD.pos}</div>
          <div className="bubble-row" aria-hidden="true">
            <div className="bubble filled" />
            <div className="bubble" />
            <div className="bubble" />
            <div className="bubble" />
          </div>
        </section>

        <section className="content">
          <div className="section-label">MEANING</div>
          <div className="def"><b>(V.)</b> {DEMO_CARD.meaningVerb}</div>
          <div className="bn">({DEMO_CARD.bengaliVerb})</div>
          <div className="def meaning-space"><b>(N.)</b> {DEMO_CARD.meaningNoun}</div>
          <div className="bn">({DEMO_CARD.bengaliNoun})</div>

          <div className="slider-head">
            <button
              className="nav-btn nav-left"
              type="button"
              onClick={() => setSlideIndex(0)}
              aria-label="Show synonyms"
            >
              &lt;
            </button>

            <div className="slider-label-group">
              <span className="slider-title">{slideTitle}</span>
              <span className="rule" aria-hidden="true" />
            </div>

            <button
              className="nav-btn nav-right"
              type="button"
              onClick={() => setSlideIndex(1)}
              aria-label="Show antonyms"
            >
              &gt;
            </button>
          </div>

          <div className="slider-viewport">
            <div className="slider-track" style={{ transform: `translateX(-${slideIndex * 50}%)` }}>
              <div className="slide synonyms">
                <ul className="syn-list">
                  {DEMO_CARD.synonyms.map(([english, bengali]) => (
                    <li key={english}>
                      <span className="syn-en">{english}</span>
                      <span className="syn-bn">{bengali}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="slide antonyms">
                <ul className="syn-list">
                  {DEMO_CARD.antonyms.map(([english, bengali]) => (
                    <li key={english}>
                      <span className="syn-en">{english}</span>
                      <span className="syn-bn">{bengali}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="dots" aria-hidden="true">
            <button type="button" className={`dot ${slideIndex === 0 ? "active" : ""}`} onClick={() => setSlideIndex(0)} />
            <button type="button" className={`dot ${slideIndex === 1 ? "active" : ""}`} onClick={() => setSlideIndex(1)} />
          </div>
        </section>

        <div className="word-nav">
          <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}>
            <span className="arrow">&lt;</span> Previous
          </button>
          <button type="button" onClick={() => setCurrentPage((value) => Math.min(13, value + 1))}>
            Next <span className="arrow">&gt;</span>
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Archivo+Black&family=Noto+Sans+Bengali:wght@400;600&display=swap');

        :root {
          --paper: #181613;
          --paper-raised: #1f1c18;
          --ink: #f2ead9;
          --ink-dim: #c9bfa9;
          --scarlet: #ff7a5c;
          --teal: #7fd4bd;
          --mustard: #f0b649;
          --line: #4a4234;
        }

        .quiz-page {
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Space Mono', monospace;
          -webkit-font-smoothing: antialiased;
          position: relative;
          padding-top: 58px;
        }

        .quiz-page[data-theme="light"] {
          --paper: #f4efe3;
          --paper-raised: #ffffff;
          --ink: #1c1c1c;
          --ink-dim: #5b5b52;
          --scarlet: #b6412e;
          --teal: #2f4b46;
          --mustard: #d69a2d;
          --line: #c9bfa5;
        }

        .quiz-page[data-theme="light"] .card {
          background: var(--paper);
        }

        .desktop-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 14px 10px;
          background: var(--paper);
          border-bottom: 1.5px solid var(--line);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .desktop-header-copy,
        .mobile-header-copy {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .desktop-header-meta,
        .mobile-header-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .desktop-header-copy {
          min-width: 0;
        }

        .desktop-header-kicker {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--ink-dim);
        }

        .desktop-header-title {
          margin-top: 3px;
          font-family: 'Archivo Black', sans-serif;
          font-size: 18px;
          line-height: 1;
          color: var(--ink);
        }

        .menu-toggle {
          width: 40px;
          height: 40px;
          padding: 10px;
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          cursor: pointer;
          flex: 0 0 auto;
        }

        .menu-toggle span {
          display: block;
          width: 100%;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }

        .theme-toggle {
          min-width: 42px;
          height: 42px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: var(--paper-raised);
          color: var(--ink);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          cursor: pointer;
        }

        .question-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink-dim);
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .quiz-page[data-theme="light"] .desktop-header {
          background: var(--paper);
        }

        .quiz-page[data-theme="light"] .theme-toggle {
          background: var(--paper);
        }

        .quiz-page[data-theme="light"] .menu-toggle {
          background: var(--paper);
        }

        .mobile-header {
          display: none;
        }

        .theme-toggle svg {
          width: 18px;
          height: 18px;
        }

        .theme-toggle-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .card {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          min-height: 100vh;
          background: var(--paper);
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          position: relative;
        }

        .palette-backdrop {
          position: fixed;
          inset: 58px 0 0 0;
          z-index: 30;
          border: 0;
          padding: 0;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(2px);
        }

        .question-palette {
          position: fixed;
          top: 58px;
          left: 12px;
          right: 12px;
          z-index: 35;
          max-width: 520px;
          margin: 0 auto;
          padding: 14px;
          border: 1.5px solid var(--line);
          border-radius: 20px;
          background: var(--paper-raised);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.2);
        }

        .quiz-page[data-theme="light"] .question-palette {
          background: var(--paper);
        }

        .question-palette-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .question-palette-kicker {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--ink-dim);
        }

        .question-palette-title {
          margin-top: 3px;
          font-family: 'Archivo Black', sans-serif;
          font-size: 16px;
          line-height: 1;
          color: var(--ink);
        }

        .palette-close {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }

        .question-palette-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .palette-pill {
          height: 44px;
          border-radius: 14px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink-dim);
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          cursor: pointer;
        }

        .palette-pill.active {
          background: var(--scarlet);
          border-color: var(--scarlet);
          color: #181613;
        }

        .page-strip {
          display: none;
        }

        .word-zone {
          text-align: center;
          padding: 22px 20px 16px;
          border-bottom: 1.5px solid var(--ink);
          background: repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(255, 122, 92, 0.07) 18px, rgba(255, 122, 92, 0.07) 19px);
        }

        .quiz-page[data-theme="light"] .word-zone {
          background: repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(182, 65, 46, 0.04) 18px, rgba(182, 65, 46, 0.04) 19px);
        }

        .word {
          font-family: 'Archivo Black', sans-serif;
          font-size: 46px;
          letter-spacing: 1px;
          color: var(--ink);
        }

        .pos {
          margin-top: 4px;
          font-size: 13.5px;
          color: var(--scarlet);
          letter-spacing: 2px;
          font-weight: 700;
        }

        .bubble-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 12px;
        }

        .bubble {
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--ink);
          border-radius: 50%;
        }

        .bubble.filled {
          background: var(--scarlet);
          border-color: var(--scarlet);
        }

        .content {
          padding: 16px 20px 4px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .section-label {
          font-family: 'Space Mono', monospace;
          font-size: 16.5px;
          letter-spacing: 2px;
          color: var(--teal);
          font-weight: 400;
          margin: 0 0 10px;
          text-align: center;
          text-transform: uppercase;
        }

        .def {
          font-size: 15px;
          line-height: 1.6;
          color: var(--ink);
        }

        .def b {
          color: var(--scarlet);
        }

        .meaning-space {
          margin-top: 8px;
        }

        .bn {
          font-family: 'Noto Sans Bengali', sans-serif;
          font-size: 15px;
          color: var(--teal);
          margin-top: 2px;
        }

        .slider-head {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 20px;
        }

        .slider-label-group {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .slider-title {
          font-family: 'Space Mono', monospace;
          font-size: 16.5px;
          letter-spacing: 2px;
          color: var(--teal);
          font-weight: 400;
          text-align: center;
          text-transform: uppercase;
          min-width: 130px;
        }

        .rule {
          display: none;
        }

        .nav-btn {
          width: 26px;
          height: 26px;
          border: 1.5px solid var(--ink);
          border-radius: 50%;
          background: var(--paper);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          color: var(--ink);
          user-select: none;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }

        .nav-btn:hover {
          background: var(--scarlet);
          color: var(--paper);
          border-color: var(--scarlet);
        }

        .nav-left {
          margin-right: 8px;
        }

        .nav-right {
          margin-left: 8px;
        }

        .slider-viewport {
          overflow: hidden;
          margin-top: 8px;
        }

        .slider-track {
          display: flex;
          width: 200%;
          transition: transform 0.5s cubic-bezier(.2,.7,.3,1);
        }

        .slide {
          width: 50%;
          flex-shrink: 0;
        }

        .syn-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .syn-list li {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 15px;
          border-bottom: 1px dotted var(--line);
          padding-bottom: 7px;
          padding-right: 4px;
        }

        .syn-en {
          font-weight: 400;
          color: var(--ink);
          letter-spacing: 0.3px;
        }

        .slide.antonyms .syn-en {
          color: var(--scarlet);
        }

        .syn-bn {
          font-family: 'Noto Sans Bengali', sans-serif;
          color: var(--teal);
          font-size: 15px;
          text-align: right;
        }

        .dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--line);
          border: 1px solid var(--ink);
          cursor: pointer;
          padding: 0;
        }

        .dot.active {
          background: var(--scarlet);
          border-color: var(--scarlet);
        }

        .word-nav {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 20px calc(18px + env(safe-area-inset-bottom));
          position: sticky;
          bottom: 0;
          background: var(--paper);
          border-top: 1.5px dashed var(--line);
        }

        .quiz-page[data-theme="light"] .word-nav {
          background: var(--paper);
        }

        .word-nav button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 13.5px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--ink);
          background: var(--paper);
          border: 1.5px solid var(--ink);
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
          box-shadow: 3px 3px 0 var(--ink);
          transition: transform 0.12s, box-shadow 0.12s, background 0.12s, color 0.12s;
        }

        .word-nav button:hover {
          background: var(--scarlet);
          color: var(--paper);
          border-color: var(--scarlet);
        }

        .word-nav button:active {
          transform: translate(3px, 3px);
          box-shadow: 0 0 0 var(--ink);
        }

        .word-nav .arrow {
          font-size: 13px;
          line-height: 1;
        }

        @media (max-width: 460px) {
          .quiz-page {
            padding-top: env(safe-area-inset-top);
            height: 100dvh;
            overflow: hidden;
          }

          .desktop-header {
            display: none;
          }

          .mobile-header {
            position: sticky;
            top: 0;
            z-index: 25;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 8px 12px 7px;
            background: var(--paper-raised);
            border-bottom: 1.5px solid var(--line);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
          }

          .mobile-header-copy {
            min-width: 0;
          }

          .mobile-header-kicker {
            font-size: 9px;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            color: var(--ink-dim);
          }

          .mobile-header-title {
            margin-top: 2px;
            font-family: 'Archivo Black', sans-serif;
            font-size: 15px;
            line-height: 1;
            color: var(--ink);
          }

          .theme-toggle {
            min-width: 64px;
            height: 34px;
            padding: 0 10px;
            flex: 0 0 auto;
            gap: 5px;
            border-radius: 999px;
            background: var(--scarlet);
            color: #181613;
            border-color: var(--scarlet);
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
          }

          .theme-toggle-label {
            font-size: 10px;
          }

          .question-count {
            min-width: 46px;
            height: 26px;
            padding: 0 8px;
            font-size: 10px;
          }

          .card {
            height: calc(100dvh - 46px - env(safe-area-inset-top));
            min-height: calc(100dvh - 46px - env(safe-area-inset-top));
            overflow: hidden;
          }

          .word-zone {
            padding: 14px 12px 10px;
          }

          .word {
            font-size: clamp(1.9rem, 9.2vw, 2.35rem);
          }

          .pos {
            letter-spacing: 1.2px;
            font-size: 11px;
          }

          .bubble-row {
            margin-top: 8px;
            gap: 7px;
          }

          .bubble {
            width: 10px;
            height: 10px;
          }

          .content {
            padding: 10px 12px 2px;
          }

          .section-label {
            font-size: 12px;
            margin-bottom: 6px;
          }

          .def,
          .bn,
          .syn-list li {
            font-size: 12px;
            line-height: 1.45;
          }

          .meaning-space {
            margin-top: 4px;
          }

          .slider-head {
            margin-top: 12px;
            gap: 8px;
          }

          .slider-title {
            min-width: 92px;
            font-size: 12px;
            letter-spacing: 1.2px;
          }

          .nav-btn {
            width: 22px;
            height: 22px;
          }

          .slider-viewport {
            margin-top: 4px;
          }

          .syn-list {
            gap: 5px;
          }

          .syn-list li {
            padding-bottom: 4px;
          }

          .syn-bn {
            font-size: 11px;
          }

          .dots {
            margin-top: 8px;
          }

          .word-nav {
            padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
            gap: 8px;
            border-top-width: 1px;
          }

          .word-nav button {
            font-size: 11px;
            padding: 8px 10px;
            box-shadow: 2px 2px 0 var(--ink);
          }

          .word-nav .arrow {
            font-size: 11px;
          }

          .theme-toggle svg {
            width: 14px;
            height: 14px;
          }

          .quiz-page[data-theme="light"] .mobile-header {
            background: var(--paper-raised);
          }

          .palette-backdrop {
            inset: 46px 0 0 0;
          }

          .question-palette {
            top: 46px;
            left: 8px;
            right: 8px;
            padding: 10px;
            border-radius: 16px;
          }

          .question-palette-head {
            margin-bottom: 10px;
          }

          .question-palette-title {
            font-size: 14px;
          }

          .question-palette-grid {
            gap: 8px;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .palette-pill {
            height: 38px;
            border-radius: 12px;
          }
        }
      `}</style>
    </main>
  );
}