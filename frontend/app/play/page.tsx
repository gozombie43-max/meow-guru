'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  ClipboardList,
  Clock3,
  Search,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';

type PlayCategory = 'All' | 'Tests' | 'Practice' | 'Review';

type PlayMode = {
  id: string;
  title: string;
  description: string;
  tag: string;
  category: Exclude<PlayCategory, 'All'>;
  duration: string;
  questions: string;
  href: string;
  accent: string;
};

const categories: PlayCategory[] = ['All', 'Tests', 'Practice', 'Review'];

const playModes: PlayMode[] = [
  {
    id: 'mock',
    title: 'Exam Simulation',
    description: 'Full-length SSC style mock with timer, scoring, and review flow.',
    tag: 'Mock',
    category: 'Tests',
    duration: '60 min',
    questions: '100 Qs',
    href: '/mock-test',
    accent: '#2563eb',
  },
  {
    id: 'adaptive',
    title: 'AI Adaptive',
    description: 'Difficulty adjusts around your accuracy to keep practice efficient.',
    tag: 'Adaptive',
    category: 'Practice',
    duration: '40 min',
    questions: 'Mixed',
    href: '/dashboard',
    accent: '#0891b2',
  },
  {
    id: 'weak-area',
    title: 'Weak Area Target',
    description: 'Drill the topics that need work before they cost marks again.',
    tag: 'Focus',
    category: 'Practice',
    duration: '30 min',
    questions: '25 Qs',
    href: '/dashboard',
    accent: '#7c3aed',
  },
  {
    id: 'speed',
    title: 'Speed Drill',
    description: 'Short rapid-fire sets for calculation speed and decision making.',
    tag: 'Speed',
    category: 'Practice',
    duration: '20 min',
    questions: '20 Qs',
    href: '/mathematics/arithmetic/percentages/quiz',
    accent: '#d97706',
  },
  {
    id: 'revision',
    title: 'Revision Mode',
    description: 'Formula-first recall with mixed difficulty and quick corrections.',
    tag: 'Revise',
    category: 'Review',
    duration: '25 min',
    questions: 'Notes + Qs',
    href: '/mathematics',
    accent: '#16a34a',
  },
  {
    id: 'mistakes',
    title: 'Mistake Analysis',
    description: 'Review incorrect attempts, patterns, and the fix for each miss.',
    tag: 'Review',
    category: 'Review',
    duration: '15 min',
    questions: 'Personal',
    href: '/dashboard',
    accent: '#dc2626',
  },
  {
    id: 'sectional',
    title: 'Sectional Practice',
    description: 'Pick a subject and build accuracy without full-test pressure.',
    tag: 'Section',
    category: 'Tests',
    duration: '50 min',
    questions: '50 Qs',
    href: '/mathematics',
    accent: '#db2777',
  },
  {
    id: 'concepts',
    title: 'Concept Builder',
    description: 'Step-by-step drills for fundamentals before timed practice.',
    tag: 'Concepts',
    category: 'Practice',
    duration: '35 min',
    questions: 'Guided',
    href: '/notes',
    accent: '#0f766e',
  },
];

const iconMap = {
  mock: ClipboardList,
  adaptive: Zap,
  'weak-area': Target,
  speed: Timer,
  revision: BookOpenCheck,
  mistakes: ShieldCheck,
  sectional: ClipboardList,
  concepts: BrainCircuit,
};

