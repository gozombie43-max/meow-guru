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

const gaTopics: TopicItem[] = [
  {
    title: "History",
    subtitle: "Ancient, Medieval, Modern India & Freedom Struggle",
    slug: "history",
    thumbnail:
      "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Polity",
    subtitle: "Constitution, Governance, Parliament, Judiciary",
    slug: "polity",
    thumbnail:
      "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Geography",
    subtitle: "Physical, Indian, World Geography",
    slug: "geography",
    thumbnail:
      "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Economics",
    subtitle: "Indian Economy, Budgeting, Banking, Schemes",
    slug: "economics",
    thumbnail:
      "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "General Science",
    subtitle: "Physics, Chemistry, Biology",
    slug: "general-science",
    thumbnail:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Current Affairs",
    subtitle: "National, International, Awards, Sports, Reports",
    slug: "current-affairs",
    thumbnail:
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Static GK",
    subtitle: "National Symbols, Awards, Culture, Organizations",
    slug: "static-gk",
    thumbnail:
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=200&q=80",
  },
];

function TopicCard({ topic }: { topic: TopicItem }) {
  return (
    <Link href={`/general-awareness/${topic.slug}`} className="topic-card" aria-label={`Open ${topic.title}`}>
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

export default function GeneralAwarenessPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return gaTopics;
    }

    return gaTopics.filter((topic) => {
      const combinedText = `${topic.title} ${topic.subtitle}`.toLowerCase();
      return combinedText.includes(normalizedQuery);
    });
  }, [searchQuery]);

  return (
    <main className="ga-topics-page">
      <header className="ga-header">
        <div className="header-inner">
          <Link href="/" className="header-back" aria-label="Back to home">
            <ArrowLeft size={20} strokeWidth={2.3} />
          </Link>
          <h1 className="header-title">General Awareness Topics</h1>
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
        .ga-topics-page {
          min-height: 100vh;
          background: #f5f6f8;
          color: #1f2937;
          font-family: "Poppins", "Segoe UI", "Helvetica Neue", sans-serif;
          position: relative;
          overflow: clip;
          isolation: isolate;
        }

        .ga-header {
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
          background: radial-gradient(circle at 18% 10%, #1c2a52 0%, #0b1328 55%, #070c1a 100%);
        }

        body.theme-dark .ga-topics-page {
          --ga-accent: #7ed0ff;
          --ga-border: rgba(126, 208, 255, 0.2);
          --ga-surface: rgba(11, 18, 36, 0.92);
          --ga-ink: #e6edff;
          --ga-subink: #9aa8c7;
          background: transparent;
          color: var(--ga-ink);
        }

        body.theme-dark .ga-topics-page::before,
        body.theme-dark .ga-topics-page::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          z-index: 0;
        }

        body.theme-dark .ga-topics-page::before {
          width: 260px;
          height: 260px;
          top: -80px;
          right: -90px;
          background: radial-gradient(circle, rgba(108, 178, 255, 0.45) 0%, transparent 70%);
        }

        body.theme-dark .ga-topics-page::after {
          width: 220px;
          height: 220px;
          bottom: -90px;
          left: -60px;
          background: radial-gradient(circle, rgba(70, 216, 255, 0.28) 0%, transparent 70%);
        }

        body.theme-dark .ga-header {
          background: rgba(8, 14, 30, 0.88);
          border-bottom: 1px solid var(--ga-border);
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.45);
        }

        body.theme-dark .header-back {
          color: var(--ga-ink);
        }

        body.theme-dark .header-back:hover {
          background: rgba(126, 208, 255, 0.14);
        }

        body.theme-dark .header-title {
          color: var(--ga-ink);
        }

        body.theme-dark .search-icon {
          color: var(--ga-accent);
          opacity: 0.85;
        }

        body.theme-dark .search-input {
          background: var(--ga-surface);
          color: var(--ga-ink);
          box-shadow: 0 14px 30px rgba(2, 6, 23, 0.6), 0 0 0 1px rgba(126, 208, 255, 0.18);
        }

        body.theme-dark .search-input::placeholder {
          color: var(--ga-subink);
        }

        body.theme-dark .search-input:focus {
          box-shadow: 0 18px 34px rgba(2, 6, 23, 0.72), 0 0 0 2px rgba(126, 208, 255, 0.45);
        }

        body.theme-dark .topic-card {
          background: linear-gradient(135deg, rgba(14, 22, 42, 0.95), rgba(10, 16, 34, 0.95));
          border: 1px solid var(--ga-border);
          box-shadow: 0 16px 36px rgba(2, 6, 23, 0.65);
        }

        body.theme-dark .topic-card:hover {
          box-shadow: 0 20px 40px rgba(2, 6, 23, 0.7);
        }

        body.theme-dark .topic-card:focus-visible {
          outline: 2px solid rgba(126, 208, 255, 0.6);
        }

        body.theme-dark .topic-thumb-wrap {
          background: rgba(6, 10, 22, 0.6);
          border: 2px solid rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        }

        body.theme-dark .topic-title {
          color: var(--ga-ink);
        }

        body.theme-dark .topic-subtitle {
          color: var(--ga-subink);
        }

        body.theme-dark .empty-state {
          background: rgba(11, 18, 36, 0.92);
          color: var(--ga-subink);
          border: 1px solid var(--ga-border);
          box-shadow: 0 16px 36px rgba(2, 6, 23, 0.6);
        }

        @media (min-width: 768px) {
          .header-inner {
            min-height: 70px;
            padding: 12px 22px;
          }

          .header-title {
            font-size: 1.15rem;
          }

          .content-wrap {
            padding: 20px 20px 40px;
          }

          .search-wrap {
            margin: 4px 2px 20px;
          }

          .topic-list {
            gap: 14px;
          }

          .topic-card {
            border-radius: 20px;
            padding: 16px;
            gap: 16px;
          }

          .topic-thumb-wrap {
            width: 70px;
            height: 70px;
          }

          .topic-title {
            font-size: 1.08rem;
          }

          .topic-subtitle {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </main>
  );
}