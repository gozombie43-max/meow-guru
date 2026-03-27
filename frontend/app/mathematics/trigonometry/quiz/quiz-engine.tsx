"use client";

import MathRenderer from "@/components/MathRenderer";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Menu,
  Flame,
  Sparkles,
  Target,
  RotateCcw,
  X,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { updateProgress, toggleBookmark } from "@/lib/userApi";
import {
  trigonometryQuestions,
  shuffle,
  type TrigonometryQuestion,
  TRIG_CONCEPTS,
} from "@/lib/trigonometry-questions";

// ── Types ────────────────────────────────────────────────────────────────────
type QuizMode = "concept" | "formula" | "mixed" | "ai-challenge";
type Difficulty = "easy" | "medium" | "hard";

interface SessionResult {
  questionId: number;
  questionIndex: number;
  selected: number | null;
  correct: number;
  isCorrect: boolean;
  timeTaken: number;
  concept: string;
  difficulty: Difficulty;
}

// ── Constants ────────────────────────────────────────────────────────────────
const MODE_LABELS: Record<QuizMode, string> = {
  concept: "Concept Practice",
  formula: "Formula Practice",
  mixed: "Mixed Practice",
  "ai-challenge": "AI Challenge",
};

/* ── MathFraction ───────────────────────────────────────────────────────────
 * Renders  a / b  as a proper stacked fraction like textbooks.
 * Used wherever we show "current / total" ratios.
 * ─────────────────────────────────────────────────────────────────────────── */