export default function PlayPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PlayCategory>('All');

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.add('play-surface');
    root.classList.add('play-surface');

    return () => {
      body.classList.remove('play-surface');
      root.classList.remove('play-surface');
    };
  }, []);

  const filteredModes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return playModes.filter((mode) => {
      const matchesCategory = category === 'All' || mode.category === category;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      return (
        mode.title.toLowerCase().includes(normalizedQuery) ||
        mode.description.toLowerCase().includes(normalizedQuery) ||
        mode.tag.toLowerCase().includes(normalizedQuery) ||
        mode.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, query]);

  return (
    <main className="play-page">
      <section className="play-hero" aria-labelledby="play-title">
        <div className="hero-copy">
          <div className="hero-icon" aria-hidden="true">
            <BrainCircuit size={23} />
          </div>
          <div>
            <h1 id="play-title">Play</h1>
            <p>High-intent practice modes for SSC prep, from timed tests to focused revision.</p>
          </div>
        </div>

        <div className="next-session" aria-label="Recommended next session">
          <span>Recommended next</span>
          <strong>Weak Area Target</strong>
          <small>30 min focused set</small>
          <div className="progress" aria-hidden="true">
            <i />
          </div>
        </div>
      </section>

      <section className="play-toolbar" aria-label="Mode controls">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search play modes"
            placeholder="Search modes, tags, or focus areas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="tabs" role="tablist" aria-label="Mode category">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mode-count" aria-live="polite">
          <TrendingUp size={16} aria-hidden="true" />
          {filteredModes.length} modes
        </div>
      </section>

      {filteredModes.length > 0 ? (
        <section className="mode-grid" aria-label="Available play modes">
          {filteredModes.map((mode) => {
            const Icon = iconMap[mode.id as keyof typeof iconMap] || Target;

            return (
              <article key={mode.id} className="mode-card" style={{ '--accent': mode.accent } as React.CSSProperties}>
                <div className="mode-top">
                  <div className="mode-icon" aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <span className="tag">{mode.tag}</span>
                </div>

                <div className="mode-copy">
                  <span>{mode.category}</span>
                  <h2>{mode.title}</h2>
                  <p>{mode.description}</p>
                </div>

                <div className="mode-meta" aria-label={`${mode.duration}, ${mode.questions}`}>
                  <span>
                    <Clock3 size={14} aria-hidden="true" />
                    {mode.duration}
                  </span>
                  <span>{mode.questions}</span>
                </div>

                <Link href={mode.href} className="start-link" aria-label={`Start ${mode.title}`}>
                  <span>Start Mode</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state" aria-live="polite">
          <strong>No matching mode</strong>
          <span>Try a different topic, tag, or category.</span>
        </section>
      )}

      <style>{`
        html.play-surface,
        body.play-surface {
          background: #f8f9fa;
          color-scheme: light;
        }

        html.play-surface.theme-dark,
        body.play-surface.theme-dark {
          background: #050509;
          color-scheme: dark;
        }

        .play-page {
          --text: #0f172a;
          --muted: #64748b;
          --border: rgba(15, 23, 42, 0.1);
          --bg-primary: #ffffff;
          --bg-secondary: rgba(255, 255, 255, 0.88);
          --bg-tertiary: rgba(255, 255, 255, 0.5);
          --glass-panel: rgba(255, 255, 255, 0.86);
          --glass-control: rgba(255, 255, 255, 0.74);
          --hairline: rgba(15, 23, 42, 0.1);
          --cta-text: #ffffff;
          --shadow: rgba(15, 23, 42, 0.1);
          position: relative;
          isolation: isolate;
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: clamp(18px, 4vw, 34px) clamp(14px, 4vw, 28px) calc(168px + env(safe-area-inset-bottom));
          color: var(--text);
          display: flex;
          flex-direction: column;
          gap: 18px;
          font-family: "General Sans", "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f8f9fa;
          transition: background 300ms ease;
        }

        .play-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(248, 249, 250, 0.94)),
            linear-gradient(115deg, rgba(37, 99, 235, 0.08), rgba(22, 163, 74, 0.06) 48%, rgba(217, 119, 6, 0.05));
        }

        .play-hero {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
          gap: clamp(16px, 3vw, 26px);
          align-items: stretch;
          padding: clamp(20px, 4vw, 34px);
          border: 1px solid var(--hairline);
          border-radius: 28px;
          background:
            linear-gradient(135deg, var(--glass-panel), var(--bg-tertiary)),
            linear-gradient(115deg, rgba(37, 99, 235, 0.16), rgba(22, 163, 74, 0.12));
          box-shadow: 0 18px 48px var(--shadow);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          transition: background 300ms ease, border-color 300ms ease;
        }

        .play-hero::after {
          content: "";
          position: absolute;
          inset: auto -12% -44% 42%;
          height: 82%;
          background: linear-gradient(120deg, rgba(37, 99, 235, 0.12), rgba(217, 119, 6, 0.1));
          transform: rotate(-7deg);
          pointer-events: none;
          opacity: 0.6;
        }

        .hero-copy {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          max-width: 720px;
        }

        .hero-icon {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          background: linear-gradient(135deg, #2563eb, #0f766e);
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
          border: 1px solid rgba(255, 255, 255, 0.28);
          flex: 0 0 auto;
        }

        .play-page h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 4.4rem);
          font-weight: 750;
          line-height: 0.95;
          letter-spacing: 0;
          color: var(--text);
          transition: color 300ms ease;
        }

        .hero-copy p {
          color: var(--muted);
          font-size: clamp(0.98rem, 2vw, 1.12rem);
          line-height: 1.55;
          max-width: 590px;
          margin: 12px 0 0;
        }

        .next-session {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          min-height: 152px;
          padding: 20px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0f172a 0%, #1a2a42 100%);
          color: #ffffff;
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(22px) saturate(175%);
          -webkit-backdrop-filter: blur(22px) saturate(175%);
          transition: all 300ms ease;
        }

        .next-session span {
          color: #93c5fd;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .next-session strong {
          font-size: 1.15rem;
          line-height: 1.2;
        }

        .next-session small {
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.92rem;
        }

        .progress {
          height: 8px;
          margin-top: 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          overflow: hidden;
        }

        .progress i {
          display: block;
          width: 68%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #22c55e, #38bdf8);
        }

        .play-toolbar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto auto;
          gap: 12px;
          align-items: center;
        }

        .search-box {
          min-height: 48px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--glass-control);
          padding: 0 14px;
          border: 1px solid var(--hairline);
          border-radius: 16px;
          box-shadow: 0 8px 24px var(--shadow);
          color: var(--muted);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          transition: all 200ms ease;
        }

        .search-box input {
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-size: 0.94rem;
          width: 100%;
          min-width: 0;
        }

        .search-box input::placeholder {
          color: var(--muted);
        }

        .tabs {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 16px;
          background: var(--glass-control);
          border: 1px solid var(--hairline);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          transition: all 200ms ease;
        }

        .tabs button {
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: var(--muted);
          font: inherit;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
        }

        .tabs button:hover {
          color: var(--text);
        }

        .tabs button.active {
          background: var(--bg-primary);
          color: #1d4ed8;
          box-shadow: 0 8px 18px var(--shadow);
        }

        .mode-count {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          border-radius: 15px;
          background: rgba(34, 197, 94, 0.1);
          color: #166534;
          font-size: 0.9rem;
          font-weight: 800;
          white-space: nowrap;
          border: 1px solid rgba(34, 197, 94, 0.14);
          backdrop-filter: blur(16px) saturate(160%);
          -webkit-backdrop-filter: blur(16px) saturate(160%);
        }

        .mode-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .mode-card {
          --accent: #2563eb;
          position: relative;
          isolation: isolate;
          min-height: 90px;
          display: flex;
          flex-direction: row;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: var(--glass-panel);
          border: 1px solid var(--hairline);
          box-shadow: 0 2px 8px var(--shadow);
          backdrop-filter: blur(18px) saturate(165%);
          -webkit-backdrop-filter: blur(18px) saturate(165%);
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
          align-items: center;
        }

        .mode-card::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%);
          opacity: 0.5;
        }

        .mode-card:hover {
          transform: translateX(2px);
          border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
          box-shadow: 0 8px 24px var(--shadow);
        }

        .mode-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-shrink: 0;
        }

        .mode-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
          border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          transition: background 200ms ease;
          flex-shrink: 0;
        }

        .tag {
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
          border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
          font-weight: 700;
          font-size: 0.65rem;
          line-height: 1;
          padding: 5px 8px;
          border-radius: 6px;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex-shrink: 0;
          display: none;
        }

        .mode-copy {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
          min-width: 0;
        }

        .mode-copy span {
          color: var(--muted);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .mode-copy h2 {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: 0;
          color: var(--text);
        }

        .mode-copy p {
          color: var(--muted);
          font-size: 0.78rem;
          line-height: 1.3;
          margin: 0;
          display: none;
        }

        .mode-meta {
          margin-top: 0;
          color: var(--muted);
          font-size: 0.72rem;
          font-weight: 600;
          flex-shrink: 0;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-direction: column;
        }

        .mode-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .start-link {
          position: relative;
          min-height: 36px;
          min-width: 118px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--cta-text);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--accent) 88%, #ffffff 12%), color-mix(in srgb, var(--accent) 70%, #111827 30%));
          border: 1px solid color-mix(in srgb, var(--accent) 70%, rgba(255, 255, 255, 0.3));
          border-radius: 999px;
          font-weight: 800;
          font-size: 0.78rem;
          text-decoration: none;
          box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 22%, transparent);
          transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
          flex-shrink: 0;
        }

        .start-link span {
          line-height: 1;
          white-space: nowrap;
        }

        .start-link svg {
          flex: 0 0 auto;
        }

        .start-link:hover {
          filter: brightness(1.06) saturate(1.08);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--accent) 30%, transparent);
        }

        .start-link:active {
          transform: scale(0.98);
        }

        .empty-state {
          min-height: 240px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          color: var(--muted);
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: 22px;
          background: var(--glass-control);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          transition: all 300ms ease;
        }

        .empty-state strong {
          color: var(--text);
          font-size: 1rem;
        }

        @media (max-width: 1024px) {
          .mode-grid {
            grid-template-columns: 1fr;
          }

          .play-toolbar {
            grid-template-columns: 1fr;
          }

          .tabs {
            width: 100%;
            overflow-x: auto;
          }

          .mode-count {
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {
          .play-page {
            padding-inline: 12px;
            gap: 14px;
          }

          .play-hero {
            grid-template-columns: 1fr;
            padding: 18px;
            border-radius: 24px;
          }

          .hero-copy {
            gap: 12px;
          }

          .hero-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
          }

          .next-session {
            min-height: 128px;
            border-radius: 18px;
          }

          .mode-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .mode-card {
            min-height: 85px;
            padding: 11px 12px;
            border-radius: 13px;
            gap: 10px;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas:
              "icon copy cta"
              "icon meta cta";
          }

          .mode-icon {
            width: 32px;
            height: 32px;
            border-radius: 10px;
            flex-shrink: 0;
          }

          .mode-top {
            grid-area: icon;
          }

          .mode-copy {
            grid-area: copy;
          }

          .tag {
            max-width: 65px;
            padding: 4px 6px;
            font-size: 0.64rem;
          }

          .mode-copy h2 {
            font-size: 0.88rem;
          }

          .mode-copy p {
            font-size: 0.78rem;
            line-height: 1.35;
          }

          .mode-meta {
            align-items: flex-start;
            grid-area: meta;
            flex-direction: row;
            gap: 4px;
            font-size: 0.78rem;
          }

          .start-link {
            grid-area: cta;
            min-height: 40px;
            min-width: 108px;
            font-size: 0.78rem;
            border-radius: 999px;
          }
        }

        @media (max-width: 430px) {
          .hero-copy {
            flex-direction: column;
          }

          .tabs button {
            padding: 0 11px;
            font-size: 0.82rem;
          }

          .search-box {
            min-height: 46px;
          }

          .mode-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .mode-card {
            min-height: 80px;
            padding: 9px 11px;
            border-radius: 12px;
            gap: 8px;
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .mode-icon {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            flex-shrink: 0;
          }

          .mode-copy h2 {
            font-size: 0.85rem;
            line-height: 1.15;
          }

          .mode-copy p {
            font-size: 0.74rem;
            line-height: 1.3;
          }

          .tag {
            max-width: 60px;
            padding: 4px 6px;
            font-size: 0.64rem;
          }

          .start-link {
            min-width: 104px;
            min-height: 38px;
            padding: 0 10px;
            border-radius: 999px;
            font-size: 0.72rem;
          }

          .mode-meta {
            flex-direction: row;
            align-items: center;
            gap: 8px;
            font-size: 0.74rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mode-card,
          .start-link,
          .tabs button {
            transition: none !important;
          }

          .mode-card:hover {
            transform: none;
          }
        }

        body.theme-dark .play-page,
        html.theme-dark .play-page {
          --text: #f5f5f7;
          --muted: rgba(235, 235, 245, 0.62);
          --border: rgba(255, 255, 255, 0.12);
          --bg-primary: rgba(35, 35, 41, 0.82);
          --bg-secondary: rgba(29, 29, 35, 0.64);
          --bg-tertiary: rgba(255, 255, 255, 0.08);
          --glass-panel: rgba(28, 28, 34, 0.72);
          --glass-control: rgba(32, 32, 38, 0.62);
          --hairline: rgba(255, 255, 255, 0.16);
          --shadow: rgba(0, 0, 0, 0.52);
          --cta-text: #ffffff;
          background:
            linear-gradient(180deg, #07070c 0%, #0b0c12 48%, #050509 100%);
        }

        body.theme-dark .play-page::before,
        html.theme-dark .play-page::before {
          background:
            linear-gradient(180deg, rgba(13, 14, 22, 0.84), rgba(5, 5, 9, 0.98)),
            linear-gradient(115deg, rgba(59, 130, 246, 0.14), rgba(20, 184, 166, 0.08) 46%, rgba(217, 119, 6, 0.08));
        }

        body.theme-dark .play-hero,
        html.theme-dark .play-hero {
          background:
            linear-gradient(135deg, rgba(42, 43, 52, 0.78), rgba(18, 19, 27, 0.72)),
            linear-gradient(115deg, rgba(37, 99, 235, 0.2), rgba(20, 184, 166, 0.12));
          border-color: rgba(255, 255, 255, 0.17);
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.56),
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
        }

        body.theme-dark .play-hero::after,
        html.theme-dark .play-hero::after {
          background: linear-gradient(120deg, rgba(37, 99, 235, 0.08), rgba(217, 119, 6, 0.05));
        }

        body.theme-dark .hero-icon,
        html.theme-dark .hero-icon {
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
        }

        body.theme-dark .next-session,
        html.theme-dark .next-session {
          background:
            linear-gradient(145deg, rgba(58, 58, 68, 0.66), rgba(20, 20, 28, 0.78)),
            linear-gradient(90deg, rgba(96, 165, 250, 0.18), rgba(45, 212, 191, 0.12));
          box-shadow:
            0 22px 46px rgba(0, 0, 0, 0.48),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.16);
        }

        body.theme-dark .tabs button.active,
        html.theme-dark .tabs button.active {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        body.theme-dark .mode-count,
        html.theme-dark .mode-count {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        body.theme-dark .mode-card,
        html.theme-dark .mode-card {
          background:
            linear-gradient(135deg, rgba(37, 38, 46, 0.78), rgba(20, 21, 28, 0.66));
          border: 1px solid rgba(255, 255, 255, 0.13);
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.13);
        }
        
        body.theme-dark .mode-card:hover,
        html.theme-dark .mode-card:hover {
          border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
        }

        body.theme-dark .start-link,
        html.theme-dark .start-link {
          border-color: color-mix(in srgb, var(--accent) 64%, rgba(255, 255, 255, 0.28));
          box-shadow:
            0 12px 24px color-mix(in srgb, var(--accent) 22%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        body.theme-dark .start-link:hover,
        html.theme-dark .start-link:hover {
          box-shadow:
            0 14px 30px color-mix(in srgb, var(--accent) 32%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.32);
        }
        
        body.theme-dark .search-box,
        html.theme-dark .search-box {
          background: rgba(32, 32, 38, 0.68);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow:
            0 12px 26px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        body.theme-dark .tabs,
        html.theme-dark .tabs,
        body.theme-dark .mode-count,
        html.theme-dark .mode-count,
        body.theme-dark .empty-state,
        html.theme-dark .empty-state {
          border-color: rgba(255, 255, 255, 0.14);
          box-shadow:
            0 12px 26px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </main>
  );
}
