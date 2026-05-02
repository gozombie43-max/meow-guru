"use client";

import { useEffect } from "react";

const OFFLINE_DETECTED_KEY = "app-recovery-offline-detected";
const PENDING_RELOAD_KEY = "app-recovery-pending-reload";
const LAST_RELOAD_KEY = "app-recovery-last-reload-at";
const RELOAD_GUARD_MS = 15_000;

const getErrorMessage = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { message?: unknown; reason?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.reason === "string") return candidate.reason;
    if (candidate.reason && typeof candidate.reason === "object") {
      const nested = candidate.reason as { message?: unknown };
      if (typeof nested.message === "string") return nested.message;
    }
  }

  return "";
};

const isRecoverableClientError = (value: unknown) => {
  const message = getErrorMessage(value);

  return /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    message
  );
};

const shouldThrottleReload = () => {
  const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || "0");
  return Date.now() - lastReloadAt < RELOAD_GUARD_MS;
};

const markForReload = () => {
  sessionStorage.setItem(PENDING_RELOAD_KEY, "1");
};

const reloadApp = () => {
  if (shouldThrottleReload()) return;
  sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  window.location.reload();
};

export default function AppRecovery() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      sessionStorage.setItem(OFFLINE_DETECTED_KEY, "1");
    };

    const handleOnline = () => {
      const wasOffline = sessionStorage.getItem(OFFLINE_DETECTED_KEY) === "1";
      const hasPendingReload = sessionStorage.getItem(PENDING_RELOAD_KEY) === "1";

      if (!wasOffline && !hasPendingReload) return;

      sessionStorage.removeItem(OFFLINE_DETECTED_KEY);
      sessionStorage.removeItem(PENDING_RELOAD_KEY);
      reloadApp();
    };

    const recoverOrDefer = () => {
      if (navigator.onLine) {
        reloadApp();
        return;
      }

      markForReload();
    };

    const handleError = (event: ErrorEvent) => {
      if (isRecoverableClientError(event.error ?? event.message)) {
        recoverOrDefer();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isRecoverableClientError(event.reason)) {
        recoverOrDefer();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
