'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

export default function StudyTimeTracker() {
  const { syncStudyTime, user } = useAuth();
  const pathname = usePathname();
  const lastTick = useRef<number>(Date.now());
  const pendingSeconds = useRef<number>(0);
  
  // Track on all pages or only study pages? The user asked to track "website usage time", 
  // so we'll track everywhere by default.
  // We can also refine it if they want.

  useEffect(() => {
    if (!user) return;

    const TICK_INTERVAL_MS = 1000;
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
          syncStudyTime(secsToSync);
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
          syncStudyTime(secsToSync);
          pendingSeconds.current -= secsToSync;
        }
      }
    };

    const handleBeforeUnload = () => {
      const secsToSync = Math.floor(pendingSeconds.current);
      if (secsToSync > 0) {
        // We can't guarantee an async fetch finishes on unload, 
        // but we can try (or use navigator.sendBeacon ideally, but syncStudyTime uses axios).
        // Since we sync every 30s, the max lost time is 30s.
        syncStudyTime(secsToSync);
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
  }, [user, syncStudyTime, pathname]); // reset on route change to optionally flush

  return null; // This is a logic-only component
}
