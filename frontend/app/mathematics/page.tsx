"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

interface TopicItem {
  title: string;
  subtitle: string;
  slug: string;
  thumbnail: string;
}

const mathTopics: TopicItem[] = [
  {
    title: "Arithmetic",
    subtitle: "Percentages, ratio, profit-loss, SI-CI, time-work",
    slug: "arithmetic",
    thumbnail:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Algebra",
    subtitle: "Equations, identities, polynomials and simplification",
    slug: "algebra",
    thumbnail:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Geometry",
    subtitle: "Angles, triangles, circles and theorem-based problems",
    slug: "geometry",
    thumbnail:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Mensuration",
    subtitle: "Area, perimeter, TSA, CSA and volume of solids",
    slug: "mensuration",
    thumbnail:
      "https://images.unsplash.com/photo-1453733190371-0a9bedd82893?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Trigonometry",
    subtitle: "Ratios, identities, heights and distances practice",
    slug: "trigonometry",
    thumbnail:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Statistics & Probability",
    subtitle: "Mean, median, mode, DI and probability rules",
    slug: "statistics-probability",
    thumbnail:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Number System",
    subtitle: "HCF, LCM, divisibility, primes and base concepts",
    slug: "number-system",
    thumbnail:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=200&q=80",
  },
];

function TopicCard({ topic }: { topic: TopicItem }) {
  return (
    <Link href={`/mathematics/${topic.slug}`} className="topic-card" aria-label={`Open ${topic.title}`}>
      <div className="topic-thumb-wrap">
        <img src={topic.thumbnail} alt={topic.title} className="topic-thumb" loading="lazy" />
      </div>
      <div className="topic-copy">
        <h2 className="topic-title">{topic.title}</h2>
        <p className="topic-subtitle">{topic.subtitle}</p>
      </div>
    </Link>
  );
}

