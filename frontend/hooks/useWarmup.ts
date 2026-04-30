"use client";

import { useEffect } from "react";
import { fetchWithRetry } from "@/lib/api/http";

const WARMUP_SESSION_KEY = "backend-warmup-complete";

export function useWarmup() {
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    if (!apiBase || typeof window === "undefined") return;
    if (sessionStorage.getItem(WARMUP_SESSION_KEY) === "1") return;

    let cancelled = false;

    const warmup = async () => {
      try {
        const res = await fetchWithRetry(
          `${apiBase.replace(/\/$/, "")}/health`,
          {
            cache: "no-store",
            keepalive: true,
          },
          {
            attempts: 3,
            timeoutMs: 15000,
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
