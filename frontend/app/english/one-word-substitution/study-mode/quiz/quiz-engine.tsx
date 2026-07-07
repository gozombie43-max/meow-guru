"use client";

import { useEffect, useRef, useState } from "react";
import RichContent from "@/components/RichContent";
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

type SubstitutionCard = {
  id: string;
  prompt: string;
  answer: string;
  definitionTranslation?: string;
  answerTranslation?: string;
  label?: string;
};

const DEMO_CARD: SubstitutionCard = {
  id: "demo",
  prompt:
    "An inscription on a tombstone in memory of the person who has died.\n\n" +
    "Memory hook: \"Epi-\" (upon) + \"taph\" (tomb) - literally, words written upon a tomb.",
  answer: "Epitaph",
  definitionTranslation: "সমাধিফলকে মৃত ব্যক্তির স্মরণে লেখা অনুশোচনা বা প্রশস্তি",
  answerTranslation: "সমাধি-লেখ, স্মৃতি-লেখ",
  label: "Noun",
};

const promptFields = [
  "prompt",
  "phrase",
  "question",
  "definition",
  "meaning",
  "clue",
];

function getFirstString(entry: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function toSubstitutionCard(entry: StudyModeEntry, index: number): SubstitutionCard | null {
  const promptFromMeaning = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => String(meaning?.definition ?? "").trim())
        .filter(Boolean)[0] ?? ""
    : "";

  const prompt =
    getFirstString(entry as Record<string, unknown>, promptFields) || promptFromMeaning;

  const answer =
    String(
      entry.word ||
        entry.correctAnswer ||
        entry.answer ||
        entry.solution ||
        ""
    ).trim();

  if (!prompt || !answer) return null;

  const translation = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => String(meaning?.translation ?? "").trim())
        .filter(Boolean)[0]
    : "";

  const answerTranslation = getFirstString(entry as Record<string, unknown>, [
    "answerTranslation",
    "wordTranslation",
    "translation",
  ]);

  const label = entry.concept ? String(entry.concept).trim() : "";

  return {
    id: String(entry.id ?? index + 1),
    prompt,
    answer,
    definitionTranslation: translation,
    answerTranslation,
    label,
  };
}

