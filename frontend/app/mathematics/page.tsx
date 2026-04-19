"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface TopicItem {
  title: string;
  subtitle: string;
  slug: string;
  thumbnail: string;
  gradient: string;
  lightGradient: string;
}

const mathTopics: TopicItem[] = [
  {
    title: "Arithmetic",
    subtitle: "Percentages, ratio, profit-loss, SI-CI, time-work",
    slug: "arithmetic",
    thumbnail:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #2748b9 0%, #223a8f 55%, #1a235b 100%)",
    lightGradient: "linear-gradient(135deg, #78a6ff 0%, #5e84f6 55%, #4c6ddf 100%)",
  },
  {
    title: "Algebra",
    subtitle: "Equations, identities, polynomials and simplification",
    slug: "algebra",
    thumbnail:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #2c3b85 0%, #2a2b72 55%, #1b1b4f 100%)",
    lightGradient: "linear-gradient(135deg, #9ba5ff 0%, #7b80f5 55%, #675fe8 100%)",
  },
  {
    title: "Geometry",
    subtitle: "Angles, triangles, circles and theorem-based problems",
    slug: "geometry",
    thumbnail:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #3b2466 0%, #5b2a81 55%, #7c2a78 100%)",
    lightGradient: "linear-gradient(135deg, #c183e6 0%, #a66ad9 55%, #8f51c7 100%)",
  },
  {
    title: "Mensuration",
    subtitle: "Area, perimeter, TSA, CSA and volume of solids",
    slug: "mensuration",
    thumbnail:
      "https://images.unsplash.com/photo-1453733190371-0a9bedd82893?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #4a246d 0%, #6f2a90 55%, #892bb0 100%)",
    lightGradient: "linear-gradient(135deg, #c582ff 0%, #a86bff 55%, #9054f2 100%)",
  },
  {
    title: "Trigonometry",
    subtitle: "Ratios, identities, heights and distances practice",
    slug: "trigonometry",
    thumbnail:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #3b1f63 0%, #542a86 55%, #6a2ca3 100%)",
    lightGradient: "linear-gradient(135deg, #a981ff 0%, #8d6cff 55%, #7755f2 100%)",
  },
  {
    title: "Statistics & Probability",
    subtitle: "Mean, median, mode, DI and probability rules",
    slug: "statistics-probability",
    thumbnail:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #22305f 0%, #323a80 55%, #474390 100%)",
    lightGradient: "linear-gradient(135deg, #92a8ff 0%, #788dff 55%, #6676f0 100%)",
  },
  {
    title: "Number System",
    subtitle: "HCF, LCM, divisibility, primes and base concepts",
    slug: "number-system",
    thumbnail:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=200&q=80",
    gradient: "linear-gradient(135deg, #1f3a87 0%, #1f2c61 55%, #13183d 100%)",
    lightGradient: "linear-gradient(135deg, #7fa6ff 0%, #688bf2 55%, #516bd4 100%)",
  },
];

function TopicCard({ topic }: { topic: TopicItem }) {
  const cardStyle = {
    "--topic-gradient-dark": topic.gradient,
    "--topic-gradient-light": topic.lightGradient,
  } as CSSProperties;

  return (
    <Link
      href={`/mathematics/${topic.slug}`}
      className="topic-card"
      style={cardStyle}
      aria-label={`Open ${topic.title}`}
    >
      <div className="topic-thumb-wrap">
        <img src={topic.thumbnail} alt={topic.title} className="topic-thumb" loading="lazy" />
      </div>
      <div className="topic-copy">
        <h2 className="topic-title">{topic.title}</h2>
        <p className="topic-subtitle">{topic.subtitle}</p>
      </div>
      <ChevronRight className="topic-chevron" aria-hidden="true" />
    </Link>
  );
}

