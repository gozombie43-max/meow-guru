"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, AlertTriangle, RefreshCw, Wifi, Database, UserCheck, Server, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import styles from "./InitialLoadingGate.module.css";

interface ConditionState {
  id: string;
  name: string;
  icon: React.ElementType;
  status: "pending" | "checking" | "active" | "warning";
  label: string;
}

const BOOT_SESSION_KEY = "app-initial-boot-complete";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function InitialLoadingGate() {
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showGate, setShowGate] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(8);
  const [statusMessage, setStatusMessage] = useState("Initializing system diagnostics...");
  const [showRecoveryOption, setShowRecoveryOption] = useState(false);
  const [retryIndex, setRetryIndex] = useState(0);

  const [conditions, setConditions] = useState<ConditionState[]>([
    { id: "network", name: "Network", icon: Wifi, status: "pending", label: "Checking connection..." },
    { id: "storage", name: "Storage", icon: Database, status: "pending", label: "Checking client cache..." },
    { id: "auth", name: "Session", icon: UserCheck, status: "pending", label: "Verifying credentials..." },
    { id: "api", name: "API Health", icon: Server, status: "pending", label: "Connecting to services..." },
    { id: "ui", name: "UI Engine", icon: Sparkles, status: "pending", label: "Loading fonts & theme..." },
  ]);

  const updateCondition = useCallback((id: string, updates: Partial<ConditionState>) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const finishAndOpenWebsite = useCallback(() => {
    setProgress(100);
    setStatusMessage("All systems active. Opening website...");
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(BOOT_SESSION_KEY, "1");
        document.documentElement.classList.remove("app-is-booting");
      } catch {
        // Safe fallback if sessionStorage is restricted
      }
    }

    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setShowGate(false);
      }, 650);
    }, 600);
  }, []);

  const runAllChecks = useCallback(async () => {
    setShowRecoveryOption(false);
    setProgress(12);
    setStatusMessage("Starting system availability diagnostics...");

    // Timeout guard: after 8 seconds, show recovery/bypass buttons if anything is slow
    const recoveryTimer = setTimeout(() => {
      setShowRecoveryOption(true);
    }, 8000);

    try {
      // ── Step 1: Check Network Condition ──────────────────
      updateCondition("network", { status: "checking", label: "Testing connectivity..." });
      setStatusMessage("Checking network connectivity...");
      await sleep(320);

      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        updateCondition("network", { status: "active", label: "Network Online" });
      } else {
        updateCondition("network", { status: "warning", label: "Offline Mode" });
      }
      setProgress(28);

      // ── Step 2: Check Client Storage & Cache Engine ─────
      updateCondition("storage", { status: "checking", label: "Checking local storage..." });
      setStatusMessage("Verifying local storage & cache engine...");
      await sleep(320);

      let storageAvailable = true;
      try {
        const testKey = "__test_app_storage__";
        localStorage.setItem(testKey, "1");
        localStorage.removeItem(testKey);
      } catch {
        storageAvailable = false;
      }

      if (storageAvailable) {
        updateCondition("storage", { status: "active", label: "Storage Ready" });
      } else {
        updateCondition("storage", { status: "warning", label: "Storage Restricted" });
      }
      setProgress(48);

      // ── Step 3: Check Auth & Session State ──────────────
      updateCondition("auth", { status: "checking", label: "Resolving session credentials..." });
      setStatusMessage("Verifying user session & security token...");

      if (authLoading) {
        await Promise.race([
          new Promise((resolve) => {
            const checkAuth = setInterval(() => {
              if (!authLoading) {
                clearInterval(checkAuth);
                resolve(true);
              }
            }, 80);
          }),
          sleep(1800),
        ]);
      } else {
        await sleep(300);
      }

      updateCondition("auth", {
        status: "active",
        label: user ? `User: ${user.name?.split(" ")[0] || "Active"}` : "Guest Active",
      });
      setProgress(68);

      // ── Step 4: Check API & Backend Health ───────────────
      updateCondition("api", { status: "checking", label: "Pinging API backend..." });
      setStatusMessage("Connecting to API backend & database services...");

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
      let apiHealthy = false;

      try {
        const controller = new AbortController();
        const apiTimeout = setTimeout(() => controller.abort(), 2500);

        const healthRes = await fetch(`${apiBase.replace(/\/$/, "")}/health`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(apiTimeout);

        if (healthRes.ok) {
          apiHealthy = true;
        }
      } catch {
        try {
          const controller2 = new AbortController();
          const apiTimeout2 = setTimeout(() => controller2.abort(), 1500);
          const healthRes2 = await fetch(`${apiBase.replace(/\/$/, "")}/api/health`, {
            method: "GET",
            signal: controller2.signal,
            cache: "no-store",
          });
          clearTimeout(apiTimeout2);
          if (healthRes2.ok) apiHealthy = true;
        } catch {
          apiHealthy = false;
        }
      }

      await sleep(320);

      if (apiHealthy) {
        updateCondition("api", { status: "active", label: "Backend Active" });
      } else {
        updateCondition("api", { status: "warning", label: "Local / Standalone" });
      }
      setProgress(88);

      // ── Step 5: Check UI Fonts & Core Assets ─────────────
      updateCondition("ui", { status: "checking", label: "Rendering fonts & styles..." });
      setStatusMessage("Initializing typography & core visual assets...");

      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await Promise.race([
            document.fonts.ready,
            sleep(600),
          ]);
        } catch {
          // ignore font loading fallback
        }
      }
      await sleep(280);

      updateCondition("ui", { status: "active", label: "UI Assets Ready" });
      setProgress(100);

      clearTimeout(recoveryTimer);

      // All condition checks complete -> transition to website
      finishAndOpenWebsite();
    } catch (err) {
      console.warn("Bootstrap condition check completed with fallback:", err);
      finishAndOpenWebsite();
    }
  }, [authLoading, finishAndOpenWebsite, updateCondition, user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Allow manual trigger via console
      (window as unknown as { __triggerSystemDiagnostics?: () => void }).__triggerSystemDiagnostics = () => {
        try {
          sessionStorage.removeItem(BOOT_SESSION_KEY);
          document.documentElement.classList.add("app-is-booting");
        } catch { /* ignore */ }
        setShowGate(true);
        setIsExiting(false);
        setRetryIndex((r) => r + 1);
      };

      (window as unknown as { __previewLoadingScreen?: (duration?: number) => void }).__previewLoadingScreen = (duration = 6000) => {
        setShowGate(true);
        setIsExiting(false);
        setProgress(55);
        setStatusMessage("Verifying user session & security token...");
        setConditions([
          { id: "network", name: "Network", icon: Wifi, status: "active", label: "Network Online" },
          { id: "storage", name: "Storage Engine", icon: Database, status: "active", label: "Storage Ready" },
          { id: "auth", name: "User Session", icon: UserCheck, status: "checking", label: "Resolving session..." },
          { id: "api", name: "API & Backend", icon: Server, status: "pending", label: "Connecting to services..." },
          { id: "ui", name: "Core Assets", icon: Sparkles, status: "pending", label: "Loading fonts & theme..." },
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
  }, [runAllChecks, retryIndex]);

  const handleRetry = () => {
    setRetryIndex((idx) => idx + 1);
  };

  const handleForceOpen = () => {
    finishAndOpenWebsite();
  };

  return (
    <aside
      id="app-initial-boot-overlay"
      className={`${styles.overlay} ${!showGate ? styles.overlayHidden : isExiting ? styles.overlayExiting : ""}`}
      aria-label="Application loading and system diagnostics"
      role="dialog"
      aria-modal="true"
    >
      {/* Background Ambient Radial Glow */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      <main className={styles.container}>
        {/* Study Guru Brand Logo matching home page */}
        <header className={styles.logoWrapper} aria-label="Study Guru">
          <span className={styles.logoMark} aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              width="46"
              height="46"
              fillRule="nonzero"
            >
              <g
                fill="#0084ff"
                fillRule="nonzero"
                stroke="none"
                strokeWidth="1"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                strokeMiterlimit="10"
                style={{ mixBlendMode: "normal" }}
              >
                <g transform="scale(4,4)">
                  <path d="M56,41.7c0,0 -2.11,-0.54 -4,-0.7c0,0 1.22,1.92 1.5,4.5c0,0 -2.26,-0.55 -4.42,-0.5c0,0 1.62,1.91 1.92,4c0,0 -1.915,1.62 -6.315,4.12c0,0 -0.073,-2.17 -1.185,-6.12h-2c0,0 -0.068,4.899 -1.5,10.3c-3,3.7 -8,3.7 -8,3.7c0,0 -5,0 -8,-3.7c-1.432,-5.401 -1.5,-10.3 -1.5,-10.3h-2c-1.111,3.95 -1.185,6.12 -1.185,6.12c-4.4,-2.5 -6.315,-4.12 -6.315,-4.12c0.3,-2.09 1.92,-4 1.92,-4c-2.16,-0.05 -4.42,0.5 -4.42,0.5c0.28,-2.58 1.5,-4.5 1.5,-4.5c-1.89,0.16 -4,0.7 -4,0.7c0.36,-2.4 2,-4.7 2,-4.7c-2.41,0.27 -4,1 -4,1c3,-14 15,-21 15,-21c-4.02,-4.35 -7.4,-7 -7.4,-7c0,0 -1.17,4.47 -0.6,10.4l-4,4.1c-1,-9.5 1.8,-20.5 1.8,-20.5l1.5,-0.5l12.7,10.5c0,0 2.46,-0.48 7,-0.48c4.54,0 7,0.48 7,0.48l12.7,-10.5l1.5,0.5c0,0 2.8,11 1.8,20.5l-4,-4.1c0.57,-5.93 -0.6,-10.4 -0.6,-10.4c0,0 -3.38,2.65 -7.4,7c0,0 12,7 15,21c0,0 -1.59,-0.73 -4,-1c0,0 1.64,2.3 2,4.7zM26.799,38c-0.143,-2.57 -1.082,-3.92 -1.614,-4.38c-1.741,-0.59 -3.813,-0.58 -5.185,-0.43c2.15,4.75 6.297,4.81 6.348,4.81zM37.652,38c0.051,0 4.198,-0.06 6.348,-4.81c-1.372,-0.15 -3.444,-0.16 -5.185,0.43c-0.532,0.46 -1.471,1.81 -1.614,4.38zM32,52c-2,0 -4,1 -4,1c1,4 4,4 4,4c0,0 3,0 4,-4c0,0 -2,-1 -4,-1z" />
                </g>
              </g>
            </svg>
          </span>
          <span className={styles.logoText}>
            <strong className={styles.logoStudy}>STUDY</strong>
            <strong className={styles.logoGuru}>GURU</strong>
          </span>
        </header>

        {/* Outer Capsule Progress Bar matching reference image */}
        <section
          className={styles.progressCapsuleWrapper}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading progress"
        >
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
            >
              {/* Effervescent glowing bubble particles inside the progress stream */}
              <div className={styles.bubblesContainer} aria-hidden="true">
                <span className={`${styles.bubble} ${styles.bubble1}`} />
                <span className={`${styles.bubble} ${styles.bubble2}`} />
                <span className={`${styles.bubble} ${styles.bubble3}`} />
                <span className={`${styles.bubble} ${styles.bubble4}`} />
                <span className={`${styles.bubble} ${styles.bubble5}`} />
                <span className={`${styles.bubble} ${styles.bubble6}`} />
                <span className={`${styles.bubble} ${styles.bubble7}`} />
                <span className={`${styles.bubble} ${styles.bubble8}`} />
                <span className={`${styles.bubble} ${styles.bubble9}`} />
                <span className={`${styles.bubble} ${styles.bubble10}`} />
              </div>

              {/* Shimmer sweep animation */}
              <div className={styles.shimmerWave} aria-hidden="true" />

              {/* Glowing leading edge tip */}
              <div className={styles.edgeGlow} aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* LOADING... Typography matching reference image */}
        <h1 className={styles.loadingText}>
          LOADING
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dotOne}>.</span>
            <span className={styles.dotTwo}>.</span>
            <span className={styles.dotThree}>.</span>
          </span>
        </h1>

        {/* Status Message and Percentage Row */}
        <div className={styles.statusRow}>
          <div className={styles.statusMessage} role="status" aria-live="polite">
            <Loader2 size={15} className={styles.iconSpin} aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
          <span className={styles.percentBadge}>{Math.round(progress)}%</span>
        </div>

        {/* Conditions Checklist Grid */}
        <section className={styles.conditionsGrid} aria-label="System diagnostic conditions">
          {conditions.map((item) => {
            const Icon = item.icon;
            const isActive = item.status === "active";
            const isChecking = item.status === "checking";
            const isWarn = item.status === "warning";

            return (
              <div
                key={item.id}
                className={`${styles.conditionCard} ${
                  isActive ? styles.conditionCardActive : ""
                } ${isWarn ? styles.conditionCardWarn : ""}`}
              >
                <div className={styles.conditionIcon} aria-hidden="true">
                  {isChecking && <Loader2 size={14} className={styles.iconSpin} color="#38bdf8" />}
                  {isActive && <CheckCircle2 size={14} color="#4ade80" />}
                  {isWarn && <AlertTriangle size={14} color="#fcd34d" />}
                  {item.status === "pending" && <Icon size={14} color="#64748b" />}
                </div>
                <span className={styles.conditionLabel}>{item.name}</span>
                <span
                  className={`${styles.conditionStatusTag} ${
                    isActive ? styles.tagActive : isChecking ? styles.tagChecking : isWarn ? styles.tagOffline : ""
                  }`}
                >
                  {isActive ? "Active" : isChecking ? "Checking" : isWarn ? "Offline" : "Pending"}
                </span>
              </div>
            );
          })}
        </section>

        {/* Recovery Fallback if diagnostics take longer */}
        {showRecoveryOption && (
          <aside className={styles.recoveryBox} aria-live="polite">
            <div className={styles.recoveryText}>
              Backend or network is taking longer to respond. You can retry or continue immediately.
            </div>
            <div className={styles.recoveryActions}>
              <button
                type="button"
                className={styles.retryBtn}
                onClick={handleRetry}
                aria-label="Retry system diagnostics"
              >
                <RefreshCw size={13} aria-hidden="true" />
                Retry Checks
              </button>
              <button
                type="button"
                className={styles.bypassBtn}
                onClick={handleForceOpen}
                aria-label="Continue to website immediately"
              >
                Open Website
              </button>
            </div>
          </aside>
        )}
      </main>
    </aside>
  );
}
