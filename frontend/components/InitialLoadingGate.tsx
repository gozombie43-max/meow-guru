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
    setMounted(true);
    if (typeof window !== "undefined") {
      // Allow manual trigger via console
      (window as unknown as { __triggerSystemDiagnostics?: () => void }).__triggerSystemDiagnostics = () => {
        try {
          sessionStorage.removeItem(BOOT_SESSION_KEY);
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
        return;
      }
    }
    runAllChecks();
  }, [runAllChecks, retryIndex]);

  if (!mounted || !showGate) {
    return null;
  }

  const handleRetry = () => {
    setRetryIndex((idx) => idx + 1);
  };

  const handleForceOpen = () => {
    finishAndOpenWebsite();
  };

  const content = (
    <aside
      className={`${styles.overlay} ${isExiting ? styles.overlayExiting : ""}`}
      aria-label="Application loading and system diagnostics"
      role="dialog"
      aria-modal="true"
    >
      {/* Background Ambient Radial Glow */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      <main className={styles.container}>
        {/* Brand Badge */}
        <header className={styles.brandBadge}>
          <span className={styles.brandDot} aria-hidden="true" />
          <span>System Initialization</span>
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

  return createPortal(content, document.body);
}
