'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import {
  ArrowRight,
  BarChart3,
  Brain,
  ChevronRight,
  Gamepad2,
  Home,
  Layers3,
  Play,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
});

const featuredModes = [
  { title: 'Exam Sim', copy: 'Real exam pressure', badge: 'Hot', href: '/mock-test/index.html', theme: 'green', Icon: Timer },
  { title: 'AI Adaptive', copy: 'Personalized path', badge: 'AI', href: '/dashboard', theme: 'blue', Icon: Brain },
  { title: 'Weak Target', copy: 'Fix weak spots', badge: 'Up', href: '/dashboard', theme: 'purple', Icon: Layers3 },
];

const allModes = [
  { title: 'Exam Simulation Mode', copy: 'Full mock · Timer · Negative marking', accent: '#00e87a', gradient: 'linear-gradient(135deg,#00703f,#00e87a)', Icon: Timer, href: '/mock-test/index.html' },
  { title: 'Adaptive AI Mode', copy: 'Dynamic difficulty · Instant explain', accent: '#3b8fff', gradient: 'linear-gradient(135deg,#1a5fbf,#3b8fff)', Icon: Brain, href: '/dashboard' },
  { title: 'Weak Area Target', copy: 'Focused weak topic questions', accent: '#a855f7', gradient: 'linear-gradient(135deg,#6d28d9,#a855f7)', Icon: Target, href: '/dashboard' },
  { title: 'Revision Mode', copy: 'Spaced recall · Mixed past attempts', accent: '#ff7c2a', gradient: 'linear-gradient(135deg,#b84900,#ff7c2a)', Icon: Zap, href: '/dashboard' },
  { title: 'Mistake Analysis', copy: 'Wrong-only · Deep explanations', accent: '#ff3d5a', gradient: 'linear-gradient(135deg,#9b0020,#ff3d5a)', Icon: Trophy, href: '/dashboard' },
  { title: 'Speed Drill Mode', copy: 'Short timer · Rapid fire questions', accent: '#ffd600', gradient: 'linear-gradient(135deg,#a38900,#ffd600)', Icon: Zap, href: '/dashboard' },
  { title: 'Accuracy Mode', copy: 'Heavy penalty · Precision training', accent: '#00d4ff', gradient: 'linear-gradient(135deg,#0087a3,#00d4ff)', Icon: Target, href: '/dashboard' },
  { title: 'Sectional Practice', copy: 'Quant · Reasoning · English · GK', accent: '#ff4fa3', gradient: 'linear-gradient(135deg,#a3006a,#ff4fa3)', Icon: Layers3, href: '/dashboard' },
  { title: 'PYQ Mode', copy: 'Previous year papers only', accent: '#00e87a', gradient: 'linear-gradient(135deg,#005c31,#00e87a)', Icon: Gamepad2, href: '/dashboard' },
  { title: 'Concept Builder', copy: 'Topic-wise · Deep fundamentals', accent: '#a855f7', gradient: 'linear-gradient(135deg,#4c1d95,#a855f7)', Icon: Sparkles, href: '/dashboard' },
];

const subjectCards = [
  { title: 'Mathematics', copy: 'Geometry, algebra, arithmetic', href: '/mathematics', accent: '#00e87a', Icon: Target },
  { title: 'Reasoning', copy: 'Logic, sequences, patterns', href: '/reasoning', accent: '#3b8fff', Icon: Layers3 },
  { title: 'English', copy: 'Grammar, vocab, comprehension', href: '/english', accent: '#a855f7', Icon: Sparkles },
  { title: 'General Awareness', copy: 'Static GK, history, polity', href: '/general-awareness', accent: '#ffb547', Icon: Trophy },
];

