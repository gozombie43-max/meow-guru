"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api, { getAccessToken } from "@/lib/axios";
import { API_BASE } from "@/lib/api-base";

interface StudyTelemetryContextValue {
  studyTime: number;
  syncStudyTime: (seconds: number) => void;
}

const StudyTelemetryContext = createContext<StudyTelemetryContextValue>({
  studyTime: 0,
  syncStudyTime: () => {},
});

export function StudyTelemetryProvider({
  children,
  initialStudyTime = 0,
}: {
  children: React.ReactNode;
  initialStudyTime?: number;
}) {
  const [studyTime, setStudyTime] = useState(initialStudyTime);
  const pendingSecondsRef = useRef(0);
  const isFlushingRef = useRef(false);

  const flush = useCallback(async (useKeepalive = false) => {
    const seconds = pendingSecondsRef.current;
    if (seconds <= 0 || isFlushingRef.current) return;

    pendingSecondsRef.current = 0;
    isFlushingRef.current = true;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload = JSON.stringify({ activeSeconds: seconds, timezone });

      if (useKeepalive && typeof fetch !== "undefined") {
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        await fetch(`${API_BASE}/users/me/usage`, {
          method: "PATCH",
          headers,
          body: payload,
          keepalive: true,
          credentials: "include",
        });
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        await api.patch(
          "/users/me/usage",
          { activeSeconds: seconds, timezone },
          { signal: controller.signal }
        );
        clearTimeout(timer);
      }
    } catch {
      // Re-accumulate so time is preserved on transient failures
      pendingSecondsRef.current += seconds;
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  const syncStudyTime = useCallback((seconds: number) => {
    if (seconds <= 0) return;

    pendingSecondsRef.current += seconds;
    setStudyTime((prev) => prev + seconds);
  }, []);

  // Periodic flush every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void flush(false);
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flush(true);
      }
    };

    const handlePageHide = () => {
      void flush(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      void flush(true);
    };
  }, [flush]);

  return (
    <StudyTelemetryContext.Provider value={{ studyTime, syncStudyTime }}>
      {children}
    </StudyTelemetryContext.Provider>
  );
}

export function useStudyTelemetry() {
  return useContext(StudyTelemetryContext);
}
