"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchQuestions } from "@/lib/api/questions";

export default function OneWordSubstitutionStudyModePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [isHoveringLights, setIsHoveringLights] = useState(false);

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
      topic: "one-word-substitution",
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

  // Keyboard shortcut: Press Enter or Cmd+Enter to open suite immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Enter") && e.target === document.body) {
        router.push("/english/one-word-substitution/study-mode/quiz");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const countLabel =
    questionCount === null
      ? "Checking indexing..."
      : questionCount === 0
      ? "Ready to study"
      : `${questionCount} vocabulary entries ready`;

  return (
    <main className="apple-fullscreen-app" data-theme={theme}>
      {/* Top Unified Navigation Toolbar */}
      <header className="fullscreen-topbar">
        <div
          className="traffic-lights"
          onMouseEnter={() => setIsHoveringLights(true)}
          onMouseLeave={() => setIsHoveringLights(false)}
        >
          <button
            type="button"
            className="light red"
            onClick={() => router.back()}
            title="Exit to Topic Selection"
            aria-label="Exit"
          >
            {isHoveringLights && <span className="symbol">×</span>}
          </button>
          <button
            type="button"
            className="light yellow"
            onClick={() => router.back()}
            title="Minimize"
            aria-label="Minimize"
          >
            {isHoveringLights && <span className="symbol">-</span>}
          </button>
          <button
            type="button"
            className="light green"
            onClick={() => router.push("/english/one-word-substitution/study-mode/quiz")}
            title="Open Study Suite"
            aria-label="Open study mode"
          >
            {isHoveringLights && <span className="symbol">+</span>}
          </button>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="appearance-pill"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            aria-label="Toggle Appearance"
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
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>

      {/* Centerpiece Minimalist Launcher */}
      <section className="launcher-body">
        <div className="centerpiece-content">
          <div className="apple-dict-emblem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-5.006L20 17" />
              <path d="M6 12h8" />
              <path d="M6 16h8" />
            </svg>
          </div>

          <div className="title-group">
            <span className="subtitle-tag">ENGLISH VOCABULARY SUITE</span>
            <h1 className="hero-title">One Word Substitution</h1>
            <p className="hero-caption">
              Interactive study deck with bilingual Bengali translations &amp; usage definitions.
            </p>
          </div>

          <div className="status-badge">
            <span className="status-dot" />
            <span>{countLabel}</span>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="btn-launch-primary"
              onClick={() => router.push("/english/one-word-substitution/study-mode/quiz")}
            >
              <span>Start Study Mode</span>
              <kbd className="key-hint">↵</kbd>
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        /* ════════════════════════════════════════════════════
           FULL SCREEN MINIMALIST APPLE DESIGN (BOTH PC & MOBILE)
           ════════════════════════════════════════════════════ */
        .apple-fullscreen-app {
          --app-bg: radial-gradient(circle at 50% 35%, rgba(0, 122, 255, 0.12) 0%, transparent 65%), #09090b;
          --topbar-bg: rgba(18, 18, 22, 0.7);
          --border-color: rgba(255, 255, 255, 0.08);
          --text-main: #ffffff;
          --text-sub: #a1a1aa;
          --text-dim: #71717a;
          --pill-bg: rgba(255, 255, 255, 0.08);
          --btn-secondary: rgba(255, 255, 255, 0.06);
          --system-blue: #007aff;
          --system-green: #30db5b;

          width: 100vw;
          height: 100vh;
          max-width: 100vw;
          max-height: 100vh;
          overflow: hidden;
          background: var(--app-bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Roboto, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0;
        }

        .apple-fullscreen-app[data-theme="light"] {
          --app-bg: radial-gradient(circle at 50% 35%, rgba(0, 122, 255, 0.08) 0%, transparent 65%), #f4f4f7;
          --topbar-bg: rgba(240, 240, 245, 0.8);
          --border-color: rgba(0, 0, 0, 0.07);
          --text-main: #18181b;
          --text-sub: #52525b;
          --text-dim: #71717a;
          --pill-bg: rgba(0, 0, 0, 0.05);
          --btn-secondary: rgba(0, 0, 0, 0.05);
        }

        /* Top Bar */
        .fullscreen-topbar {
          height: 54px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 0.5px solid var(--border-color);
          background: var(--topbar-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 50;
          flex-shrink: 0;
        }

        .traffic-lights {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .light {
          width: 14px;
          height: 14px;
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

        .symbol {
          font-size: 9px;
          font-weight: 800;
          color: rgba(0, 0, 0, 0.7);
          line-height: 1;
        }

        .appearance-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          background: var(--pill-bg);
          border: 0.5px solid var(--border-color);
          color: var(--text-main);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s ease, filter 0.15s ease;
        }

        .appearance-pill:active { transform: scale(0.96); }
        .icon-theme { width: 16px; height: 16px; color: var(--text-sub); }

        /* Centerpiece Launcher */
        .launcher-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          overflow: hidden;
        }

        .centerpiece-content {
          max-width: 520px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 28px;
        }

        .apple-dict-emblem {
          width: 76px;
          height: 76px;
          border-radius: 20px;
          background: linear-gradient(180deg, #007aff 0%, #0051b4 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 35px rgba(0, 122, 255, 0.35);
        }

        .apple-dict-emblem svg { width: 42px; height: 42px; }

        .title-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .subtitle-tag {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--system-blue);
        }

        .hero-title {
          font-size: clamp(2.4rem, 6vw, 3.4rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          margin: 0;
          line-height: 1.1;
          color: var(--text-main);
        }

        .hero-caption {
          font-size: clamp(15px, 2vw, 17px);
          line-height: 1.5;
          color: var(--text-sub);
          margin: 0;
          max-width: 440px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 100px;
          background: var(--pill-bg);
          border: 0.5px solid var(--border-color);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-sub);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--system-green);
          box-shadow: 0 0 8px var(--system-green);
        }

        /* Action Controls */
        .action-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 100%;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .btn-launch-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 15px 40px;
          border-radius: 12px;
          background: #007aff;
          color: #ffffff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 10px 28px rgba(0, 122, 255, 0.4);
          transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }

        .btn-launch-primary:hover {
          filter: brightness(1.1);
          box-shadow: 0 14px 34px rgba(0, 122, 255, 0.5);
        }

        .btn-launch-primary:active {
          transform: scale(0.97);
        }

        .key-hint {
          font-size: 13px;
          background: rgba(128, 128, 128, 0.18);
          border: 0.5px solid var(--border-color);
          color: var(--text-main);
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 700;
          line-height: 1;
        }

        /* Responsive spacing for smaller mobile phones */
        @media (max-height: 620px) {
          .centerpiece-content { gap: 16px; }
          .apple-dict-emblem { width: 56px; height: 56px; }
          .hero-title { font-size: 2rem; }
        }
      `}</style>
    </main>
  );
}