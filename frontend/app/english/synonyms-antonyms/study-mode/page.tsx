"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchQuestions } from "@/lib/api/questions";

export default function SynonymsAntonymsStudyModePage() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [questionCount, setQuestionCount] = useState<number | null>(null);

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

  useEffect(() => {
    let active = true;
    fetchQuestions({
      subject: "english",
      topic: "synonyms-antonyms",
      questionType: "study-mode",
      useCache: false,
    })
      .then((data) => {
        if (!active) return;
        setQuestionCount(data.length);
      })
      .catch(() => {
        if (active) setQuestionCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  const countLabel =
    questionCount === null
      ? "Loading questions..."
      : questionCount === 0
      ? "No questions available"
      : `${questionCount} question${questionCount === 1 ? "" : "s"} available`;

  return (
    <main className="start-page" data-theme={theme}>
      <div className="card-shell">
        <div className="perf" />

        <div className="header-bar">
          <span>Vocabulary</span>
          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          >
            <span className="theme-toggle-label">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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

        <div className="center-zone">
          <div className="eyebrow">English</div>
          <div className="quiz-title">
            Antonyms <span className="accent">Synonyms</span>
          </div>

          <div className="bubble-row" aria-hidden="true">
            <div className="bubble" />
            <div className="bubble" />
          </div>

          <div className="available-tag">
            <span className="dot" />
            {countLabel}
          </div>

        </div>

        <div className="start-bar">
          <Link className="start-btn" href="/english/synonyms-antonyms/study-mode/quiz">
            Begin Study Quiz <span className="arrow">▶</span>
          </Link>
        </div>
      </div>

      <style>{`
        .start-page {
          min-height: 100vh;
          position: relative;
          background:
            radial-gradient(circle at top left, rgba(255, 122, 92, 0.12), transparent 28%),
            radial-gradient(circle at 85% 22%, rgba(127, 212, 189, 0.12), transparent 24%),
            linear-gradient(180deg, #181613 0%, #11100e 100%);
          padding: 0;
          color: #f2ead9;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .start-page[data-theme="light"] {
          background:
            radial-gradient(circle at top left, rgba(214, 154, 45, 0.14), transparent 28%),
            radial-gradient(circle at 85% 22%, rgba(47, 75, 70, 0.14), transparent 24%),
            linear-gradient(180deg, #f4efe3 0%, #ece4d3 100%);
          color: #1c1c1c;
        }

        .card-shell {
          width: 100%;
          max-width: 520px;
          min-height: 100vh;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          background: #181613;
          color: #f2ead9;
          overflow-x: hidden;
        }

        .start-page[data-theme="light"] .card-shell {
          background: #f4efe3;
          color: #1c1c1c;
        }

        .perf {
          height: 14px;
          background-image: radial-gradient(circle, #000000 2.5px, transparent 2.6px);
          background-size: 16px 16px;
          background-position: 4px center;
          border-bottom: 1px dashed #4a4234;
        }

        .start-page[data-theme="light"] .perf {
          border-bottom-color: #c9bfa5;
        }

        .header-bar {
          min-height: 56px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-bottom: 1.5px solid #4a4234;
          background: #1f1c18;
          position: relative;
        }

        .theme-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          min-width: 42px;
          height: 34px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          border: 1.5px solid #4a4234;
          background: #1f1c18;
          color: #f2ead9;
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          cursor: pointer;
        }

        .start-page[data-theme="light"] .theme-toggle {
          border-color: #c9bfa5;
          background: #ffffff;
          color: #1c1c1c;
        }

        .start-page[data-theme="light"] .header-bar {
          background: #ffffff;
          border-bottom-color: #c9bfa5;
        }

        .header-bar span {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 4px;
          color: #7fd4bd;
          text-transform: uppercase;
        }

        .center-zone {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 26px 24px 22px;
        }

        .eyebrow {
          font-size: 11px;
          letter-spacing: 3px;
          color: #c9bfa9;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .start-page[data-theme="light"] .header-bar span,
        .start-page[data-theme="light"] .eyebrow,
        .start-page[data-theme="light"] .intro {
          color: #5b5b52;
        }

        .quiz-title {
          font-family: "Archivo Black", sans-serif;
          font-size: 34px;
          line-height: 1.1;
          letter-spacing: 0.5px;
          color: #f2ead9;
          margin-top: 2px;
          margin-bottom: 8px;
        }

        .start-page[data-theme="light"] .quiz-title,
        .start-page[data-theme="light"] .available-tag b,
        .start-page[data-theme="light"] .start-btn {
          color: #1c1c1c;
        }

        .accent {
          color: #ff7a5c;
        }

        .start-page[data-theme="light"] .accent,
        .start-page[data-theme="light"] .available-tag .dot {
          background: #d69a2d;
          border-color: #d69a2d;
        }

        .bubble-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 16px;
        }

        .bubble {
          width: 12px;
          height: 12px;
          border: 1.5px solid #f2ead9;
          border-radius: 50%;
        }

        .start-page[data-theme="light"] .bubble {
          border-color: #1c1c1c;
        }

        .bubble:first-child {
          background: #ff7a5c;
          border-color: #ff7a5c;
        }

        .start-page[data-theme="light"] .bubble:first-child {
          background: #d69a2d;
          border-color: #d69a2d;
        }

        .available-tag {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 18px;
          padding: 5px 12px;
          font-size: 11px;
          letter-spacing: 1px;
          color: #7fd4bd;
          border: 1px dashed #4a4234;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.02);
        }

        .start-page[data-theme="light"] .available-tag {
          border-color: #c9bfa5;
          background: rgba(255, 255, 255, 0.7);
        }

        .available-tag .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7fd4bd;
        }

        .available-tag b {
          color: #f0b649;
          font-weight: 700;
        }

        .intro {
          margin: 18px 0 0;
          max-width: 34ch;
          color: #c9bfa9;
          font-size: 14px;
          line-height: 1.65;
        }

        .start-bar {
          padding: 16px 20px calc(18px + env(safe-area-inset-bottom));
          position: sticky;
          bottom: 0;
          background: #181613;
          border-top: 1.5px dashed #4a4234;
        }

        .start-page[data-theme="light"] .start-bar {
          background: #f4efe3;
          border-top-color: #c9bfa5;
        }

        .start-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: "Space Mono", monospace;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #181613;
          background: #ff7a5c;
          border: 1.5px solid #ff7a5c;
          border-radius: 999px;
          padding: 15px 14px;
          text-decoration: none;
          box-shadow: 4px 4px 0 #f2ead9;
        }

        .start-page[data-theme="light"] .start-btn {
          box-shadow: 4px 4px 0 #1c1c1c;
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

        .start-btn:active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 #f2ead9;
        }

        .arrow {
          font-size: 14px;
        }

        @media (max-width: 460px) {
          .theme-toggle {
            min-width: 72px;
            height: 38px;
            padding: 0 12px;
            gap: 6px;
            border-radius: 999px;
          }

          .theme-toggle-label {
            font-size: 11px;
          }

          .quiz-title {
            font-size: 28px;
          }

          .center-zone {
            padding: 28px 18px;
          }

          .theme-toggle svg {
            width: 16px;
            height: 16px;
          }
        }
      `}</style>
    </main>
  );
}