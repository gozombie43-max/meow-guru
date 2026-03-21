'use client';

import Link from "next/link";
import { Menu, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface Subject {
  title: string;
  baseColor: string;
  lightColor: string;
  darkColor: string;
  glowColor: string;
  href: string;
}

const subjects: Subject[] = [
  { title: "Mathematics", baseColor: "#5B9FE0", lightColor: "#A5CDF0", darkColor: "#4A80B3", glowColor: "rgba(91, 159, 224, 0.4)", href: "/mathematics" },
  { title: "Reasoning", baseColor: "#E05B7A", lightColor: "#F0A6B8", darkColor: "#B34A62", glowColor: "rgba(224, 91, 122, 0.4)", href: "/reasoning" },
  { title: "English", baseColor: "#7ACD6A", lightColor: "#B3E3A8", darkColor: "#62A457", glowColor: "rgba(122, 205, 106, 0.4)", href: "/english" },
  { title: "General Awareness", baseColor: "#F0A050", lightColor: "#F7C28E", darkColor: "#C08040", glowColor: "rgba(240, 160, 80, 0.4)", href: "/general-awareness" },
];

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <style>{`
        .pill-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
          max-width: 760px;
          margin: 0 auto;
          padding: 0 1rem;
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
          min-height: 66px;
          padding: 8px 18px;
          color: #fff;
          text-decoration: none;
          background:
            radial-gradient(circle at 18% 16%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 58%),
            radial-gradient(circle at 82% 84%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 54%),
            linear-gradient(126deg, color-mix(in srgb, var(--pill-light) 82%, #fff 18%) 0%, var(--pill-base) 46%, color-mix(in srgb, var(--pill-dark) 88%, #0f172a 12%) 100%);
          border: 1px solid color-mix(in srgb, var(--pill-light) 62%, white 38%);
          box-shadow:
            0 10px 20px color-mix(in srgb, var(--pill-base) 50%, transparent),
            0 0 18px color-mix(in srgb, var(--pill-glow) 70%, transparent),
            inset 0 1px 0 rgba(255,255,255,0.46),
            inset 0 -10px 18px rgba(10,20,40,0.16);
          transform: scale(0.6);
          opacity: 0;
          animation: pill-entry 500ms cubic-bezier(0.34,1.56,0.64,1) forwards, pill-breathe 4.8s ease-in-out infinite, pill-chroma 6.6s linear infinite;
          transition: transform 220ms ease, box-shadow 220ms ease, filter 220ms ease;
          will-change: transform, box-shadow, filter;
        }
        .pill-card::before {
          content: "";
          position: absolute;
          top: -38%; left: -45%;
          width: 38%; height: 180%;
          background: linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 44%, rgba(255,255,255,0.62) 50%, rgba(255,255,255,0.2) 56%, rgba(255,255,255,0) 100%);
          transform: translateX(-190%) rotate(12deg);
          animation: pill-shimmer 4.8s cubic-bezier(0.4,0,0.2,1) infinite;
          pointer-events: none; z-index: 0;
        }
        .pill-card::after {
          content: "";
          position: absolute; inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22), 0 0 28px color-mix(in srgb, var(--pill-glow) 78%, transparent);
          opacity: 0.72;
          animation: pill-glow-pulse 4.8s ease-in-out infinite;
          pointer-events: none;
        }
        .pill-card:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.05) saturate(1.08); box-shadow: 0 16px 30px color-mix(in srgb, var(--pill-base) 62%, transparent), 0 0 22px color-mix(in srgb, var(--pill-glow) 85%, transparent), inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -10px 18px rgba(10,20,40,0.2); }
        .pill-card:hover::before { animation-duration: 2.2s; }
        .pill-card:active { transform: scale(0.97); transition-duration: 80ms; }
        .pill-gloss-top { position: absolute; top: -2%; left: 8%; width: 84%; height: 48%; background: radial-gradient(ellipse at top, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 74%); opacity: 0.26; border-radius: 999px 999px 120px 120px; pointer-events: none; z-index: 1; }
        .pill-gloss-bottom { position: absolute; bottom: 8%; left: 20%; width: 55%; height: 20%; background: radial-gradient(ellipse at center, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0) 74%); opacity: 0.2; border-radius: 999px; pointer-events: none; z-index: 1; }
        .guru-neon {
          background: linear-gradient(95deg, #49f6ff 0%, #39b5ff 18%, #72ff9f 36%, #faff58 52%, #ff8a00 70%, #ff3a8c 84%, #49f6ff 100%);
          background-size: 340% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: guru-neon-shift 3.9s linear infinite;
          text-shadow: 0 0 10px rgba(73,246,255,0.72), 0 0 20px rgba(255,138,0,0.48), 0 0 36px rgba(255,58,140,0.36);
        }
        @keyframes guru-neon-shift { 0% { background-position: 0% 50%; filter: hue-rotate(0deg); } 50% { background-position: 100% 50%; filter: hue-rotate(68deg); } 100% { background-position: 0% 50%; filter: hue-rotate(0deg); } }
        .pill-content { position: relative; z-index: 2; font-family: "Trebuchet MS","Segoe UI",sans-serif; font-size: clamp(0.95rem,1.7vw,1.1rem); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.28), 0 0 16px color-mix(in srgb, var(--pill-light) 55%, transparent); text-align: center; padding: 0 0.35rem; }
        @keyframes pill-entry { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pill-breathe { 0%,100% { box-shadow: 0 10px 20px color-mix(in srgb, var(--pill-base) 52%, transparent), 0 0 16px color-mix(in srgb, var(--pill-glow) 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -9px 16px rgba(10,20,40,0.14); } 50% { box-shadow: 0 12px 24px color-mix(in srgb, var(--pill-base) 58%, transparent), 0 0 28px color-mix(in srgb, var(--pill-glow) 88%, transparent), inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -9px 16px rgba(10,20,40,0.16); } }
        @keyframes pill-chroma { 0%,100% { filter: hue-rotate(0deg) saturate(1); } 50% { filter: hue-rotate(14deg) saturate(1.08); } }
        @keyframes pill-glow-pulse { 0%,100% { opacity: 0.5; box-shadow: 0 0 20px color-mix(in srgb, var(--pill-glow) 60%, transparent); } 50% { opacity: 0.82; box-shadow: 0 0 32px color-mix(in srgb, var(--pill-glow) 86%, transparent); } }
        @keyframes pill-shimmer { 0% { transform: translateX(-170%) rotate(12deg); opacity: 0; } 10% { opacity: 0.9; } 22% { transform: translateX(330%) rotate(12deg); opacity: 0.9; } 30%,100% { transform: translateX(330%) rotate(12deg); opacity: 0; } }
        @media (max-width: 820px) { .pill-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 420px; gap: 0.75rem; padding: 0 0.85rem; } .pill-card { min-height: 58px; padding: 7px 14px; } .pill-content { font-size: clamp(0.85rem,3.8vw,1rem); } }
        @media (max-width: 640px) { .hero-mobile-offset { padding-top: 9.5rem; padding-bottom: 2.75rem; } .pill-grid { max-width: 380px; gap: 0.55rem; padding: 0 0.65rem; } .pill-card { min-height: 50px; padding: 6px 10px; } .pill-content { font-size: clamp(0.72rem,2.9vw,0.84rem); letter-spacing: 0.02em; text-transform: none; padding: 0 0.15rem; } }
        @media (prefers-reduced-motion: reduce) { .pill-card { animation: none; transform: none; opacity: 1; transition: none; } .pill-card::before, .pill-card::after { animation: none; } }
      `}</style>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-500" />
            <span className="text-base sm:text-3xl font-extrabold tracking-wide font-sans guru-neon whitespace-nowrap leading-none">
              STUDY WITH GURU
            </span>
          </div>

          {/* ── Auth buttons in navbar ── */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-slate-600 hidden sm:block">Hi, {user.name.split(' ')[0]}</span>
                <Link href="/dashboard" className="text-sm font-semibold text-slate-700 hover:text-cyan-500 transition">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-red-400 hover:text-red-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-cyan-500 transition">
                  Login
                </Link>
                <Link href="/register" className="text-sm font-semibold bg-cyan-500 text-white px-4 py-1.5 rounded-full hover:bg-cyan-600 transition">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-36 sm:pt-32 pb-24 px-6 hero-mobile-offset">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: "500ms" }}>
            <button className="btn-outline px-8 py-3.5 rounded-xl font-medium text-base cursor-pointer">
              Explore Subjects
            </button>
          </div>
        </div>
      </section>

      {/* ── Subject Boxes ── */}
      <section className="relative pb-24">
        <div className="w-full">
          <div className="text-center mb-10 px-6 subject-heading-wrap">
            <h2 className="animate-fade-in-up text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold mb-4 text-[var(--text-primary)] subject-heading-title" style={{ animationDelay: "600ms", fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif" }}>
              Choose Your <span className="gradient-text">Subject</span>
            </h2>
            <p className="animate-fade-in-up text-slate-500 subject-heading-copy" style={{ animationDelay: "650ms" }}>
              Select a subject to begin your practice session
            </p>
          </div>

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

      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      <p className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 text-black font-bold text-sm sm:text-base text-center">
        Developed by : Gurucharan Murmu
      </p>
    </div>
  );
}