function MathFraction({
  numerator,
  denominator,
  className = "",
}: {
  numerator: React.ReactNode;
  denominator: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className}`}
      role="math"
    >
      <span
        className="text-[var(--text-primary)] font-bold"
        style={{ fontSize: "0.85em" }}
      >
        {numerator}
      </span>
      <span
        className="w-full border-t border-slate-400 my-[2px]"
        style={{ minWidth: "1.2em" }}
      />
      <span className="text-slate-500 font-semibold" style={{ fontSize: "0.85em" }}>
        {denominator}
      </span>
    </span>
  );
}

/* ── Question Status Helpers ────────────────────────────────────────────────  */
type QuestionStatus =
  | "current"
  | "answered"
  | "correct"
  | "wrong"
  | "not-answered";

function getQuestionStatus({
  index,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
}: {
  index: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: TrigonometryQuestion[];
  submittedQuestions: Set<number>;
}): QuestionStatus {
  const selected = selectedAnswers[index];
  const question = questions[index];

  if (index === currentIndex) return "current";
  if (selected === undefined || !question) return "not-answered";
  if (!submittedQuestions.has(index)) return "answered";
  if (selected === question.correctAnswer) return "correct";
  return "wrong";
}

function statusClasses(status: QuestionStatus) {
  const base = "border transition-all duration-200";
  if (status === "current")
    return `${base} bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-400/40 scale-110 z-10`;
  if (status === "answered")
    return `${base} bg-amber-100 text-amber-700 border-amber-300`;
  if (status === "correct")
    return `${base} bg-emerald-100 text-emerald-700 border-emerald-300`;
  if (status === "wrong")
    return `${base} bg-rose-100 text-rose-700 border-rose-300`;
  return `${base} bg-slate-100 text-slate-700 border-slate-300`;
}

/* ── Question Palette Modal ─────────────────────────────────────────────────  */
function QuestionPaletteModal({
  isOpen,
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onClose,
  onGoToQuestion,
}: {
  isOpen: boolean;
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: TrigonometryQuestion[];
  submittedQuestions: Set<number>;
  onClose: () => void;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] bg-slate-900/45 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full w-full bg-white/95 p-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                Question Palette
              </h3>
              <button
                onClick={onClose}
                className="h-12 min-w-12 rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm"
                aria-label="Close question palette"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-md border border-violet-300 bg-violet-100 px-2 py-1">
                Current
              </span>
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1">
                Answered
              </span>
              <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">
                Correct
              </span>
              <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1">
                Wrong
              </span>
              <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1">
                Not Answered
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="question-grid question-grid--palette">
                {Array.from({ length: total }, (_, index) => {
                  const status = getQuestionStatus({
                    index,
                    currentIndex,
                    selectedAnswers,
                    questions,
                    submittedQuestions,
                  });
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        onGoToQuestion(index + 1);
                        onClose();
                      }}
                      className={`question-button min-h-12 rounded-xl text-sm font-semibold ${statusClasses(status)}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Question Navigator ─────────────────────────────────────────────────────  */
function QuestionNavigator({
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onGoToQuestion,
  onOpenPalette,
  onClosePalette,
  isPaletteOpen,
}: {
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: TrigonometryQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
  onOpenPalette: () => void;
  onClosePalette: () => void;
  isPaletteOpen: boolean;
}) {
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = quickButtonRefs.current[currentIndex];
    if (!activeButton) return;
    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-1 py-1.5">
          <div
            className="question-strip qnav-bar-scroll mx-auto"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {Array.from({ length: total }, (_, index) => {
              const status = getQuestionStatus({
                index,
                currentIndex,
                selectedAnswers,
                questions,
                submittedQuestions,
              });
              return (
                <button
                  key={index}
                  ref={(el) => {
                    quickButtonRefs.current[index] = el;
                  }}
                  onClick={() => onGoToQuestion(index + 1)}
                  className={`qnum-chip h-11 w-11 min-h-11 min-w-11 rounded-lg text-sm font-semibold ${statusClasses(status)}`}
                  aria-label={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <QuestionPaletteModal
        isOpen={isPaletteOpen}
        total={total}
        currentIndex={currentIndex}
        selectedAnswers={selectedAnswers}
        questions={questions}
        submittedQuestions={submittedQuestions}
        onClose={onClosePalette}
        onGoToQuestion={onGoToQuestion}
      />
    </>
  );
}

/* ── Timer Circle ───────────────────────────────────────────────────────────  */
function TimerCircle({
  timeLeft,
  maxTime,
  mini,
}: {
  timeLeft: number;
  maxTime: number;
  mini?: boolean;
}) {
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
          stroke="rgba(255,255,255,0.06)"
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
}

/* ── Concept Badge ───────────────────────────────────────────────────────────
 * Maps each trig concept to a distinct accent colour so learners
 * can visually distinguish question categories at a glance.
 * ─────────────────────────────────────────────────────────────────────────── */
const CONCEPT_COLOURS: Record<string, { border: string; bg: string; text: string }> = {
  "Trigonometric Ratios & Values": {
    border: "#7C3AED",
    bg: "#F5F3FF",
    text: "#5B21B6",
  },
  "Trigonometric Identities": {
    border: "#0891B2",
    bg: "#ECFEFF",
    text: "#0E7490",
  },
  "Height & Distance": {
    border: "#059669",
    bg: "#ECFDF5",
    text: "#047857",
  },
  "Trigonometric Equations": {
    border: "#D97706",
    bg: "#FFFBEB",
    text: "#B45309",
  },
  "Graphs & Periodicity": {
    border: "#DB2777",
    bg: "#FDF2F8",
    text: "#BE185D",
  },
  "Complementary Angles": {
    border: "#2563EB",
    bg: "#EFF6FF",
    text: "#1D4ED8",
  },
  Simplification: {
    border: "#64748B",
    bg: "#F8FAFC",
    text: "#475569",
  },
};

function ConceptBadge({ concept }: { concept: string }) {
  const colours =
    CONCEPT_COLOURS[concept] ?? {
      border: "#7C3AED",
      bg: "#F5F3FF",
      text: "#5B21B6",
    };
  return (
    <span
      style={{
        border: `1.5px solid ${colours.border}`,
        borderRadius: "999px",
        padding: "3px 12px",
        fontSize: "13px",
        color: colours.text,
        background: colours.bg,
        fontWeight: 500,
      }}
    >
      {concept}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN TRIG QUIZ ENGINE
   ════════════════════════════════════════════════════════════════════════════ */
export default function TrigQuizEngine() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "mixed") as QuizMode;

  // ── State ──────────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<TrigonometryQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [miniMode, setMiniMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const { user, token, refreshUser } = useAuth();
  const [bookmarked, setBookmarked] = useState<Set<string>>(
    new Set(user?.bookmarks ?? [])
  );

  const maxTime = miniMode ? 20 : 60;
  const currentQ = questions[currentIndex] as TrigonometryQuestion | undefined;
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;

  // ── Build question set ─────────────────────────────────────────────────────
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let pool: TrigonometryQuestion[];

    switch (mode) {
      case "concept":
        pool =
          conceptFilter === "all"
            ? [...trigonometryQuestions]
            : trigonometryQuestions.filter((q) => q.concept === conceptFilter);
        break;
      case "formula":
        pool = [...trigonometryQuestions];
        break;
      case "ai-challenge":
        pool = [...trigonometryQuestions];
        break;
      case "mixed":
      default:
        pool = shuffle([...trigonometryQuestions]);
        break;
    }

    setQuestions(shuffle(pool));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setIsPaletteOpen(false);
    setStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }, [mode, conceptFilter]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(maxTime);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [maxTime, stopTimer]);

  useEffect(() => {
    if (timeLeft === 0) stopTimer();
  }, [stopTimer, timeLeft]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleStart() {
    setStarted(true);
    startTimer();
  }

  const showQuestion = useCallback(
    (index: number) => {
      if (questions.length === 0) return;
      const safeIndex = Math.max(0, Math.min(index, questions.length - 1));
      stopTimer();
      setCurrentIndex(safeIndex);
      const existingSelection = selectedAnswers[safeIndex];
      setSelectedAnswer(existingSelection ?? null);
      setSubmitError("");
      if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) {
        startTimer();
      }
    },
    [
      questions.length,
      selectedAnswers,
      showAnalytics,
      startTimer,
      started,
      stopTimer,
      submittedQuestions,
    ]
  );

  const goToQuestion = useCallback(
    (questionNumber: number) => {
      if (questions.length === 0) return;
      const safeNumber = Math.max(
        1,
        Math.min(questionNumber, questions.length)
      );
      showQuestion(safeNumber - 1);
    },
    [questions.length, showQuestion]
  );

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);

  const adaptDifficulty = useCallback(
    (correct: boolean) => {
      const recent = [...results.slice(-4), { isCorrect: correct }];
      const recentCorrect = recent.filter((r) => r.isCorrect).length;
      if (recentCorrect >= 4 && difficulty !== "hard") {
        setDifficulty((d) => (d === "easy" ? "medium" : "hard"));
      } else if (recentCorrect <= 1 && difficulty !== "easy") {
        setDifficulty((d) => (d === "hard" ? "medium" : "easy"));
      }
    },
    [difficulty, results]
  );

  const handleSelectAnswer = useCallback(
    (index: number) => {
      if (!currentQ) return;
      if (submittedQuestions.has(currentIndex)) return;
      if (index < 0 || index >= currentQ.options.length) return;
      setSelectedAnswer(index);
      setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions]
  );

  const handleSubmitCurrent = useCallback(() => {
    if (!currentQ) return;
    if (submittedQuestions.has(currentIndex)) return;
    const selected = selectedAnswers[currentIndex];
    if (selected === undefined) {
      setSubmitError("Please choose an option before submitting.");
      return;
    }

    stopTimer();
    const timeTaken = Math.max(1, maxTime - timeLeft);
    const isCorrect = selected === currentQ.correctAnswer;
    adaptDifficulty(isCorrect);

    if (isCorrect) {
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }

    if (token) {
      updateProgress(token, currentQ.concept, 1, isCorrect ? 1 : 0).catch(
        () => {}
      );
    }

    setResults((prev) => {
      const next: SessionResult = {
        questionId: currentQ.id,
        questionIndex: currentIndex,
        selected,
        correct: currentQ.correctAnswer,
        isCorrect,
        timeTaken,
        concept: currentQ.concept,
        difficulty: currentQ.difficulty,
      };
      const existingIndex = prev.findIndex(
        (r) => r.questionIndex === currentIndex
      );
      if (existingIndex === -1) return [...prev, next];
      const updated = [...prev];
      updated[existingIndex] = next;
      return updated;
    });

    setSubmittedQuestions((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });

    setSubmitError("");
  }, [
    adaptDifficulty,
    currentIndex,
    currentQ,
    maxTime,
    selectedAnswers,
    stopTimer,
    submittedQuestions,
    timeLeft,
    token,
  ]);

  const handleBookmark = useCallback(async () => {
    if (!currentQ || !token) return;
    const qId = String(currentQ.id);
    const isBookmarked = bookmarked.has(qId);
    const action = isBookmarked ? "remove" : "add";

    setBookmarked((prev) => {
      const next = new Set(prev);
      isBookmarked ? next.delete(qId) : next.add(qId);
      return next;
    });

    try {
      await toggleBookmark(token, qId, action);
    } catch {
      setBookmarked((prev) => {
        const next = new Set(prev);
        isBookmarked ? next.add(qId) : next.delete(qId);
        return next;
      });
    }
  }, [currentQ, token, bookmarked]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    showQuestion(currentIndex - 1);
  }, [currentIndex, showQuestion]);

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else {
      stopTimer();
      refreshUser();
      setShowAnalytics(true);
    }
  }

  function handleRestart() {
    setQuestions(shuffle([...questions]));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    closePalette();
    setStreak(0);
    setBestStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || showAnalytics) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showQuestion(currentIndex - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showQuestion(currentIndex + 1);
        return;
      }
      if (!currentQ) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const base =
          selectedAnswer === null
            ? 0
            : Math.min(selectedAnswer + 1, currentQ.options.length - 1);
        handleSelectAnswer(base);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const base =
          selectedAnswer === null
            ? currentQ.options.length - 1
            : Math.max(selectedAnswer - 1, 0);
        handleSelectAnswer(base);
        return;
      }
      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= currentQ.options.length) {
        event.preventDefault();
        handleSelectAnswer(num - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentIndex,
    currentQ,
    handleSelectAnswer,
    selectedAnswer,
    showAnalytics,
    showQuestion,
    started,
  ]);

  // ── Computed stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length;
    const wrong = results.filter(
      (r) => !r.isCorrect && r.selected !== null
    ).length;
    const attempted = results.length;
    const accuracy =
      attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const avgTime =
      results.length > 0
        ? Math.round(
            results.reduce((a, r) => a + r.timeTaken, 0) / results.length
          )
        : 0;
    return { correct, wrong, accuracy, avgTime };
  }, [results]);

  const weakConcepts = useMemo(() => {
    const conceptStats: Record<string, { correct: number; total: number }> = {};
    for (const r of results) {
      if (!conceptStats[r.concept])
        conceptStats[r.concept] = { correct: 0, total: 0 };
      conceptStats[r.concept].total++;
      if (r.isCorrect) conceptStats[r.concept].correct++;
    }
    return Object.entries(conceptStats)
      .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.5)
      .map(([c, s]) => ({
        concept: c,
        accuracy: Math.round((s.correct / s.total) * 100),
      }));
  }, [results]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatClock(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const mins = Math.floor(safeSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (safeSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */

  // ── Analytics Screen ───────────────────────────────────────────────────────
  if (showAnalytics) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto relative">
          <h1
            className="animate-fade-in-up text-3xl font-bold mb-2 text-[var(--text-primary)]"
            style={{
              fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
            }}
          >
            Session{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Complete
            </span>
          </h1>
          <p
            className="animate-fade-in-up text-slate-500 mb-10"
            style={{ animationDelay: "100ms" }}
          >
            Here&apos;s how you performed in this {MODE_LABELS[mode]} session.
          </p>

          {/* Formula reminder banner */}
          {currentQ && (
            <div
              className="animate-fade-in-up mb-8 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4"
              style={{ animationDelay: "150ms" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-1">
                Key Formula
              </p>
              <p className="text-sm font-mono text-violet-800">
                sin²θ + cos²θ = 1 &nbsp;|&nbsp; 1 + tan²θ = sec²θ &nbsp;|&nbsp; 1 + cot²θ = cosec²θ
              </p>
            </div>
          )}

          {/* Stats grid */}
          <div
            className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
            style={{ animationDelay: "200ms" }}
          >
            {[
              {
                label: "Correct",
                value: stats.correct,
                color: "text-emerald-600",
              },
              { label: "Wrong", value: stats.wrong, color: "text-red-500" },
              {
                label: "Accuracy",
                value: `${stats.accuracy}%`,
                color: "text-violet-600",
              },
              {
                label: "Avg Time",
                value: `${stats.avgTime}s`,
                color: "text-amber-600",
              },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Extra stats */}
          <div
            className="animate-fade-in-up grid grid-cols-2 gap-4 mb-10"
            style={{ animationDelay: "250ms" }}
          >
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-slate-500 mb-1">Best Streak</div>
              <div className="text-xl font-bold text-violet-600 flex items-center gap-2">
                <Flame className="w-5 h-5" /> {bestStreak}
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-slate-500 mb-1">Questions Done</div>
              <div className="text-xl font-bold text-[var(--text-primary)] flex items-center justify-center gap-2">
                <MathFraction
                  numerator={results.length}
                  denominator={questions.length}
                />
              </div>
            </div>
          </div>

          {/* Concept breakdown */}
          {results.length > 0 && (
            <div
              className="animate-fade-in-up glass-card rounded-xl p-6 mb-6"
              style={{ animationDelay: "300ms" }}
            >
              <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#7c3aed",
                  }}
                />
                Concept Breakdown
              </h3>
              <div className="space-y-3">
                {TRIG_CONCEPTS.map((c) => {
                  const conceptResults = results.filter(
                    (r) => r.concept === c
                  );
                  if (conceptResults.length === 0) return null;
                  const correct = conceptResults.filter(
                    (r) => r.isCorrect
                  ).length;
                  const pct = Math.round(
                    (correct / conceptResults.length) * 100
                  );
                  const col = CONCEPT_COLOURS[c] ?? {
                    border: "#7C3AED",
                    bg: "#F5F3FF",
                    text: "#5B21B6",
                  };
                  return (
                    <div key={c}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-600">{c}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: col.bg,
                            color: col.text,
                            border: `1px solid ${col.border}`,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 70
                                ? "#059669"
                                : pct >= 40
                                ? "#D97706"
                                : "#DC2626",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weak concepts */}
          {weakConcepts.length > 0 && (
            <div
              className="animate-fade-in-up glass-card rounded-xl p-6 mb-10"
              style={{ animationDelay: "350ms" }}
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                <Target className="w-4 h-4 text-red-500" />
                Weak Areas — Needs Practice
              </h3>
              <div className="space-y-3">
                {weakConcepts.map((wc) => (
                  <div
                    key={wc.concept}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-600">{wc.concept}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/25">
                      {wc.accuracy}% accuracy
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            className="animate-fade-in-up flex flex-col sm:flex-row gap-4"
            style={{ animationDelay: "450ms" }}
          >
            <button
              onClick={handleRestart}
              className="btn-glow px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                color: "#fff",
                border: "none",
              }}
            >
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <Link
              href="/mathematics/trigonometry"
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              Change Mode
            </Link>
            <Link
              href="/mathematics"
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              All Topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-start Screen ───────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="trig-start min-h-screen relative overflow-hidden px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto text-center min-h-screen flex flex-col pt-20 sm:pt-24 pb-8">
          {/* Header */}
          <div className="mb-2 flex items-center justify-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "#F5F3FF",
                color: "#7c3aed",
                border: "1px solid #7c3aed30",
              }}
            >
              Trigonometry
            </span>
          </div>
          <h1
            className="text-[clamp(1.8rem,4vw,2.5rem)] font-bold mb-3 text-[var(--text-primary)]"
            style={{
              fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
            }}
          >
            {MODE_LABELS[mode]}
          </h1>
          <p className="text-slate-500 mb-4">
            {mode === "concept"
              ? "Concept Practice · 60s per question"
              : `${MODE_LABELS[mode]} · 60s per question`}
          </p>

          {/* Concept filter (only in concept mode) */}
          {mode === "concept" && (
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setConceptFilter("all")}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background:
                    conceptFilter === "all" ? "#7c3aed" : "#F5F3FF",
                  color: conceptFilter === "all" ? "#fff" : "#5B21B6",
                  border: `1.5px solid ${
                    conceptFilter === "all" ? "#7c3aed" : "#7c3aed40"
                  }`,
                }}
              >
                All
              </button>
              {TRIG_CONCEPTS.map((c) => {
                const col = CONCEPT_COLOURS[c] ?? {
                  border: "#7C3AED",
                  bg: "#F5F3FF",
                  text: "#5B21B6",
                };
                const isActive = conceptFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setConceptFilter(c)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: isActive ? col.text : col.bg,
                      color: isActive ? "#fff" : col.text,
                      border: `1.5px solid ${col.border}`,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}

          {/* Formula cheatsheet */}
          <div className="mb-8 mx-auto max-w-sm rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-2">
              Key Identities
            </p>
            {[
              "sin²θ + cos²θ = 1",
              "1 + tan²θ = sec²θ",
              "1 + cot²θ = cosec²θ",
              "sin(90°−θ) = cosθ",
              "tan(90°−θ) = cotθ",
            ].map((f) => (
              <p key={f} className="text-xs font-mono text-violet-700 leading-6">
                {f}
              </p>
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleStart}
              className="trig-start-button mx-auto"
              aria-label="Start Quiz"
            >
              <Sparkles className="trig-start-icon" aria-hidden="true" />
              <span className="trig-start-label">Start Quiz</span>
            </button>
          </div>
        </div>

        <style jsx>{`
          .trig-start {
            background: radial-gradient(
                1200px 600px at 20% -10%,
                rgba(124, 58, 237, 0.12),
                transparent 60%
              ),
              radial-gradient(
                1000px 540px at 85% 110%,
                rgba(37, 99, 235, 0.12),
                transparent 62%
              ),
              linear-gradient(135deg, #faf8ff 0%, #eef4ff 45%, #faf8ff 100%);
          }
          .trig-start-button {
            position: relative;
            width: min(78vw, 260px);
            min-height: 54px;
            border: 0;
            border-radius: 999px;
            cursor: pointer;
            isolation: isolate;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.42rem;
            padding: 0 1.2rem;
            background: linear-gradient(
              130deg,
              #7c3aed 0%,
              #4f46e5 48%,
              #2563eb 100%
            );
            background-size: 190% 190%;
            color: #ffffff;
            box-shadow: 0 18px 32px rgba(124, 58, 237, 0.35),
              0 0 22px rgba(79, 70, 229, 0.3), 0 0 40px rgba(37, 99, 235, 0.2),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.32);
            transition: transform 0.4s ease, box-shadow 0.4s ease,
              filter 0.4s ease;
            animation: trig-breathe 3.4s ease-in-out infinite,
              trig-gradient 4.2s ease-in-out infinite;
          }
          .trig-start-button::before,
          .trig-start-button::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
          }
          .trig-start-button::before {
            inset: 2px;
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.42),
              rgba(255, 255, 255, 0.08) 42%,
              transparent 85%
            );
            opacity: 0.85;
          }
          .trig-start-button::after {
            background: linear-gradient(
              100deg,
              transparent 18%,
              rgba(255, 255, 255, 0.72) 47%,
              transparent 78%
            );
            transform: translateX(-140%);
            mix-blend-mode: screen;
            opacity: 0.92;
            animation: trig-sweep 3s ease-in-out infinite;
          }
          .trig-start-icon {
            position: relative;
            z-index: 2;
            width: 0.88rem;
            height: 0.88rem;
            stroke-width: 2.4;
            color: #ffffff;
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.55));
            animation: trig-twinkle 2.8s ease-in-out infinite;
          }
          .trig-start-label {
            position: relative;
            z-index: 2;
            font-size: clamp(0.88rem, 2.5vw, 1rem);
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #ffffff;
            text-shadow: 0 2px 10px rgba(30, 41, 59, 0.34);
          }
          .trig-start-button:hover {
            transform: translateY(-2px) scale(1.05);
            filter: brightness(1.12);
            box-shadow: 0 22px 42px rgba(124, 58, 237, 0.45),
              0 0 30px rgba(79, 70, 229, 0.45), 0 0 58px rgba(37, 99, 235, 0.3),
              inset 0 2px 0 rgba(255, 255, 255, 0.44);
          }
          .trig-start-button:focus-visible {
            outline: 2px solid rgba(255, 255, 255, 0.72);
            outline-offset: 4px;
          }
          @keyframes trig-sweep {
            0% {
              transform: translateX(-140%);
            }
            55%,
            100% {
              transform: translateX(140%);
            }
          }
          @keyframes trig-breathe {
            0%,
            100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-4px) scale(1.018);
            }
          }
          @keyframes trig-gradient {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes trig-twinkle {
            0%,
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 0.92;
            }
            50% {
              transform: scale(1.15) rotate(8deg);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // ── No questions guard ─────────────────────────────────────────────────────
  if (!currentQ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        No questions available for this selection.
      </div>
    );
  }

  const isCurrentSubmitted = submittedQuestions.has(currentIndex);
  const canSubmit = selectedAnswer !== null && !isCurrentSubmitted;

  // ── Quiz Screen ────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "linear-gradient(165deg, #f5f0ff 0%, #eef2ff 38%, #f8faff 100%)",
        fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
      }}
    >
      <main className="mx-auto max-w-3xl px-3 pb-[110px] pt-3 sm:px-6 sm:pt-4">

        {/* Top bar */}
        <section className="mb-3 flex items-center justify-end gap-2">
          {/* Streak indicator */}
          {streak >= 2 && (
            <div className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-bold text-violet-600">
              <Flame className="w-3.5 h-3.5" />
              {streak}
            </div>
          )}
          <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {formatClock(timeLeft)}
          </div>
          <button
            onClick={openPalette}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50"
            aria-label="Open question palette"
          >
            <Menu className="h-4 w-4" />
          </button>
        </section>

        {/* Question Navigator Strip */}
        <div className="mb-3">
          <QuestionNavigator
            total={questions.length}
            currentIndex={currentIndex}
            selectedAnswers={selectedAnswers}
            questions={questions}
            submittedQuestions={submittedQuestions}
            onGoToQuestion={goToQuestion}
            onOpenPalette={openPalette}
            onClosePalette={closePalette}
            isPaletteOpen={isPaletteOpen}
          />
        </div>

        {/* Question Card */}
        <section
          className="mb-4"
          onTouchStart={(event) => {
            const touch = event.changedTouches[0];
            touchStartXRef.current = touch.clientX;
            touchStartYRef.current = touch.clientY;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartXRef.current;
            const startY = touchStartYRef.current;
            if (startX === null || startY === null) return;
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > 90) return;
            if (deltaX > 0) showQuestion(currentIndex - 1);
            else showQuestion(currentIndex + 1);
          }}
        >
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`bg-white rounded-2xl shadow-[0_4px_20px_rgba(124,58,237,0.08)] px-6 py-6 sm:px-8 sm:py-8 ${
              isLongQuestion
                ? "min-h-[220px] sm:min-h-[260px]"
                : "min-h-[150px] sm:min-h-[180px]"
            }`}
          >
            {/* Card header */}
            <div className="flex items-center mb-[14px] flex-wrap gap-2">
              <ConceptBadge concept={currentQ.concept} />
              <span
                style={{
                  fontSize: "13px",
                  color: "#6B7280",
                  fontWeight: 500,
                }}
              >
                {currentQ.exam} {currentQ.year}
              </span>

              {/* Formula hint — shown when submitted */}
              {isCurrentSubmitted && currentQ.formula && (
                <span
                  className="ml-auto hidden sm:inline-block rounded-lg px-3 py-1 text-xs font-mono"
                  style={{
                    background: "#F5F3FF",
                    color: "#5B21B6",
                    border: "1px solid #7c3aed30",
                  }}
                >
                  {currentQ.formula}
                </span>
              )}

              <button
                onClick={handleBookmark}
                className="ml-auto sm:ml-0 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                aria-label={
                  bookmarked.has(String(currentQ.id))
                    ? "Remove bookmark"
                    : "Add bookmark"
                }
              >
                {bookmarked.has(String(currentQ.id)) ? (
                  <BookmarkCheck className="w-5 h-5 text-violet-500" />
                ) : (
                  <Bookmark className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>

            {/* Question text */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "#111827",
                lineHeight: 1.6,
                marginBottom: 28,
                letterSpacing: 0.01,
              }}
            >
              <MathRenderer
                text={currentQ.question}
                className="leading-relaxed"
              />
            </div>

            {/* Formula hint on mobile — shown below question when submitted */}
            {isCurrentSubmitted && currentQ.formula && (
              <div
                className="sm:hidden rounded-lg px-3 py-2 text-xs font-mono mb-2"
                style={{
                  background: "#F5F3FF",
                  color: "#5B21B6",
                  border: "1px solid #7c3aed30",
                }}
              >
                <span className="font-semibold text-violet-400 mr-1">
                  Formula:
                </span>
                {currentQ.formula}
              </div>
            )}
          </motion.div>
        </section>

        {/* Options */}
        <section className="mb-5" style={{ marginTop: 28 }}>
          {currentQ.options.slice(0, 4).map((opt, i) => {
            let border = "#E5E7EB",
              bg = "#FFFFFF",
              letterBg = "transparent",
              letterBorder = "#7C3AED",
              letterText = "#5B21B6",
              letterFontWeight = 600;

            if (isCurrentSubmitted && i === currentQ.correctAnswer) {
              border = "#16A34A";
              bg = "#F0FDF4";
              letterBg = "#16A34A";
              letterBorder = "#16A34A";
              letterText = "#fff";
            } else if (
              isCurrentSubmitted &&
              selectedAnswer === i &&
              i !== currentQ.correctAnswer
            ) {
              border = "#DC2626";
              bg = "#FEF2F2";
              letterBg = "#DC2626";
              letterBorder = "#DC2626";
              letterText = "#fff";
            } else if (!isCurrentSubmitted && selectedAnswer === i) {
              border = "#7C3AED";
              bg = "#F5F3FF";
              letterBg = "#7C3AED";
              letterBorder = "#7C3AED";
              letterText = "#fff";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelectAnswer(i)}
                disabled={isCurrentSubmitted}
                type="button"
                style={{
                  width: "100%",
                  height: 58,
                  background: bg,
                  border: `1.5px solid ${border}`,
                  borderRadius: 16,
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  marginBottom: 12,
                  cursor: isCurrentSubmitted ? "default" : "pointer",
                  transition: "all 0.15s ease",
                  fontSize: 17,
                  fontWeight: 400,
                  color: "#111827",
                  outline: "none",
                }}
                onMouseOver={(e) => {
                  if (!isCurrentSubmitted && selectedAnswer !== i) {
                    e.currentTarget.style.borderColor = "#C4B5FD";
                    e.currentTarget.style.background = "#F5F3FF";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isCurrentSubmitted && selectedAnswer !== i) {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.background = "#FFFFFF";
                  }
                }}
              >
                {/* Letter bubble */}
                <span
                  style={{
                    width: 34,
                    height: 34,
                    border: `1.5px solid ${letterBorder}`,
                    borderRadius: "50%",
                    background: letterBg,
                    color: letterText,
                    fontSize: 14,
                    fontWeight: letterFontWeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginRight: 10,
                    transition: "all 0.15s ease",
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>

                {/* Option text */}
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 400,
                    color: "#111827",
                    lineHeight: 1.5,
                  }}
                >
                  <MathRenderer text={opt} />
                </span>

                {/* Correct / wrong icons */}
                {isCurrentSubmitted && i === currentQ.correctAnswer && (
                  <CheckCircle2
                    className="ml-auto h-5 w-5 shrink-0 text-emerald-600"
                    aria-label="Correct option"
                  />
                )}
                {isCurrentSubmitted &&
                  selectedAnswer === i &&
                  i !== currentQ.correctAnswer && (
                    <XCircle
                      className="ml-auto h-5 w-5 shrink-0 text-red-600"
                      aria-label="Wrong option"
                    />
                  )}
              </button>
            );
          })}
        </section>
      </main>

      {/* Submit error toast */}
      {submitError && (
        <div className="fixed bottom-[86px] left-0 right-0 z-40 px-3 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 shadow-sm">
            {submitError}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md">
        <div
          className="mx-auto max-w-3xl px-3 pb-3 pt-3 sm:px-6"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Previous
            </button>

            <button
              onClick={() => {
                if (!isCurrentSubmitted) {
                  handleSubmitCurrent();
                  return;
                }
                handleNext();
              }}
              disabled={!canSubmit && !isCurrentSubmitted}
              className="inline-flex h-14 items-center justify-center rounded-2xl px-5 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: isCurrentSubmitted
                  ? "linear-gradient(135deg, #5b21b6 0%, #1d4ed8 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              }}
            >
              {!isCurrentSubmitted
                ? "Submit"
                : currentIndex < questions.length - 1
                ? "Next →"
                : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}