function FoxMascot() {
  return (
    <svg className="fox-svg" viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="foxBody" x1="60" y1="40" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#ff6b2c" />
        </linearGradient>
        <linearGradient id="foxEar" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ff3d5a" />
          <stop offset="100%" stopColor="#ff7c2a" />
        </linearGradient>
        <linearGradient id="foxBelly" x1="60" y1="70" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe4c7" />
          <stop offset="100%" stopColor="#ffcfa0" />
        </linearGradient>
      </defs>
      <g style={{ animation: 'foxTail 2.5s ease-in-out infinite', transformOrigin: '35px 105px' }}>
        <ellipse cx="28" cy="108" rx="24" ry="14" fill="url(#foxBody)" transform="rotate(-15 28 108)" />
        <ellipse cx="20" cy="112" rx="12" ry="8" fill="#ffe4c7" transform="rotate(-15 20 112)" />
      </g>
      <ellipse cx="60" cy="95" rx="34" ry="28" fill="url(#foxBody)" />
      <ellipse cx="60" cy="100" rx="20" ry="16" fill="url(#foxBelly)" />
      <rect x="38" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      <rect x="68" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      <g style={{ animation: 'foxBreathe 3s ease-in-out infinite', transformOrigin: '60px 55px' }}>
        <g style={{ animation: 'foxEarLeft 4s ease-in-out infinite', transformOrigin: '38px 25px' }}>
          <path d="M28 38 L22 8 L42 24 Z" fill="url(#foxBody)" />
          <path d="M30 35 L26 14 L38 26 Z" fill="url(#foxEar)" />
        </g>
        <g style={{ animation: 'foxEarRight 4s ease-in-out infinite 0.2s', transformOrigin: '82px 25px' }}>
          <path d="M72 38 L78 8 L58 24 Z" fill="url(#foxBody)" />
          <path d="M70 35 L74 14 L62 26 Z" fill="url(#foxEar)" />
        </g>
        <circle cx="60" cy="52" r="28" fill="url(#foxBody)" />
        <ellipse cx="60" cy="58" rx="16" ry="14" fill="url(#foxBelly)" />
        <g style={{ animation: 'foxBlink 5s ease-in-out infinite' }}>
          <circle cx="50" cy="48" r="6" fill="#1a0a00" />
          <circle cx="70" cy="48" r="6" fill="#1a0a00" />
          <circle cx="52" cy="46" r="2.2" fill="#fff" />
          <circle cx="72" cy="46" r="2.2" fill="#fff" />
        </g>
        <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#1a0a00" />
        <path d="M50 62 Q60 72 70 62" stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="42" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
        <ellipse cx="78" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
      </g>
    </svg>
  );
}

function ModeGlyph({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="mode-glyph">
      <Icon className="mode-glyph-icon" />
    </span>
  );
}

