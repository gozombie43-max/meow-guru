"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import api from "@/lib/axios";

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

  const syncStudyTime = useCallback(async (seconds: number) => {
    if (seconds <= 0) return;

    // Update local state (deferred to avoid React render warnings)
    setTimeout(() => {
      setStudyTime((prev) => prev + seconds);
    }, 0);

    // Fire-and-forget telemetry
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      await api.patch("/users/me/usage", { activeSeconds: seconds }, {
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // Best-effort telemetry — silent failure
    }
  }, []);

  return (
    <StudyTelemetryContext.Provider value={{ studyTime, syncStudyTime }}>
      {children}
    </StudyTelemetryContext.Provider>
  );
}

export function useStudyTelemetry() {
  return useContext(StudyTelemetryContext);
}
