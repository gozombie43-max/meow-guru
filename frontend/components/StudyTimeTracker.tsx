'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { useStudyTelemetry } from "@/context/StudyTelemetryContext";

export default function StudyTimeTracker() {
  const { user } = useAuth();
  const { syncStudyTime } = useStudyTelemetry();
  const userId = user?.id;
  const pathname = usePathname();
  const lastTick = useRef<number>(Date.now());
  const pendingSeconds = useRef<number>(0);
  const syncStudyTimeRef = useRef(syncStudyTime);

  useEffect(() => {
    syncStudyTimeRef.current = syncStudyTime;
  }, [syncStudyTime]);

  useEffect(() => {
    if (!userId) return;

    const TICK_INTERVAL_MS = 5000;
    const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds

    lastTick.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTick.current;
      lastTick.current = now;

      // Only count if the tab is visible
      if (document.visibilityState === 'visible') {
        pendingSeconds.current += (deltaMs / 1000);
      }

      if (pendingSeconds.current >= (SYNC_INTERVAL_MS / 1000)) {
        const secsToSync = Math.floor(pendingSeconds.current);
        if (secsToSync > 0) {
          syncStudyTimeRef.current(secsToSync);
          pendingSeconds.current -= secsToSync;
        }
      }
    }, TICK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      lastTick.current = Date.now(); // reset tick to prevent large jumps
      if (document.visibilityState === 'hidden') {
        // Sync immediately if hidden
        const secsToSync = Math.floor(pendingSeconds.current);
        if (secsToSync > 0) {
          syncStudyTimeRef.current(secsToSync);
          pendingSeconds.current -= secsToSync;
        }
      }
    };

    const handleBeforeUnload = () => {
      const secsToSync = Math.floor(pendingSeconds.current);
      if (secsToSync > 0) {
        syncStudyTimeRef.current(secsToSync);
        pendingSeconds.current = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, pathname]); // reset on route change or auth user change only

  return null; // This is a logic-only component
}
