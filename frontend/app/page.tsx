'use client';

import Link from "next/link";
import { Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

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

const SUBJECT_META = {
  mathematics: {
    label: "Mathematics",
    badge: "rgba(91, 159, 224, 0.25)",
    text: "#d9efff",
    accent: "linear-gradient(90deg, #7dd3fc, #38bdf8)",
  },
  reasoning: {
    label: "Reasoning",
    badge: "rgba(224, 91, 122, 0.25)",
    text: "#ffd1df",
    accent: "linear-gradient(90deg, #f472b6, #fb7185)",
  },
  english: {
    label: "English",
    badge: "rgba(122, 205, 106, 0.25)",
    text: "#dafbd0",
    accent: "linear-gradient(90deg, #86efac, #22c55e)",
  },
  "general-awareness": {
    label: "General Awareness",
    badge: "rgba(240, 160, 80, 0.25)",
    text: "#ffe0c4",
    accent: "linear-gradient(90deg, #fdba74, #fb923c)",
  },
  default: {
    label: "Quiz",
    badge: "rgba(148, 163, 184, 0.3)",
    text: "#e2e8f0",
    accent: "linear-gradient(90deg, #94a3b8, #cbd5f5)",
  },
} as const;

export default function Home() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    refreshUser().catch(() => {});
  }, [refreshUser, user?.id]);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.add('home-hero');
    root.classList.add('home-hero');
    return () => {
      body.classList.remove('home-hero');
      root.classList.remove('home-hero');
    };
  }, []);

  const recentQuizzes = useMemo(() => {
    if (!user?.recentQuizzes) return [];
    return [...user.recentQuizzes]
      .filter((entry) => entry && entry.quizKey)
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || "") || 0;
        const bTime = Date.parse(b.updatedAt || "") || 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [user?.recentQuizzes]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen relative overflow-clip">
      <style>{`
        .lower-shell {
          position: relative;
          padding: clamp(2.75rem, 6vw, 4.5rem) 0 clamp(3.5rem, 7vw, 5rem);
          background: transparent;
        }
        .subject-panel {
          position: relative;
          z-index: 2;
          width: min(980px, 92vw);
          margin: 0 auto;
          padding: clamp(2rem, 6vw, 3.25rem) clamp(1.4rem, 5vw, 3rem) clamp(2.2rem, 6vw, 3.2rem);
          background: transparent;
          border-radius: 32px;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }
        .subject-heading-title { color: #f8fafc; }
        .subject-heading-copy { color: rgba(226, 244, 255, 0.78); }
        .hero-nav {
          background: rgba(8, 20, 38, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 10px 30px rgba(5, 10, 20, 0.2);
        }
        .nav-brand {
          color: #dff6ff;
        }
        .nav-link {
          color: rgba(226, 244, 255, 0.88);
        }
        .nav-link:hover {
          color: #6ee7ff;
        }
        .auth-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 20px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.01em;
          transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease, color 200ms ease;
        }
        .auth-pill-outline {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #e7f7ff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }
        .auth-pill-outline:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
        body.has-bottom-nav {
          padding-bottom: 0 !important;
        }
        .auth-pill-solid {
          background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%);
          color: #031326;
          box-shadow: 0 10px 24px rgba(14, 165, 233, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .auth-pill-solid:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(14, 165, 233, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .hero-section {
          position: relative;
          overflow: clip;
          min-height: 100vh;
          min-height: 100svh;
          color: #f8fafc;
          background-image:
            linear-gradient(120deg, rgba(6, 18, 38, 0.45) 0%, rgba(8, 22, 44, 0.35) 46%, rgba(6, 18, 36, 0.25) 100%),
            radial-gradient(900px 360px at 14% 18%, rgba(34, 211, 238, 0.18), transparent 70%),
            var(--hero-image, linear-gradient(135deg, #0b1c33 0%, #142746 45%, #0a1a2e 100%));
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        .hero-section::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(6, 12, 24, 0.05) 0%, rgba(6, 12, 24, 0.45) 100%);
          z-index: 1;
        }
        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 1100px;
          margin: 0 auto;
          padding: 9.5rem 1.5rem calc(6.5rem + env(safe-area-inset-bottom));
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: center;
          min-height: 100vh;
          min-height: 100svh;
        }
        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: rgba(207, 243, 255, 0.85);
          margin-bottom: 1.4rem;
        }
        .hero-title {
          font-size: clamp(2.2rem, 4.8vw, 4.5rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          margin-bottom: 1.4rem;
          text-shadow: 0 12px 30px rgba(2, 8, 18, 0.55);
        }
        .hero-highlight {
          display: inline-block;
          background: linear-gradient(90deg, #67e8f9 0%, #38bdf8 40%, #2dd4bf 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 24px rgba(103, 232, 249, 0.35);
        }
        .hero-copy {
          max-width: 560px;
          font-size: clamp(1rem, 2.1vw, 1.2rem);
          color: rgba(226, 244, 255, 0.78);
          line-height: 1.65;
          margin-bottom: 2.2rem;
          text-shadow: 0 8px 20px rgba(2, 8, 18, 0.4);
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .battle-dock {
          left: 50%;
        }
        .hero-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          border-radius: 999px;
          font-weight: 700;
          letter-spacing: 0.02em;
          font-size: 1rem;
          transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease, color 200ms ease;
        }
        .hero-btn-primary {
          background: linear-gradient(120deg, #22d3ee 0%, #38bdf8 70%);
          color: #031826;
          box-shadow: 0 16px 30px rgba(34, 211, 238, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .hero-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(34, 211, 238, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }
        .hero-btn-ghost {
          background: rgba(15, 23, 42, 0.55);
          color: #e2f4ff;
          border: 1px solid rgba(255, 255, 255, 0.32);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        .hero-btn-ghost:hover {
          transform: translateY(-1px);
          background: rgba(15, 23, 42, 0.7);
        }
        .pill-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          max-width: 760px;
          margin: 0 auto;
          padding: 0;
        }
        .liquid-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          max-width: 760px;
          margin: 0 auto;
          padding: 0;
        }
        .liquid-subject {
          justify-content: center;
          text-align: center;
          border-radius: 999px;
          min-height: 68px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1.5px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 12px 28px rgba(2, 6, 14, 0.15), inset 0 2px 0 rgba(255, 255, 255, 1);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
        }
        .liquid-subject:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 16px 36px rgba(2, 6, 14, 0.2), inset 0 2px 0 rgba(255, 255, 255, 1);
        }
        .liquid-subject .btn-label {
          color: #0f172a;
          font-weight: 800;
          font-size: clamp(0.95rem, 1.8vw, 1.15rem);
          letter-spacing: 0.02em;
        }
        .liquid-battle {
          width: min(86vw, 420px);
          min-height: 72px;
          padding: 20px 40px;
          border-radius: 999px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          justify-content: center;
        }
        .liquid-battle .btn-label {
          color: #f8fafc;
          font-weight: 900;
          width: 100%;
          text-align: center;
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
          min-height: 68px;
          padding: 10px 18px;
          color: #fff;
          text-decoration: none;
          background:
            radial-gradient(circle at 16% 18%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 34%, rgba(255,255,255,0) 62%),
            radial-gradient(circle at 80% 84%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 60%),
            linear-gradient(130deg, color-mix(in srgb, var(--pill-light) 78%, #fff 22%) 0%, var(--pill-base) 45%, color-mix(in srgb, var(--pill-dark) 84%, #111827 16%) 100%);
          border: 1px solid color-mix(in srgb, var(--pill-light) 72%, white 28%);
          box-shadow:
            0 18px 36px color-mix(in srgb, var(--pill-base) 40%, transparent),
            0 8px 18px rgba(15, 23, 42, 0.12),
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -10px 18px rgba(15, 23, 42, 0.12);
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
        .pill-content { position: relative; z-index: 2; font-family: "Avenir Next","Segoe UI",sans-serif; font-size: clamp(0.95rem,1.8vw,1.15rem); font-weight: 700; letter-spacing: 0.02em; text-transform: none; text-shadow: 0 1px 2px rgba(0,0,0,0.22), 0 0 18px color-mix(in srgb, var(--pill-light) 55%, transparent); text-align: center; padding: 0 0.35rem; }
        .battle-cta {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 18px 44px;
          border-radius: 999px;
          font-weight: 900;
          font-size: clamp(1.05rem,2.5vw,1.45rem);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #f8fafc;
          text-decoration: none;
          background: linear-gradient(120deg, #7c5cff 0%, #b76bff 38%, #ff7ccf 70%, #7dd3fc 100%);
          background-size: 200% 200%;
          border: 1px solid rgba(255,255,255,0.55);
          box-shadow:
            0 18px 40px rgba(124, 92, 255, 0.35),
            0 8px 18px rgba(15, 23, 42, 0.12),
            inset 0 2px 0 rgba(255,255,255,0.5);
          transform: translateY(8px) scale(0.96);
          opacity: 0;
          animation: battle-entry 520ms cubic-bezier(0.22,1.28,0.36,1) forwards, glow-pulse 3.6s ease-in-out infinite, color-wave 7.2s ease-in-out infinite;
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
          overflow: hidden;
        }
        .battle-cta-text { position: relative; z-index: 2; text-shadow: 0 2px 6px rgba(0,0,0,0.45); }
        .battle-cta::before {
          content: "";
          position: absolute;
          inset: -12px;
          border-radius: inherit;
          background: radial-gradient(circle, rgba(147, 197, 253, 0.55) 0%, rgba(147, 197, 253, 0) 70%);
          filter: blur(8px);
          opacity: 0.85;
          pointer-events: none;
          z-index: 1;
        }
        .battle-cta::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(130deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 55%);
          opacity: 0.7;
          animation: wind-sheen 3.8s ease-in-out infinite;
          pointer-events: none;
          z-index: 1;
        }
        .battle-cta:hover { transform: translateY(2px) scale(1.01); filter: brightness(1.05) saturate(1.05); box-shadow: 0 22px 44px rgba(124, 92, 255, 0.45), 0 0 30px rgba(248, 113, 113, 0.35), inset 0 2px 0 rgba(255,255,255,0.6); }
        .battle-cta:active { transform: translateY(10px) scale(0.98); transition-duration: 80ms; }
        @keyframes battle-entry { 0% { transform: translateY(18px) scale(0.9); opacity: 0; } 70% { transform: translateY(-2px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes glow-pulse { 0%,100% { box-shadow: 0 14px 30px rgba(138,77,255,0.32), 0 0 22px rgba(240,132,255,0.55), inset 0 2px 0 rgba(255,255,255,0.4); } 50% { box-shadow: 0 20px 40px rgba(138,77,255,0.5), 0 0 36px rgba(240,132,255,0.85), inset 0 2px 0 rgba(255,255,255,0.5); } }
        @keyframes color-wave {
          0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
          35% { background-position: 55% 45%; filter: hue-rotate(10deg); }
          70% { background-position: 100% 55%; filter: hue-rotate(18deg); }
          100% { background-position: 0% 50%; filter: hue-rotate(0deg); }
        }
        @keyframes wind-sheen { 0%,100% { opacity: 0.55; transform: translateX(-6%) translateY(0); } 50% { opacity: 0.9; transform: translateX(6%) translateY(-2%); } }
        @keyframes pill-entry { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pill-breathe { 0%,100% { box-shadow: 0 10px 20px color-mix(in srgb, var(--pill-base) 52%, transparent), 0 0 16px color-mix(in srgb, var(--pill-glow) 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -9px 16px rgba(10,20,40,0.14); } 50% { box-shadow: 0 12px 24px color-mix(in srgb, var(--pill-base) 58%, transparent), 0 0 28px color-mix(in srgb, var(--pill-glow) 88%, transparent), inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -9px 16px rgba(10,20,40,0.16); } }
        @keyframes pill-chroma { 0%,100% { filter: hue-rotate(0deg) saturate(1); } 50% { filter: hue-rotate(14deg) saturate(1.08); } }
        @keyframes pill-glow-pulse { 0%,100% { opacity: 0.5; box-shadow: 0 0 20px color-mix(in srgb, var(--pill-glow) 60%, transparent); } 50% { opacity: 0.82; box-shadow: 0 0 32px color-mix(in srgb, var(--pill-glow) 86%, transparent); } }
        @keyframes pill-shimmer { 0% { transform: translateX(-170%) rotate(12deg); opacity: 0; } 10% { opacity: 0.9; } 22% { transform: translateX(330%) rotate(12deg); opacity: 0.9; } 30%,100% { transform: translateX(330%) rotate(12deg); opacity: 0; } }
        @media (max-width: 820px) { .pill-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 420px; gap: 0.8rem; padding: 0; } .pill-card { min-height: 60px; padding: 7px 14px; } .pill-content { font-size: clamp(0.85rem,3.8vw,1rem); } .liquid-grid { max-width: 420px; gap: 0.8rem; } .liquid-subject { min-height: 60px; padding: 10px 14px; } }
        @media (max-width: 640px) {
          .hero-section { min-height: 100vh; min-height: 100svh; background-position: center top; }
          .hero-content { min-height: 100vh; min-height: 100svh; padding-top: 7.75rem; padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); text-align: center; }
          .hero-kicker { letter-spacing: 0.24em; font-size: 0.68rem; justify-content: center; }
          .hero-title { font-size: clamp(2rem, 9vw, 3rem); }
          .hero-copy { margin: 0 auto 1.6rem; }
          .hero-actions { flex-direction: column; align-items: center; }
          .hero-btn { width: min(86vw, 320px); }
          .auth-pill { padding: 6px 14px; font-size: 0.82rem; }
          .nav-brand { font-size: 1rem; }
          .pill-grid { max-width: 380px; gap: 0.6rem; padding: 0; }
          .pill-card { min-height: 54px; padding: 7px 10px; }
          .pill-content { font-size: clamp(0.78rem,3.2vw,0.92rem); letter-spacing: 0.01em; text-transform: none; padding: 0 0.15rem; }
          .liquid-grid { max-width: 380px; gap: 0.6rem; }
          .liquid-subject { min-height: 54px; padding: 8px 12px; }
          .liquid-subject .btn-label { font-size: clamp(0.85rem, 3.2vw, 0.98rem); letter-spacing: 0.01em; }
          .liquid-battle { min-height: 52px; padding: 12px 26px; font-size: clamp(0.98rem, 4.2vw, 1.12rem); letter-spacing: 0.1em; }
          .battle-cta {
            width: min(86vw, 320px);
            min-height: 52px;
            padding: 12px 26px;
            font-size: clamp(0.98rem, 4.2vw, 1.12rem);
            letter-spacing: 0.08em;
          }
          .battle-cta-text { white-space: nowrap; line-height: 1; }
          .battle-cta::before { inset: -10px; }
          .battle-dock { margin-top: 2rem; }
        }
        .battle-dock {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          margin-top: 2.4rem;
        }
        .battle-credit {
          color: rgba(226, 244, 255, 0.78);
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.01em;
        }
        .recent-section {
          margin-top: 2.5rem;
          width: min(820px, 96%);
        }
        .recent-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.2rem;
        }
        .recent-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #f8fafc;
        }
        .recent-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: #7dd3fc;
          transition: color 200ms ease;
        }
        .recent-link:hover {
          color: #a5f3fc;
        }
        .recent-empty {
          color: rgba(226, 244, 255, 0.7);
          font-size: 0.9rem;
          text-align: center;
          padding: 1rem 0 0.2rem;
        }
        .recent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .recent-card {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 16px 18px;
          border-radius: 22px;
          background: rgba(10, 18, 34, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 14px 30px rgba(7, 15, 35, 0.35);
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }
        .recent-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.4);
          box-shadow: 0 18px 36px rgba(7, 15, 35, 0.45);
        }
        .recent-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .recent-tag {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .recent-progress {
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(226, 244, 255, 0.8);
        }
        .recent-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
        }
        .recent-card-sub {
          font-size: 0.8rem;
          color: rgba(226, 244, 255, 0.7);
        }
        .recent-bar {
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          overflow: hidden;
          margin-top: 0.2rem;
        }
        .recent-bar span {
          display: block;
          height: 100%;
          border-radius: 999px;
          transition: width 300ms ease;
        }
        .recent-action {
          font-size: 0.85rem;
          font-weight: 600;
          color: #7dd3fc;
        }
        @media (max-width: 640px) {
          .recent-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .recent-section {
            width: 100%;
          }
        }
        @media (prefers-reduced-motion: reduce) { .pill-card { animation: none; transform: none; opacity: 1; transition: none; } .pill-card::before, .pill-card::after { animation: none; } }
      `}</style>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass hero-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-500" />
            <span className="text-base sm:text-3xl font-extrabold tracking-wide font-sans guru-neon whitespace-nowrap leading-none nav-brand">
              STUDY WITH GURU
            </span>
          </div>

          {/* ── Auth buttons in navbar ── */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-slate-200 hidden sm:block">Hi, {user.name.split(' ')[0]}</span>
                <Link href="/dashboard" className="text-sm font-semibold nav-link transition">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-red-200 hover:text-red-400 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="auth-pill auth-pill-outline">
                  Login
                </Link>
                <Link href="/register" className="auth-pill auth-pill-solid">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="hero-section" style={{ ["--hero-image" as string]: "url('/study-hero.jpg')" }}>
        <div className="hero-content">
          <section className="lower-shell" id="subjects">
            <div className="subject-panel">
              <div className="text-center mb-10 px-4 sm:px-6 subject-heading-wrap">
                <h2 className="animate-fade-in-up text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold mb-3 subject-heading-title" style={{ animationDelay: "600ms", fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif" }}>
                  Choose Your <span className="gradient-text">Subject</span>
                </h2>
                <p className="animate-fade-in-up subject-heading-copy" style={{ animationDelay: "650ms" }}>
                  Select a subject to begin your practice session
                </p>
              </div>

              <div className="liquid-grid">
                {subjects.map((subject, i) => (
                  <Link
                    key={subject.title}
                    href={subject.href}
                    className="liquid-btn liquid-subject animate-fade-in-up"
                    style={{
                      animationDelay: `${700 + i * 120}ms`,
                      ["--liquid-cyan" as string]: subject.lightColor,
                      ["--liquid-teal" as string]: subject.baseColor,
                      ["--liquid-purple" as string]: subject.darkColor,
                    }}
                  >
                    <span className="btn-label">{subject.title}</span>
                  </Link>
                ))}
              </div>

              <div className="battle-dock">
                <Link
                  href="/battle"
                  className="liquid-btn liquid-battle animate-fade-in-up"
                  style={{
                    animationDelay: "1100ms",
                    ["--liquid-cyan" as string]: "#7c5cff",
                    ["--liquid-teal" as string]: "#ff7ccf",
                    ["--liquid-purple" as string]: "#7dd3fc",
                  }}
                >
                  <span className="btn-label">Battle Mode</span>
                </Link>
                <p className="battle-credit">Developed by Gurucharan Murmu</p>
                <div className="recent-section">
                  <div className="recent-header">
                    <h3 className="recent-title">Recent Quizzes</h3>
                    {user && recentQuizzes.length > 0 ? (
                      <Link href="/dashboard" className="recent-link">
                        View All
                      </Link>
                    ) : null}
                  </div>
                  {!user ? (
                    <p className="recent-empty">Login to see your recent quizzes.</p>
                  ) : recentQuizzes.length === 0 ? (
                    <p className="recent-empty">
                      No recent quizzes yet. Start one to see it here.
                    </p>
                  ) : (
                    <div className="recent-grid">
                      {recentQuizzes.map((entry) => {
                        const meta =
                          SUBJECT_META[
                            entry.subject as keyof typeof SUBJECT_META
                          ] || SUBJECT_META.default;
                        const submittedCount =
                          entry.submittedQuestions?.length ?? Math.max(entry.currentIndex ?? 0, 0);
                        const total = entry.totalQuestions ?? 0;
                        const progress =
                          total > 0
                            ? Math.round((submittedCount / total) * 100)
                            : 0;
                        const resumeHref = entry.mode
                          ? `${entry.href}?mode=${entry.mode}&resume=1`
                          : `${entry.href}?resume=1`;
                        const currentLabel =
                          total > 0
                            ? `Q${Math.min((entry.currentIndex ?? 0) + 1, total)}`
                            : "your last question";
                        return (
                          <Link key={entry.quizKey} href={resumeHref} className="recent-card">
                            <div className="recent-card-top">
                              <span
                                className="recent-tag"
                                style={{ background: meta.badge, color: meta.text }}
                              >
                                {meta.label}
                              </span>
                              <span className="recent-progress">
                                {total > 0 ? `${submittedCount}/${total}` : `${submittedCount}+`}
                              </span>
                            </div>
                            <div className="recent-card-title">{entry.title}</div>
                            <div className="recent-card-sub">
                              {entry.status === "completed"
                                ? "Completed"
                                : `Continue from ${currentLabel}`}
                            </div>
                            <div className="recent-bar">
                              <span style={{ width: `${progress}%`, background: meta.accent }} />
                            </div>
                            <div className="recent-action">
                              {entry.status === "completed" ? "Review →" : "Continue →"}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* ── Subject Boxes ── */}
    </div>
  );
}