export default function MathematicsPage() {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.add("math-topics-surface");
    root.classList.add("math-topics-surface");
    return () => {
      body.classList.remove("math-topics-surface");
      root.classList.remove("math-topics-surface");
    };
  }, []);

  return (
    <main className="math-topics-page">
      <div className="math-shell">
        <header className="math-header">
          <div className="header-pill">
            <Link href="/" className="header-back" aria-label="Back to home">
              <ArrowLeft size={20} strokeWidth={2.3} />
            </Link>
            <h1 className="header-title">Mathematics Topics</h1>
          </div>
        </header>

        <section className="topic-list" aria-label="Mathematics topics">
          {mathTopics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))}
        </section>
      </div>

      <style>{`
        .math-topics-page {
          min-height: 100vh;
          position: relative;
          padding: 18px 16px 24px;
          background: radial-gradient(circle at 20% 10%, #f1f5ff 0%, #e7ecf8 40%, #dfe5f3 100%);
          color: #0f172a;
          font-family: "Outfit", "Poppins", "Segoe UI", sans-serif;
          overflow: clip;
          --math-header-bg: rgba(255, 255, 255, 0.78);
          --math-header-border: rgba(15, 23, 42, 0.08);
          --math-header-text: #0f172a;
          --math-card-border: rgba(255, 255, 255, 0.48);
          --math-card-shadow: 0 18px 34px rgba(15, 23, 42, 0.16);
          --math-card-highlight: rgba(255, 255, 255, 0.26);
          --topic-text: rgba(255, 255, 255, 0.98);
          --topic-subtext: rgba(245, 247, 255, 0.82);
          --topic-chevron: rgba(240, 242, 255, 0.78);
        }

        body.theme-dark .math-topics-page {
          background: radial-gradient(circle at 18% 10%, #1d2b57 0%, #131a38 45%, #0b0f22 100%);
          color: #eef2ff;
          --math-header-bg: rgba(18, 26, 58, 0.78);
          --math-header-border: rgba(120, 130, 255, 0.2);
          --math-header-text: #eef2ff;
          --math-card-border: rgba(255, 255, 255, 0.12);
          --math-card-shadow: 0 22px 40px rgba(6, 8, 24, 0.55);
          --math-card-highlight: rgba(255, 255, 255, 0.12);
          --topic-text: rgba(255, 255, 255, 0.98);
          --topic-subtext: rgba(222, 228, 255, 0.8);
          --topic-chevron: rgba(233, 236, 255, 0.75);
        }

        .math-topics-page::before,
        .math-topics-page::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          opacity: 0.85;
          pointer-events: none;
        }

        .math-topics-page::before {
          width: 240px;
          height: 240px;
          top: -70px;
          right: -90px;
          background: radial-gradient(circle, rgba(120, 140, 255, 0.45) 0%, transparent 70%);
        }

        .math-topics-page::after {
          width: 200px;
          height: 200px;
          bottom: -80px;
          left: -70px;
          background: radial-gradient(circle, rgba(171, 117, 255, 0.35) 0%, transparent 70%);
        }

        body.theme-dark .math-topics-page::before {
          background: radial-gradient(circle, rgba(78, 99, 210, 0.55) 0%, transparent 70%);
        }

        body.theme-dark .math-topics-page::after {
          background: radial-gradient(circle, rgba(160, 96, 255, 0.4) 0%, transparent 70%);
        }

        .math-shell {
          max-width: 560px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .math-header {
          position: relative;
          z-index: 2;
          margin-bottom: 18px;
        }

        .header-pill {
          display: grid;
          grid-template-columns: 40px 1fr;
          align-items: center;
          gap: 10px;
          min-height: 64px;
          padding: 10px 16px;
          border-radius: 999px;
          background: var(--math-header-bg);
          border: 1px solid var(--math-header-border);
          box-shadow: 0 12px 30px rgba(11, 15, 32, 0.16);
          backdrop-filter: blur(16px);
        }

        .header-back {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--math-header-text);
          text-decoration: none;
          transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .header-back:hover {
          background: rgba(255, 255, 255, 0.12);
          transform: translateX(-1px);
        }

        .header-title {
          text-align: center;
          font-size: 1.08rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: var(--math-header-text);
          padding-right: 30px;
        }

        .topic-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 4px 2px 18px;
        }

        .topic-card {
          width: 100%;
          background: var(--topic-gradient-light);
          border-radius: 22px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          border: 1px solid var(--math-card-border);
          box-shadow: var(--math-card-shadow);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        body.theme-dark .topic-card {
          background: var(--topic-gradient-dark);
        }

        .topic-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), transparent 55%);
          opacity: var(--math-card-highlight);
          pointer-events: none;
        }

        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 34px rgba(9, 12, 30, 0.25);
        }

        .topic-card:focus-visible {
          outline: 2px solid rgba(148, 163, 255, 0.75);
          outline-offset: 2px;
        }

        .topic-thumb-wrap {
          flex: 0 0 auto;
          width: 58px;
          height: 58px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
        }

        body.theme-dark .topic-thumb-wrap {
          background: rgba(7, 12, 28, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.18);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
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
          font-size: 1.03rem;
          line-height: 1.2;
          font-weight: 700;
          color: var(--topic-text);
        }

        .topic-subtitle {
          margin: 6px 0 0;
          font-size: 0.86rem;
          line-height: 1.4;
          color: var(--topic-subtext);
        }

        .topic-chevron {
          margin-left: auto;
          color: var(--topic-chevron);
          opacity: 0.9;
        }

        @media (min-width: 768px) {
          .topic-list {
            gap: 14px;
          }

          .topic-card {
            border-radius: 24px;
            padding: 16px 18px;
            gap: 18px;
          }

          .topic-thumb-wrap {
            width: 64px;
            height: 64px;
          }

          .topic-title {
            font-size: 1.08rem;
          }

          .topic-subtitle {
            font-size: 0.9rem;
          }

          .header-pill {
            min-height: 70px;
            padding: 12px 20px;
          }

          .header-title {
            font-size: 1.15rem;
          }
        }
      `}</style>
    </main>
  );
}