export default function StudyModeQuizEngine() {
  const [currentPage, setCurrentPage] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [cards, setCards] = useState<SubstitutionCard[]>([]);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const totalCards = Math.max(cards.length, 1);
  const currentIndex = Math.min(Math.max(currentPage - 1, 0), totalCards - 1);
  const activeCard = cards[currentIndex] ?? DEMO_CARD;

  useEffect(() => {
    let active = true;

    fetchQuestions({
      subject: "english",
      topic: "one-word-substitution",
      questionType: "study-mode",
    })
      .then((data) => {
        if (!active) return;
        const mapped = data
          .map((entry, index) => toSubstitutionCard(entry as StudyModeEntry, index))
          .filter(Boolean) as SubstitutionCard[];
        setCards(mapped.length ? [DEMO_CARD, ...mapped] : [DEMO_CARD]);
      })
      .catch(() => {
        if (active) setCards([DEMO_CARD]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cards.length === 0) {
      setCurrentPage(1);
      return;
    }
    if (currentPage > cards.length) {
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

  const [definitionText, memoryHookText] = (() => {
    const [definition, memory] = activeCard.prompt.split(/Memory hook:/i);
    return [definition?.trim() ?? "", memory?.trim() ?? ""];
  })();

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
          <span className="question-count">{currentPage}/{totalCards}</span>

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
          <span className="question-count">{currentPage}/{totalCards}</span>

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

      <div
        className="card"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartXRef.current = touch?.clientX ?? null;
          touchStartYRef.current = touch?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          const startX = touchStartXRef.current;
          const startY = touchStartYRef.current;
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          if (startX === null || startY === null || !touch) return;
          const deltaX = touch.clientX - startX;
          const deltaY = touch.clientY - startY;
          if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
          setCurrentPage((value) =>
            deltaX > 0 ? Math.max(1, value - 1) : Math.min(totalCards, value + 1)
          );
        }}
      >
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
              {Array.from({ length: totalCards }, (_, index) => index + 1).map((page) => (
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

        <section className="content">
          <div className="def">
            <RichContent text={definitionText} />
          </div>
          {activeCard.definitionTranslation ? (
            <div className="bn">({activeCard.definitionTranslation})</div>
          ) : null}
        </section>

        <section className="word-zone">
          <div className="word">{activeCard.answer}</div>
          <div className="pos">{(activeCard.label || "One Word").toUpperCase()}</div>
          <div className="bubble-row" aria-hidden="true">
            <div className="bubble filled" />
            <div className="bubble" />
            <div className="bubble" />
            <div className="bubble" />
          </div>
        </section>

        <div className="section-divider" aria-hidden="true" />

        <section className="content memory-block">
          <div className="divider dotted" />
          <div className="section-label">MEMORY HOOK</div>
          <div className="memory-text">
            {memoryHookText ? <RichContent text={memoryHookText} /> : "--"}
          </div>
          {activeCard.answerTranslation ? (
            <div className="memory-translation">{activeCard.answerTranslation}</div>
          ) : null}
        </section>

        <div className="word-nav">
          <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}>
            <span className="arrow">&lt;</span> Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((value) => Math.min(totalCards, value + 1))}
          >
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

        .word-zone {
          text-align: center;
          padding: 0 20px 6px;
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
          padding: 8px 20px 0;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .section-divider {
          margin: 0;
          border-top: 1.5px solid #f2ead9;
        }

        .section-label {
          font-family: 'Space Mono', monospace;
          font-size: 16.5px;
          letter-spacing: 2px;
          color: var(--teal);
          font-weight: 400;
          margin: 0;
          text-align: center;
          text-transform: uppercase;
        }

        .def {
          font-size: 15px;
          line-height: 1.65;
          color: var(--ink);
          text-align: center;
        }

        .bn {
          font-family: 'Noto Sans Bengali', sans-serif;
          font-size: 15px;
          color: var(--teal);
          text-align: center;
        }

        .divider {
          height: 1px;
          background: var(--line);
          width: 100%;
        }

        .divider.dotted {
          background: none;
          border-top: 1px dashed var(--line);
          margin: 6px 0 2px;
        }

        .memory-text {
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink-dim);
          text-align: center;
        }

        .memory-translation {
          font-family: 'Noto Sans Bengali', sans-serif;
          font-size: 15px;
          color: var(--mustard);
          text-align: center;
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
            min-height: calc(100dvh - 46px - env(safe-area-inset-top));
          }

          .word-zone {
            padding: 0 12px 8px;
          }

          .word {
            font-size: clamp(2rem, 9.8vw, 2.55rem);
          }

          .pos {
            letter-spacing: 1.4px;
            font-size: 12px;
          }

          .bubble-row {
            margin-top: 8px;
            gap: 8px;
          }

          .bubble {
            width: 11px;
            height: 11px;
          }

          .content {
            flex: 0 0 auto;
            padding: 7px 12px 0;
            gap: 5px;
          }

          .section-divider {
            margin: 0;
          }

          .section-label {
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 1px;
          }

          .def {
            font-size: 15px;
            line-height: 1.65;
          }

          .bn {
            font-size: 14px;
            line-height: 1.55;
          }

          .memory-text {
            font-size: 14px;
            line-height: 1.65;
          }

          .memory-translation {
            font-size: 14px;
          }

          .word-nav {
            position: static;
            margin-top: 14px;
            padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
            gap: 10px;
            border-top-width: 1px;
          }

          .word-nav button {
            font-size: 13px;
            font-weight: 600;
            padding: 11px 10px;
            box-shadow: 2px 2px 0 var(--ink);
            letter-spacing: 0.5px;
          }

          .word-nav .arrow {
            font-size: 12px;
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
