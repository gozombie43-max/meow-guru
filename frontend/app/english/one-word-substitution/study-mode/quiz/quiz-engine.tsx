"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Menu, Moon, Sun } from "lucide-react";
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

const DEMO_CARDS: SubstitutionCard[] = [
  DEMO_CARD,
  {
    id: "demo-bibliophile",
    prompt:
      'A person who loves and collects books.\n\nMemory hook: "Biblio-" (book) + "-phile" (lover) - same root as bibliography.',
    answer: "Bibliophile",
    definitionTranslation: "যে ব্যক্তি বই ভালোবাসে এবং সংগ্রহ করে",
    answerTranslation: "গ্রন্থপ্রেমী, বইপ্রেমী",
    label: "Noun",
  },
];

const promptFields = [
  "prompt",
  "phrase",
  "question",
  "definition",
  "meaning",
  "clue",
];

function getFirstString(entry: unknown, keys: string[]): string {
  if (!entry || typeof entry !== "object") return "";
  const record = entry as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
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

  const prompt = getFirstString(entry, promptFields) || promptFromMeaning;

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

  const answerTranslation = getFirstString(entry, [
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

/*
export default function StudyModeQuizEngine() {
  const [currentPage, setCurrentPage] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = window.localStorage.getItem("study-mode-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [cards, setCards] = useState<SubstitutionCard[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const studyCards = cards.length ? cards : DEMO_CARDS;
  const totalCards = studyCards.length;
  const currentIndex = Math.min(Math.max(currentPage - 1, 0), totalCards - 1);
  const activeCard = studyCards[currentIndex];

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
        setCards(mapped.length ? [...DEMO_CARDS, ...mapped] : DEMO_CARDS);
      })
      .catch(() => {
        if (active) setCards(DEMO_CARDS);
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
      const savedTheme = window.localStorage.getItem("study-mode-theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            setCurrentPage(index + 1);
          }
        });
      },
      { root: scroller, threshold: [0.6] }
    );

    const slides = scroller.querySelectorAll<HTMLElement>("[data-index]");
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [cards.length]);

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
            <div className="desktop-header-title">One Word Substitution</div>
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
            <div className="mobile-header-title">One Word Substitution</div>
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
            const goToCard = (index: number) => {
              scrollerRef.current
                ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              setCurrentPage(index + 1);
            };

            return (
              <>
                <main className="ows-page" data-theme={theme}>
                  <div className="ows-header">
                    <div className="ows-header-text">
        {isPaletteOpen && (
          <section className="question-palette" aria-label="Question palette">
                      className="ows-menu-button"
              <div>
                <div className="question-palette-kicker">Navigation</div>
                <div className="question-palette-title">Question Palette</div>
              </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                      </svg>
                aria-label="Close question palette"
                onClick={() => setIsPaletteOpen(false)}
                      <div className="ows-header-label">English</div>
                      <div className="ows-header-title">One Word Substitution</div>
              </button>
                    </div>
                    <div className="ows-header-actions">
                      <span className="ows-counter">{currentPage}/{totalCards}</span>
                      <button
                        type="button"
                        className="ows-theme-toggle"
                        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                        aria-pressed={theme === "dark"}
                        onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
                      >
                        <span>{theme === "dark" ? "Dark" : "Light"}</span>
                        {theme === "dark" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 2v2.4M12 19.6V22M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2 12h2.4M19.6 12H22M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" /><circle cx="12" cy="12" r="4.2" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.5a8.5 8.5 0 1 1-9-13 7 7 0 0 0 9 13Z" /></svg>
                        )}
                      </button>
                    </div>
          --ink-dim: #8a8a8a;
          --card-ink: #f2ead9;
                  <div
                    ref={scrollerRef}
                    className="ows-scroller"
          --teal: #6ea89c;
          --line: #262626;
          goToCard(deltaX > 0 ? Math.max(0, currentIndex - 1) : Math.min(totalCards - 1, currentIndex + 1));
        .quiz-page {
          min-height: 100dvh;
          {studyCards.map((card, index) => {
            const [definition, memory] = card.prompt.split(/Memory hook:/i);
            return (
              <section className="ows-slide" data-index={index} key={card.id}>
                <article className="ows-card">
                  <div className="ows-word">{card.answer}</div>
                  <div className="ows-pos">{(card.label || "One Word").toUpperCase()}</div>
                  {card.answerTranslation ? <div className="ows-word-bn">{card.answerTranslation}</div> : null}
                  <div className="ows-divider" />
                  <div className="ows-phrase"><RichContent text={definition.trim()} /></div>
                  {card.definitionTranslation ? <div className="ows-bn">{card.definitionTranslation}</div> : null}
                  <div className="ows-hook">
                    <div className="ows-hook-label">Memory Hook</div>
                    <div className="ows-hook-text">{memory?.trim() ? <RichContent text={memory.trim()} /> : "--"}</div>
                  </div>
                </article>
              </section>
            );
          })}
        </div>

        <div className="ows-dots" aria-label={`Card ${currentPage} of ${totalCards}`}>
          {studyCards.map((card, index) => (
          border-radius: 10px;
            key={card.id}
          background: var(--paper);
            className={`ows-dot ${currentIndex === index ? "active" : ""}`}
          cursor: pointer;
          flex: 0 0 auto;
            onClick={() => goToCard(index)}

        .menu-toggle span {
        </div>
      </main>
          width: 100%;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }

        .theme-toggle {
          min-width: 42px;
          height: 34px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          box-shadow: none;
          cursor: pointer;
        }

        .question-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 58px;
          height: 34px;
          padding: 0 12px;
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
          background: var(--paper-raised);
        }

        .quiz-page[data-theme="light"] .theme-toggle {
          background: var(--paper);
        }

        .quiz-page[data-theme="light"] .menu-toggle {
          background: var(--paper-raised);
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
          min-height: calc(100dvh - 67px);
          padding: 34px 48px 34px 22px;
          background: var(--paper);
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          position: relative;
        }

        .progress-dots {
          position: fixed;
          top: 50%;
          left: calc(50% + min(260px, 50vw - 14px));
          z-index: 15;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transform: translateY(-50%);
        }

        .progress-dot {
          width: 5px;
          height: 5px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: var(--ink);
          cursor: pointer;
          opacity: 0.25;
          transition: opacity 0.2s, height 0.2s, background 0.2s;
        }

        .progress-dot.active {
          height: 16px;
          border-radius: 3px;
          background: var(--scarlet);
          opacity: 1;
        }

        .palette-backdrop {
          position: fixed;
          inset: 0;
          z-index: 30;
          border: 0;
          padding: 0;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(2px);
        }

        .question-palette {
          position: fixed;
          top: 0;
          left: 0;
          right: auto;
          bottom: 0;
          z-index: 35;
          width: min(280px, 80vw);
          margin: 0;
          padding: 18px;
          border: 0;
          border-right: 1.5px solid var(--line);
          border-radius: 0;
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
          font-size: 11px;
          line-height: 1.2;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--ink);
        }

        .palette-close {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }

        .question-palette-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .palette-pill {
          aspect-ratio: 1;
          height: auto;
          border-radius: 8px;
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
          color: #ffffff;
        }

        .word-zone {
          width: 100%;
          margin: auto 0 0;
          text-align: center;
          padding: 44px 30px 0;
          background: var(--card);
          border: 1px solid var(--card-line);
          border-bottom: 0;
          border-radius: 14px 14px 0 0;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
        }

        .word {
          font-family: 'Archivo Black', sans-serif;
          font-size: clamp(2rem, 6vw, 2.75rem);
          letter-spacing: 0;
          color: var(--card-ink);
        }

        .pos {
          margin-top: 10px;
          font-size: 11px;
          color: var(--scarlet);
          letter-spacing: 2px;
          font-weight: 700;
        }

        .word-translation {
          margin-top: 10px;
          color: var(--teal);
          font-family: 'Noto Sans Bengali', sans-serif;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.7;
        }

        .content {
          width: 100%;
          padding: 20px 30px 0;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .section-divider {
          width: 36px;
          height: 2px;
          margin: 20px auto 0;
          background: var(--card-line);
          border: 0;
        }

        .section-label {
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          letter-spacing: 3px;
          color: var(--teal);
          font-weight: 700;
          margin: 0;
          text-align: center;
          text-transform: uppercase;
        }

        .def {
          font-size: 14.5px;
          line-height: 1.85;
          color: var(--card-ink);
          text-align: center;
        }

        .bn {
          font-family: 'Noto Sans Bengali', sans-serif;
          margin-top: 12px;
          font-size: 14px;
          line-height: 1.9;
          color: var(--card-ink-dim);
          text-align: center;
        }

        .divider {
          height: 1px;
          background: var(--card-line);
          width: 100%;
        }

        .divider.dotted {
          background: none;
          border-top: 1px dashed var(--card-line);
          margin: 2px 0 0;
        }

        .memory-text {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.8;
          color: var(--card-ink-dim);
          text-align: center;
        }

        .word-nav {
          width: 100%;
          margin: 0;
          padding: 20px 30px 40px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          bottom: auto;
          background: var(--card);
          border: 1px solid var(--card-line);
          border-top: 0;
          border-radius: 0 0 14px 14px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
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
          color: var(--card-ink);
          background: transparent;
          border: 1.5px solid var(--card-ink);
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
          box-shadow: none;
          transition: transform 0.12s, box-shadow 0.12s, background 0.12s, color 0.12s;
        }

        .word-nav button:hover {
          background: var(--scarlet);
          color: #ffffff;
          border-color: var(--scarlet);
        }

        .word-nav button:active {
          transform: translate(3px, 3px);
          box-shadow: none;
        }

        .word-nav .arrow {
          font-size: 13px;
          line-height: 1;
        }

        @media (max-width: 460px) {
          .quiz-page {
            padding-top: calc(67px + env(safe-area-inset-top));
          }

          .desktop-header {
            display: flex;
          }

          .mobile-header {
            display: none;
          }

          .theme-toggle {
            min-width: 42px;
            height: 34px;
            padding: 0 8px;
            flex: 0 0 auto;
            gap: 5px;
            border-radius: 999px;
            background: var(--paper);
            color: var(--ink);
            border-color: var(--line);
            box-shadow: none;
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
            min-height: calc(100dvh - 67px - env(safe-area-inset-top));
            padding: 24px 30px 24px 16px;
          }

          .word-zone {
            padding: 36px 22px 0;
          }

          .word {
            font-size: clamp(2rem, 9.8vw, 2.55rem);
          }

          .pos {
            letter-spacing: 1.4px;
            font-size: 12px;
          }

          .content {
            flex: 0 0 auto;
            padding: 18px 22px 0;
            gap: 5px;
          }

          .section-divider {
            margin: 0;
          }

          .section-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 2px;
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
            font-size: 12.5px;
            line-height: 1.65;
          }

          .word-nav {
            position: relative;
            margin: 0;
            padding: 18px 22px calc(32px + env(safe-area-inset-bottom));
            gap: 10px;
            border-top: 0;
          }

          .word-nav button {
            font-size: 13px;
            font-weight: 600;
            padding: 11px 10px;
            box-shadow: none;
            letter-spacing: 0.5px;
          }

          .word-nav .arrow {
            font-size: 12px;
          }

          .theme-toggle svg {
            width: 14px;
            height: 14px;
          }

          .palette-backdrop {
            inset: 0;
          }

          .question-palette {
            top: 0;
            left: 0;
            right: auto;
            bottom: 0;
            padding: 18px;
            border-radius: 0;
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
            height: auto;
            border-radius: 8px;
          }

          .progress-dots {
            left: auto;
            right: 12px;
          }
        }
      `}</style>
    </main>
  );
}
*/

function splitPrompt(prompt: string) {
  const [definition, memoryHook] = prompt.split(/Memory hook:/i);
  return { definition: definition.trim(), memoryHook: memoryHook?.trim() ?? "" };
}

function MemoryHookContent({ text }: { text: string }) {
  return text.split(/(bibliography)/i).map((part, index) =>
    part.toLowerCase() === "bibliography" ? (
      <span className="ows-memory-highlight" key={`${part}-${index}`}>{part}</span>
    ) : (
      <RichContent key={`${part}-${index}`} text={part} />
    )
  );
}

export default function StudyModeQuizEngine() {
  const [currentPage, setCurrentPage] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [cards, setCards] = useState<SubstitutionCard[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const studyCards = cards.length ? cards : DEMO_CARDS;
  const currentIndex = Math.min(Math.max(currentPage - 1, 0), studyCards.length - 1);

  useEffect(() => {
    let active = true;
    fetchQuestions({ subject: "english", topic: "one-word-substitution", questionType: "study-mode" })
      .then((data) => {
        if (!active) return;
        const mapped = data
          .map((entry, index) => toSubstitutionCard(entry as StudyModeEntry, index))
          .filter(Boolean) as SubstitutionCard[];
        setCards(mapped.length ? [...DEMO_CARDS, ...mapped] : DEMO_CARDS);
      })
      .catch(() => {
        if (active) setCards(DEMO_CARDS);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("study-mode-theme", theme);
    } catch {
      // Ignore storage access issues.
    }
  }, [theme]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setCurrentPage(Number((entry.target as HTMLElement).dataset.index) + 1);
          }
        });
      },
      { root: scroller, threshold: [0.6] }
    );
    scroller.querySelectorAll<HTMLElement>("[data-index]").forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [cards.length]);

  const goToCard = (index: number) => {
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrentPage(index + 1);
    setIsPaletteOpen(false);
  };

  return (
    <main className="ows-page" data-theme={theme}>
      <div className="ows-wrap">
        <header className="ows-header">
          <button
            type="button"
            className="ows-menu-btn"
            aria-label="Open word palette"
            aria-expanded={isPaletteOpen}
            onClick={() => setIsPaletteOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="ows-header-text">
            <div className="ows-header-label">English</div>
            <div className="ows-header-title">One Word Substitution</div>
          </div>
          <div className="ows-header-actions">
            <span className="ows-counter">{currentPage}/{studyCards.length}</span>
            <button
              type="button"
              className="ows-theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
            >
              <span>{theme === "dark" ? "Dark" : "Light"}</span>
              {theme === "dark" ? (
                <Sun aria-hidden="true" />
              ) : (
                <Moon aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <div className="ows-scroller" ref={scrollerRef}>
          {studyCards.map((card, index) => {
            const { definition, memoryHook } = splitPrompt(card.prompt);
            return (
              <section className="ows-slide" data-index={index} key={card.id}>
                <article className="ows-card">
                  <div className="ows-corner-ornament ows-corner-ornament--top" aria-hidden="true" />
                  <div className="ows-book-mark" aria-hidden="true"><BookOpen /></div>
                  <div className="ows-word">{card.answer}</div>
                  <div className="ows-pos">{(card.label || "One Word").toUpperCase()}</div>
                  {card.answerTranslation ? <div className="ows-word-bn">{card.answerTranslation}</div> : null}
                  <div className="ows-divider" aria-hidden="true"><span>❖</span></div>
                  <div className="ows-phrase"><RichContent text={definition} /></div>
                  <div className="ows-mini-divider" aria-hidden="true"><i /><b /><i /></div>
                  {card.definitionTranslation ? <div className="ows-bn">{card.definitionTranslation}</div> : null}
                  <div className="ows-hook">
                    <div className="ows-hook-label">Memory Hook</div>
                    <div className="ows-hook-emblem" aria-hidden="true"><i /><BookOpen className="ows-hook-icon" /><i /></div>
                    <div className="ows-hook-text">{memoryHook ? <MemoryHookContent text={memoryHook} /> : "--"}</div>
                  </div>
                  <div className="ows-corner-ornament ows-corner-ornament--bottom" aria-hidden="true" />
                </article>
              </section>
            );
          })}
        </div>

        <div className="ows-dots" aria-label={`Card ${currentPage} of ${studyCards.length}`}>
          {studyCards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`ows-dot ${currentIndex === index ? "active" : ""}`}
              aria-label={`Go to card ${index + 1}`}
              onClick={() => goToCard(index)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`ows-overlay ${isPaletteOpen ? "open" : ""}`}
        aria-label="Close word palette"
        onClick={() => setIsPaletteOpen(false)}
      />
      <aside className={`ows-drawer ${isPaletteOpen ? "open" : ""}`} aria-label="Word palette">
        <div className="ows-drawer-head">
          <span>Word Palette</span>
          <button type="button" aria-label="Close word palette" onClick={() => setIsPaletteOpen(false)}>×</button>
        </div>
        <div className="ows-palette-grid">
          {studyCards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={currentIndex === index ? "active" : ""}
              onClick={() => goToCard(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </aside>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Archivo+Black&family=Noto+Sans+Bengali:wght@400;600&display=swap');
        .ows-page{--bg:#000;--panel:#0d0d0d;--ink:#f5f5f5;--ink-dim:#8a8a8a;--line:#262626;--card:#1a1712;--card-ink:#f2ead9;--card-ink-dim:#b9ae98;--card-line:rgba(242,234,217,.12);--scarlet:#e2664a;--teal:#6ea89c;--shadow:rgba(0,0,0,.55);width:100%;min-height:100dvh;overflow:hidden;background:var(--bg);font-family:'Space Mono',monospace;-webkit-font-smoothing:antialiased}
        .ows-page[data-theme="light"]{--bg:#f5f1e8;--panel:#fff;--ink:#1a1712;--ink-dim:#8a8072;--line:#e3dcc9;--card:#fffdf8;--card-ink:#1a1712;--card-ink-dim:#6b6255;--card-line:rgba(26,23,18,.12);--scarlet:#c94b34;--teal:#2f7a6c;--shadow:rgba(26,23,18,.14)}
        .ows-page *{box-sizing:border-box}.ows-wrap{max-width:520px;height:100dvh;margin:0 auto;position:relative;display:flex;flex-direction:column}.ows-header{flex-shrink:0;z-index:20;background:var(--panel);display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1.5px solid var(--line)}
        .ows-menu-btn{flex-shrink:0;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;color:var(--ink);cursor:pointer}.ows-menu-btn svg{width:16px;height:16px}.ows-header-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.ows-header-label{font-size:10.5px;letter-spacing:3px;color:var(--ink-dim);text-transform:uppercase}.ows-header-title{font-weight:500;font-size:13px;letter-spacing:.3px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ows-header-actions{flex-shrink:0;display:flex;align-items:center;gap:8px}.ows-counter,.ows-theme-toggle{font-family:'Space Mono',monospace;font-weight:700;background:var(--bg);border:1.5px solid var(--line);border-radius:999px;color:var(--ink)}.ows-counter{font-size:13px;color:var(--ink-dim);padding:8px 14px;white-space:nowrap}.ows-theme-toggle{display:flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 14px;cursor:pointer}.ows-theme-toggle svg{width:14px;height:14px}
        .ows-scroller{flex:1;min-height:0;overflow-y:auto;scroll-snap-type:y mandatory;scrollbar-width:none}.ows-scroller::-webkit-scrollbar{display:none}.ows-slide{height:100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;padding:34px 22px}.ows-card{width:100%;background:var(--card);border:1px solid var(--card-line);border-radius:14px;padding:44px 30px 40px;text-align:center;box-shadow:0 18px 40px var(--shadow)}.ows-word{font-family:'Archivo Black',sans-serif;font-size:32px;color:var(--card-ink);line-height:1.2}.ows-pos{margin-top:10px;font-size:11px;font-weight:700;letter-spacing:2.5px;color:var(--scarlet)}.ows-word-bn{font-family:'Noto Sans Bengali',sans-serif;font-weight:600;font-size:15px;line-height:1.7;color:var(--teal);margin-top:10px}.ows-divider{width:36px;height:2px;background:var(--card-line);margin:20px auto}.ows-phrase{font-size:14.5px;line-height:1.85;color:var(--card-ink);opacity:.82;max-width:400px;margin:0 auto}.ows-bn{font-family:'Noto Sans Bengali',sans-serif;font-weight:600;font-size:14px;line-height:1.9;color:var(--card-ink-dim);margin-top:16px}.ows-hook{margin-top:26px;padding-top:22px;border-top:1px dashed var(--card-line)}.ows-hook-label{font-weight:700;font-size:11px;letter-spacing:3px;color:var(--teal);text-transform:uppercase}.ows-hook-text{margin-top:10px;font-size:13px;line-height:1.8;color:var(--card-ink-dim)}
        .ows-dots{position:absolute;right:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:10}.ows-dot{width:5px;height:5px;padding:0;border:0;border-radius:50%;background:var(--ink);opacity:.25;cursor:pointer;transition:opacity .2s,height .2s,background .2s}.ows-dot.active{opacity:1;background:var(--scarlet);height:16px;border-radius:3px}
        .ows-wrap{max-width:760px}.ows-header{min-height:134px;padding:28px 36px;gap:26px}.ows-menu-btn{width:74px;height:74px;border-radius:18px;background:color-mix(in srgb,var(--panel) 78%,var(--bg));box-shadow:0 3px 10px var(--shadow)}.ows-menu-btn svg{width:31px;height:31px}.ows-header-text{gap:8px}.ows-header-label{font-size:17px;letter-spacing:6px;color:var(--teal);font-weight:700}.ows-header-title{font-size:22px;letter-spacing:0}.ows-header-actions{gap:14px}.ows-counter{min-width:104px;padding:17px 20px;font-size:20px;color:var(--teal)}.ows-theme-toggle{gap:12px;padding:16px 23px;font-size:17px;color:#c58b43}.ows-theme-toggle svg{width:26px;height:26px}.ows-slide{align-items:flex-start;overflow-y:auto;padding:102px 44px 118px}.ows-card{position:relative;min-height:min(1120px,calc(100dvh - 254px));padding:148px 56px 104px;border-radius:32px;overflow:hidden;background:radial-gradient(circle at 50% 32%,color-mix(in srgb,var(--card) 94%,#fff 6%),var(--card));box-shadow:0 22px 42px var(--shadow)}.ows-word{position:relative;z-index:1;font-family:Georgia,'Times New Roman',serif;font-size:clamp(44px,7vw,70px);line-height:1.05;letter-spacing:0}.ows-pos{position:relative;z-index:1;margin-top:25px;font-size:18px;letter-spacing:6px}.ows-word-bn{position:relative;z-index:1;font-size:27px;line-height:1.55;margin-top:24px}.ows-divider{position:relative;z-index:1;width:72px;height:4px;margin:42px auto;background:color-mix(in srgb,var(--teal) 72%,transparent)}.ows-phrase{position:relative;z-index:1;max-width:550px;font-size:24px;line-height:2.05;opacity:.88}.ows-bn{position:relative;z-index:1;font-size:21px;line-height:1.85;margin-top:48px;color:color-mix(in srgb,var(--card-ink) 72%,var(--scarlet))}.ows-hook{position:relative;z-index:1;margin-top:54px;padding-top:48px;border-top:1px dashed color-mix(in srgb,var(--teal) 34%,transparent)}.ows-hook-label{font-size:18px;letter-spacing:7px}.ows-hook-icon{width:54px;height:54px;margin:26px auto 21px;color:#c58b43;stroke-width:1.25}.ows-hook-text{max-width:580px;margin:0 auto;font-size:20px;line-height:1.9}.ows-book-mark{position:absolute;right:34px;top:50px;width:74px;height:74px;border-radius:50%;border:1px solid var(--card-line);display:grid;place-items:center;color:var(--teal);background:color-mix(in srgb,var(--card) 75%,transparent)}.ows-book-mark svg{width:34px;height:34px;stroke-width:1.35}.ows-leaf-spray{position:absolute;top:54px;left:-19px;width:190px;height:225px;transform:rotate(-20deg);opacity:.58}.ows-leaf-spray::before{content:'';position:absolute;left:69px;top:0;width:2px;height:238px;background:color-mix(in srgb,var(--teal) 55%,transparent);transform:rotate(25deg);transform-origin:top}.ows-leaf-spray i{position:absolute;width:49px;height:20px;border-radius:100% 0 100% 0;background:color-mix(in srgb,var(--teal) 50%,transparent);transform:rotate(18deg)}.ows-leaf-spray i:nth-child(1){left:66px;top:27px}.ows-leaf-spray i:nth-child(2){left:25px;top:74px;transform:rotate(151deg)}.ows-leaf-spray i:nth-child(3){left:81px;top:100px}.ows-leaf-spray i:nth-child(4){left:14px;top:137px;transform:rotate(151deg)}.ows-leaf-spray i:nth-child(5){left:67px;top:170px}.ows-shelf{position:absolute;right:0;bottom:26px;left:0;height:120px;border-bottom:13px solid #bd7c3e;background:linear-gradient(180deg,transparent 90%,color-mix(in srgb,#bd7c3e 55%,transparent) 90%)}.ows-shelf i{position:absolute;bottom:12px;width:37px;border-radius:5px 5px 0 0;border:1px solid color-mix(in srgb,#d9b16d 60%,transparent);background:linear-gradient(90deg,#315d52,#183b34 70%,#467262);box-shadow:inset -7px 0 rgba(0,0,0,.18)}.ows-shelf i:nth-child(1){right:112px;height:84px}.ows-shelf i:nth-child(2){right:74px;height:101px;background:linear-gradient(90deg,#cd6334,#8d331d 70%,#e68342)}.ows-shelf i:nth-child(3){right:36px;height:122px;background:linear-gradient(90deg,#8c4b20,#4d2614 70%,#bd6e2d)}.ows-shelf i:nth-child(4){right:0;height:148px;background:linear-gradient(90deg,#8c4b20,#4d2614 70%,#bd6e2d)}.ows-page[data-theme="light"] .ows-card{background:radial-gradient(circle at 50% 29%,#fffefb,var(--card))}.ows-page[data-theme="light"] .ows-shelf{opacity:.78}.ows-page[data-theme="light"] .ows-leaf-spray{opacity:.43}.ows-page[data-theme="light"] .ows-theme-toggle{color:#9d6530}.ows-page[data-theme="light"] .ows-menu-btn{box-shadow:0 3px 10px rgba(70,50,20,.08)}
        @media (max-width:600px){.ows-header{min-height:0;padding:18px 20px;gap:15px}.ows-menu-btn{width:54px;height:54px;border-radius:14px}.ows-menu-btn svg{width:25px;height:25px}.ows-header-label{font-size:13px;letter-spacing:4px}.ows-header-title{font-size:17px}.ows-header-actions{gap:8px}.ows-counter{min-width:72px;padding:11px 12px;font-size:15px}.ows-theme-toggle{padding:11px 13px;font-size:13px;gap:7px}.ows-theme-toggle svg{width:20px;height:20px}.ows-slide{padding:72px 24px 90px}.ows-card{min-height:calc(100dvh - 242px);padding:112px 27px 84px;border-radius:27px}.ows-word{font-size:clamp(39px,10vw,57px)}.ows-pos{font-size:14px;letter-spacing:4px;margin-top:19px}.ows-word-bn{font-size:21px;margin-top:17px}.ows-divider{margin:34px auto;width:60px}.ows-phrase{font-size:18px;line-height:1.9}.ows-bn{margin-top:36px;font-size:17px}.ows-hook{margin-top:42px;padding-top:38px}.ows-hook-label{font-size:15px;letter-spacing:5px}.ows-hook-icon{width:45px;height:45px;margin:20px auto 18px}.ows-hook-text{font-size:16px}.ows-book-mark{top:38px;right:24px;width:60px;height:60px}.ows-book-mark svg{width:29px;height:29px}.ows-leaf-spray{transform:scale(.78) rotate(-20deg);transform-origin:top left}.ows-shelf{height:94px}.ows-shelf i:nth-child(1){right:88px;height:61px;width:29px}.ows-shelf i:nth-child(2){right:58px;height:75px;width:29px}.ows-shelf i:nth-child(3){right:28px;height:92px;width:29px}.ows-shelf i:nth-child(4){height:108px;width:29px}.ows-dots{display:none}}
        .ows-overlay{position:fixed;inset:0;border:0;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .2s;z-index:30}.ows-overlay.open{opacity:1;pointer-events:auto}.ows-drawer{position:fixed;top:0;left:0;bottom:0;width:280px;max-width:80%;background:var(--panel);border-right:1.5px solid var(--line);transform:translateX(-100%);transition:transform .25s ease;z-index:31;display:flex;flex-direction:column}.ows-drawer.open{transform:translateX(0)}.ows-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 14px;border-bottom:1.5px solid var(--line);font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--ink-dim)}.ows-drawer-head button{width:30px;height:30px;background:var(--bg);border:1.5px solid var(--line);border-radius:8px;color:var(--ink);font-size:20px;cursor:pointer}.ows-palette-grid{padding:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;overflow-y:auto}.ows-palette-grid button{aspect-ratio:1;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;color:var(--ink-dim);background:var(--bg);border:1.5px solid var(--line);border-radius:8px;cursor:pointer}.ows-palette-grid button.active{background:var(--scarlet);border-color:var(--scarlet);color:#fff}
        @media (max-width:600px){.ows-wrap{min-height:100dvh;height:100dvh}.ows-header{padding:calc(10px + env(safe-area-inset-top)) 14px 10px;gap:10px}.ows-menu-btn{width:44px;height:44px;border-radius:12px}.ows-menu-btn svg{width:21px;height:21px}.ows-header-text{gap:2px}.ows-header-label{font-size:10px;letter-spacing:2.5px}.ows-header-title{font-size:13px}.ows-header-actions{gap:6px}.ows-counter{min-width:0;padding:8px 9px;font-size:12px}.ows-theme-toggle{width:44px;height:38px;justify-content:center;padding:0}.ows-theme-toggle span{display:none}.ows-theme-toggle svg{width:18px;height:18px}.ows-slide{align-items:flex-start;padding:18px 14px calc(24px + env(safe-area-inset-bottom));overflow-y:auto}.ows-card{min-height:0;padding:74px 20px 56px;border-radius:20px}.ows-word{font-size:clamp(32px,9.5vw,46px);overflow-wrap:anywhere}.ows-pos{margin-top:14px;font-size:11px;letter-spacing:3px}.ows-word-bn{margin-top:12px;font-size:17px;line-height:1.5}.ows-divider{width:48px;height:3px;margin:25px auto}.ows-phrase{font-size:15px;line-height:1.75}.ows-bn{margin-top:22px;font-size:15px;line-height:1.7}.ows-hook{margin-top:28px;padding-top:27px}.ows-hook-label{font-size:11px;letter-spacing:3px}.ows-hook-icon{width:31px;height:31px;margin:15px auto 12px}.ows-hook-text{font-size:13px;line-height:1.65}.ows-book-mark{top:21px;right:17px;width:43px;height:43px}.ows-book-mark svg{width:21px;height:21px}.ows-leaf-spray{transform:scale(.55) rotate(-20deg);transform-origin:top left}.ows-shelf{height:60px}.ows-shelf i:nth-child(1){right:59px;height:39px;width:19px}.ows-shelf i:nth-child(2){right:39px;height:48px;width:19px}.ows-shelf i:nth-child(3){right:19px;height:58px;width:19px}.ows-shelf i:nth-child(4){height:68px;width:19px}.ows-drawer{width:min(280px,86vw)}}
        @media (max-width:400px){.ows-header{padding-left:10px;padding-right:10px}.ows-header-title{font-size:12px}.ows-slide{padding-left:10px;padding-right:10px}.ows-card{padding:67px 16px 48px}.ows-word{font-size:clamp(29px,9vw,38px)}.ows-phrase{font-size:14px}.ows-hook-text{font-size:12.5px}}
      `}</style>
      <style>{`
        .ows-page {
          --emerald-deep: #071c18;
          --emerald-mid: #0d2a24;
          --emerald-card: #0f2d26;
          --cream: #f6efe3;
          --gold: #c79a55;
          --teal: #6ea89c;
          --copper: #c86a45;
          background:
            radial-gradient(circle at 48% 13%, rgba(54, 111, 93, .2), transparent 31%),
            radial-gradient(circle at 100% 75%, rgba(15, 72, 61, .22), transparent 36%),
            linear-gradient(155deg, var(--emerald-deep), var(--emerald-mid)) !important;
          color: var(--cream) !important;
          isolation: isolate;
        }
        .ows-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: .025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E");
        }
        .ows-wrap { max-width: 760px !important; }
        .ows-header {
          min-height: 114px !important;
          padding: 26px 36px !important;
          gap: 26px !important;
          background: transparent !important;
          border-bottom-color: rgba(246, 239, 227, .15) !important;
        }
        .ows-menu-btn {
          width: 62px !important;
          height: 62px !important;
          border-radius: 18px !important;
          color: var(--cream) !important;
          background: rgba(7, 28, 24, .42) !important;
          border-color: rgba(110, 168, 156, .25) !important;
          box-shadow: inset 0 1px rgba(255,255,255,.04), 0 12px 28px rgba(0,0,0,.2) !important;
        }
        .ows-menu-btn svg { width: 27px !important; height: 27px !important; }
        .ows-header-label { color: var(--teal) !important; font-size: 16px !important; letter-spacing: 6px !important; }
        .ows-header-title { color: var(--cream) !important; font-size: 22px !important; font-family: Georgia, 'Times New Roman', serif !important; }
        .ows-header-actions { gap: 18px !important; }
        .ows-counter {
          min-width: 88px !important;
          padding: 14px 17px !important;
          color: var(--teal) !important;
          background: rgba(7, 28, 24, .34) !important;
          border-color: rgba(110, 168, 156, .22) !important;
        }
        .ows-theme-toggle {
          width: 54px !important;
          height: 44px !important;
          padding: 0 !important;
          justify-content: center !important;
          color: var(--gold) !important;
          background: transparent !important;
          border: 0 !important;
          border-left: 1px solid rgba(246, 239, 227, .16) !important;
          border-radius: 0 !important;
        }
        .ows-theme-toggle span { display: none !important; }
        .ows-theme-toggle svg { width: 27px !important; height: 27px !important; }
        .ows-scroller { background: transparent !important; }
        .ows-slide { padding: 42px 36px 76px !important; align-items: flex-start !important; }
        .ows-card {
          min-height: min(1120px, calc(100dvh - 196px)) !important;
          padding: 142px 60px 110px !important;
          overflow: hidden !important;
          border-radius: 28px !important;
          background: linear-gradient(145deg, rgba(19, 58, 50, .88), rgba(8, 38, 32, .92)) !important;
          border-color: rgba(246, 239, 227, .15) !important;
          box-shadow: inset 0 1px rgba(255,255,255,.07), 0 28px 65px rgba(0,0,0,.35) !important;
          backdrop-filter: blur(18px) saturate(120%);
        }
        .ows-card::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 50% 25%, rgba(110,168,156,.09), transparent 28%);
        }
        .ows-word { color: var(--cream) !important; font-size: clamp(52px, 8vw, 76px) !important; text-shadow: 0 5px 15px rgba(0,0,0,.28); }
        .ows-pos { color: var(--copper) !important; }
        .ows-word-bn { color: var(--teal) !important; }
        .ows-divider { width: min(270px, 68%) !important; height: 24px !important; margin: 35px auto !important; display: flex !important; align-items: center !important; justify-content: center !important; background: none !important; }
        .ows-divider::before, .ows-divider::after { content: ""; height: 1px; flex: 1; background: var(--gold); opacity: .78; }
        .ows-divider span { padding: 0 13px; color: var(--gold); font-family: Georgia, serif; font-size: 24px; line-height: 1; }
        .ows-phrase { color: #f7f7f7 !important; font-family: 'Space Mono', monospace !important; font-size: 21px !important; line-height: 1.95 !important; opacity: .94 !important; }
        .ows-mini-divider { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 32px auto 0; }
        .ows-mini-divider i { display: block; width: 38px; height: 1px; background: var(--teal); opacity: .65; }
        .ows-mini-divider b { display: block; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); }
        .ows-bn { color: #d3a35d !important; font-size: 20px !important; line-height: 1.85 !important; margin-top: 30px !important; }
        .ows-hook { border-top-color: rgba(110,168,156,.42) !important; margin-top: 47px !important; padding-top: 40px !important; }
        .ows-hook-label { color: var(--teal) !important; }
        .ows-hook-emblem { display: flex; align-items: center; justify-content: center; gap: 15px; margin: 22px auto 16px; color: var(--gold); }
        .ows-hook-emblem i { width: 20px; height: 1px; background: currentColor; position: relative; opacity: .82; }
        .ows-hook-emblem i::after { content: ""; position: absolute; width: 1px; height: 12px; top: -6px; background: currentColor; }
        .ows-hook-emblem i:first-child::after { right: 4px; transform: rotate(-55deg); }
        .ows-hook-emblem i:last-child::after { left: 4px; transform: rotate(55deg); }
        .ows-hook-icon { color: var(--gold) !important; margin: 0 !important; }
        .ows-hook-text { color: var(--cream) !important; font-family: 'Space Mono', monospace !important; font-size: 18px !important; line-height: 1.8 !important; }
        .ows-memory-highlight { color: var(--teal); }
        .ows-hook-text :global(strong), .ows-hook-text :global(em) { color: var(--teal) !important; }
        .ows-book-mark { color: var(--gold) !important; border-color: rgba(110,168,156,.28) !important; background: rgba(3,28,23,.36) !important; }
        .ows-corner-ornament {
          position: absolute;
          z-index: 0;
          width: 178px;
          height: 178px;
          opacity: .65;
          pointer-events: none;
          color: var(--gold);
          background:
            radial-gradient(circle at 28px 28px, currentColor 0 2px, transparent 2.5px),
            radial-gradient(circle at 49px 49px, currentColor 0 1.5px, transparent 2px),
            linear-gradient(currentColor, currentColor) 17px 17px / 96px 1px no-repeat,
            linear-gradient(currentColor, currentColor) 17px 17px / 1px 96px no-repeat;
        }
        .ows-corner-ornament::before,
        .ows-corner-ornament::after {
          content: "";
          position: absolute;
          border-color: currentColor;
          opacity: .68;
        }
        .ows-corner-ornament::before {
          top: 35px;
          left: 35px;
          width: 83px;
          height: 83px;
          border-top: 1px solid;
          border-left: 1px solid;
          border-radius: 22px 0 0;
        }
        .ows-corner-ornament::after {
          top: 58px;
          left: 58px;
          width: 30px;
          height: 30px;
          border: 1px solid;
          transform: rotate(45deg);
          box-shadow: 0 0 0 7px rgba(199,154,85,.07);
        }
        .ows-corner-ornament--top { top: 27px; left: 22px; }
        .ows-corner-ornament--bottom { right: 22px; bottom: 19px; transform: rotate(180deg); opacity: .43; }
        .ows-page[data-theme="light"] {
          --cream: #19362e;
          --gold: #a97436;
          --teal: #397c70;
          --copper: #a95339;
          background: radial-gradient(circle at 48% 10%, rgba(154,194,180,.4), transparent 31%), linear-gradient(155deg, #eaf0e8, #d9e5dd) !important;
        }
        .ows-page[data-theme="light"] .ows-header { border-bottom-color: rgba(25,54,46,.15) !important; }
        .ows-page[data-theme="light"] .ows-menu-btn,
        .ows-page[data-theme="light"] .ows-counter { background: rgba(255,255,255,.38) !important; border-color: rgba(25,54,46,.18) !important; }
        .ows-page[data-theme="light"] .ows-card { background: linear-gradient(145deg, rgba(250,252,247,.88), rgba(226,238,229,.9)) !important; border-color: rgba(25,54,46,.16) !important; box-shadow: inset 0 1px rgba(255,255,255,.85), 0 28px 65px rgba(37,73,62,.16) !important; }
        .ows-page[data-theme="light"] .ows-card::after { background: radial-gradient(circle at 50% 25%, rgba(92,148,132,.13), transparent 31%); }
        .ows-page[data-theme="light"] .ows-word,
        .ows-page[data-theme="light"] .ows-phrase,
        .ows-page[data-theme="light"] .ows-hook-text,
        .ows-page[data-theme="light"] .ows-header-title { color: #19362e !important; text-shadow: none !important; }
        .ows-page[data-theme="light"] .ows-bn { color: #9a6430 !important; }
        .ows-page[data-theme="light"] .ows-book-mark { background: rgba(255,255,255,.28) !important; border-color: rgba(25,54,46,.17) !important; }
        .ows-page[data-theme="light"] .ows-corner-ornament { opacity: .5; }
        .ows-drawer { background: #0b2520 !important; border-color: rgba(246,239,227,.14) !important; }
        .ows-drawer-head, .ows-palette-grid button { color: var(--cream) !important; border-color: rgba(246,239,227,.14) !important; }
        .ows-drawer-head button, .ows-palette-grid button { background: rgba(7,28,24,.6) !important; }
        .ows-palette-grid button.active { background: var(--copper) !important; border-color: var(--copper) !important; }
        .ows-dot.active { background: var(--gold) !important; }
        @media (max-width: 600px) {
          .ows-header { min-height: 96px !important; padding: calc(18px + env(safe-area-inset-top)) 20px 16px !important; gap: 14px !important; }
          .ows-menu-btn { width: 52px !important; height: 52px !important; border-radius: 16px !important; }
          .ows-header-label { font-size: 11px !important; letter-spacing: 4px !important; }
          .ows-header-title { font-size: 16px !important; }
          .ows-counter { min-width: 65px !important; padding: 10px 9px !important; font-size: 13px !important; }
          .ows-theme-toggle { width: 39px !important; height: 38px !important; }
          .ows-theme-toggle svg { width: 21px !important; height: 21px !important; }
          .ows-slide { padding: 25px 18px calc(38px + env(safe-area-inset-bottom)) !important; }
          .ows-card { min-height: calc(100dvh - 160px) !important; padding: 105px 23px 72px !important; border-radius: 27px !important; }
          .ows-word { font-size: clamp(43px, 11.4vw, 58px) !important; }
          .ows-pos { margin-top: 18px !important; font-size: 12px !important; letter-spacing: 4px !important; }
          .ows-word-bn { font-size: 19px !important; margin-top: 15px !important; }
          .ows-divider { margin: 27px auto !important; }
          .ows-phrase { font-size: 16px !important; line-height: 1.9 !important; }
          .ows-bn { margin-top: 23px !important; font-size: 16px !important; }
          .ows-hook { margin-top: 36px !important; padding-top: 31px !important; }
          .ows-hook-label { font-size: 12px !important; letter-spacing: 4px !important; }
          .ows-hook-text { font-size: 13px !important; line-height: 1.75 !important; }
          .ows-corner-ornament { transform: scale(.64); transform-origin: top left; }
          .ows-corner-ornament--bottom { transform: rotate(180deg) scale(.64); transform-origin: bottom right; }
        }
      `}</style>
    </main>
  );
}
