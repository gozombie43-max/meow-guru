"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { useQuestions } from "@/hooks/useQuestions";
import {
  isFormulaQuestion,
  isMixedQuestion,
  isAiChallengeQuestion,
  isTopicMixQuestion,
  isTier2Question,
} from "@/components/quiz-engine/utils";
import {
  FileQuestion,
  BookOpenCheck,
  Shuffle,
  Zap,
  Compass,
  Flame,
} from "lucide-react";

interface ReasoningTopicPageProps {
  title: string;
  slug: string;
  routeBase?: string;
  eyebrow?: string;
  bannerKicker?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerHref?: string;
  bannerActionLabel?: string;
  bannerAriaLabel?: string;
}

/* ── SVG Icons ───────────────────────────────── */
const IconBanner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const Chevron = ({ size = 7 }: { size?: number }) => (
  <svg width={size} height={size * 1.7} viewBox="0 0 7 12" fill="none" className="sg-chev">
    <path d="M1.5 1.5 6 6l-4.5 4.5"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export default function ReasoningTopicPage({
  title,
  slug,
  routeBase,
  eyebrow = "Reasoning",
  bannerKicker,
  bannerTitle,
  bannerSubtitle,
  bannerHref,
  bannerActionLabel,
  bannerAriaLabel,
}: ReasoningTopicPageProps) {
  const router = useRouter();

  const base = routeBase ?? `/reasoning/${slug}`;

  // Real available questions
  const { questions: topicQuestions } = useQuestions({
    topic: slug,
    subject: "reasoning",
  });

  const modeQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      concept: 0,
      formula: 0,
      mixed: 0,
      "ai-challenge": 0,
      easy: 0,
      hard: 0,
    };

    if (!topicQuestions || !Array.isArray(topicQuestions)) {
      return counts;
    }

    topicQuestions.forEach((q) => {
      if (isFormulaQuestion(q)) {
        counts.formula += 1;
      } else if (isAiChallengeQuestion(q)) {
        counts["ai-challenge"] += 1;
      } else if (isTier2Question(q)) {
        counts.hard += 1;
      } else if (isTopicMixQuestion(q)) {
        counts.easy += 1;
      } else if (isMixedQuestion(q)) {
        counts.mixed += 1;
      } else {
        counts.concept += 1;
      }
    });

    return counts;
  }, [topicQuestions]);

  const modes = [
    {
      title: "PYQ",
      sub: "Previous year Qs",
      href: `${base}/quiz?mode=concept`,
      mode: "concept",
      icon: FileQuestion,
      color: "#0d9488",
      gradient: "linear-gradient(135deg, #e6f7f2 0%, #d4f3eb 100%)",
      gradientDark: "linear-gradient(135deg, rgba(13, 148, 136, 0.2) 0%, rgba(13, 148, 136, 0.08) 100%)",
      border: "rgba(13, 148, 136, 0.22)",
      borderDark: "rgba(13, 148, 136, 0.35)",
      shadow: "0 2px 8px rgba(13, 148, 136, 0.08)",
    },
    {
      title: "CareerWill",
      sub: "Core formulas & patterns",
      href: `${base}/quiz?mode=formula`,
      mode: "formula",
      icon: BookOpenCheck,
      color: "#2563eb",
      gradient: "linear-gradient(135deg, #edf4fe 0%, #dbeafe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(37, 99, 235, 0.08) 100%)",
      border: "rgba(37, 99, 235, 0.22)",
      borderDark: "rgba(37, 99, 235, 0.35)",
      shadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
    },
    {
      title: "PW",
      sub: "Comprehensive mixture",
      href: `${base}/quiz?mode=mixed`,
      mode: "mixed",
      icon: Shuffle,
      color: "#4f46e5",
      gradient: "linear-gradient(135deg, #f1f3fd 0%, #e0e7ff 100%)",
      gradientDark: "linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(79, 70, 229, 0.08) 100%)",
      border: "rgba(79, 70, 229, 0.22)",
      borderDark: "rgba(79, 70, 229, 0.35)",
      shadow: "0 2px 8px rgba(79, 70, 229, 0.08)",
    },
    {
      title: "Selection Way",
      sub: "Speed test",
      href: `${base}/quiz?mode=ai-challenge`,
      mode: "ai-challenge",
      icon: Zap,
      color: "#7c3aed",
      gradient: "linear-gradient(135deg, #f7f2fe 0%, #ede9fe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.08) 100%)",
      border: "rgba(124, 58, 237, 0.22)",
      borderDark: "rgba(124, 58, 237, 0.35)",
      shadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
    },
    {
      title: "Topic Mix",
      sub: "Foundation easy",
      href: `${base}/quiz?mode=easy`,
      mode: "easy",
      icon: Compass,
      color: "#0284c7",
      gradient: "linear-gradient(135deg, #edf9ff 0%, #e0f2fe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(2, 132, 199, 0.08) 100%)",
      border: "rgba(2, 132, 199, 0.22)",
      borderDark: "rgba(2, 132, 199, 0.35)",
      shadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
    },
    {
      title: "Tier 2",
      sub: "Advanced level",
      href: `${base}/quiz?mode=hard`,
      mode: "hard",
      icon: Flame,
      color: "#e11d48",
      gradient: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
      gradientDark: "linear-gradient(135deg, rgba(225, 29, 72, 0.2) 0%, rgba(225, 29, 72, 0.08) 100%)",
      border: "rgba(225, 29, 72, 0.22)",
      borderDark: "rgba(225, 29, 72, 0.35)",
      shadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
    },
  ];

  const headlineText = bannerTitle ?? "Formula & Notes";
  const subtitleText = bannerSubtitle ?? "Shortcuts & revision sheets";
  const notesHref = bannerHref ?? `${base}/formula-notes`;

  return (
    <>
      <style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }

        .sg-page {
          --bg: #000000;
          --card: #1C1C1E;
          --card-2: #232326;
          --sep: rgba(255,255,255,0.11);
          --label: #FFFFFF;
          --label-2: rgba(235,235,245,0.6);
          --label-3: rgba(235,235,245,0.3);

          box-sizing: border-box;
          min-height: calc(100vh - 94px - env(safe-area-inset-bottom, 0px));
          min-height: calc(100dvh - 94px - env(safe-area-inset-bottom, 0px));
          overflow-x: hidden;
          scrollbar-width: none;
          background: #000000;
          color: var(--label);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          padding-top: calc(56px + max(env(safe-area-inset-top, 0px), 0px));
          padding-bottom: 24px;
          transition: background .25s ease, color .25s ease;
        }
        .sg-page::-webkit-scrollbar {
          display: none;
        }

        .sg-navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: max(env(safe-area-inset-top, 0px), 0px) 16px 0;
          background: #000;
        }
        .sg-nav-inline {
          height: 56px;
          display: flex; align-items: center; justify-content: center;
          position: relative;
          margin: 0 -16px; padding: 0 16px;
          border-bottom: 1px solid rgba(255,255,255,0.14);
        }
        .sg-back {
          display: flex; align-items: center; justify-content: center; color: var(--label);
          position: absolute; left: 16px; top: 0; bottom: 0; margin: auto 0;
          width: 40px; height: 40px;
          background: transparent; border: none; padding: 0; cursor: pointer;
          border-radius: 50%;
          -webkit-tap-highlight-color: transparent;
          transform: none !important;
          transition: opacity 0.15s ease, background-color 0.15s ease;
        }
        .sg-back:active {
          animation: none !important;
          transform: none !important;
          opacity: 0.5;
        }
        .sg-back svg { width: 22px; height: 22px; }
        .sg-nav-title {
          font-size: 17px; font-weight: 600; letter-spacing: -0.2px;
          margin: 0; color: var(--label);
        }

        .sg-banner-wrap {
          padding: 16px 16px 16px;
          animation: sg-in .38s cubic-bezier(.22,1,.36,1) both .06s;
        }
        .sg-banner {
          background: var(--card);
          border-radius: 16px;
          padding: 16px 16px;
          min-height: 80px;
          box-sizing: border-box;
          display: flex; align-items: center; gap: 14px;
          margin: 0;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: background .12s, transform .1s;
        }
        .sg-banner:active { background: rgba(255,255,255,0.06); }
        .sg-banner-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(150deg, #38bdf8, #0284c7);
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 1px 0.5px rgba(255,255,255,0.3);
          color: white;
        }
        .sg-banner-icon svg { width: 22px; height: 22px; }
        .sg-banner-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .sg-banner-title {
          font-size: 16px; font-weight: 650; margin: 0 0 2px;
          letter-spacing: -0.3px; color: var(--label);
        }
        .sg-banner-sub {
          font-size: 13px; color: var(--label-2); margin: 0;
          line-height: 1.35; letter-spacing: -0.1px;
        }
        .sg-banner-arr { flex-shrink: 0; color: var(--label-3); display: flex; align-items: center; }

        .sg-section {
          font-size: 13px; font-weight: 600; color: var(--label-2);
          text-transform: uppercase; letter-spacing: 0.3px;
          padding: 0 20px 10px;
          animation: sg-up .34s ease both .1s;
        }

        .sg-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0 16px 16px;
          background: transparent;
          overflow: visible;
          animation: sg-up .38s ease both .14s;
        }

        /* ── CAPSULE PILL CARD ── */
        .sg-card {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px 10px 12px;
          min-height: 62px;
          border-radius: 14px;
          background: #1C1C1E;
          color: #f8fafc;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease, background 0.18s ease;
          cursor: pointer;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }

        .sg-card:hover {
          color: #f8fafc;
          transform: translateY(-1.5px);
          background: #242428;
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .sg-card:active {
          transform: translateY(0);
        }

        .sg-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding-right: 92px;
          z-index: 2;
        }

        .sg-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--card-accent, #007AFF) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
        }

        .sg-badge svg {
          width: 18px;
          height: 18px;
          color: #ffffff !important;
          stroke: #ffffff;
        }

        .sg-card-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }

        .sg-card-name {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
        }

        .sg-card-sub {
          font-size: 12px;
          font-weight: 500;
          color: rgba(235, 235, 245, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }

        /* ── Right White Cutout Tab with Curved Notch ── */
        .sg-card-tab {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 92px;
          height: 100%;
          pointer-events: none;
          z-index: 3;
        }

        .sg-tab-bg-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .sg-tab-bg-svg path {
          fill: #ffffff;
        }

        .sg-tab-action-wrap {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sg-card-qs-text {
          font-size: 13px;
          font-weight: 750;
          color: #007AFF !important;
          letter-spacing: -0.01em;
          white-space: nowrap;
          line-height: 1;
          background: none;
          border: none;
          padding: 0;
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
        }

        .sg-card:hover .sg-card-qs-text {
          transform: scale(1.06);
        }

        /* ════════════════════════════════════
           LIGHT THEME OVERRIDES
           ════════════════════════════════════ */
        body.theme-light .sg-page {
          --bg: #F6F8FA;
          --card: #FFFFFF;
          --card-2: #E6EAEF;
          --sep: #E6EAEF;
          --label: #1d1d1f;
          --label-2: #57606a;
          --label-3: #8c959f;
          background: var(--bg);
        }
        body.theme-light .sg-navbar { background: #F6F8FA; }
        body.theme-light .sg-nav-inline { border-bottom-color: #E6EAEF; }
        body.theme-light .sg-banner {
          background: #FFFFFF;
          border-color: #E6EAEF;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
        }
        body.theme-light .sg-card {
          background: var(--card-gradient, linear-gradient(135deg, #e6f7f2 0%, #d4f3eb 100%));
          border-color: var(--card-border, rgba(0, 0, 0, 0.08));
          color: #0f172a;
          box-shadow: var(--card-shadow, 0 2px 6px rgba(0, 0, 0, 0.04)), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        body.theme-light .sg-card:hover {
          color: #0f172a;
          border-color: var(--card-accent, rgba(0, 113, 227, 0.4));
          box-shadow: var(--card-shadow, 0 4px 12px rgba(0, 0, 0, 0.08)), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        body.theme-light .sg-badge {
          background: var(--card-accent, #007AFF) !important;
          border-color: transparent !important;
          color: #ffffff !important;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        }
        body.theme-light .sg-badge svg {
          color: #ffffff !important;
          stroke: #ffffff;
        }
        body.theme-light .sg-card-name {
          color: #0f172a;
        }
        body.theme-light .sg-card-sub {
          color: #64748b;
        }
        body.theme-light .sg-tab-bg-svg path {
          fill: #ffffff;
        }
        body.theme-light .sg-card-qs-text {
          color: #007AFF !important;
        }

        @media (min-width: 900px) {
          .sg-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
          .sg-desktop-container {
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: 50px;
            max-width: 960px;
            width: 100%;
            margin: 0 auto;
          }
          .sg-left-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .sg-right-pane {
            flex: 1.2;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          .sg-navbar {
            position: relative; padding: 0 0 28px 0; background: transparent;
            z-index: 1;
          }
          .sg-nav-inline {
            border-bottom: none; justify-content: flex-start; height: auto; margin: 0; padding: 0;
            display: flex; align-items: center; gap: 14px;
          }
          .sg-back {
            display: flex;
            position: static;
            margin: 0;
            width: 42px;
            height: 42px;
            background: var(--card);
            border: 0.5px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            color: var(--label);
            transform: none !important;
            transition: background 0.15s ease, opacity 0.15s ease;
          }
          .sg-back:hover {
            background: var(--card-2);
          }
          .sg-back:active {
            animation: none !important;
            transform: scale(0.95) !important;
            opacity: 0.8;
          }
          .sg-nav-title {
            font-size: 2rem; font-weight: 800; letter-spacing: -0.04em;
          }
          
          .sg-banner-wrap { padding: 0; }
          .sg-banner {
            border-radius: 16px;
            border: 0.5px solid rgba(255,255,255,0.07);
            padding: 16px;
            margin: 0;
          }
          .sg-banner-icon {
            width: 42px; height: 42px; border-radius: 12px;
          }
          .sg-banner-icon svg { width: 22px; height: 22px; }
          .sg-banner-title { font-size: 1.05rem; font-weight: 700; }
          .sg-banner-sub { font-size: 0.8rem; margin-top: 2px; }
          .sg-section { padding: 0; margin-bottom: 14px; }
          
          .sg-grid {
            margin: 0;
            gap: 10px;
          }
          
          body.theme-light .sg-navbar { background: transparent; }
          body.theme-light .sg-back {
            background: #ffffff;
            border-color: rgba(0,0,0,0.08);
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          }
          body.theme-light .sg-back:hover {
            background: #f2f2f7;
          }
        }
      `}</style>

      <div className="sg-page page">
        <div className="sg-navbar">
          <div className="sg-nav-inline">
            <button className="sg-back" onClick={() => router.back()} aria-label="Go back">
              <IconBack />
            </button>
            <h1 className="sg-nav-title">{title}</h1>
          </div>
        </div>
        
        <div className="sg-desktop-container">
          
          <div className="sg-left-pane">
            <div className="sg-banner-wrap">
              <Link href={notesHref} className="sg-banner" aria-label={bannerAriaLabel || bannerActionLabel || "Open formula notes"}>
                <div className="sg-banner-icon"><IconBanner /></div>
                <div className="sg-banner-body">
                  <div className="sg-banner-title">{headlineText}</div>
                  <div className="sg-banner-sub">{subtitleText}</div>
                </div>
                <div className="sg-banner-arr"><Chevron size={8} /></div>
              </Link>
            </div>
          </div>

          <div className="sg-right-pane">
            <div className="sg-section">Practice Modes</div>

            <div className="sg-grid">
              {modes.map((m) => {
                const ModeIcon = m.icon;
                const qCount = modeQuestionCounts[m.mode] ?? 0;
                const displayQs = `${qCount} Qs`;
                return (
                  <Link
                    key={m.title}
                    href={m.href}
                    className="sg-card"
                    style={
                      {
                        "--card-gradient": m.gradient,
                        "--card-gradient-dark": m.gradientDark,
                        "--card-border": m.border,
                        "--card-border-dark": m.borderDark,
                        "--card-accent": m.color,
                        "--card-shadow": m.shadow,
                      } as React.CSSProperties
                    }
                  >
                    <div className="sg-card-left">
                      <div className="sg-badge">
                        <ModeIcon size={18} strokeWidth={2.2} />
                      </div>
                      <div className="sg-card-info">
                        <div className="sg-card-name">{m.title}</div>
                        <div className="sg-card-sub">{m.sub}</div>
                      </div>
                    </div>
                    <div className="sg-card-tab" aria-hidden="true">
                      <svg
                        className="sg-tab-bg-svg"
                        viewBox="0 0 88 46"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M28 0 C28 10, 0 13, 0 23 C0 33, 28 36, 28 46 L88 46 L88 0 Z"
                          fill="#ffffff"
                        />
                      </svg>
                      <div className="sg-tab-action-wrap">
                        <span className="sg-card-qs-text">{displayQs}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
