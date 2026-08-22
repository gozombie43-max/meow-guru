"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface GeneralAwarenessTopicPageProps {
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
const IconPYQ = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/><rect x="9" y="1" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
  </svg>
);
const IconPatternBank = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
  </svg>
);
const IconPW = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L4.5 14h5.5L11 22l8.5-12H14l-1-8z"/>
  </svg>
);
const IconSelection = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.6 6.8L21 11l-6.4 2.2L12 20l-2.6-6.8L3 11l6.4-2.2z"/>
  </svg>
);
const IconTopicMix = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>
  </svg>
);
const IconTier2 = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C9 6 7 9.5 7 13a5 5 0 0 0 10 0c0-3.5-2-7-5-11z"/>
  </svg>
);

const IconBanner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

/* Chevron — colour driven by CSS var so theme can override */
const Chevron = ({ size = 7 }: { size?: number }) => (
  <svg width={size} height={size * 1.7} viewBox="0 0 7 12" fill="none" className="sg-chev">
    <path d="M1.5 1.5 6 6l-4.5 4.5"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* Back icon */
const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

/* iOS badge classes */
const badgeClasses = [
  "bg-blue",
  "bg-purple",
  "bg-mustard",
  "bg-scarlet",
  "bg-teal",
  "bg-orange",
];

export default function GeneralAwarenessTopicPage({
  title,
  slug,
  routeBase,
  eyebrow = "General Awareness",
  bannerKicker,
  bannerTitle,
  bannerSubtitle,
  bannerHref,
  bannerActionLabel,
  bannerAriaLabel,
}: GeneralAwarenessTopicPageProps) {
  const router = useRouter();

  const base = routeBase ?? `/general-awareness/${slug}`;

  const modes = [
    { title: "PYQ Practice", sub: "Previous year Qs",       href: `${base}/quiz?mode=concept`,      Icon: IconPYQ         },
    { title: "Fact Bank",    sub: "Important facts & dates", href: `${base}/quiz?mode=formula`,      Icon: IconPatternBank },
    { title: "Mixed PW",     sub: "Mixed practice",          href: `${base}/quiz?mode=mixed`,        Icon: IconPW          },
    { title: "AI Challenge", sub: "Speed test",              href: `${base}/quiz?mode=ai-challenge`, Icon: IconSelection   },
    { title: "Topic Mix",    sub: "Foundation easy",         href: `${base}/quiz?mode=easy`,         Icon: IconTopicMix    },
    { title: "Tier 2 Hard",  sub: "Advanced level",          href: `${base}/quiz?mode=hard`,         Icon: IconTier2       },
  ];

  const kickerText = bannerKicker ?? "Sprint 2026";
  const headlineText = bannerTitle ?? "Facts & Summary Notes";
  const subtitleText = bannerSubtitle ?? "Quick revision & key points";
  const notesHref = bannerHref ?? `${base}/formula-notes`;

  return (
    <>
      <style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }

        /* ════════════════════════════════════
           DARK THEME (Mobile & Desktop Defaults)
           ════════════════════════════════════ */
        .sg-page {
          --bg: #000000;
          --card: #1C1C1E;
          --card-2: #232326;
          --sep: rgba(255,255,255,0.11);
          --label: #FFFFFF;
          --label-2: rgba(235,235,245,0.6);
          --label-3: rgba(235,235,245,0.3);
          --tint: #2E8F82;
          --scarlet: #FF5B4D;
          --mustard: #F0A82E;
          --blue: #0A84FF;
          --purple: #BF5AF2;
          --green: #30D158;
          --orange: #FF9F0A;

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
          padding-bottom: 0;
          transition: background .25s ease, color .25s ease;
        }
        .sg-page::-webkit-scrollbar {
          display: none;
        }

        /* Gradient backgrounds for badges */
        .bg-blue { background: linear-gradient(150deg,#3d9bff,var(--blue)); color: white; }
        .bg-purple { background: linear-gradient(150deg,#d17dff,var(--purple)); color: white; }
        .bg-mustard { background: linear-gradient(150deg,#ffc257,var(--mustard)); color: white; }
        .bg-scarlet { background: linear-gradient(150deg,#ff7a6e,var(--scarlet)); color: white; }
        .bg-teal { background: linear-gradient(150deg,#41ab9d,var(--tint)); color: white; }
        .bg-orange { background: linear-gradient(150deg,#ffb84d,var(--orange)); color: white; }

        /* ── Fixed NavBar (iOS Reference) ── */
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

        /* ── Banner (iOS Card Style) ── */
        .sg-banner-wrap {
          padding: 16px 16px 18px;
          animation: sg-in .38s cubic-bezier(.22,1,.36,1) both .06s;
        }
        .sg-banner {
          background: var(--card);
          border-radius: 18px;
          padding: 20px 18px;
          min-height: 94px;
          box-sizing: border-box;
          display: flex; align-items: center; gap: 16px;
          margin: 0;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: background .12s, transform .1s;
        }
        .sg-banner:active { background: rgba(255,255,255,0.06); }
        .sg-banner-icon {
          width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(150deg, #38bdf8, #0284c7);
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 1px 0.5px rgba(255,255,255,0.3);
          color: white;
        }
        .sg-banner-icon svg { width: 26px; height: 26px; }
        .sg-banner-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .sg-banner-title {
          font-size: 17.5px; font-weight: 650; margin: 0 0 3px;
          letter-spacing: -0.3px; color: var(--label);
        }
        .sg-banner-sub {
          font-size: 14px; color: var(--label-2); margin: 0;
          line-height: 1.35; letter-spacing: -0.1px;
        }
        .sg-banner-arr { flex-shrink: 0; color: var(--label-3); display: flex; align-items: center; }

        /* ── Section label ── */
        .sg-section {
          font-size: 13px; font-weight: 600; color: var(--label-2);
          text-transform: uppercase; letter-spacing: 0.3px;
          padding: 0 20px 8px;
          animation: sg-up .34s ease both .1s;
        }

        /* ── MOBILE LIST (iOS Grouped Style) ── */
        .sg-grid {
          background: var(--card);
          border-radius: 14px;
          overflow: hidden;
          margin: 0 16px 12px;
          display: flex; flex-direction: column;
          animation: sg-up .38s ease both .14s;
        }

        /* ── MOBILE LIST ROW ── */
        .sg-card {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 14px;
          position: relative;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: background .12s;
        }
        .sg-card:not(:last-child)::after {
          content: "";
          position: absolute; left: 52px; right: 0; bottom: 0;
          height: 0.5px; background: var(--sep);
        }
        .sg-card:active { background: rgba(255,255,255,0.06); }
        
        .sg-badge {
          width: 29px; height: 29px; border-radius: 7.5px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 1px 0.5px rgba(255,255,255,0.3);
        }
        .sg-badge svg { width: 16px; height: 16px; }
        
        .sg-card-bottom {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
        }
        .sg-card-name {
          font-size: 16px; font-weight: 590; letter-spacing: -0.2px; margin: 0;
          color: var(--label);
        }
        .sg-card-sub {
          font-size: 13px; color: var(--label-2); margin: 1px 0 0;
        }
        
        .sg-card-chev {
          color: var(--label-3); flex-shrink: 0;
          display: flex; align-items: center;
        }

        /* ════════════════════════════════════
           iOS LIGHT THEME OVERRIDES
           Triggered by body.theme-light
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
        body.theme-light .sg-card:active { background: #E6EAEF; }
        body.theme-light .sg-banner {
          background: #FFFFFF;
          border-color: #E6EAEF;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
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
            gap: 60px;
            max-width: 1080px;
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
            flex: 1.4;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          .sg-navbar {
            position: relative; padding: 0 0 32px 0; background: transparent;
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
            font-size: 2.2rem; font-weight: 800; letter-spacing: -0.04em;
          }
          
          .sg-banner-wrap { padding: 0; }
          .sg-banner {
            border-radius: 18px;
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
          .sg-section { padding: 0; margin-bottom: 20px; }
          
          .sg-grid {
            background: transparent;
            border-radius: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            overflow: visible;
          }
          
          .sg-card {
            border-radius: 18px;
            background: var(--card);
            border: 0.5px solid rgba(255,255,255,0.07);
            flex-direction: column;
            justify-content: space-between;
            align-items: stretch;
            padding: 13px;
            height: 154px;
            transition: transform 0.12s ease, background 0.15s, border-color 0.25s, box-shadow 0.25s;
          }
          .sg-card:not(:last-child)::after { display: none; }
          .sg-card:active { transform: scale(0.93); background: var(--card-2); }
          .sg-card::after {
            content: '';
            position: absolute; inset: 0; border-radius: inherit;
            background: linear-gradient(175deg,rgba(255,255,255,0.04) 0%,transparent 50%);
            pointer-events: none;
            transition: background 0.25s;
          }
          
          .sg-badge {
            width: 42px; height: 42px; border-radius: 12px;
          }
          .sg-badge svg { width: 22px; height: 22px; }
          
          .sg-card-bottom {
            flex: none; display: block;
          }
          .sg-card-name { font-size: 0.97rem; font-weight: 700; margin-bottom: 0px; }
          .sg-card-sub { font-size: 0.7rem; margin-top: 3px; }
          
          .sg-card-chev {
            position: absolute;
            top: 15px;
            right: 15px;
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
          body.theme-light .sg-card {
            border-color: rgba(0,0,0,0.06);
            box-shadow: 0 1px 8px rgba(0,0,0,0.06);
          }
          body.theme-light .sg-card::after {
            background: linear-gradient(175deg,rgba(255,255,255,0.8) 0%,transparent 50%);
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
            {/* BANNER */}
            <div className="sg-banner-wrap">
              <Link href={notesHref} className="sg-banner" aria-label={bannerAriaLabel || bannerActionLabel || "Open summary notes"}>
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
            {/* SECTION LABEL */}
            <div className="sg-section">Practice Modes</div>

            {/* CARD GRID / LIST */}
            <div className="sg-grid">
              {modes.map((m, i) => (
                <Link key={m.title} href={m.href} className="sg-card">
                  <div className={`sg-badge ${badgeClasses[i]}`}>
                    <m.Icon />
                  </div>
                  <div className="sg-card-bottom">
                    <div className="sg-card-name">{m.title}</div>
                    <div className="sg-card-sub">{m.sub}</div>
                  </div>
                  <div className="sg-card-chev">
                    <Chevron size={8} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
