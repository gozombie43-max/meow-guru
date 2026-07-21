"use client";

import Link from "next/link";

const slug = "series";

/* ── SVG Icons ───────────────────────────────── */
const IconDoc = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2.5"/>
    <line x1="9" y1="7" x2="15" y2="7"/>
    <line x1="9" y1="11" x2="15" y2="11"/>
    <line x1="9" y1="15" x2="12" y2="15"/>
  </svg>
);
const IconWand = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4l5 5L9 20H4v-5L15 4z"/>
    <line x1="14" y1="5" x2="19" y2="10"/>
  </svg>
);
const IconBolt = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M13 2 4.09 12.5A.5.5 0 004.5 13H11l-1 9 8.91-10.5A.5.5 0 0018.5 11H12l1-9z"/>
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2l2.45 7.54H22l-6.36 4.62 2.45 7.54L12 17.27l-6.09 4.43 2.45-7.54L2 9.54h7.55L12 2z"/>
  </svg>
);
const IconTarget = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
  </svg>
);
const IconDrop = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 2C9.5 7 5 9.5 5 14.5a7 7 0 0014 0C19 9.5 14.5 7 12 2z"/>
  </svg>
);

/* Chevron — colour driven by CSS var so theme can override */
const Chevron = ({ size = 7 }: { size?: number }) => (
  <svg width={size} height={size * 1.7} viewBox="0 0 7 12" fill="none">
    <path d="M1.5 1.5 6 6l-4.5 4.5"
      stroke="var(--sg-chevron, rgba(235,235,245,0.28))" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* Dark badge colours */
const darkBadge  = [
  { bg: "#1e3a7a", color: "#93bcfe" },
  { bg: "#3b1f6e", color: "#c4b5fd" },
  { bg: "#4a2500", color: "#fbbf24" },
  { bg: "#4a1520", color: "#f87171" },
  { bg: "#0f3320", color: "#4ade80" },
  { bg: "#3d1a00", color: "#fb923c" },
];

const modes = [
  { title: "PYQ",          sub: "Previous Year Questions", href: `/reasoning/${slug}/quiz?mode=concept`,      Icon: IconDoc    },
  { title: "Pattern Bank", sub: "Core Formulas",           href: `/reasoning/${slug}/quiz?mode=formula`,      Icon: IconWand   },
  { title: "PW",           sub: "Mixed Practice",          href: `/reasoning/${slug}/quiz?mode=mixed`,        Icon: IconBolt   },
  { title: "Selection",    sub: "AI Challenge",            href: `/reasoning/${slug}/quiz?mode=ai-challenge`, Icon: IconStar   },
  { title: "Topic Mix",    sub: "Easy Questions",          href: `/reasoning/${slug}/quiz?mode=easy`,         Icon: IconTarget },
  { title: "Tier 2",       sub: "Advanced Level",          href: `/reasoning/${slug}/quiz?mode=hard`,         Icon: IconDrop   },
];

export default function SeriesPage() {
  return (
    <>
      <style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }

        /* ════════════════════════════════════
           DARK THEME  (default)
           ════════════════════════════════════ */
        .sg-page {
          min-height: 100dvh;
          background: #0b0d12;
          color: #fff;
          font-family: -apple-system,'SF Pro Display','Inter',sans-serif;
          -webkit-font-smoothing: antialiased;
          padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px));
          padding-top: max(env(safe-area-inset-top, 0px), 0px);
          --sg-chevron: rgba(235,235,245,0.28);
          transition: background .25s ease, color .25s ease;
        }

        /* ── Header ── */
        .sg-hd {
          display: flex; align-items: flex-end; justify-content: space-between;
          padding: 20px 20px 18px;
          animation: sg-up .3s ease both;
        }
        .sg-eyebrow {
          font-size: .65rem; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: rgba(235,235,245,.4);
          margin-bottom: 3px;
          transition: color .25s;
        }
        .sg-h1 {
          font-size: 2.2rem; font-weight: 800;
          letter-spacing: -.04em; line-height: .93;
          color: #fff;
          transition: color .25s;
        }
        .sg-notes-btn {
          display: flex; align-items: center; gap: 7px;
          background: #1e2028;
          border: .5px solid rgba(255,255,255,.1);
          border-radius: 100px; padding: 8px 16px 8px 10px;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: background .12s, border-color .25s, box-shadow .25s;
          animation: sg-up .3s ease both .04s;
        }
        .sg-notes-btn:active { background: #2a2d38; }
        .sg-notes-icon {
          width: 28px; height: 28px; border-radius: 8px;
          background: linear-gradient(145deg,#e86c3a,#c0392b);
          display: flex; align-items: center; justify-content: center;
          font-size: .95rem;
        }
        .sg-notes-label {
          font-size: .84rem; font-weight: 600;
          color: rgba(235,235,245,.85); letter-spacing: -.01em;
          transition: color .25s;
        }

        /* ── Banner ── */
        .sg-banner {
          position: relative; overflow: hidden;
          margin: 0 16px 28px;
          border-radius: 20px; padding: 18px 16px;
          display: flex; align-items: center; gap: 14px;
          text-decoration: none; color: #fff;
          -webkit-tap-highlight-color: transparent;
          animation: sg-in .38s cubic-bezier(.22,1,.36,1) both .06s;
          transition: transform .1s, opacity .1s, background .25s, border-color .25s, box-shadow .25s;
          background: #111827;
          border: .5px solid rgba(255,255,255,.08);
        }
        .sg-banner:active { transform: scale(.977); opacity: .9; }
        .sg-banner::before {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(135deg,rgba(59,130,246,.12) 0%,transparent 55%);
          pointer-events: none;
          transition: background .25s;
        }
        .sg-banner-icon {
          flex-shrink: 0; z-index: 1;
          width: 46px; height: 46px; border-radius: 13px;
          background: rgba(255,255,255,.08);
          border: .5px solid rgba(255,255,255,.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; color: rgba(255,255,255,.85);
          transition: background .25s, border-color .25s, color .25s;
        }
        .sg-banner-body { flex: 1; min-width: 0; z-index: 1; }
        .sg-banner-kicker {
          font-size: .62rem; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: #6b9bff;
          margin-bottom: 4px;
          transition: color .25s;
        }
        .sg-banner-title {
          font-size: 1.1rem; font-weight: 700;
          letter-spacing: -.02em; color: #fff; line-height: 1.15;
          transition: color .25s;
        }
        .sg-banner-sub {
          font-size: .75rem; color: rgba(235,235,245,.42); margin-top: 3px;
          transition: color .25s;
        }
        .sg-banner-arr { z-index: 1; flex-shrink: 0; }

        /* ── Section label ── */
        .sg-section {
          font-size: .62rem; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: rgba(235,235,245,.3);
          padding: 0 20px; margin-bottom: 12px;
          animation: sg-up .34s ease both .1s;
          transition: color .25s;
        }

        /* ── Grid ── */
        .sg-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 0 16px;
          animation: sg-up .38s ease both .14s;
        }

        /* ── Card ── */
        .sg-card {
          position: relative; overflow: hidden;
          border-radius: 18px;
          background: #16181e;
          border: .5px solid rgba(255,255,255,.07);
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: 13px;
          text-decoration: none; color: #fff;
          height: 148px;
          -webkit-tap-highlight-color: transparent;
          transition: transform .12s ease, background .15s, border-color .25s, box-shadow .25s;
        }
        .sg-card:active { transform: scale(.93); background: #1e2028; }
        .sg-card::after {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(175deg,rgba(255,255,255,.04) 0%,transparent 50%);
          pointer-events: none;
          transition: background .25s;
        }
        .sg-card-top {
          display: flex; align-items: flex-start;
          justify-content: space-between;
        }
        .sg-badge {
          width: 42px; height: 42px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background .25s, color .25s;
        }
        .sg-card-name {
          font-size: .97rem; font-weight: 700;
          letter-spacing: -.02em; line-height: 1.1;
          color: #fff;
          transition: color .25s;
        }
        .sg-card-sub {
          font-size: .7rem; color: rgba(235,235,245,.38);
          margin-top: 3px; line-height: 1.2;
          transition: color .25s;
        }

        /* stagger */
        .sg-card:nth-child(1){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .18s}
        .sg-card:nth-child(2){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .22s}
        .sg-card:nth-child(3){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .26s}
        .sg-card:nth-child(4){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .30s}
        .sg-card:nth-child(5){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .34s}
        .sg-card:nth-child(6){animation:sg-in .44s cubic-bezier(.22,1,.36,1) both .38s}


        /* ════════════════════════════════════
           iOS LIGHT THEME OVERRIDES
           Triggered by body.theme-light
           ════════════════════════════════════ */

        /* Page bg — iOS "Grouped Table" system background */
        body.theme-light .sg-page {
          background: #f2f2f7;
          color: #000;
          --sg-chevron: rgba(60,60,67,0.25);
        }

        /* Header */
        body.theme-light .sg-eyebrow  { color: rgba(60,60,67,0.45); }
        body.theme-light .sg-h1       { color: #000; }

        body.theme-light .sg-notes-btn {
          background: #fff;
          border-color: rgba(0,0,0,0.08);
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        }
        body.theme-light .sg-notes-btn:active { background: #ebebeb; }
        body.theme-light .sg-notes-label      { color: rgba(0,0,0,0.78); }

        /* Banner */
        body.theme-light .sg-banner {
          background: #fff;
          border-color: rgba(0,0,0,0.07);
          color: #000;
          box-shadow: 0 2px 14px rgba(0,0,0,0.06);
        }
        body.theme-light .sg-banner::before {
          background: linear-gradient(135deg,rgba(59,130,246,.07) 0%,transparent 60%);
        }
        body.theme-light .sg-banner-icon {
          background: rgba(59,130,246,.1);
          border-color: rgba(59,130,246,.18);
          color: #1d4ed8;
        }
        body.theme-light .sg-banner-kicker { color: #1d4ed8; }
        body.theme-light .sg-banner-title  { color: #000; }
        body.theme-light .sg-banner-sub    { color: rgba(60,60,67,0.52); }

        /* Section label */
        body.theme-light .sg-section { color: rgba(60,60,67,0.45); }

        /* Cards — white elevated surface */
        body.theme-light .sg-card {
          background: #fff;
          border-color: rgba(0,0,0,0.06);
          color: #000;
          box-shadow: 0 1px 8px rgba(0,0,0,0.06);
        }
        body.theme-light .sg-card:active { background: #f5f5f5; }
        body.theme-light .sg-card::after {
          background: linear-gradient(175deg,rgba(255,255,255,0.8) 0%,transparent 50%);
        }
        body.theme-light .sg-card-name { color: #000; }
        body.theme-light .sg-card-sub  { color: rgba(60,60,67,0.48); }

        /* Badge colours in light mode — vivid iOS system tints on white bg */
        body.theme-light .sg-badge[data-idx="0"] { background: #dbeafe !important; color: #1d4ed8 !important; }
        body.theme-light .sg-badge[data-idx="1"] { background: #ede9fe !important; color: #6d28d9 !important; }
        body.theme-light .sg-badge[data-idx="2"] { background: #fef3c7 !important; color: #92400e !important; }
        body.theme-light .sg-badge[data-idx="3"] { background: #fee2e2 !important; color: #991b1b !important; }
        body.theme-light .sg-badge[data-idx="4"] { background: #dcfce7 !important; color: #166534 !important; }
        body.theme-light .sg-badge[data-idx="5"] { background: #ffedd5 !important; color: #9a3412 !important; }

        /* ════════════════════════════════════
           DESKTOP (PC) LAYOUT
           ════════════════════════════════════ */
        @media (min-width: 900px) {
          .sg-page {
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
          
          /* Reset mobile spacing constraints */
          .sg-hd { padding: 0 0 32px 0; }
          .sg-banner { margin: 0; }
          .sg-section { padding: 0; margin-bottom: 20px; }
          .sg-grid { 
            padding: 0; 
            gap: 16px; 
            grid-template-columns: repeat(3, 1fr); 
          }
          .sg-card {
            height: 154px; /* slightly taller for desktop breathing room */
          }
        }
      `}</style>

      <div className="sg-page">
        <div className="sg-desktop-container">
          
          <div className="sg-left-pane">
            {/* HEADER */}
            <div className="sg-hd">
              <div>
                <div className="sg-eyebrow">Reasoning</div>
                <div className="sg-h1">Series</div>
              </div>
              <Link href={`/reasoning/${slug}/formula-notes`} className="sg-notes-btn">
                <div className="sg-notes-icon">📚</div>
                <span className="sg-notes-label">Notes</span>
              </Link>
            </div>

            {/* BANNER */}
            <Link href={`/reasoning/${slug}/formula-notes`} className="sg-banner">
              <div className="sg-banner-icon">✦</div>
              <div className="sg-banner-body">
                <div className="sg-banner-kicker">Sprint 2026</div>
                <div className="sg-banner-title">Notes, Formula &amp; Tricks</div>
                <div className="sg-banner-sub">Curated shortcuts to crack Series</div>
              </div>
              <div className="sg-banner-arr"><Chevron /></div>
            </Link>
          </div>

          <div className="sg-right-pane">
            {/* SECTION LABEL */}
            <div className="sg-section">Practice Modes</div>

            {/* CARD GRID */}
            <div className="sg-grid">
              {modes.map((m, i) => (
                <Link key={m.title} href={m.href} className="sg-card">
                  <div className="sg-card-top">
                    <div
                      className="sg-badge"
                      data-idx={i}
                      style={{ background: darkBadge[i].bg, color: darkBadge[i].color }}
                    >
                      <m.Icon />
                    </div>
                    <Chevron />
                  </div>
                  <div className="sg-card-bottom">
                    <div className="sg-card-name">{m.title}</div>
                    <div className="sg-card-sub">{m.sub}</div>
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
