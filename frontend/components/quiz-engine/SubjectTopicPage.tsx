"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Sparkles,
} from "lucide-react";

export interface SubjectTopicPageProps {
  subject: "mathematics" | "reasoning" | "english" | "general-awareness";
  title: string;
  slug: string;
  questionTopic?: string;
  routeBase?: string;
  backHref?: string;
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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="42"
    height="42"
    style={{ filter: "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.2))" }}
  >
    <path fill="#ffadc8" d="M39,16v25c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h17L39,16z" />
    <path fill="#e72636" d="M28,5v9c0,1.105,0.895,2,2,2h9L28,5z" />
    <path fill="#e72636" d="M16.738,26.99v2.531h-1.655v-7.348h2.592c1.852,0,2.777,0.781,2.777,2.342 c0,0.738-0.265,1.335-0.797,1.791c-0.531,0.456-1.241,0.684-2.129,0.684H16.738z M16.738,23.445v2.29h0.651 c0.882,0,1.322-0.386,1.322-1.159c0-0.754-0.44-1.132-1.322-1.132L16.738,23.445L16.738,23.445z" />
    <path fill="#e72636" d="M21.528,29.521v-7.348h2.603c2.61,0,3.914,1.194,3.914,3.581c0,1.145-0.356,2.058-1.068,2.741 c-0.712,0.684-1.661,1.025-2.846,1.025h-2.603V29.521z M23.183,23.521v4.657h0.82c0.717,0,1.279-0.215,1.688-0.645 c0.408-0.43,0.612-1.016,0.612-1.758c0-0.7-0.202-1.251-0.606-1.652c-0.405-0.402-0.973-0.602-1.704-0.602H23.183z" />
    <path fill="#e72636" d="M33.514,23.521h-2.593v1.803h2.383v1.343h-2.383v2.854h-1.655v-7.348h4.248V23.521z" />
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

const SUBJECT_DEFAULTS = {
  mathematics: {
    eyebrow: "Mathematics",
    formulaSubtitle: "Core formulas & shortcuts",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Comprehensive mixture",
  },
  reasoning: {
    eyebrow: "Reasoning",
    formulaSubtitle: "Core formulas & patterns",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Comprehensive mixture",
  },
  english: {
    eyebrow: "English",
    formulaSubtitle: "Words & vocabulary",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Mixed practice",
  },
  "general-awareness": {
    eyebrow: "General Awareness",
    formulaSubtitle: "Important facts & dates",
    headline: "Facts & Summary Notes",
    notesSubtitle: "Quick revision & key points",
    mixedSubtitle: "Comprehensive mixture",
  },
} as const;

const STUDY_MODE_TOPICS = new Set([
  "synonyms-antonyms",
  "one-word-substitution",
  "idioms-phrases",
  "spelling-misspelled-words",
  "homonyms-homophones",
]);

export default function SubjectTopicPage({
  subject,
  title,
  slug,
  questionTopic,
  routeBase,
  backHref,
  eyebrow,
  bannerKicker,
  bannerTitle,
  bannerSubtitle,
  bannerHref,
  bannerActionLabel,
  bannerAriaLabel,
}: SubjectTopicPageProps) {
  const router = useRouter();
  const defaults = SUBJECT_DEFAULTS[subject];
  const hasStudyMode = subject === "english" && STUDY_MODE_TOPICS.has(slug);

  const base = routeBase ?? `/${subject}/${slug}`;
  const resolvedBackHref =
    backHref ??
    (routeBase && routeBase.includes("/") && routeBase.lastIndexOf("/") > 0
      ? routeBase.substring(0, routeBase.lastIndexOf("/"))
      : `/${subject}`);

  // Real available questions
  const { questions: topicQuestions } = useQuestions({
    topic: questionTopic ?? slug,
    subject,
  });
  const { questions: studyModeQuestions } = useQuestions({
    enabled: hasStudyMode,
    topic: slug,
    subject,
    questionType: "study-mode",
  });

  const modeQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      concept: 0,
      formula: 0,
      mixed: 0,
      "ai-challenge": 0,
      "study-mode": 0,
      easy: 0,
      hard: 0,
    };

    if (topicQuestions) {
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
    }

    if (studyModeQuestions) {
      counts["study-mode"] = studyModeQuestions.length;
    }

