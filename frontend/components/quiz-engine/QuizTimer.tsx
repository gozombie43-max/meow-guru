"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Clock } from "lucide-react";

export interface QuizTimerRef {
  getTimeLeft: () => number;
  start: (maxTime: number) => void;
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
    start: (time: number) => startTimer(time),
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

export const TimerCircle = forwardRef<QuizTimerRef, { maxTime: number, mini?: boolean }>(({ maxTime, mini }, ref) => {
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
    start: (time: number) => startTimer(time),
    stop: stopTimer,
    reset: (time?: number) => {
      stopTimer();
      const newTime = time ?? maxTime;
      setTimeLeft(newTime);
      timeLeftRef.current = newTime;
    }
  }));

  const size = mini ? 48 : 64;
  const stroke = mini ? 3 : 4;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / maxTime;
  const offset = circumference * (1 - progress);
  const isLow = timeLeft <= 5;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--quiz-ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isLow ? "#ef4444" : "#7c3aed"}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-1000 linear ${
            isLow ? "animate-pulse" : ""
          }`}
        />
      </svg>
      <span
        className={`absolute text-sm font-bold ${
          isLow ? "text-red-500" : "text-[var(--text-primary)]"
        }`}
      >
        {timeLeft}
      </span>
    </div>
  );
});
