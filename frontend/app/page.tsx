'use client';

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/hooks/useTheme";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Subject {
  title: string;
  accentColor: string;
  href: string;
}

const subjects: Subject[] = [
  { title: "Mathematics", accentColor: "#6AA4DF", href: "/mathematics" },
  { title: "Reasoning", accentColor: "#D9869A", href: "/reasoning" },
  { title: "English", accentColor: "#7FC494", href: "/english" },
  { title: "General Awareness", accentColor: "#DCAA75", href: "/general-awareness" },
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

const LOADER_COLORS = ["#f0604a", "#4d90e8", "#2d9e4f", "#f0a020", "#a855f7", "#ec4899"] as const;

type ConfettiDot = {
  id: string;
  left: number;
  top: number;
  color: string;
  duration: number;
  delay: number;
};

const createConfettiDots = () =>
  Array.from({ length: 18 }, (_, index): ConfettiDot => ({
    id: `dot-${Date.now()}-${index}`,
    color: LOADER_COLORS[Math.floor(Math.random() * LOADER_COLORS.length)],
    left: 20 + Math.random() * 60,
    top: 40 + Math.random() * 30,
    duration: 0.6 + Math.random() * 0.6,
    delay: Math.random() * 0.3,
  }));

function HomeLoadingOverlay({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [confettiDots, setConfettiDots] = useState<ConfettiDot[]>([]);
  const startedAtRef = useRef<number>(Date.now());
  const doneTriggeredRef = useRef(false);

  useEffect(() => {
    if (pct >= 100) return;

    const speed = ready
      ? 20
      : pct < 15
        ? 80
        : pct < 85
          ? 35 + Math.random() * 40
          : 90 + Math.random() * 60;

    const timer = window.setTimeout(() => {
      setPct((current) => {
        if (ready) {
          const jump = Math.max(1, Math.ceil((100 - current) / 6));
          return Math.min(100, current + jump);
        }

        const increment = current < 85 ? (Math.random() < 0.15 ? 0 : 1) : 1;
        const cap = ready ? 100 : 95;
        return Math.min(cap, current + increment);
      });
    }, speed);

    return () => window.clearTimeout(timer);
  }, [pct, ready]);

  useEffect(() => {
    if (pct < 100 || doneTriggeredRef.current) return;

    doneTriggeredRef.current = true;
    setDone(true);
    setConfettiDots(createConfettiDots());

    let hideTimer: number | undefined;

    const showTimer = window.setTimeout(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, 900 - elapsed);
      hideTimer = window.setTimeout(onDone, remaining);
    }, 700);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [pct, onDone]);

  useEffect(() => {
    if (!confettiDots.length) return;
    const timer = window.setTimeout(() => setConfettiDots([]), 2000);
    return () => window.clearTimeout(timer);
  }, [confettiDots.length]);

  return (
    <div className="home-loader" aria-busy={true} aria-live="polite">
      <div className="home-loader__scene">
        <div className="home-loader__bar-wrap">
          <div className="home-loader__bar-track">
            <div
              className={`home-loader__bar-fill${pct >= 100 ? " done" : ""}`}
              style={{ width: `${pct}%` }}
            />
            <span className="home-loader__bar-label">LOADING {pct}%</span>
          </div>
          <div className={`home-loader__done-msg${done ? " show" : ""}`}>✓ READY!</div>
        </div>
      </div>
      <div className="home-loader__confetti" aria-hidden="true">
        {confettiDots.map((dot) => (
          <span
            key={dot.id}
            className="home-loader__dot"
            style={{
              left: `${dot.left}vw`,
              top: `${dot.top}vh`,
              background: dot.color,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, logout, refreshUser, loading } = useAuth();
  const router = useRouter();
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const recentTrackRef = useRef<HTMLDivElement | null>(null);
  const [activeRecentIndex, setActiveRecentIndex] = useState(0);
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const { theme, toggleThemeMode } = useThemeMode();
  const activeRecentIndexRef = useRef(0);
  const [hasWarmup, setHasWarmup] = useState(false);
  const [warmupOk, setWarmupOk] = useState(false);
  const [hasWindowLoaded, setHasWindowLoaded] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const isDarkMode = theme === "dark";

  useEffect(() => {
    if (!user) return;
    refreshUser().catch(() => {});
  }, [refreshUser, user?.id]);

  useEffect(() => {
    const shouldShowLoader = window.sessionStorage.getItem("home_loader_ready") !== "true";
    setShowLoader(shouldShowLoader);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handleLoad = () => {
      if (!cancelled) setHasWindowLoaded(true);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    const warmup = async () => {
      try {
        await api.get("/health", { timeout: 20000 });
        if (!cancelled) setWarmupOk(true);
      } catch {
        // ignore warmup failures
        if (!cancelled) setWarmupOk(false);
      } finally {
        if (!cancelled) setHasWarmup(true);
      }
    };

    warmup();

    return () => {
      cancelled = true;
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  useEffect(() => {
    if (isAppReady) return;
    if (!loading && hasWarmup && hasWindowLoaded) {
      setIsAppReady(true);
    }
  }, [hasWarmup, hasWindowLoaded, isAppReady, loading]);

  useEffect(() => {
    if (isAppReady) return;
    const fallback = window.setTimeout(() => setIsAppReady(true), 45000);
    return () => window.clearTimeout(fallback);
  }, [isAppReady]);

  const handleLoaderDone = useCallback(() => setShowLoader(false), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showLoader && isAppReady && warmupOk) {
      window.sessionStorage.setItem("home_loader_ready", "true");
    }
  }, [isAppReady, showLoader, warmupOk]);

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

  useEffect(() => {
    const handleScroll = () => {
      setIsNavScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isProfileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsProfileSidebarOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileSidebarOpen]);

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

  useEffect(() => {
    activeRecentIndexRef.current = 0;
    setActiveRecentIndex(0);
    const track = recentTrackRef.current;
    if (track) {
      track.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [recentQuizzes.length]);

  const handleRecentScroll = () => {
    const track = recentTrackRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll<HTMLElement>(".recent-card"));
    if (!cards.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let nextIndex = 0;
    let nearest = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < nearest) {
        nearest = distance;
        nextIndex = index;
      }
    });

    if (nextIndex !== activeRecentIndexRef.current) {
      activeRecentIndexRef.current = nextIndex;
      setActiveRecentIndex(nextIndex);
    }
  };

  const handleRecentDotClick = (index: number) => {
    const track = recentTrackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".recent-card");
    const target = cards[index];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const handleLogout = () => {
    setIsProfileSidebarOpen(false);
    logout();
    router.push('/');
  };

  const progressEntries = Object.values(user?.progress || {});
  const attemptedTotal = progressEntries.reduce((sum, item) => sum + (item.attempted || 0), 0);
  const correctTotal = progressEntries.reduce((sum, item) => sum + (item.correct || 0), 0);
  const accuracy = attemptedTotal > 0 ? Math.round((correctTotal / attemptedTotal) * 100) : 0;
  const bookmarkCount = user?.bookmarkEntries?.length || user?.bookmarks?.length || 0;
  const completedCount = user?.recentQuizzes?.filter((quiz) => quiz.status === "completed").length || 0;

  const activeRecentSafeIndex = Math.min(
    activeRecentIndex,
    Math.max(0, recentQuizzes.length - 1)
  );

  return (
    <div className="min-h-screen relative overflow-clip">
      {showLoader ? <HomeLoadingOverlay ready={isAppReady} onDone={handleLoaderDone} /> : null}
      <style>{`
        .lower-shell {
          position: relative;
          padding: clamp(2rem, 4.8vw, 3.6rem) 0 clamp(3.5rem, 7vw, 5rem);
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
          transition: background 220ms ease, border-color 220ms ease, box-shadow 220ms ease, backdrop-filter 220ms ease;
        }
        .hero-nav.nav-scrolled {
          background: rgb(8, 20, 38);
          border-bottom: 1px solid rgba(255, 255, 255, 0.26);
          box-shadow: 0 12px 30px rgba(2, 8, 18, 0.45);
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
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
          line-height: 1;
          white-space: nowrap;
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
        .profile-avatar-button {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.14);
          box-shadow: 0 8px 18px rgba(2, 8, 18, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.25);
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #e7f7ff;
          font-size: 0.86rem;
          font-weight: 800;
          line-height: 1;
          flex: 0 0 auto;
          transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
        }
        .profile-avatar-button:hover {
          transform: translateY(-1px);
          border-color: #7dd3fc;
          box-shadow: 0 10px 22px rgba(14, 165, 233, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.32);
        }
        .profile-avatar {
          width: 100%;
          height: 100%;
          display: block;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
        }
        .qm-sidebar-overlay {
          position: fixed;
          inset: 0;
          border: 0;
          background: rgba(2, 8, 23, 0.46);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s ease, visibility 0.3s ease;
          z-index: 90;
        }
        .qm-sidebar-overlay.active {
          opacity: 1;
          visibility: visible;
        }
        .qm-sidebar {
          --qm-primary: #6366f1;
          --qm-primary-light: #e0e7ff;
          --qm-bg: #f8fafc;
          --qm-surface: #ffffff;
          --qm-text-primary: #1e293b;
          --qm-text-secondary: #64748b;
          --qm-text-muted: #94a3b8;
          --qm-border: #e2e8f0;
          --qm-danger: #ef4444;
          --qm-purple: #8b5cf6;
          --qm-card: #f8fafc;
          --qm-shadow: rgba(2, 8, 18, 0.22);
          --qm-premium-bg: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          --qm-premium-title: #92400e;
          --qm-premium-text: #b45309;
          position: fixed;
          top: 0;
          right: 0;
          width: min(78vw, 320px);
          height: 100vh;
          height: 100dvh;
          background: var(--qm-surface);
          color: var(--qm-text-primary);
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 91;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          box-shadow: -16px 0 40px var(--qm-shadow);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color-scheme: light;
        }
        body.theme-dark .qm-sidebar {
          --qm-primary: #818cf8;
          --qm-primary-light: rgba(129, 140, 248, 0.16);
          --qm-bg: #0f172a;
          --qm-surface: #111827;
          --qm-text-primary: #f8fafc;
          --qm-text-secondary: #cbd5e1;
          --qm-text-muted: #94a3b8;
          --qm-border: rgba(148, 163, 184, 0.22);
          --qm-danger: #f87171;
          --qm-purple: #a78bfa;
          --qm-card: rgba(15, 23, 42, 0.82);
          --qm-shadow: rgba(0, 0, 0, 0.42);
          --qm-premium-bg: linear-gradient(135deg, rgba(146, 64, 14, 0.36) 0%, rgba(120, 53, 15, 0.48) 100%);
          --qm-premium-title: #fde68a;
          --qm-premium-text: #fbbf24;
          color-scheme: dark;
        }
        body.theme-dark .qm-sidebar-overlay {
          background: rgba(0, 0, 0, 0.64);
        }
        @media (prefers-color-scheme: dark) {
          body:not(.theme-light) .qm-sidebar {
            --qm-primary: #818cf8;
            --qm-primary-light: rgba(129, 140, 248, 0.16);
            --qm-bg: #0f172a;
            --qm-surface: #111827;
            --qm-text-primary: #f8fafc;
            --qm-text-secondary: #cbd5e1;
            --qm-text-muted: #94a3b8;
            --qm-border: rgba(148, 163, 184, 0.22);
            --qm-danger: #f87171;
            --qm-purple: #a78bfa;
            --qm-card: rgba(15, 23, 42, 0.82);
            --qm-shadow: rgba(0, 0, 0, 0.42);
            --qm-premium-bg: linear-gradient(135deg, rgba(146, 64, 14, 0.36) 0%, rgba(120, 53, 15, 0.48) 100%);
            --qm-premium-title: #fde68a;
            --qm-premium-text: #fbbf24;
            color-scheme: dark;
          }
          body:not(.theme-light) .qm-sidebar-overlay {
            background: rgba(0, 0, 0, 0.64);
          }
        }
        .qm-sidebar.active {
          transform: translateX(0);
        }
        .qm-sidebar::-webkit-scrollbar {
          width: 0;
        }
        .qm-sidebar-header {
          padding: 14px 16px;
          display: flex;
          justify-content: flex-end;
        }
        .qm-close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: var(--qm-text-primary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }
        .qm-close-btn:hover {
          background: var(--qm-bg);
        }
        .qm-icon {
          width: 24px;
          height: 24px;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
        }
        .qm-profile-section {
          padding: 0 16px 18px;
          text-align: center;
        }
        .qm-profile-avatar {
          position: relative;
          width: 72px;
          height: 72px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          border-radius: 50%;
          background: var(--qm-primary-light);
          color: var(--qm-primary);
          font-size: 1.65rem;
          font-weight: 800;
          border: 3px solid var(--qm-surface);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: visible;
        }
        .qm-profile-avatar-image {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
        }
        .qm-edit-avatar {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 28px;
          height: 28px;
          background: var(--qm-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--qm-surface);
          color: white;
        }
        .qm-edit-avatar .qm-icon {
          width: 16px;
          height: 16px;
        }
        .qm-profile-name {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .qm-profile-email {
          font-size: 13px;
          color: var(--qm-text-secondary);
          margin-bottom: 12px;
          word-break: break-word;
        }
        .qm-level-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--qm-primary-light);
          color: var(--qm-primary);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .qm-level-badge .qm-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
          stroke: none;
        }
        .qm-xp-bar {
          width: 100%;
          max-width: 220px;
          margin: 0 auto;
        }
        .qm-xp-progress {
          height: 6px;
          background: var(--qm-border);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .qm-xp-fill {
          width: 69%;
          height: 100%;
          background: linear-gradient(90deg, var(--qm-primary), var(--qm-purple));
          border-radius: 3px;
        }
        .qm-xp-text {
          font-size: 12px;
          color: var(--qm-text-muted);
        }
        .qm-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          padding: 0 14px;
          margin-bottom: 22px;
        }
        .qm-stat-item {
          text-align: center;
          padding: 10px 2px;
        }
        .qm-stat-icon {
          font-size: 20px;
          margin-bottom: 6px;
        }
        .qm-stat-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--qm-text-primary);
          margin-bottom: 2px;
        }
        .qm-stat-label {
          font-size: 11px;
          color: var(--qm-text-muted);
        }
        .qm-sidebar-section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--qm-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0 16px;
          margin-bottom: 8px;
        }
        .qm-sidebar-list,
        .qm-settings-list,
        .qm-account-list {
          padding: 0 16px;
          margin-bottom: 18px;
        }
        .qm-sidebar-item,
        .qm-setting-item,
        .qm-account-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 0;
          border: 0;
          border-bottom: 1px solid var(--qm-border);
          background: transparent;
          color: var(--qm-text-primary);
          text-align: left;
          cursor: pointer;
          font: inherit;
          text-decoration: none;
        }
        .qm-setting-item {
          padding: 14px 0;
        }
        .qm-sidebar-item:last-child,
        .qm-setting-item:last-child,
        .qm-account-item:last-child {
          border-bottom: none;
        }
        .qm-item-icon,
        .qm-setting-icon,
        .qm-account-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          background: var(--qm-card);
        }
        .qm-item-icon.blue { background: #dbeafe; }
        .qm-item-icon.red { background: #fee2e2; }
        .qm-item-icon.green { background: #dcfce7; }
        .qm-item-icon.purple { background: #ede9fe; }
        body.theme-dark .qm-item-icon.blue { background: rgba(59, 130, 246, 0.18); }
        body.theme-dark .qm-item-icon.red { background: rgba(248, 113, 113, 0.18); }
        body.theme-dark .qm-item-icon.green { background: rgba(34, 197, 94, 0.18); }
        body.theme-dark .qm-item-icon.purple { background: rgba(167, 139, 250, 0.18); }
        @media (prefers-color-scheme: dark) {
          body:not(.theme-light) .qm-item-icon.blue { background: rgba(59, 130, 246, 0.18); }
          body:not(.theme-light) .qm-item-icon.red { background: rgba(248, 113, 113, 0.18); }
          body:not(.theme-light) .qm-item-icon.green { background: rgba(34, 197, 94, 0.18); }
          body:not(.theme-light) .qm-item-icon.purple { background: rgba(167, 139, 250, 0.18); }
        }
        .qm-item-info {
          flex: 1;
          min-width: 0;
        }
        .qm-item-name,
        .qm-setting-name,
        .qm-account-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }
        .qm-item-meta,
        .qm-setting-value {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--qm-text-muted);
        }
        .qm-chevron {
          color: var(--qm-text-muted);
          font-size: 1.35rem;
          line-height: 1;
        }
        .qm-achievements-row {
          display: flex;
          gap: 8px;
          padding: 0 16px;
          margin-bottom: 18px;
        }
        .qm-achievement-item {
          flex: 1;
          background: var(--qm-card);
          border-radius: 12px;
          padding: 12px 6px;
          text-align: center;
        }
        .qm-achievement-icon {
          font-size: 20px;
          margin-bottom: 6px;
        }
        .qm-achievement-value {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .qm-achievement-label {
          font-size: 11px;
          color: var(--qm-text-muted);
        }
        .qm-toggle {
          width: 44px;
          height: 24px;
          background: var(--qm-border);
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: background 0.3s;
          flex-shrink: 0;
        }
        .qm-toggle.active {
          background: var(--qm-primary);
        }
        .qm-toggle-knob {
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.3s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .qm-toggle.active .qm-toggle-knob {
          transform: translateX(20px);
        }
        .qm-premium-banner {
          margin: 0 16px 18px;
          background: var(--qm-premium-bg);
          border: 1px solid color-mix(in srgb, var(--qm-premium-text) 22%, transparent);
          border-radius: 16px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .qm-premium-icon {
          font-size: 28px;
        }
        .qm-premium-info {
          flex: 1;
          min-width: 0;
        }
        .qm-premium-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--qm-premium-title);
          margin-bottom: 2px;
        }
        .qm-premium-desc {
          font-size: 12px;
          color: var(--qm-premium-text);
        }
        .qm-premium-btn {
          background: var(--qm-primary);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .qm-account-item.logout,
        .qm-account-item.logout .qm-account-icon {
          color: var(--qm-danger);
        }
        .qm-account-badge {
          background: var(--qm-primary-light);
          color: var(--qm-primary);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        @media (max-width: 420px) {
          .qm-sidebar {
            width: 82vw;
            max-width: 310px;
          }
          .qm-stats-grid {
            gap: 4px;
            padding: 0 14px;
          }
          .qm-premium-banner {
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .qm-premium-btn {
            margin-left: 40px;
          }
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
          padding: 8.25rem 1.5rem calc(6.5rem + env(safe-area-inset-bottom));
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
        .ios-card-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          max-width: 760px;
          margin: 0 auto;
          padding: 0;
        }
        .ios-action-card {
          --card-accent: #6aa4df;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.9rem;
          min-height: 84px;
          padding: 1rem 1.1rem;
          border-radius: 24px;
          text-decoration: none;
          color: #0f172a;
          background: linear-gradient(160deg, rgba(249, 250, 252, 0.5) 0%, rgba(236, 240, 245, 0.38) 52%, rgba(229, 233, 239, 0.3) 100%);
          border: 1px solid rgba(255, 255, 255, 0.58);
          backdrop-filter: blur(16px) saturate(135%);
          -webkit-backdrop-filter: blur(16px) saturate(135%);
          box-shadow:
            0 18px 34px rgba(8, 15, 30, 0.22),
            0 4px 12px rgba(8, 15, 30, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.74),
            inset 0 -10px 18px rgba(148, 163, 184, 0.22);
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, background 220ms ease;
          overflow: hidden;
        }
        .ios-action-card::before {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.08) 56%, rgba(148, 163, 184, 0.12) 100%);
          pointer-events: none;
        }
        .ios-action-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.7);
          box-shadow:
            0 20px 36px rgba(8, 15, 30, 0.25),
            0 6px 16px rgba(8, 15, 30, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -10px 18px rgba(148, 163, 184, 0.26);
        }
        .ios-action-card:active {
          transform: translateY(0);
        }
        .ios-card-main {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          position: relative;
          z-index: 1;
        }
        .ios-card-accent {
          width: 4px;
          height: 34px;
          border-radius: 999px;
          background: var(--card-accent);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55), 0 4px 10px rgba(30, 41, 59, 0.16);
          flex-shrink: 0;
        }
        .ios-card-label {
          font-weight: 700;
          font-size: clamp(0.94rem, 1.8vw, 1.08rem);
          letter-spacing: 0.01em;
        }
        .ios-card-chevron {
          position: relative;
          z-index: 1;
          font-size: 1.15rem;
          font-weight: 700;
          color: rgba(30, 41, 59, 0.7);
          line-height: 1;
        }
        .battle-action-card {
          width: min(86vw, 420px);
        }
        .battle-action-card .ios-card-main {
          flex: 1;
        }
        .battle-action-card .ios-card-label {
          font-size: clamp(1rem, 2.1vw, 1.2rem);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
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
        @media (max-width: 820px) { .pill-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 420px; gap: 0.8rem; padding: 0; } .pill-card { min-height: 60px; padding: 7px 14px; } .pill-content { font-size: clamp(0.85rem,3.8vw,1rem); } .ios-card-grid { max-width: 420px; gap: 0.8rem; } .ios-action-card { min-height: 70px; padding: 0.8rem 0.9rem; border-radius: 20px; } .ios-card-accent { height: 30px; } }
        @media (max-width: 640px) {
          .hero-section { min-height: 100vh; min-height: 100svh; background-position: center top; }
          .hero-content { min-height: 100vh; min-height: 100svh; padding-top: 5.5rem; padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); text-align: center; }
          .lower-shell { padding-top: 1.25rem; }
          .hero-kicker { letter-spacing: 0.24em; font-size: 0.68rem; justify-content: center; }
          .hero-title { font-size: clamp(2rem, 9vw, 3rem); }
          .hero-copy { margin: 0 auto 1.6rem; }
          .hero-actions { flex-direction: column; align-items: center; }
          .hero-btn { width: min(86vw, 320px); }
          .auth-pill { padding: 6px 12px; font-size: 0.8rem; }
          .profile-avatar-button { width: 32px; height: 32px; font-size: 0.76rem; }
          .nav-brand { font-size: 1rem; }
          .guru-neon { letter-spacing: 0.05em; font-size: 1.5rem; }
          .guru-neon::before { text-shadow: -1px -1px 3px rgba(255,255,255,0.9); }
          .guru-neon::after { text-shadow: 1px 1px 4px rgba(0,0,0,0.6); transform: none; opacity: 1; }
          .pill-grid { max-width: 380px; gap: 0.6rem; padding: 0; }
          .pill-card { min-height: 54px; padding: 7px 10px; }
          .pill-content { font-size: clamp(0.78rem,3.2vw,0.92rem); letter-spacing: 0.01em; text-transform: none; padding: 0 0.15rem; }
          .ios-card-grid { max-width: 380px; gap: 0.6rem; }
          .ios-action-card { min-height: 62px; padding: 0.7rem 0.78rem; border-radius: 18px; }
          .ios-card-main { gap: 0.65rem; }
          .ios-card-accent { width: 3px; height: 26px; }
          .ios-card-label { font-size: clamp(0.82rem, 3.2vw, 0.95rem); letter-spacing: 0.01em; }
          .ios-card-chevron { font-size: 1rem; }
          .battle-action-card { width: min(86vw, 320px); }
          .battle-action-card .ios-card-label { font-size: clamp(0.95rem, 4.2vw, 1.1rem); letter-spacing: 0.07em; }
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
        .recent-carousel {
          position: relative;
        }
        .recent-track {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          padding: 0.2rem 0.25rem 0.85rem;
          margin: 0 -0.25rem;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .recent-track::-webkit-scrollbar {
          display: none;
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
          flex: 0 0 clamp(240px, 78vw, 360px);
          scroll-snap-align: center;
          scroll-snap-stop: always;
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
        .recent-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          margin-top: 0.4rem;
        }
        .recent-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(226, 244, 255, 0.35);
          border: none;
          padding: 0;
          cursor: pointer;
          opacity: 0.65;
          transition: width 200ms ease, background 200ms ease, opacity 200ms ease, box-shadow 200ms ease;
        }
        .recent-dot.is-active {
          width: 22px;
          background: #7dd3fc;
          opacity: 1;
          box-shadow: 0 0 14px rgba(125, 211, 252, 0.55);
        }
        @media (max-width: 640px) {
          .recent-header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .recent-section {
            width: 100%;
          }
        }
        @media (prefers-reduced-motion: reduce) { .pill-card { animation: none; transform: none; opacity: 1; transition: none; } .pill-card::before, .pill-card::after { animation: none; } .recent-track { scroll-behavior: auto; } }
      `}</style>

      {/* ── Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 glass hero-nav ${isNavScrolled ? "nav-scrolled" : ""}`}>
        <div className="w-full h-14 sm:h-16 flex items-center justify-between gap-3 px-4 sm:px-6 md:px-10">
          <div className="flex items-center gap-2.5">
            <span className="text-base sm:text-2xl font-extrabold tracking-wide font-sans text-white whitespace-nowrap leading-none nav-brand">
              STUDY WITH GURU
            </span>
          </div>

          {/* ── Auth buttons in navbar ── */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <span className="text-sm text-slate-200 hidden sm:block">Hi, {user.name.split(' ')[0]}</span>
                <Link href="/dashboard" className="text-sm font-semibold nav-link transition">
                  Dashboard
                </Link>
                <button
                  onClick={() => setIsProfileSidebarOpen(true)}
                  className="profile-avatar-button"
                  aria-label="Open profile menu"
                  aria-expanded={isProfileSidebarOpen}
                  title="Profile"
                >
                  {user.avatar ? (
                    <span
                      aria-hidden="true"
                      className="profile-avatar"
                      style={{ backgroundImage: `url("${user.avatar}")` }}
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
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
              </div>

              <div className="ios-card-grid">
                {subjects.map((subject, i) => (
                  <Link
                    key={subject.title}
                    href={subject.href}
                    className="ios-action-card animate-fade-in-up"
                    style={{
                      animationDelay: `${700 + i * 120}ms`,
                      ["--card-accent" as string]: subject.accentColor,
                    }}
                  >
                    <span className="ios-card-main">
                      <span className="ios-card-accent" aria-hidden="true" />
                      <span className="ios-card-label">{subject.title}</span>
                    </span>
                    <span className="ios-card-chevron" aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>

              <div className="battle-dock">
                <Link
                  href="/battle"
                  className="ios-action-card battle-action-card animate-fade-in-up"
                  style={{
                    animationDelay: "1100ms",
                    ["--card-accent" as string]: "#9ba8ff",
                  }}
                >
                  <span className="ios-card-main">
                    <span className="ios-card-accent" aria-hidden="true" />
                    <span className="ios-card-label">BATTLE MODE</span>
                  </span>
                  <span className="ios-card-chevron" aria-hidden="true">›</span>
                </Link>
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
                    <div className="recent-carousel">
                      <div
                        className="recent-track"
                        ref={recentTrackRef}
                        onScroll={handleRecentScroll}
                        role="list"
                      >
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
                            <Link
                              key={entry.quizKey}
                              href={resumeHref}
                              className="recent-card"
                              role="listitem"
                            >
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
                      {recentQuizzes.length > 1 ? (
                        <div className="recent-dots">
                          {recentQuizzes.map((entry, index) => (
                            <button
                              key={entry.quizKey ?? `${entry.subject}-${index}`}
                              type="button"
                              aria-label={`Go to recent quiz ${index + 1}`}
                              aria-current={
                                index === activeRecentSafeIndex ? "true" : undefined
                              }
                              className={`recent-dot ${
                                index === activeRecentSafeIndex ? "is-active" : ""
                              }`}
                              onClick={() => handleRecentDotClick(index)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {user ? (
        <>
          <button
            type="button"
            className={`qm-sidebar-overlay ${isProfileSidebarOpen ? "active" : ""}`}
            aria-label="Close profile menu"
            onClick={() => setIsProfileSidebarOpen(false)}
          />

          <aside
            className={`qm-sidebar ${isProfileSidebarOpen ? "active" : ""}`}
            aria-hidden={!isProfileSidebarOpen}
          >
            <div className="qm-sidebar-header">
              <button
                type="button"
                className="qm-close-btn"
                aria-label="Close profile menu"
                onClick={() => setIsProfileSidebarOpen(false)}
              >
                <svg className="qm-icon" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="qm-profile-section">
              <div className="qm-profile-avatar">
                {user.avatar ? (
                  <span
                    className="qm-profile-avatar-image"
                    aria-hidden="true"
                    style={{ backgroundImage: `url("${user.avatar}")` }}
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
                <div className="qm-edit-avatar" aria-hidden="true">
                  <svg className="qm-icon" viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              </div>
              <div className="qm-profile-name">{user.name}</div>
              <div className="qm-profile-email">{user.email}</div>
              <div className="qm-level-badge">
                <svg className="qm-icon" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Level 12
              </div>
              <div className="qm-xp-bar">
                <div className="qm-xp-progress">
                  <div className="qm-xp-fill" />
                </div>
                <div className="qm-xp-text">XP: 3,450 / 5,000</div>
              </div>
            </div>

            <div className="qm-stats-grid">
              <div className="qm-stat-item">
                <div className="qm-stat-icon">🎯</div>
                <div className="qm-stat-value">{accuracy}%</div>
                <div className="qm-stat-label">Accuracy</div>
              </div>
              <div className="qm-stat-item">
                <div className="qm-stat-icon">⚡</div>
                <div className="qm-stat-value">5</div>
                <div className="qm-stat-label">Day Streak</div>
              </div>
              <div className="qm-stat-item">
                <div className="qm-stat-icon">🏆</div>
                <div className="qm-stat-value">{attemptedTotal}</div>
                <div className="qm-stat-label">Questions</div>
              </div>
              <div className="qm-stat-item">
                <div className="qm-stat-icon">🔥</div>
                <div className="qm-stat-value">12</div>
                <div className="qm-stat-label">Best Streak</div>
              </div>
            </div>

            <div className="qm-sidebar-section-title">My Learning</div>
            <div className="qm-sidebar-list">
              <Link href="/dashboard" className="qm-sidebar-item" onClick={() => setIsProfileSidebarOpen(false)}>
                <div className="qm-item-icon blue">🔖</div>
                <div className="qm-item-info">
                  <div className="qm-item-name">Bookmarked Questions</div>
                </div>
                <div className="qm-item-meta">
                  <span>{bookmarkCount}</span>
                  <span className="qm-chevron">›</span>
                </div>
              </Link>
              <button type="button" className="qm-sidebar-item">
                <div className="qm-item-icon red">❌</div>
                <div className="qm-item-info">
                  <div className="qm-item-name">Incorrect Questions</div>
                </div>
                <div className="qm-item-meta">
                  <span>56</span>
                  <span className="qm-chevron">›</span>
                </div>
              </button>
              <Link href="/dashboard" className="qm-sidebar-item" onClick={() => setIsProfileSidebarOpen(false)}>
                <div className="qm-item-icon green">✅</div>
                <div className="qm-item-info">
                  <div className="qm-item-name">Completed Quizzes</div>
                </div>
                <div className="qm-item-meta">
                  <span>{completedCount}</span>
                  <span className="qm-chevron">›</span>
                </div>
              </Link>
              <Link href="/dashboard" className="qm-sidebar-item" onClick={() => setIsProfileSidebarOpen(false)}>
                <div className="qm-item-icon purple">🕐</div>
                <div className="qm-item-info">
                  <div className="qm-item-name">Practice History</div>
                </div>
                <div className="qm-item-meta">
                  <span className="qm-chevron">›</span>
                </div>
              </Link>
            </div>

            <div className="qm-sidebar-section-title">Achievements</div>
            <div className="qm-achievements-row">
              <div className="qm-achievement-item">
                <div className="qm-achievement-icon">🪙</div>
                <div className="qm-achievement-value">1,250</div>
                <div className="qm-achievement-label">Coins</div>
              </div>
              <div className="qm-achievement-item">
                <div className="qm-achievement-icon">🛡️</div>
                <div className="qm-achievement-value">18</div>
                <div className="qm-achievement-label">Badges</div>
              </div>
              <div className="qm-achievement-item">
                <div className="qm-achievement-icon">📊</div>
                <div className="qm-achievement-value">Top 15%</div>
                <div className="qm-achievement-label">Leaderboard</div>
              </div>
            </div>

            <div className="qm-sidebar-section-title">Settings</div>
            <div className="qm-settings-list">
              <button
                type="button"
                className="qm-setting-item"
                role="switch"
                aria-checked={isDarkMode}
                aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                onClick={toggleThemeMode}
              >
                <div className="qm-setting-icon">{isDarkMode ? "🌙" : "☀️"}</div>
                <div className="qm-setting-name">Appearance</div>
                <div className="qm-setting-value">{isDarkMode ? "Dark" : "Light"}</div>
                <div className={`qm-toggle ${isDarkMode ? "active" : ""}`} aria-hidden="true">
                  <div className="qm-toggle-knob" />
                </div>
              </button>
              <button
                type="button"
                className="qm-setting-item"
                onClick={() => setIsSoundOn((value) => !value)}
              >
                <div className="qm-setting-icon">🔊</div>
                <div className="qm-setting-name">Sound</div>
                <div className={`qm-toggle ${isSoundOn ? "active" : ""}`} aria-hidden="true">
                  <div className="qm-toggle-knob" />
                </div>
              </button>
              <button type="button" className="qm-setting-item">
                <div className="qm-setting-icon">🌐</div>
                <div className="qm-setting-name">Language</div>
                <div className="qm-setting-value">
                  English
                  <span className="qm-chevron">›</span>
                </div>
              </button>
              <button type="button" className="qm-setting-item">
                <div className="qm-setting-icon">🔔</div>
                <div className="qm-setting-name">Notifications</div>
                <span className="qm-chevron">›</span>
              </button>
            </div>

            <div className="qm-premium-banner">
              <div className="qm-premium-icon">👑</div>
              <div className="qm-premium-info">
                <div className="qm-premium-title">QuizMaster Premium</div>
                <div className="qm-premium-desc">Unlock unlimited quizzes, ads-free experience and more!</div>
              </div>
              <button type="button" className="qm-premium-btn">Upgrade Now</button>
            </div>

            <div className="qm-sidebar-section-title">Account</div>
            <div className="qm-account-list">
              <button type="button" className="qm-account-item">
                <div className="qm-account-icon">👤</div>
                <div className="qm-account-name">Edit Profile</div>
                <span className="qm-chevron">›</span>
              </button>
              <button type="button" className="qm-account-item">
                <div className="qm-account-icon">🔒</div>
                <div className="qm-account-name">Change Password</div>
                <span className="qm-chevron">›</span>
              </button>
              <button type="button" className="qm-account-item">
                <div className="qm-account-icon">🎁</div>
                <div className="qm-account-name">Invite Friends</div>
                <span className="qm-account-badge">Earn Coins</span>
                <span className="qm-chevron">›</span>
              </button>
              <button type="button" className="qm-account-item">
                <div className="qm-account-icon">❓</div>
                <div className="qm-account-name">Help & Support</div>
                <span className="qm-chevron">›</span>
              </button>
              <button type="button" className="qm-account-item">
                <div className="qm-account-icon">ℹ️</div>
                <div className="qm-account-name">About QuizMaster</div>
                <span className="qm-chevron">›</span>
              </button>
              <button type="button" className="qm-account-item logout" onClick={handleLogout}>
                <div className="qm-account-icon">↩️</div>
                <div className="qm-account-name">Logout</div>
              </button>
            </div>

            <div style={{ height: 20 }} />
          </aside>
        </>
      ) : null}

      {/* ── Subject Boxes ── */}
    </div>
  );
}
