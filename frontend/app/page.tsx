import Link from "next/link";
import {
  Menu, ArrowRight, Zap,
} from "lucide-react";

/* ── Subject data ─────────────────────────────────────── */

interface Subject {
  title: string;
  baseColor: string;
  lightColor: string;
  darkColor: string;
  glowColor: string;
  href: string;
}

const subjects: Subject[] = [
  {
    title: "Mathematics",
    baseColor: "#5B9FE0",
    lightColor: "#A5CDF0",
    darkColor: "#4A80B3",
    glowColor: "rgba(91, 159, 224, 0.4)",
    href: "/mathematics",
  },
  {
    title: "Reasoning",
    baseColor: "#E05B7A",
    lightColor: "#F0A6B8",
    darkColor: "#B34A62",
    glowColor: "rgba(224, 91, 122, 0.4)",
    href: "/reasoning",
  },
  {
    title: "English",
    baseColor: "#7ACD6A",
    lightColor: "#B3E3A8",
    darkColor: "#62A457",
    glowColor: "rgba(122, 205, 106, 0.4)",
    href: "/english",
  },
  {
    title: "General Awareness",
    baseColor: "#F0A050",
    lightColor: "#F7C28E",
    darkColor: "#C08040",
    glowColor: "rgba(240, 160, 80, 0.4)",
    href: "/general-awareness",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <style>{`
        .pill-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          max-width: 860px;
          margin: 0 auto;
          padding: 0 1.25rem;
        }

        .pill-card {
          --pill-base: #5b9fe0;
          --pill-light: #a5cdf0;
          --pill-dark: #4a80b3;
          --pill-glow: rgba(91, 159, 224, 0.4);
          position: relative;
          overflow: hidden;
          border: 0;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 88px;
          padding: 14px 26px;
          color: #fff;
          text-decoration: none;
          background:
            radial-gradient(circle at 20% 16%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.1) 28%, rgba(255, 255, 255, 0) 58%),
            radial-gradient(circle at 52% 96%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 50%),
            linear-gradient(140deg, var(--pill-light) 2%, var(--pill-base) 52%, var(--pill-dark) 100%);
          box-shadow:
            0 10px 26px color-mix(in srgb, var(--pill-base) 54%, transparent),
            0 3px 10px color-mix(in srgb, var(--pill-dark) 38%, transparent),
            0 0 18px color-mix(in srgb, var(--pill-base) 20%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -8px 16px rgba(0, 0, 0, 0.1);
          transform: scale(0.6);
          opacity: 0;
          animation:
            pill-entry 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            pill-breathe 4.8s ease-in-out infinite;
          transition: transform 240ms ease, box-shadow 240ms ease, filter 240ms ease;
          will-change: transform, box-shadow, filter;
        }

        .pill-card::before {
          content: "";
          position: absolute;
          top: -34%;
          left: -42%;
          width: 40%;
          height: 170%;
          background: linear-gradient(
            115deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.2) 44%,
            rgba(255, 255, 255, 0.62) 50%,
            rgba(255, 255, 255, 0.2) 56%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-170%) rotate(12deg);
          animation: pill-shimmer 4.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
          z-index: 0;
        }

        .pill-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: 0 0 24px rgba(255, 140, 50, 0.22);
          opacity: 0.6;
          animation: pill-glow-pulse 4.8s ease-in-out infinite;
          pointer-events: none;
        }

        .pill-card:hover {
          transform: scale(1.05);
          filter: brightness(1.04);
          box-shadow:
            0 16px 34px color-mix(in srgb, var(--pill-base) 64%, transparent),
            0 0 20px color-mix(in srgb, var(--pill-base) 30%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.42),
            inset 0 -8px 16px rgba(0, 0, 0, 0.1);
        }

        .pill-card:hover::before {
          animation-duration: 2.2s;
        }

        .pill-card:active {
          transform: scale(0.96);
          box-shadow:
            0 4px 14px color-mix(in srgb, var(--pill-base) 58%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -5px 12px rgba(0, 0, 0, 0.14);
          transition-duration: 80ms;
        }

        .pill-gloss-top {
          position: absolute;
          top: -2%;
          left: 8%;
          width: 84%;
          height: 48%;
          background: radial-gradient(ellipse at top, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0) 74%);
          opacity: 0.32;
          border-radius: 999px 999px 120px 120px;
          pointer-events: none;
          z-index: 1;
        }

        .pill-gloss-bottom {
          position: absolute;
          bottom: 8%;
          left: 20%;
          width: 55%;
          height: 20%;
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.46) 0%, rgba(255, 255, 255, 0) 74%);
          opacity: 0.24;
          border-radius: 999px;
          pointer-events: none;
          z-index: 1;
        }

        .guru-neon {
          background: linear-gradient(95deg, #66fff2 0%, #6ad9ff 24%, #8ec5ff 48%, #7dff90 72%, #66fff2 100%);
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: guru-neon-shift 5.6s linear infinite;
          text-shadow:
            0 0 8px rgba(102, 255, 242, 0.45),
            0 0 16px rgba(106, 217, 255, 0.35),
            0 0 24px rgba(125, 255, 144, 0.25);
        }

        @keyframes guru-neon-shift {
          0% {
            background-position: 0% 50%;
            filter: hue-rotate(0deg);
          }
          50% {
            background-position: 100% 50%;
            filter: hue-rotate(26deg);
          }
          100% {
            background-position: 0% 50%;
            filter: hue-rotate(0deg);
          }
        }

        .pill-content {
          position: relative;
          z-index: 2;
          font-family: "Segoe UI", "Helvetica Neue", sans-serif;
          font-size: clamp(1rem, 2vw, 1.25rem);
          font-weight: 600;
          letter-spacing: 0.02em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
          text-align: center;
          padding: 0 0.5rem;
        }

        @keyframes pill-entry {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          70% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes pill-breathe {
          0%,
          100% {
            box-shadow:
              0 10px 26px color-mix(in srgb, var(--pill-base) 54%, transparent),
              0 3px 10px color-mix(in srgb, var(--pill-dark) 38%, transparent),
              0 0 16px rgba(255, 140, 50, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.35),
              inset 0 -8px 16px rgba(0, 0, 0, 0.1);
          }
          50% {
            box-shadow:
              0 12px 30px color-mix(in srgb, var(--pill-base) 58%, transparent),
              0 4px 12px color-mix(in srgb, var(--pill-dark) 42%, transparent),
              0 0 26px rgba(255, 140, 50, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.4),
              inset 0 -8px 16px rgba(0, 0, 0, 0.1);
          }
        }

        @keyframes pill-glow-pulse {
          0%,
          100% {
            opacity: 0.42;
            box-shadow: 0 0 18px rgba(255, 140, 50, 0.2);
          }
          50% {
            opacity: 0.74;
            box-shadow: 0 0 28px rgba(255, 140, 50, 0.34);
          }
        }

        @keyframes pill-shimmer {
          0% {
            transform: translateX(-170%) rotate(12deg);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          22% {
            transform: translateX(310%) rotate(12deg);
            opacity: 0.9;
          }
          30%,
          100% {
            transform: translateX(310%) rotate(12deg);
            opacity: 0;
          }
        }

        @media (max-width: 820px) {
          .pill-grid {
            grid-template-columns: 1fr;
            max-width: 520px;
            gap: 0.9rem;
            padding: 0 1rem;
          }

          .pill-card {
            min-height: 74px;
            padding: 10px 18px;
          }

          .pill-content {
            font-size: clamp(0.95rem, 4vw, 1.12rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pill-card {
            animation: none;
            transform: none;
            opacity: 1;
            transition: none;
          }

          .pill-card::before,
          .pill-card::after {
            animation: none;
          }
        }
      `}</style>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-500" />
            <span className="text-sm sm:text-xl font-bold tracking-tight font-sans guru-neon whitespace-nowrap leading-none">
              STUDY WITH GURU
            </span>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-36 sm:pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="animate-fade-in-up developer-credit mb-12"
            style={{ animationDelay: "250ms" }}
          >
            Developed by{" "}
            <span className="gradient-text-subtle font-medium">
              Gurucharan
            </span>
          </p>

          {/* CTA Buttons */}
          <div
            className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "500ms" }}
          >
            <Link
              href="/mathematics"
              className="btn-glow px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2 text-base cursor-pointer"
            >
              start practicing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="btn-outline px-8 py-3.5 rounded-xl font-medium text-base cursor-pointer">
              Explore Subjects
            </button>
          </div>
        </div>
      </section>

      {/* ── Subject Boxes ── */}
      <section className="relative pb-24">
        <div className="w-full">
          {/* Section heading */}
          <div className="text-center mb-10 px-6">
            <h2
              className="animate-fade-in-up text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold mb-4 text-[var(--text-primary)]"
              style={{ animationDelay: "600ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
            >
              Choose Your <span className="gradient-text">Subject</span>
            </h2>
            <p
              className="animate-fade-in-up text-slate-500"
              style={{ animationDelay: "650ms" }}
            >
              Select a subject to begin your practice session
            </p>
          </div>

          {/* Glossy pill subject grid */}
          <div className="pill-grid">
            {subjects.map((subject, i) => (
              <Link
                key={subject.title}
                href={subject.href}
                className="pill-card"
                style={{
                  animationDelay: `${700 + i * 120}ms, ${i * 360}ms`,
                  ["--pill-base" as string]: subject.baseColor,
                  ["--pill-light" as string]: subject.lightColor,
                  ["--pill-dark" as string]: subject.darkColor,
                  ["--pill-glow" as string]: subject.glowColor,
                }}
              >
                <div className="pill-gloss-top" aria-hidden="true" />
                <div className="pill-content">{subject.title}</div>
                <div className="pill-gloss-bottom" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer accent line ── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
    </div>
  );
}