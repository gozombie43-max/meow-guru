"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, useCallback, forwardRef } from "react";
import { Clock, Timer } from "lucide-react";

export interface QuizTimerRef {
  getTimeLeft: () => number;
  getElapsed?: () => number;
  start: (maxTime?: number) => void;
  stop: () => void;
  reset: (time?: number) => void;
}

interface QuizTimerProps {
  maxTime: number;
  onExpire?: () => void;
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatUptime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const QuizTimer = forwardRef<QuizTimerRef, QuizTimerProps>(({ maxTime, onExpire }, ref) => {
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(maxTime);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (time: number) => {
    stopTimer();
    setTimeLeft(time);
    timeLeftRef.current = time;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        timeLeftRef.current = next;
        if (next <= 0) {
          stopTimer();
          if (onExpire) onExpire();
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  useEffect(() => {
    return stopTimer;
  }, []);

  useImperativeHandle(ref, () => ({
    getTimeLeft: () => timeLeftRef.current,
    start: (time?: number) => startTimer(time ?? maxTime),
    stop: stopTimer,
    reset: (time?: number) => {
      stopTimer();
      const newTime = time ?? maxTime;
      setTimeLeft(newTime);
      timeLeftRef.current = newTime;
    }
  }));

  return (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2">
      <Clock className="h-4 w-4 text-red-500" />
      <span className="text-[15px] font-bold text-red-600 tabular-nums tracking-wide">
        {formatClock(timeLeft)}
      </span>
    </div>
  );
});

QuizTimer.displayName = 'QuizTimer';

export interface UptimeTimerProps {
  currentIndex: number;
  isSubmitted: boolean;
  submittedTime?: number;
  className?: string;
}

export const UptimeTimer = forwardRef<QuizTimerRef, UptimeTimerProps>(
  ({ currentIndex, isSubmitted, submittedTime, className }, ref) => {
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stop = useCallback(() => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const start = useCallback((initialTime = 0) => {
      stop();
      setElapsed(initialTime);
      elapsedRef.current = initialTime;
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          elapsedRef.current = next;
          return next;
        });
      }, 1000);
    }, [stop]);

    const reset = (time = 0) => {
      stop();
      setElapsed(time);
      elapsedRef.current = time;
    };

    useEffect(() => {
      return stop;
    }, [stop]);

    useImperativeHandle(ref, () => ({
      getTimeLeft: () => Math.max(0, 60 - elapsedRef.current),
      getElapsed: () => elapsedRef.current,
      start: (_maxTime?: number) => {
        start(0);
      },
      stop,
      reset,
    }));

    useEffect(() => {
      if (isSubmitted) {
        stop();
        const finalTime = submittedTime ?? 0;
        setElapsed(finalTime);
        elapsedRef.current = finalTime;
      } else {
        start(0);
      }
      return stop;
    }, [currentIndex, isSubmitted, submittedTime, start, stop]);

    const displaySeconds = isSubmitted && submittedTime !== undefined ? submittedTime : elapsed;

    return (
      <div
        className={className || "ios-series-timer"}
        aria-label={`Time: ${formatUptime(displaySeconds)}`}
        role="timer"
      >
        <Timer aria-hidden="true" />
        <span>{formatUptime(displaySeconds)}</span>
      </div>
    );
  }
);
UptimeTimer.displayName = 'UptimeTimer';

