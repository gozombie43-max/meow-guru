"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchQuestions } from "@/lib/api/questions";

export default function SynonymsAntonymsStudyModePage() {
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

  // Keyboard shortcut: Press Enter or Cmd+Enter to open suite
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey || e.key === "Enter") && e.target === document.body) {
        router.push("/english/synonyms-antonyms/study-mode/quiz");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const countLabel =
    questionCount === null
      ? "Initializing Dictionary..."
      : questionCount === 0
      ? "Ready for practice"
      : `${questionCount} entries indexed`;

  return (
    <main className="apple-desktop-viewport" data-theme={theme}>
      {/* ── Authentic macOS Welcome Window ── */}
      <div className="apple-welcome-window">
        
        {/* Left Translucent Sidebar with Embedded Traffic Lights */}
        <aside className="apple-sidebar">
          <div
            className="traffic-lights-bar"
            onMouseEnter={() => setIsHoveringLights(true)}
            onMouseLeave={() => setIsHoveringLights(false)}
          >
            <button
              type="button"
              className="light red"
              onClick={() => router.back()}
              aria-label="Close and return to topic"
              title="Close & return to topic"
            >
              {isHoveringLights && <span className="symbol">×</span>}
            </button>
            <button
              type="button"
              className="light yellow"
              onClick={() => router.back()}
              aria-label="Minimize and return"
              title="Minimize & return"
            >
              {isHoveringLights && <span className="symbol">-</span>}
            </button>
            <button
              type="button"
              className="light green"
              onClick={() => router.push("/english/synonyms-antonyms/study-mode/quiz")}
              aria-label="Launch dictionary"
              title="Expand to study suite"
            >
              {isHoveringLights && <span className="symbol">+</span>}
            </button>
          </div>

          <div className="sidebar-app-brand">
            <div className="apple-dict-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-5.006L20 17" />
                <path d="M6 12h8" />
                <path d="M6 16h8" />
              </svg>
            </div>
            <div className="app-title-group">
              <div className="app-name">Dictionary Suite</div>
              <div className="app-ver">Version 2.4 · macOS Edition</div>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="index-pill">
              <span className="dot-ready" />
              <span className="index-text">{countLabel}</span>
            </div>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <section className="apple-workspace">
          <div className="workspace-topbar">
            <button
              type="button"
              className="appearance-btn"
              onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
              aria-label="Toggle light or dark mode"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="icon-appr">
                  <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-appr">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
              <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
          </div>

          <div className="workspace-hero">
            <h1 className="welcome-heading">Welcome to Synonyms &amp; Antonyms</h1>
            <p className="welcome-subtitle">
              An authentic Apple Dictionary and learning environment designed for precision, speed, and deep vocabulary retention.
            </p>
          </div>

          <div className="apple-preferences-group">
            <div className="pref-row">
              <div className="icon-box system-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </div>
              <div className="row-text">
                <div className="row-label">Master-Detail Navigation Sidebar</div>
                <div className="row-caption">Search and filter words immediately from the dedicated left sidebar column on PC.</div>
              </div>
            </div>

            <div className="pref-row">
              <div className="icon-box system-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              </div>
              <div className="row-text">
                <div className="row-label">Simultaneous Comparison Tables</div>
                <div className="row-caption">View structured Synonyms and Antonyms side-by-side with crisp Apple table hierarchy.</div>
              </div>
            </div>

            <div className="pref-row">
              <div className="icon-box system-purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="row-text">
                <div className="row-label">Dual English &amp; Bengali Meanings</div>
                <div className="row-caption">Standardized definitions paired with regional translation notes and grammar tags.</div>
              </div>
            </div>
          </div>

          <div className="workspace-footer">
            <button
              type="button"
              className="apple-secondary-btn"
              onClick={() => router.back()}
            >
              Cancel
            </button>
            <Link className="apple-primary-btn" href="/english/synonyms-antonyms/study-mode/quiz">
              <span>Launch Dictionary Suite</span>
              <kbd className="shortcut-tag">⌘↵</kbd>
            </Link>
          </div>
        </section>
      </div>

      <style jsx>{`
        /* ════════════════════════════════════════════════════
           AUTHENTIC APPLE DESIGN SYSTEM MATERIALS & TOKENS
           ════════════════════════════════════════════════════ */
        .apple-desktop-viewport {
          --desktop-bg: #000000;
          --sidebar-bg: rgba(30, 30, 35, 0.88);
          --workspace-bg: rgba(24, 24, 28, 0.95);
          --window-border: rgba(255, 255, 255, 0.16);
          --divider: rgba(255, 255, 255, 0.08);
          --text-primary: #ffffff;
          --text-secondary: #98989d;
          --text-muted: #636366;
          --row-bg: rgba(255, 255, 255, 0.04);
          --btn-secondary: rgba(255, 255, 255, 0.1);
          --system-blue: #007aff;
          --system-green: #30db5b;
          --system-purple: #bf5af2;

          min-height: 100vh;
          background: var(--desktop-bg);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .apple-desktop-viewport[data-theme="light"] {
          --desktop-bg: #e5e5eb;
          --sidebar-bg: rgba(230, 230, 235, 0.9);
          --workspace-bg: #ffffff;
          --window-border: rgba(0, 0, 0, 0.16);
          --divider: rgba(0, 0, 0, 0.07);
          --text-primary: #1d1d1f;
          --text-secondary: #6e6e73;
          --text-muted: #86868b;
          --row-bg: rgba(0, 0, 0, 0.03);
          --btn-secondary: rgba(0, 0, 0, 0.06);
          --system-blue: #007aff;
          --system-green: #28cd41;
          --system-purple: #af52de;
        }

        /* ── macOS Welcome Application Window ── */
        .apple-welcome-window {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          border-radius: 14px;
          border: 0.5px solid var(--window-border);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55);
          background: var(--workspace-bg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .apple-desktop-viewport[data-theme="light"] .apple-welcome-window {
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.18);
        }

        /* ── Left Navigation Sidebar (Translucent Material) ── */
        .apple-sidebar {
          background: var(--sidebar-bg);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border-bottom: 0.5px solid var(--divider);
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
        }

        .traffic-lights-bar {
          display: flex;
          align-items: center;
          gap: 8px;
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

        .symbol {
          font-size: 8px;
          font-weight: 800;
          color: rgba(0, 0, 0, 0.7);
          line-height: 1;
        }

        .sidebar-app-brand {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .apple-dict-icon {
          width: 54px;
          height: 54px;
          border-radius: 13px;
          background: linear-gradient(180deg, #007aff 0%, #0051a8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        }

        .apple-dict-icon svg { width: 30px; height: 30px; }

        .app-title-group { display: flex; flex-direction: column; gap: 2px; }
        .app-name { font-size: 18px; font-weight: 700; color: var(--text-primary); }
        .app-ver { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

        .sidebar-footer { display: flex; align-items: center; }
        .index-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 100px;
          background: rgba(0, 0, 0, 0.15);
          border: 0.5px solid var(--divider);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .apple-desktop-viewport[data-theme="light"] .index-pill {
          background: rgba(0, 0, 0, 0.04);
        }

        .dot-ready {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--system-green);
        }

        /* ── Right Workspace Panel ── */
        .apple-workspace {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
        }

        .workspace-topbar {
          display: flex;
          justify-content: flex-end;
        }

        .appearance-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 6px;
          border: 0.5px solid var(--divider);
          background: var(--btn-secondary);
          color: var(--text-primary);
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
        }

        .icon-appr { width: 15px; height: 15px; color: var(--text-secondary); }

        .workspace-hero {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .welcome-heading {
          font-size: clamp(1.6rem, 3vw, 2.1rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          color: var(--text-primary);
        }

        .welcome-subtitle {
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-secondary);
          margin: 0;
          max-width: 480px;
        }

        /* Apple System Settings Rows */
        .apple-preferences-group {
          background: var(--row-bg);
          border: 0.5px solid var(--divider);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .pref-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
          transition: background 0.15s ease;
        }

        .pref-row:not(:last-child) {
          border-bottom: 0.5px solid var(--divider);
        }

        .icon-box {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .system-blue { background: var(--system-blue); }
        .system-green { background: var(--system-green); }
        .system-purple { background: var(--system-purple); }

        .icon-box svg { width: 18px; height: 18px; }

        .row-text { display: flex; flex-direction: column; gap: 3px; }
        .row-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .row-caption { font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; }

        /* Footer Action Buttons */
        .workspace-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          border-top: 0.5px solid var(--divider);
          padding-top: 18px;
        }

        .apple-secondary-btn {
          padding: 6px 16px;
          border-radius: 6px;
          border: 0.5px solid var(--divider);
          background: var(--btn-secondary);
          color: var(--text-primary);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .apple-primary-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 18px;
          border-radius: 6px;
          background: var(--system-blue);
          color: #ffffff;
          font-size: 13.5px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .apple-primary-btn:hover { filter: brightness(1.08); }
        .apple-primary-btn:active { transform: scale(0.98); }

        .shortcut-tag {
          font-size: 11.5px;
          background: rgba(255, 255, 255, 0.2);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
        }

        /* ════════════════════════════════════════════════════
           PC DESKTOP ZERO-SCROLL WELCOME WINDOW (min-width: 900px)
           ════════════════════════════════════════════════════ */
        @media (min-width: 900px) {
          .apple-desktop-viewport {
            height: 100vh;
            max-height: 100vh;
            overflow: hidden;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .apple-welcome-window {
            max-width: 780px;
            width: calc(100vw - 60px);
            height: 480px;
            max-height: calc(100vh - 60px);
            flex-direction: row;
            margin: auto;
          }

          .apple-sidebar {
            width: 260px;
            border-bottom: none;
            border-right: 0.5px solid var(--divider);
            padding: 16px 20px 20px;
          }

          .apple-workspace {
            padding: 24px 28px;
            overflow: hidden;
          }
        }
      `}</style>
    </main>
  );
}