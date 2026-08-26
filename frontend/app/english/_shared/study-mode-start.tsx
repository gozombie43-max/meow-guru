"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Layers,
  Globe,
  BookOpen,
  AlignLeft,
  Clock,
  LayoutGrid,
  CheckSquare,
} from "lucide-react";
import { useThemeMode } from "@/hooks/useTheme";
import { fetchQuestions } from "@/lib/api/questions";

export interface StudyModeStartProps {
  title: string;
  slug: string;
  subtitle?: string;
  quizHref?: string;
  backHref?: string;
}

export default function StudyModeStartView({
  title,
  slug,
  subtitle = "Bilingual study deck with Bengali translations and usage definitions.",
  quizHref,
  backHref,
}: StudyModeStartProps) {
  const router = useRouter();
  const { theme } = useThemeMode();
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [isHoveringLights, setIsHoveringLights] = useState(false);

  const targetQuizHref = quizHref ?? `/english/${slug}/study-mode/quiz`;
  const targetBackHref = backHref ?? `/english/${slug}`;

  useEffect(() => {
    let active = true;
    fetchQuestions({
      subject: "english",
      topic: slug,
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
  }, [slug]);

  // Keyboard shortcut: Press Enter to open suite immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.target === document.body) {
        router.push(targetQuizHref);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, targetQuizHref]);

  const formattedCount = (questionCount ?? 5612).toLocaleString();

  return (
    <div className="study-start-root" data-theme={theme}>
      {/* =======================================================================
          MOBILE VIEW (< 768px)
          ======================================================================= */}
      <div className="study-mobile-container">
        {/* Top Header Position */}
        <header className="study-mobile-header">
          <h1 className="study-mobile-title">{title}</h1>
        </header>

        {/* Center Cards Position */}
        <main className="study-mobile-body">
          {/* Hero Card: Study Deck Ready */}
          <div className="study-mobile-hero-card">
            <div className="study-mobile-hero-icon-box">
              <FileText size={28} color="#ffffff" strokeWidth={2.2} />
            </div>
            <h2 className="study-mobile-hero-heading">Study deck ready</h2>
            <p className="study-mobile-hero-sub">
              Bilingual entries with Bengali translations and usage definitions.
            </p>
          </div>

          {/* Grouped Table Stats Card */}
          <div className="study-mobile-stats-group">
            {/* Row 1: Entries */}
            <div className="study-mobile-stat-row">
              <div className="study-mobile-stat-left">
                <div className="study-stat-badge blue">
                  <Layers size={15} color="#ffffff" strokeWidth={2.2} />
                </div>
                <span className="study-mobile-stat-label">Entries</span>
              </div>
              <span className="study-mobile-stat-val">{formattedCount}</span>
            </div>

            {/* Row 2: Languages */}
            <div className="study-mobile-stat-row">
              <div className="study-mobile-stat-left">
                <div className="study-stat-badge green">
                  <Globe size={15} color="#ffffff" strokeWidth={2.2} />
                </div>
                <span className="study-mobile-stat-label">Languages</span>
              </div>
              <span className="study-mobile-stat-val">EN · BN</span>
            </div>
          </div>
        </main>

        {/* Bottom Button Position */}
        <footer className="study-mobile-footer">
          <button
            type="button"
            className="study-mobile-cta-btn"
            onClick={() => router.push(targetQuizHref)}
          >
            Start Study Mode
          </button>
        </footer>
      </div>

      {/* =======================================================================
          PC / DESKTOP VIEW (>= 768px)
          ======================================================================= */}
      <div className="study-pc-container">
        <div className="study-mac-window">
          {/* Left Sidebar */}
          <aside className="study-mac-sidebar">
            {/* Traffic Lights at Top-Left of Sidebar */}
            <div
              className="study-traffic-lights"
              onMouseEnter={() => setIsHoveringLights(true)}
              onMouseLeave={() => setIsHoveringLights(false)}
            >
              <button
                type="button"
                className="study-light red"
                onClick={() => router.push(targetBackHref)}
                title="Close / Back"
                aria-label="Close"
              >
                {isHoveringLights && <span className="study-light-symbol">×</span>}
              </button>
              <button
                type="button"
                className="study-light yellow"
                onClick={() => router.push(targetBackHref)}
                title="Minimize"
                aria-label="Minimize"
              >
                {isHoveringLights && <span className="study-light-symbol">-</span>}
              </button>
              <button
                type="button"
                className="study-light green"
                onClick={() => router.push(targetQuizHref)}
                title="Start Study Mode"
                aria-label="Start"
              >
                {isHoveringLights && <span className="study-light-symbol">+</span>}
              </button>
            </div>

            {/* Sidebar Navigation Section */}
            <div className="study-sidebar-section-title">STUDY</div>
            <nav className="study-sidebar-nav">
              <Link
                href="/english"
                className="study-nav-item active"
              >
                <BookOpen size={14} strokeWidth={2.2} />
                <span>Vocabulary</span>
              </Link>
              <Link
                href="/english"
                className="study-nav-item"
              >
                <AlignLeft size={14} strokeWidth={2.2} />
                <span>Grammar</span>
              </Link>
              <Link
                href="/reasoning"
                className="study-nav-item"
              >
                <Clock size={14} strokeWidth={2.2} />
                <span>Reasoning</span>
              </Link>
              <Link
                href="/mathematics"
                className="study-nav-item"
              >
                <LayoutGrid size={14} strokeWidth={2.2} />
                <span>Math</span>
              </Link>
              <Link
                href="/mock-test"
                className="study-nav-item"
              >
                <CheckSquare size={14} strokeWidth={2.2} />
                <span>Mock Tests</span>
              </Link>
            </nav>
          </aside>

          {/* Right Main Canvas */}
          <main className="study-mac-main">
            <div className="study-mac-center-content">
              {/* Header Group */}
              <div className="study-mac-header">
                <div className="study-mac-icon-box">
                  <FileText size={28} color="#ffffff" strokeWidth={2.2} />
                </div>
                <div className="study-mac-header-text">
                  <h1 className="study-mac-title">{title}</h1>
                  <p className="study-mac-sub">{subtitle}</p>
                </div>
              </div>

              {/* 2 Stat Cards */}
              <div className="study-mac-stats-grid">
                {/* Card 1: Entries */}
                <div className="study-mac-stat-card">
                  <div className="study-stat-badge blue">
                    <Layers size={15} color="#ffffff" strokeWidth={2.2} />
                  </div>
                  <div className="study-mac-stat-info">
                    <span className="study-mac-stat-num">{formattedCount}</span>
                    <span className="study-mac-stat-lbl">Entries</span>
                  </div>
                </div>

                {/* Card 2: Languages */}
                <div className="study-mac-stat-card">
                  <div className="study-stat-badge green">
                    <Globe size={15} color="#ffffff" strokeWidth={2.2} />
                  </div>
                  <div className="study-mac-stat-info">
                    <span className="study-mac-stat-num">EN · BN</span>
                    <span className="study-mac-stat-lbl">Languages</span>
                  </div>
                </div>
              </div>

              {/* PC CTA Button */}
              <button
                type="button"
                className="study-pc-start-btn"
                onClick={() => router.push(targetQuizHref)}
              >
                Start Study Mode
              </button>
            </div>
          </main>
        </div>
      </div>

      <style jsx>{`
        /* ════════════════════════════════════════════════════
           ROOT THEME & LAYOUT VARIABLES
           ════════════════════════════════════════════════════ */
        .study-start-root {
          --bg-root: #000000;
          --bg-desktop: #0a0a0c;
          --bg-window: #161618;
          --bg-sidebar: #111113;
          --bg-card: #1c1c1e;
          --border-window: rgba(255, 255, 255, 0.08);
          --border-subtle: rgba(255, 255, 255, 0.08);
          --text-primary: #ffffff;
          --text-secondary: rgba(235, 235, 245, 0.6);
          --text-tertiary: rgba(235, 235, 245, 0.38);
          --blue-ios: #007aff;
          --green-ios: #34c759;

          width: 100vw;
          min-height: 100dvh;
          margin: 0;
          padding: 0;
          background: var(--bg-root);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .study-start-root[data-theme="light"] {
          --bg-root: #f2f2f7;
          --bg-desktop: #e5e5ea;
          --bg-window: #ffffff;
          --bg-sidebar: #f8f8fa;
          --bg-card: #ffffff;
          --border-window: rgba(0, 0, 0, 0.08);
          --border-subtle: rgba(0, 0, 0, 0.08);
          --text-primary: #000000;
          --text-secondary: #6e6e73;
          --text-tertiary: #8e8e93;
        }

        /* ════════════════════════════════════════════════════
           MOBILE VIEW (< 768px)
           ════════════════════════════════════════════════════ */
        .study-mobile-container {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          min-height: 100dvh;
          padding: max(16px, var(--safe-top)) 16px max(24px, var(--safe-bottom));
          box-sizing: border-box;
          background: var(--bg-root);
        }

        .study-pc-container {
          display: none;
        }

        @media (min-width: 768px) {
          .study-mobile-container {
            display: none;
          }
          .study-pc-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100vw;
            height: 100dvh;
            background: var(--bg-desktop);
            padding: 24px;
            box-sizing: border-box;
          }
        }

        .study-mobile-header {
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          padding: 8px 0 4px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .study-mobile-title {
          font-size: 1.22rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin: 0;
          text-align: center;
        }

        .study-mobile-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          gap: 16px;
          padding: 16px 0;
        }

        .study-mobile-hero-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 28px 18px 24px;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
        }

        .study-mobile-hero-icon-box {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: var(--blue-ios);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
          box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35);
        }

        .study-mobile-hero-heading {
          font-size: 1.22rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px 0;
          letter-spacing: -0.01em;
        }

        .study-mobile-hero-sub {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0 auto;
          max-width: 270px;
        }

        /* Grouped Table Stats Card */
        .study-mobile-stats-group {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
        }

        .study-mobile-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          position: relative;
        }

        .study-mobile-stat-row:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 54px;
          right: 0;
          bottom: 0;
          height: 0.5px;
          background: var(--border-subtle);
        }

        .study-mobile-stat-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .study-stat-badge {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        }

        .study-stat-badge.blue {
          background: var(--blue-ios);
        }

        .study-stat-badge.green {
          background: var(--green-ios);
        }

        .study-mobile-stat-label {
          font-size: 0.95rem;
          font-weight: 550;
          color: var(--text-primary);
        }

        .study-mobile-stat-val {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .study-mobile-footer {
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          padding-top: 8px;
        }

        .study-mobile-cta-btn {
          width: 100%;
          height: 50px;
          border-radius: 14px;
          background: var(--blue-ios);
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35);
          transition: transform 0.12s ease, filter 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .study-mobile-cta-btn:active {
          transform: scale(0.98);
          filter: brightness(0.95);
        }

        /* ════════════════════════════════════════════════════
           PC / DESKTOP VIEW (>= 768px)
           ════════════════════════════════════════════════════ */
        .study-mac-window {
          width: 100%;
          max-width: 900px;
          height: 520px;
          background: var(--bg-window);
          border-radius: 14px;
          border: 1px solid var(--border-window);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65);
          display: grid;
          grid-template-columns: 190px 1fr;
          overflow: hidden;
        }

        /* Sidebar */
        .study-mac-sidebar {
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-subtle);
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
        }

        .study-traffic-lights {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 24px;
        }

        .study-light {
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

        .study-light.red {
          background: #ff5f56;
          border: 0.5px solid #e0443e;
        }

        .study-light.yellow {
          background: #ffbd2e;
          border: 0.5px solid #dea123;
        }

        .study-light.green {
          background: #27c93f;
          border: 0.5px solid #1aab29;
        }

        .study-light-symbol {
          font-size: 8px;
          font-weight: 800;
          color: rgba(0, 0, 0, 0.7);
          line-height: 1;
        }

        .study-sidebar-section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          padding: 0 8px 8px 8px;
        }

        .study-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .study-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .study-nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .study-nav-item.active {
          background: var(--blue-ios) !important;
          color: #ffffff !important;
          font-weight: 600;
        }

        /* Main Panel */
        .study-mac-main {
          padding: 36px 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .study-mac-center-content {
          max-width: 540px;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .study-mac-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .study-mac-icon-box {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: var(--blue-ios);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35);
        }

        .study-mac-header-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .study-mac-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.15;
        }

        .study-mac-sub {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin: 4px 0 0 0;
        }

        .study-mac-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
          max-width: 460px;
        }

        .study-mac-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        }

        .study-mac-stat-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .study-mac-stat-num {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .study-mac-stat-lbl {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-tertiary);
          margin-top: 1px;
        }

        .study-pc-start-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: var(--blue-ios);
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 650;
          padding: 10px 22px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          width: fit-content;
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.35);
          transition: transform 0.12s ease, filter 0.12s ease;
        }

        .study-pc-start-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .study-pc-start-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