export default function MathematicsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return mathTopics;
    }

    return mathTopics.filter((topic) => {
      const combinedText = `${topic.title} ${topic.subtitle}`.toLowerCase();
      return combinedText.includes(normalizedQuery);
    });
  }, [searchQuery]);

  return (
    <main className="math-topics-page">
      <header className="math-header">
        <div className="header-inner">
          <Link href="/" className="header-back" aria-label="Back to home">
            <ArrowLeft size={20} strokeWidth={2.3} />
          </Link>
          <h1 className="header-title">Mathematics Topics</h1>
          <div className="header-spacer" aria-hidden="true" />
        </div>
      </header>

      <section className="content-wrap" aria-label="Topic listing area">
        <div className="search-wrap">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search topics..."
            aria-label="Search topics"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="topic-list">
          {filteredTopics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))}

          {filteredTopics.length === 0 ? (
            <div className="empty-state" role="status" aria-live="polite">
              No topics found. Try a different search term.
            </div>
          ) : null}
        </div>
      </section>

      <style>{`
        .math-topics-page {
          min-height: 100vh;
          background: #f5f6f8;
          color: #1f2937;
          font-family: "Poppins", "Segoe UI", "Helvetica Neue", sans-serif;
          position: relative;
          overflow: clip;
          isolation: isolate;
        }

        .math-header {
          position: sticky;
          top: 0;
          z-index: 30;
          background: rgba(245, 246, 248, 0.93);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #e8ebf0;
        }

        .header-inner {
          max-width: 740px;
          margin: 0 auto;
          min-height: 64px;
          display: grid;
          grid-template-columns: 40px 1fr 40px;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
        }

        .header-back {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #111827;
          text-decoration: none;
          transition: background-color 0.2s ease;
        }

        .header-back:hover {
          background: #e8edf3;
        }

        .header-title {
          text-align: center;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #111827;
        }

        .header-spacer {
          width: 40px;
          height: 40px;
        }

        .content-wrap {
          max-width: 740px;
          margin: 0 auto;
          padding: 14px 14px 28px;
          position: relative;
          z-index: 1;
        }

        .search-wrap {
          position: relative;
          margin: 4px 2px 16px;
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          color: #9aa3b2;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          border: none;
          outline: none;
          border-radius: 18px;
          background: #ffffff;
          height: 48px;
          padding: 0 14px 0 42px;
          font-size: 0.95rem;
          color: #1f2937;
          box-shadow: 0 6px 20px rgba(16, 24, 40, 0.07);
          transition: box-shadow 0.25s ease;
        }

        .search-input::placeholder {
          color: #9aa3b2;
        }

        .search-input:focus {
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.12);
        }

        .topic-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 10px;
        }

        .topic-card {
          width: 100%;
          background: #ffffff;
          border-radius: 18px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          cursor: pointer;
        }

        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.13);
        }

        .topic-card:focus-visible {
          outline: 2px solid #7aa8ff;
          outline-offset: 2px;
        }

        .topic-thumb-wrap {
          flex: 0 0 auto;
          width: 64px;
          height: 64px;
          border-radius: 999px;
          overflow: hidden;
          background: #edf2f7;
          border: 2px solid #f2f4f7;
        }

        .topic-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .topic-copy {
          min-width: 0;
        }

        .topic-title {
          margin: 0;
          font-size: 1.02rem;
          line-height: 1.2;
          font-weight: 700;
          color: #1f2937;
        }

        .topic-subtitle {
          margin: 6px 0 0;
          font-size: 0.86rem;
          line-height: 1.45;
          color: #6b7280;
        }

        .empty-state {
          border-radius: 16px;
          background: #ffffff;
          color: #6b7280;
          text-align: center;
          padding: 18px;
          font-size: 0.9rem;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }

        body.theme-dark {
          background: #000000;
        }

        body.theme-dark .math-topics-page {
          --math-accent: #0a84ff;
          --math-border: rgba(255, 255, 255, 0.08);
          --math-surface: #1c1c1e;
          --math-ink: #ffffff;
          --math-subink: rgba(235, 235, 245, 0.55);
          background: transparent;
          color: var(--math-ink);
        }

        body.theme-dark .math-topics-page::before,
        body.theme-dark .math-topics-page::after {
          display: none;
        }

        body.theme-dark .math-header {
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid var(--math-border);
          box-shadow: none;
        }

        body.theme-dark .header-back {
          color: var(--math-ink);
        }

        body.theme-dark .header-back:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        body.theme-dark .header-title {
          color: var(--math-ink);
        }

        body.theme-dark .search-icon {
          color: var(--math-accent);
          opacity: 0.85;
        }

        body.theme-dark .search-input {
          background: var(--math-surface);
          color: var(--math-ink);
          box-shadow: none;
          border: 1px solid var(--math-border);
        }

        body.theme-dark .search-input::placeholder {
          color: var(--math-subink);
        }

        body.theme-dark .search-input:focus {
          box-shadow: none;
          border-color: var(--math-accent);
        }

        body.theme-dark .topic-card {
          background: var(--math-surface);
          border: 1px solid var(--math-border);
          box-shadow: none;
        }

        body.theme-dark .topic-card:hover {
          background: #2c2c2e;
        }

        body.theme-dark .topic-card:focus-visible {
          outline: 2px solid var(--math-accent);
        }

        body.theme-dark .topic-thumb-wrap {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }

        body.theme-dark .topic-title {
          color: var(--math-ink);
        }

        body.theme-dark .topic-subtitle {
          color: var(--math-subink);
        }

        body.theme-dark .empty-state {
          background: var(--math-surface);
          color: var(--math-subink);
          border: 1px solid var(--math-border);
          box-shadow: none;
        }

        /* ── DESKTOP PC DESIGN (>= 768px) ── */
        @media (min-width: 768px) {
          .math-header .header-inner {
            max-width: 100%;
            padding: 12px 40px;
          }

          .content-wrap {
            max-width: 1240px;
            padding: 32px 40px 80px;
          }

          .search-wrap {
            max-width: 500px;
            margin: 0 auto 32px;
          }

          .topic-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
          }

          .topic-card {
            border-radius: 20px;
            padding: 14px;
            gap: 14px;
            height: 100%;
          }

          .topic-thumb-wrap {
            width: 56px;
            height: 56px;
            border-radius: 12px;
          }

          .topic-title {
            font-size: 1.05rem;
          }

          .topic-subtitle {
            font-size: 0.88rem;
          }
        }
      `}</style>
    </main>
  );
}