export default function PlayPage() {
  useEffect(() => {
    document.body.classList.add('play-locked');
    return () => document.body.classList.remove('play-locked');
  }, []);

  return (
    <main className={`play-shell ${jakarta.className}`}>
      <style>{`
        body.play-locked { overflow-x: hidden; }
        .play-shell {
          position: relative;
          min-height: 100svh;
          overflow: hidden;
          color: #f0f2f8;
          background:
            radial-gradient(ellipse 60% 50% at 15% 20%, rgba(59, 143, 255, 0.09) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 75%, rgba(0, 232, 122, 0.08) 0%, transparent 52%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 52%),
            linear-gradient(180deg, #050608 0%, #090b11 100%);
        }
        .play-shell::before {
          content: ''; position: fixed; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.08), transparent 26%),
            radial-gradient(circle at 80% 12%, rgba(255, 255, 255, 0.05), transparent 22%),
            radial-gradient(circle at 70% 78%, rgba(255, 255, 255, 0.05), transparent 18%);
          animation: playMesh 20s ease-in-out infinite alternate;
        }
        .play-shell::after {
          content: ''; position: fixed; inset: 0; pointer-events: none;
          background: linear-gradient(120deg, rgba(255, 255, 255, 0) 36%, rgba(255, 255, 255, 0.06) 49%, rgba(255, 255, 255, 0) 62%);
          opacity: 0.45; mix-blend-mode: screen;
        }
        @keyframes playMesh { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(1.5%, -1%, 0) scale(1.02); } 100% { transform: translate3d(-1%, 1.5%, 0) scale(0.98); } }
        @keyframes foxTail { 0%,100% { transform: rotate(-10deg) translateX(0); } 50% { transform: rotate(20deg) translateX(6px); } }
        @keyframes foxEarLeft { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(-12deg); } 96% { transform: rotate(6deg); } }
        @keyframes foxEarRight { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(12deg); } 96% { transform: rotate(-6deg); } }
        @keyframes foxBlink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes foxBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        .play-app { position: relative; z-index: 1; width: min(440px, 100%); margin: 0 auto; padding: 18px 16px 132px; }
        .play-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 2px 14px; position: sticky; top: 0; z-index: 20; backdrop-filter: blur(18px) saturate(1.2); }
        .play-header-left { display: flex; align-items: center; gap: 12px; }
        .play-avatar { width: 48px; height: 48px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ff3d5a 0%, #ff7c2a 50%, #ffd600 100%); box-shadow: 0 10px 28px rgba(255, 91, 49, 0.22); font-size: 22px; }
        .play-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.34em; text-transform: uppercase; color: rgba(139, 146, 168, 0.95); display: inline-flex; align-items: center; gap: 8px; }
        .play-title { margin-top: 4px; font-size: 17px; line-height: 1.1; font-weight: 800; letter-spacing: -0.3px; }
        .play-status { margin-top: 5px; font-size: 12px; font-weight: 700; color: #00e87a; display: flex; align-items: center; gap: 4px; }
        .play-status::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; box-shadow: 0 0 10px currentColor; }
        .header-actions { display: flex; gap: 10px; }
        .header-action { width: 40px; height: 40px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); color: inherit; backdrop-filter: blur(16px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
        .hero-card { position: relative; overflow: hidden; min-height: 188px; border-radius: 26px; padding: 26px 22px 0; background: linear-gradient(135deg, #00b359 0%, #00d472 40%, #00c4a0 100%); box-shadow: 0 20px 60px rgba(0, 232, 122, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.18); }
        .hero-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0, 0, 0, 0.1) 0%, transparent 40%); }
        .hero-card::after { content: ''; position: absolute; inset: -50%; background: conic-gradient(from 0deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, transparent 40%); animation: heroRotate 8s linear infinite; pointer-events: none; }
        @keyframes heroRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 6px; }
        .hero-copy h1 { margin: 0; color: #001a09; font-size: clamp(1.95rem, 5vw, 2.35rem); line-height: 0.98; letter-spacing: -0.6px; font-weight: 900; font-family: ${grotesk.style.fontFamily}; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); }
        .hero-copy p { margin: 8px 0 18px; max-width: 19ch; color: rgba(0, 77, 31, 0.92); font-size: 13px; font-weight: 700; }
        .hero-cta { display: inline-flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 16px; background: #001a09; color: #00e87a; font-size: 14px; font-weight: 800; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16); }
        .hero-art { position: relative; z-index: 1; width: 150px; height: 150px; align-self: end; margin-right: -10px; filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.25)); animation: foxFloat 4s ease-in-out infinite; }
        @keyframes foxFloat { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-10px) rotate(2deg); } 75% { transform: translateY(-6px) rotate(-1deg); } }
        .section-head { display: flex; align-items: center; justify-content: space-between; margin: 22px 2px 10px; }
        .section-head h2 { margin: 0; font-size: 17px; line-height: 1.1; letter-spacing: -0.3px; font-weight: 800; }
        .section-link { display: inline-flex; align-items: center; gap: 4px; color: #00e87a; font-size: 13px; font-weight: 800; }
        .mode-row { display: flex; gap: 14px; overflow-x: auto; padding: 6px 0 10px; scrollbar-width: none; }
        .mode-row::-webkit-scrollbar { display: none; }
        .mode-card { position: relative; flex: 0 0 170px; height: 220px; overflow: hidden; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.08); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, border-color 0.4s ease; animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .mode-card:hover { transform: translateY(-8px) scale(1.04) rotateX(4deg); border-color: rgba(255, 255, 255, 0.2); }
        .mode-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 20%, rgba(0, 0, 0, 0.74) 100%); z-index: 1; }
        .mode-card-bg { position: absolute; inset: 0; transition: transform 0.5s ease; }
        .mode-card:hover .mode-card-bg { transform: scale(1.08); }
        .theme-green .mode-card-bg { background: linear-gradient(135deg, #006d3f 0%, #00b84d 50%, #00e87a 100%); }
        .theme-blue .mode-card-bg { background: linear-gradient(135deg, #0f4db8 0%, #2563eb 50%, #3b8fff 100%); }
        .theme-purple .mode-card-bg { background: linear-gradient(135deg, #5b1fa8 0%, #7c3aed 50%, #a855f7 100%); }
        .mode-card-content { position: relative; z-index: 2; display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 18px 14px; }
        .card-badge { width: fit-content; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 800; color: #fff; background: rgba(0, 0, 0, 0.38); border: 1px solid rgba(255, 255, 255, 0.12); backdrop-filter: blur(12px); }
        .mode-card-bottom h3 { margin: 0; font-size: 15px; line-height: 1.1; letter-spacing: -0.2px; font-weight: 800; color: #fff; }
        .mode-card-bottom p { margin: 4px 0 0; font-size: 11px; line-height: 1.3; color: rgba(255, 255, 255, 0.72); font-weight: 600; }
        .mode-card-illustration { position: absolute; right: -8px; bottom: 40px; width: 94px; height: 94px; display: flex; align-items: center; justify-content: center; z-index: 1; filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.38)); }
        .mode-card-illustration svg { width: 80px; height: 80px; }
        .subject-grid { display: grid; gap: 12px; margin-top: 8px; }
        .subject-card { position: relative; overflow: hidden; display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(20, 22, 30, 0.68); backdrop-filter: blur(20px) saturate(1.2); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
        .subject-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px; opacity: 1; background: var(--accent); }
        .subject-card-main { min-width: 0; flex: 1; }
        .subject-card-main h3 { margin: 0; font-size: 15px; line-height: 1.1; letter-spacing: -0.2px; font-weight: 800; }
        .subject-card-main p { margin: 4px 0 0; font-size: 12px; line-height: 1.35; color: rgba(139, 146, 168, 0.95); font-weight: 600; }
        .subject-arrow { width: 38px; height: 38px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #051108; flex-shrink: 0; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22); }
        .play-footer { margin-top: 20px; padding: 18px 0 0; color: rgba(139, 146, 168, 0.9); font-size: 12px; line-height: 1.5; }
        .mode-glyph { width: 56px; height: 56px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(14px); }
        .mode-glyph-icon { width: 28px; height: 28px; stroke: currentColor; stroke-width: 2.2; fill: none; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .list-mode { display: flex; align-items: center; gap: 16px; margin: 0 0 12px; padding: 16px 18px; border-radius: 20px; background: rgba(20, 22, 30, 0.68); border: 1px solid rgba(255, 255, 255, 0.06); backdrop-filter: blur(20px) saturate(1.2); }
        .list-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
        .list-icon svg { width: 28px; height: 28px; }
        .list-info { flex: 1; min-width: 0; }
        .list-info h4 { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; margin: 0; }
        .list-info p { font-size: 12px; color: rgba(139, 146, 168, 0.95); font-weight: 600; margin-top: 3px; }
        .list-action { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .list-action svg { width: 14px; height: 14px; fill: #000; }
        @media (max-width: 420px) { .play-app { padding-inline: 14px; } .hero-card { padding: 22px 18px 0; } .hero-art { width: 132px; height: 132px; margin-right: -16px; } .mode-card { flex-basis: 162px; } }
      `}</style>

      <div className="play-app">
        <header className="play-header">
          <div className="play-header-left">
            <div className="play-avatar">🎓</div>
            <div>
              <div className="play-kicker">
                <span>PLAY</span>
                <span style={{ color: 'rgba(139, 146, 168, 0.55)' }}>•</span>
                <span>Premium modes</span>
              </div>
              <div className="play-title">Choose how you want to train</div>
              <div className="play-status">Ready to go</div>
            </div>
          </div>
          <div className="header-actions">
            <Link className="header-action" href="/">
              <Home className="h-4 w-4" />
            </Link>
            <Link className="header-action" href="/dashboard">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="hero-card">
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>Study Smart.<br />Rank Higher.</h1>
              <p>10 Pro modes for SSC · CAT · UPSC, tuned for speed and focus.</p>
              <Link href="/mock-test/index.html" className="hero-cta">
                Start Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="hero-art">
              <FoxMascot />
            </div>
          </div>
        </section>

        <div className="section-head">
          <h2>Featured Modes</h2>
          <Link href="/dashboard" className="section-link">
            See All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mode-row">
          {featuredModes.map((mode) => (
            <Link key={mode.title} href={mode.href} className={`mode-card theme-${mode.theme}`}>
              <div className="mode-card-bg" />
              <div className="mode-card-illustration">
                <ModeGlyph Icon={mode.Icon} />
              </div>
              <div className="mode-card-content">
                <div className="card-badge">{mode.badge}</div>
                <div className="mode-card-bottom">
                  <h3>{mode.title}</h3>
                  <p>{mode.copy}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="section-head">
          <h2>All Quiz Modes</h2>
          <button className="section-link" type="button" style={{ background: 'none', border: 0, padding: 0 }}>
            Filter
          </button>
        </div>

        {allModes.map((mode) => (
          <Link key={mode.title} href={mode.href} className="list-mode" style={{ ['--accent' as string]: mode.accent } as React.CSSProperties}>
            <div className="list-icon" style={{ background: mode.gradient }}>
              <mode.Icon className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <div className="list-info">
              <h4>{mode.title}</h4>
              <p>{mode.copy}</p>
            </div>
            <button className="list-action" style={{ background: mode.accent }} type="button">
              <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19" /></svg>
            </button>
          </Link>
        ))}

        <div className="section-head">
          <h2>Quick Start</h2>
          <span className="section-link" aria-hidden="true">
            Jump in <Play className="h-4 w-4" />
          </span>
        </div>

        <div className="subject-grid">
          {subjectCards.map((subject) => (
            <Link key={subject.title} href={subject.href} className="subject-card" style={{ ['--accent' as string]: subject.accent } as React.CSSProperties}>
              <ModeGlyph Icon={subject.Icon} />
              <div className="subject-card-main">
                <h3>{subject.title}</h3>
                <p>{subject.copy}</p>
              </div>
              <span className="subject-arrow" aria-hidden="true">
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>

        <div className="play-footer">
          Pick a mode, run a focused session, and keep the same premium visual language from the quiz modes screen.
        </div>
      </div>
    </main>
  );
}