    return counts;
  }, [studyModeQuestions, topicQuestions]);

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
      sub: defaults.formulaSubtitle,
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
      sub: defaults.mixedSubtitle,
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
    ...(hasStudyMode
      ? [
          {
            title: "Study Mode",
            sub: "Interactive study deck",
            href: `${base}/study-mode`,
            mode: "study-mode",
            icon: Sparkles,
            color: "#ec4899",
            gradient: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
            gradientDark: "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(236, 72, 153, 0.08) 100%)",
            border: "rgba(236, 72, 153, 0.22)",
            borderDark: "rgba(236, 72, 153, 0.35)",
            shadow: "0 2px 8px rgba(236, 72, 153, 0.08)",
          },
        ]
      : []),
  ];

  const headlineText = bannerTitle ?? defaults.headline;
  const subtitleText = bannerSubtitle ?? defaults.notesSubtitle;
  const notesHref = bannerHref ?? `${base}/formula-notes`;

  return (
    <>
      <style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }

        /* ════════════════════════════════════
           THEME DEFAULTS
           ════════════════════════════════════ */
        .sg-page {
          --bg: #000000;
          --card: #1C1C1E;
          --card-2: #232326;
          --sep: rgba(255,255,255,0.11);
          --label: #FFFFFF;
          --label-2: rgba(235,235,245,0.6);
          --label-3: rgba(235,235,245,0.3);

          box-sizing: border-box;
          min-height: calc(100dvh - var(--app-bottom-nav-height) - var(--safe-bottom));
          overflow-x: hidden;
          scrollbar-width: none;
          background: #000000;
          color: var(--label);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          padding-top: calc(var(--app-header-height) + var(--safe-top));
          padding-bottom: 24px;
          transition: background .25s ease, color .25s ease;
        }
        .sg-page::-webkit-scrollbar {
          display: none;
        }

        /* ── Fixed NavBar ── */
        .sg-navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: var(--safe-top) 16px 0;
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
          max-width: calc(100% - 104px);
          margin: 0; color: var(--label);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── Banner ── */
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
          background: transparent;
          display: flex; align-items: center; justify-content: center;
        }
        .sg-banner-icon svg { width: 42px; height: 42px; }
        .sg-banner-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .sg-banner-kicker {
          margin-bottom: 2px;
          color: var(--label-2);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .sg-banner-title {
          font-size: 16px; font-weight: 650; margin: 0 0 2px;
          letter-spacing: -0.3px; color: var(--label);
        }
        .sg-banner-sub {
          font-size: 13px; color: var(--label-2); margin: 0;
          line-height: 1.35; letter-spacing: -0.1px;
        }
        .sg-banner-arr { flex-shrink: 0; color: var(--label-3); display: flex; align-items: center; }

        /* ── Section label ── */
        .sg-section {
          font-size: 13px; font-weight: 600; color: var(--label-2);
          text-transform: uppercase; letter-spacing: 0.3px;
          padding: 0 20px 10px;
          animation: sg-up .34s ease both .1s;
        }

        /* ── PRACTICE MODES LIST ── */
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
          font-size: 16px; font-weight: 650; margin: 0 0 2px;
          letter-spacing: -0.3px; color: var(--label);
        }
        .sg-banner-sub {
          font-size: 13px; color: var(--label-2); margin: 0;
          line-height: 1.35; letter-spacing: -0.1px;
        }
        .sg-banner-action {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .sg-banner-open-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #000000;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
          padding: 7px 15px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
        }
        .sg-banner:hover .sg-banner-open-btn {
          transform: scale(1.05);
        }
        .sg-banner:active .sg-banner-open-btn {
          transform: scale(0.95);
        }
        body.theme-light .sg-banner-open-btn {
          background: #000000;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }

        /* ── Section label ── */
        .sg-section {
          font-size: 13px; font-weight: 600; color: var(--label-2);
          text-transform: uppercase; letter-spacing: 0.3px;
          padding: 0 20px 10px;
          animation: sg-up .34s ease both .1s;
        }

        /* ── PRACTICE MODES LIST ── */
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

        /* ════════════════════════════════════
           DESKTOP (PC) LAYOUT
           ════════════════════════════════════ */
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
            max-width: none;
            font-size: 2rem; font-weight: 800; letter-spacing: -0.04em;
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
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
          .sg-banner-icon svg { width: 42px; height: 42px; }
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
        <header
          className="sg-navbar"
          aria-label={`${eyebrow ?? defaults.eyebrow}: ${title}`}
        >
          <div className="sg-nav-inline">
            <Link href={resolvedBackHref} className="sg-back" aria-label={`Back to ${eyebrow ?? defaults.eyebrow}`}>
              <IconBack />
            </Link>
            <h1 className="sg-nav-title">{title}</h1>
          </div>
        </header>

        <div className="sg-desktop-container">
          <div className="sg-left-pane">
            {/* BANNER */}
            <div className="sg-banner-wrap">
              <Link href={notesHref} className="sg-banner" aria-label={bannerAriaLabel || bannerActionLabel || "Open formula notes"}>
                <div className="sg-banner-icon"><IconBanner /></div>
                <div className="sg-banner-body">
                  {bannerKicker ? <div className="sg-banner-kicker">{bannerKicker}</div> : null}
                  <div className="sg-banner-title">{headlineText}</div>
                  <div className="sg-banner-sub">{subtitleText}</div>
                </div>
                <div className="sg-banner-action">
                  <span className="sg-banner-open-btn">Open</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="sg-right-pane">
            {/* SECTION LABEL */}
            <div className="sg-section">Practice Modes</div>

            {/* CARD LIST */}
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
