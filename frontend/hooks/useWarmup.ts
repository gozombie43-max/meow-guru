"use client";

import { useEffect } from "react";
import { fetchWithRetry } from "@/lib/api/http";
import { API_BASE } from "@/lib/api-base";

const WARMUP_SESSION_KEY = "backend-warmup-complete";

export function useWarmup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(WARMUP_SESSION_KEY) === "1") return;

    let cancelled = false;

    const warmup = async () => {
      try {
        const res = await fetchWithRetry(
          `${API_BASE}/health`,
          {
            cache: "no-store",
            keepalive: true,
          },
          {
            attempts: 1,
            timeoutMs: 8000,
            retryDelayMs: 5000,
          }
        );

        if (!cancelled && res.ok) {
          sessionStorage.setItem(WARMUP_SESSION_KEY, "1");
        }
      } catch {
        // Best-effort warmup only.
      }
    };

    warmup();

    return () => {
      cancelled = true;
    };
  }, []);
}
