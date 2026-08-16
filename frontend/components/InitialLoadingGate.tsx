"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import {
  Wifi,
  Database,
  Shield,
  Rocket,
  Check,
  Loader2,
  Lock,
  Zap,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import styles from "./InitialLoadingGate.module.css";

interface StepItem {
  id: "connecting" | "resources" | "session" | "finalizing";
  title: string;
  subtext: string;
  icon: React.ElementType;
  status: "pending" | "progress" | "done" | "ready" | "warning";
  statusLabel: string;
}

const MOTIVATIONAL_QUOTES = [
  { text: "Small daily progress leads to big results.", author: "Keep Going!" },
  { text: "Consistency beats talent when talent doesn't work hard.", author: "Study Guru" },
  { text: "Every mock test is one step closer to your dream rank.", author: "Stay Focused" },
];

const BOOT_SESSION_KEY = "app-initial-boot-complete";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function InitialLoadingGate() {
  const { user, loading: authLoading } = useAuth();
  const authLoadingRef = useRef(authLoading);
  const userRef = useRef(user);

  useEffect(() => {
    authLoadingRef.current = authLoading;
    userRef.current = user;
  }, [authLoading, user]);

  const [showGate, setShowGate] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(15);
  const targetProgressRef = useRef(15);
  const currentProgressRef = useRef(15);
  const hasRunRef = useRef(false);

  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showRecoveryOption, setShowRecoveryOption] = useState(false);
  const [retryIndex, setRetryIndex] = useState(0);

  const [steps, setSteps] = useState<StepItem[]>([
    {
      id: "connecting",
      title: "Connecting",
      subtext: "Establishing secure connection",
      icon: Wifi,
      status: "progress",
      statusLabel: "In Progress",
    },
    {
      id: "resources",
      title: "Loading Resources",
      subtext: "Fetching questions & data",
      icon: Database,
      status: "pending",
      statusLabel: "Pending",
    },
    {
      id: "session",
      title: "Verifying Session",
      subtext: "Checking your session",
      icon: Shield,
      status: "pending",
      statusLabel: "Pending",
    },
    {
      id: "finalizing",
      title: "Finalizing",
      subtext: "Almost there...",
      icon: Rocket,
      status: "pending",
      statusLabel: "Pending",
    },
  ]);

  // Strictly monotonic target progress increment helper
  const setTargetProgress = useCallback((val: number) => {
    targetProgressRef.current = Math.max(targetProgressRef.current, Math.min(100, val));
  }, []);

  // Smooth frame-by-frame interpolation loop for 60fps/120fps fluid progress
  useEffect(() => {
    let animationFrameId: number;

    const animateProgress = () => {
      const target = targetProgressRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        // Continuous smooth easing step (minimum 0.35% per frame)
        const diff = target - current;
        const step = Math.max(0.35, diff * 0.085);
        const next = Math.min(target, current + step);
        currentProgressRef.current = next;
        setDisplayProgress(Math.round(next));
      }

      animationFrameId = requestAnimationFrame(animateProgress);
    };

    animationFrameId = requestAnimationFrame(animateProgress);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const updateStep = useCallback(
    (id: StepItem["id"], updates: Partial<StepItem>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const finishAndOpenWebsite = useCallback(() => {
    setTargetProgress(100);
    updateStep("finalizing", { status: "done", statusLabel: "Done" });

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(BOOT_SESSION_KEY, "1");
        document.documentElement.classList.remove("app-is-booting");
      } catch {
        // Safe fallback
      }
    }

    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setShowGate(false);
      }, 650);
    }, 600);
  }, [setTargetProgress, updateStep]);

  const runAllChecks = useCallback(async () => {
    setShowRecoveryOption(false);
    setTargetProgress(20);

    const recoveryTimer = setTimeout(() => {
      setShowRecoveryOption(true);
    }, 8000);

    try {
      // ── Step 1: Connecting ────────────────────────────────
      updateStep("connecting", { status: "progress", statusLabel: "In Progress" });
      await sleep(400);

      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        updateStep("connecting", { status: "done", statusLabel: "Done" });
      } else {
        updateStep("connecting", { status: "warning", statusLabel: "Offline" });
      }
      setTargetProgress(45);

      // ── Step 2: Loading Resources & Storage ──────────────
      updateStep("resources", { status: "progress", statusLabel: "In Progress" });
      await sleep(450);

      let storageHealthy = true;
      try {
        const testKey = "__test_app_storage__";
        localStorage.setItem(testKey, "1");
        localStorage.removeItem(testKey);
      } catch {
        storageHealthy = false;
      }

      if (storageHealthy) {
        updateStep("resources", { status: "ready", statusLabel: "Ready" });
      } else {
        updateStep("resources", { status: "warning", statusLabel: "Cached" });
      }
      setTargetProgress(70);

      // ── Step 3: Verifying Session ────────────────────────
      updateStep("session", { status: "progress", statusLabel: "In Progress" });

      if (authLoadingRef.current) {
        await Promise.race([
          new Promise((resolve) => {
            const checkAuth = setInterval(() => {
              if (!authLoadingRef.current) {
                clearInterval(checkAuth);
                resolve(true);
              }
            }, 80);
          }),
          sleep(1400),
        ]);
      } else {
        await sleep(350);
      }

      const currentUser = userRef.current;
      updateStep("session", {
        status: "done",
        statusLabel: "Done",
        subtext: currentUser ? `User: ${currentUser.name?.split(" ")[0] || "Active"}` : "Session verified",
      });
      setTargetProgress(90);

      // ── Step 4: Finalizing ───────────────────────────────
      updateStep("finalizing", { status: "progress", statusLabel: "In Progress" });

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
      try {
        const controller = new AbortController();
        const apiTimeout = setTimeout(() => controller.abort(), 1200);
        await fetch(`${apiBase.replace(/\/$/, "")}/health`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        }).catch(() => null);
        clearTimeout(apiTimeout);
      } catch {
        // Safe skip
      }

      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await Promise.race([document.fonts.ready, sleep(300)]);
        } catch {
          // ignore
        }
      }

      await sleep(350);
      clearTimeout(recoveryTimer);
      finishAndOpenWebsite();
    } catch (err) {
      console.warn("Bootstrap diagnostics fallback:", err);
      finishAndOpenWebsite();
    }
  }, [finishAndOpenWebsite, setTargetProgress, updateStep]);

  // Quote rotation timer
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 4000);
    return () => clearInterval(quoteInterval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __triggerSystemDiagnostics?: () => void }).__triggerSystemDiagnostics = () => {
        try {
          sessionStorage.removeItem(BOOT_SESSION_KEY);
          document.documentElement.classList.add("app-is-booting");
        } catch { /* ignore */ }
        targetProgressRef.current = 15;
        currentProgressRef.current = 15;
        setDisplayProgress(15);
        setShowGate(true);
        setIsExiting(false);
        setRetryIndex((r) => r + 1);
      };

      (window as unknown as { __previewLoadingScreen?: (duration?: number) => void }).__previewLoadingScreen = (duration = 30000) => {
        setShowGate(true);
        setIsExiting(false);
        targetProgressRef.current = 48;
        currentProgressRef.current = 48;
        setDisplayProgress(48);
        setSteps([
          { id: "connecting", title: "Connecting", subtext: "Establishing secure connection", icon: Wifi, status: "done", statusLabel: "Done" },
          { id: "resources", title: "Loading Resources", subtext: "Fetching questions & data", icon: Database, status: "ready", statusLabel: "Ready" },
          { id: "session", title: "Verifying Session", subtext: "Checking your session", icon: Shield, status: "progress", statusLabel: "In Progress" },
          { id: "finalizing", title: "Finalizing", subtext: "Almost there...", icon: Rocket, status: "pending", statusLabel: "Pending" },
        ]);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => setShowGate(false), 650);
        }, duration);
      };

      const alreadyBooted = sessionStorage.getItem(BOOT_SESSION_KEY) === "1";
      if (alreadyBooted) {
        setShowGate(false);
        document.documentElement.classList.remove("app-is-booting");
        return;
      }
    }

    runAllChecks();
  }, [retryIndex, runAllChecks]);

  const handleRetry = () => {
    targetProgressRef.current = 15;
    currentProgressRef.current = 15;
    setDisplayProgress(15);
    setRetryIndex((idx) => idx + 1);
  };

  const handleForceOpen = () => {
    finishAndOpenWebsite();
  };

  const currentQuote = useMemo(() => MOTIVATIONAL_QUOTES[quoteIndex], [quoteIndex]);

  return (
    <aside
      id="app-initial-boot-overlay"
      className={`${styles.overlay} ${!showGate ? styles.overlayHidden : isExiting ? styles.overlayExiting : ""}`}
      aria-label="Application loading and system diagnostics"
      role="dialog"
      aria-modal="true"
    >
      {/* Background Ambient Glows & Vector Waves */}
      <div className={styles.ambientGlowTop} aria-hidden="true" />
      <div className={styles.ambientGlowBottom} aria-hidden="true" />

      {/* Floating Sparkle Particles */}
      <div className={styles.sparklesLayer} aria-hidden="true">
        <span className={`${styles.sparkle} ${styles.sparkle1}`} />
        <span className={`${styles.sparkle} ${styles.sparkle2}`} />
        <span className={`${styles.sparkle} ${styles.sparkle3}`} />
        <span className={`${styles.sparkle} ${styles.sparkle4}`} />
        <span className={`${styles.sparkle} ${styles.sparkle5}`} />
      </div>

      <div className={styles.container}>
        {/* TOP BRAND & SEAMLESS ARTWORK HEADER */}
        <header className={styles.headerRow}>
          {/* Brand Logo Info */}
          <div className={styles.brandWrapper}>
            <div className={styles.brandLogoIcon} aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
                width="48"
                height="48"
                fillRule="nonzero"
              >
                <g fill="#0084ff">
                  <g transform="scale(4,4)">
                    <path d="M56,41.7c0,0 -2.11,-0.54 -4,-0.7c0,0 1.22,1.92 1.5,4.5c0,0 -2.26,-0.55 -4.42,-0.5c0,0 1.62,1.91 1.92,4c0,0 -1.915,1.62 -6.315,4.12c0,0 -0.073,-2.17 -1.185,-6.12h-2c0,0 -0.068,4.899 -1.5,10.3c-3,3.7 -8,3.7 -8,3.7c0,0 -5,0 -8,-3.7c-1.432,-5.401 -1.5,-10.3 -1.5,-10.3h-2c-1.111,3.95 -1.185,6.12 -1.185,6.12c-4.4,-2.5 -6.315,-4.12 -6.315,-4.12c0.3,-2.09 1.92,-4 1.92,-4c-2.16,-0.05 -4.42,0.5 -4.42,0.5c0.28,-2.58 1.5,-4.5 1.5,-4.5c-1.89,0.16 -4,0.7 -4,0.7c0.36,-2.4 2,-4.7 2,-4.7c-2.41,0.27 -4,1 -4,1c3,-14 15,-21 15,-21c-4.02,-4.35 -7.4,-7 -7.4,-7c0,0 -1.17,4.47 -0.6,10.4l-4,4.1c-1,-9.5 1.8,-20.5 1.8,-20.5l1.5,-0.5l12.7,10.5c0,0 2.46,-0.48 7,-0.48c4.54,0 7,0.48 7,0.48l12.7,-10.5l1.5,0.5c0,0 2.8,11 1.8,20.5l-4,-4.1c0.57,-5.93 -0.6,-10.4 -0.6,-10.4c0,0 -3.38,2.65 -7.4,7c0,0 12,7 15,21c0,0 -1.59,-0.73 -4,-1c0,0 1.64,2.3 2,4.7zM26.799,38c-0.143,-2.57 -1.082,-3.92 -1.614,-4.38c-1.741,-0.59 -3.813,-0.58 -5.185,-0.43c2.15,4.75 6.297,4.81 6.348,4.81zM37.652,38c0.051,0 4.198,-0.06 6.348,-4.81c-1.372,-0.15 -3.444,-0.16 -5.185,0.43c-0.532,0.46 -1.471,1.81 -1.614,4.38zM32,52c-2,0 -4,1 -4,1c1,4 4,4 4,4c0,0 3,0 4,-4c0,0 -2,-1 -4,-1z" />
                    </g>
                  </g>
                </svg>
              </div>
              <div className={styles.brandTextBlock}>
                <div className={styles.brandTitle}>
                  <span className={styles.brandStudy}>STUDY</span>{" "}
                  <span className={styles.brandGuru}>GURU</span>
                </div>
                <div className={styles.brandTagline}>Learn • Practice • Achieve</div>
              </div>
            </div>

            {/* Seamless Study Hero Artwork gradually blending into theme */}
            <div className={styles.heroArtworkContainer}>
              <div className={styles.heroArtworkSeamless}>
                <Image
                  src="/loading_study_hero.webp"
                  alt="Student studying mock test at night"
                  width={560}
                  height={315}
                  priority
                  className={styles.heroArtworkImg}
                />
                <div className={styles.heroArtworkBlend} aria-hidden="true" />
              </div>
            </div>
        </header>

        {/* 2-COLUMN DESKTOP / 1-COLUMN MOBILE CONTENT GRID */}
        <main className={styles.mainGrid}>
          {/* LEFT / PRIMARY CARD: Loading Experience & Diagnostic Stepper */}
          <section className={styles.loadingCard} aria-label="Loading your experience">
            {/* Header: Title and Percentage */}
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderText}>
                <h1 className={styles.cardHeading}>
                  <span className={styles.desktopHeading}>Loading your experience</span>
                  <span className={styles.mobileHeading}>Loading...</span>
                </h1>
                <p className={`${styles.cardSubheading} ${styles.desktopOnlySubhead}`}>
                  Preparing the best experience for you
                </p>
              </div>
              <div className={styles.progressPercent}>{displayProgress}%</div>
            </div>

            {/* Glowing Capsule Progress Bar */}
            <div
              className={styles.progressBarWrapper}
              role="progressbar"
              aria-valuenow={displayProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Experience load progress"
            >
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.min(100, Math.max(8, displayProgress))}%` }}
                >
                  <div className={styles.progressBarShimmer} aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Mobile Subheading below progress bar */}
            <p className={`${styles.cardSubheading} ${styles.mobileOnlySubhead}`}>
              Preparing the best experience for you
            </p>

            {/* Vertical Diagnostic Stepper */}
            <div className={styles.stepperWrapper}>
              {steps.map((step, idx) => {
                const IconComp = step.icon;
                const isDone = step.status === "done" || step.status === "ready";
                const isProgress = step.status === "progress";
                const isPending = step.status === "pending";
                const isWarning = step.status === "warning";

                return (
                  <div
                    key={step.id}
                    className={`${styles.stepRow} ${
                      isDone ? styles.stepRowDone : isProgress ? styles.stepRowProgress : styles.stepRowPending
                    }`}
                  >
                    {/* Left Timeline Indicator Node & Track */}
                    <div className={styles.stepIndicatorCol}>
                      <div
                        className={`${styles.indicatorCircle} ${
                          isDone
                            ? styles.indicatorDone
                            : isProgress
                            ? styles.indicatorProgress
                            : isWarning
                            ? styles.indicatorWarning
                            : styles.indicatorPending
                        }`}
                      >
                        {isDone && <Check size={11} strokeWidth={3} className={styles.checkSvg} />}
                        {isProgress && <span className={styles.pulsePoint} />}
                      </div>

                      {/* Vertical connector line */}
                      {idx < steps.length - 1 && (
                        <div
                          className={`${styles.timelineConnector} ${
                            isDone
                              ? styles.connectorDone
                              : isProgress
                              ? styles.connectorProgress
                              : styles.connectorPending
                          }`}
                        />
                      )}
                    </div>

                    {/* Step Rounded Icon Box */}
                    <div
                      className={`${styles.stepIconBox} ${
                        isDone
                          ? styles.iconBoxDone
                          : isProgress
                          ? styles.iconBoxProgress
                          : styles.iconBoxPending
                      }`}
                    >
                      {isProgress ? (
                        <Loader2 size={16} className={styles.iconSpin} color="#38bdf8" />
                      ) : (
                        <IconComp
                          size={16}
                          color={isDone || isProgress ? "#38bdf8" : "#64748b"}
                        />
                      )}
                    </div>

                    {/* Step Title & Subtext */}
                    <div className={styles.stepInfoBlock}>
                      <div className={styles.stepTitle}>{step.title}</div>
                      <div className={styles.stepSubtext}>{step.subtext}</div>
                    </div>

                    {/* Step Status Pill */}
                    <div className={styles.stepBadgeCol}>
                      <span
                        className={`${styles.statusBadge} ${
                          isDone
                            ? styles.badgeDone
                            : isProgress
                            ? styles.badgeProgress
                            : isWarning
                            ? styles.badgeWarning
                            : styles.badgePending
                        }`}
                      >
                        <span>{step.statusLabel}</span>
                        {isDone && <Check size={11} strokeWidth={2.5} />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT CARD: Motivational Quote & Growth Chart */}
          <aside className={styles.quoteCard} aria-label="Study motivation and progress visualization">
            <div className={styles.quoteCardContent}>
              {/* Quote Mark Icon */}
              <div className={styles.quoteMarkSymbol} aria-hidden="true">
                “
              </div>

              {/* Quote Text & Author */}
              <blockquote className={styles.quoteBody}>
                {currentQuote.text}
              </blockquote>
              <div className={styles.quoteAuthorTag}>— {currentQuote.author}</div>
            </div>

            {/* Ascending Growth Chart with Flag */}
            <div className={styles.chartGraphicArea} aria-hidden="true">
              {/* Trajectory Dashed Path with Glowing Goal Flag */}
              <div className={styles.chartFlagIcon}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 15C4 15 5 14 8 14C11 14 13 16 16 16C19 16 20 15 20 15V3C20 3 19 4 16 4C13 4 11 2 8 2C5 2 4 3 4 3V22"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="rgba(56, 189, 248, 0.45)"
                  />
                </svg>
              </div>

              <svg
                className={styles.trajectorySvg}
                viewBox="0 0 180 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 68 C 60 52, 110 38, 160 12"
                  stroke="#0084ff"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
                <circle cx="160" cy="12" r="3.5" fill="#38bdf8" />
              </svg>

              {/* Ascending Bar Columns */}
              <div className={styles.barColumns}>
                <div className={`${styles.barCol} ${styles.bar1}`} />
                <div className={`${styles.barCol} ${styles.bar2}`} />
                <div className={`${styles.barCol} ${styles.bar3}`} />
                <div className={`${styles.barCol} ${styles.bar4}`} />
                <div className={`${styles.barCol} ${styles.bar5}`} />
                <div className={`${styles.barCol} ${styles.bar6}`} />
              </div>
            </div>

            {/* Mobile Pagination Carousel Indicator */}
            <div className={styles.carouselIndicators} aria-hidden="true">
              {MOTIVATIONAL_QUOTES.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.indicatorDot} ${i === quoteIndex ? styles.indicatorDotActive : ""}`}
                />
              ))}
            </div>
          </aside>
        </main>

        {/* BOTTOM STRIP: Trust & Security Badges */}
        <footer className={styles.footerRow}>
          <div className={styles.trustBadgePill}>
            <div className={styles.trustItem}>
              <Lock size={12.5} className={styles.trustIcon} />
              <span>Secure</span>
            </div>
            <span className={styles.trustDot}>•</span>
            <div className={styles.trustItem}>
              <Zap size={12.5} className={styles.trustIcon} />
              <span>Fast</span>
            </div>
            <span className={styles.trustDot}>•</span>
            <div className={styles.trustItem}>
              <ShieldCheck size={12.5} className={styles.trustIcon} />
              <span>Reliable</span>
            </div>
          </div>
        </footer>

        {/* Fallback Recovery Modal if checks stall */}
        {showRecoveryOption && (
          <aside className={styles.recoveryPanel} aria-live="polite">
            <div className={styles.recoveryNotice}>
              Diagnostics taking longer to respond. You can retry or open the website immediately.
            </div>
            <div className={styles.recoveryButtons}>
              <button
                type="button"
                className={styles.btnRetry}
                onClick={handleRetry}
                aria-label="Retry connection checks"
              >
                <RefreshCw size={12} aria-hidden="true" />
                Retry
              </button>
              <button
                type="button"
                className={styles.btnBypass}
                onClick={handleForceOpen}
                aria-label="Continue immediately to the app"
              >
                Open Website
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Decorative Bottom Curved Lines */}
      <div className={styles.bottomWavesLayer} aria-hidden="true">
        <svg
          className={styles.waveSvgPath}
          viewBox="0 0 1440 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-50 110 C 250 50, 650 150, 980 70 C 1220 15, 1380 80, 1500 65"
            stroke="rgba(0, 132, 255, 0.32)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M-50 140 C 220 85, 520 170, 850 100 C 1150 35, 1350 120, 1500 95"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </aside>
  );
}
