"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Sparkles, Target,
  CheckCircle2, XCircle, BarChart3, Flame,
  RotateCcw, Lightbulb, Menu, X,
} from "lucide-react";
import {
  algebraQuestions,
  shuffle,
  type AlgebraQuestion,
  CONCEPTS,
} from "@/lib/algebra-questions";

/* ── Types ──────────────────────────────────────────────── */

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

/* ── Constants ──────────────────────────────────────────── */

const MODE_LABELS: Record<QuizMode, string> = {
  concept: "Concept Practice",
  formula: "Formula Practice",
  mixed: "Mixed Practice",
  "ai-challenge": "AI Challenge",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25",
  medium: "text-amber-600 bg-amber-500/10 border-amber-500/25",
  hard: "text-red-500 bg-red-500/10 border-red-500/25",
};

/* ── Math Fraction Display ──────────────────────────────── *
 * Renders  a / b  as a proper stacked fraction like textbooks.
 * Used wherever we show "current / total" ratios.
 * ──────────────────────────────────────────────────────────── */

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
      <span className="text-[var(--text-primary)] font-bold" style={{ fontSize: "0.85em" }}>
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

/* ── Math Text Renderer ─────────────────────────────────── *
 * Parses a string for fraction patterns like  a/b, (expr)/(expr)
 * and renders them as stacked math-book fractions with a vinculum.
 * ──────────────────────────────────────────────────────────── */

function MathText({ text, className = "" }: { text: string; className?: string }) {
  /*
   * Regex explanation:
   *   Group 1 – numerator that is a parenthesized expression: \(([^()]+)\)
   *   Group 2 – OR a "simple" token (digits, letters, superscripts, √, ., –, ^, etc.)
   *   Then a literal /
   *   Group 3 – denominator parenthesized
   *   Group 4 – OR simple token
   *
   * We avoid matching the "/" inside exam fields like "CGL Tier-II" by requiring
   * at least one alphanumeric / math char on both sides.
   */
  const fractionRe =
    /(\([^()]+\)|[\w\d√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇⁿ.–^]+)\/((\([^()]+\))|[\w\d√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇⁿ.–^]+)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fractionRe.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const rawNum = match[1];
    const rawDen = match[2];
    // Strip outer parens for display if the whole token is wrapped
    const num = rawNum.startsWith("(") && rawNum.endsWith(")") ? rawNum.slice(1, -1) : rawNum;
    const den = rawDen.startsWith("(") && rawDen.endsWith(")") ? rawDen.slice(1, -1) : rawDen;

    parts.push(
      <span
        key={match.index}
        className="inline-flex flex-col items-center leading-none align-middle mx-[2px]"
        role="math"
        aria-label={`${num} over ${den}`}
      >
        <span className="font-semibold px-[3px]" style={{ fontSize: "0.88em" }}>
          {num}
        </span>
        <span
          className="w-full my-[1px]"
          style={{ minWidth: "0.9em", borderTop: "1.5px solid currentColor" }}
        />
        <span className="font-semibold px-[3px]" style={{ fontSize: "0.88em" }}>
          {den}
        </span>
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

/* ── Question Navigator (Virtualized + Mobile) ─────────── *
 *  - Sticky two-row navigation
 *  - React Window virtualization for quick strip and palette
 *  - Framer Motion full-screen palette modal
 * ──────────────────────────────────────────────────────────── */

type QuestionStatus = "current" | "review" | "answered" | "not-answered";

function getQuestionStatus({
  index,
  currentIndex,
  answeredQuestions,
  markedForReview,
}: {
  index: number;
  currentIndex: number;
  answeredQuestions: Set<number>;
  markedForReview: Set<number>;
}): QuestionStatus {
  if (index === currentIndex) return "current";
  if (markedForReview.has(index)) return "review";
  if (answeredQuestions.has(index)) return "answered";
  return "not-answered";
}

function statusClasses(status: QuestionStatus) {
  const base = "border transition-all duration-200";
  if (status === "current") return `${base} bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-400/40`;
  if (status === "review") return `${base} bg-orange-100 text-orange-700 border-orange-300`;
  if (status === "answered") return `${base} bg-emerald-100 text-emerald-700 border-emerald-300`;
  return `${base} bg-slate-100 text-slate-700 border-slate-300`;
}

function QuestionPaletteModal({
  isOpen,
  total,
  currentIndex,
  answeredQuestions,
  markedForReview,
  onClose,
  onGoToQuestion,
}: {
  isOpen: boolean;
  total: number;
  currentIndex: number;
  answeredQuestions: Set<number>;
  markedForReview: Set<number>;
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
              <h3 className="text-base font-semibold text-slate-800">Question Palette</h3>
              <button
                onClick={onClose}
                className="h-12 min-w-12 rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm"
                aria-label="Close question palette"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex gap-2 text-xs text-slate-600">
              <span className="rounded-md border border-blue-300 bg-blue-100 px-2 py-1">Current</span>
              <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">Answered</span>
              <span className="rounded-md border border-orange-300 bg-orange-100 px-2 py-1">Review</span>
              <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1">Not Answered</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="question-grid question-grid--palette">
                {Array.from({ length: total }, (_, index) => {
                  const status = getQuestionStatus({
                    index,
                    currentIndex,
                    answeredQuestions,
                    markedForReview,
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

function QuestionNavigator({
  total,
  currentIndex,
  answeredQuestions,
  markedForReview,
  onGoToQuestion,
  onOpenPalette,
  onClosePalette,
  isPaletteOpen,
}: {
  total: number;
  currentIndex: number;
  answeredQuestions: Set<number>;
  markedForReview: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
  onOpenPalette: () => void;
  onClosePalette: () => void;
  isPaletteOpen: boolean;
}) {
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = quickButtonRefs.current[currentIndex];
    if (!activeButton) return;
    activeButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIndex]);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-1 py-1.5">
          <div className="question-strip qnav-bar-scroll mx-auto" style={{ scrollSnapType: "x mandatory" }}>
            {Array.from({ length: total }, (_, index) => {
              const status = getQuestionStatus({
                index,
                currentIndex,
                answeredQuestions,
                markedForReview,
              });

              return (
                <button
                  key={index}
                  ref={(element) => {
                    quickButtonRefs.current[index] = element;
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
        answeredQuestions={answeredQuestions}
        markedForReview={markedForReview}
        onClose={onClosePalette}
        onGoToQuestion={onGoToQuestion}
      />
    </>
  );
}

/* ── Timer Circle SVG ──────────────────────────────────── */

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
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
          stroke={isLow ? "#ef4444" : "#00e5ff"}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-1000 linear ${isLow ? "animate-pulse" : ""}`}
        />
      </svg>
      <span
        className={`absolute text-sm font-bold ${isLow ? "text-red-500" : "text-[var(--text-primary)]"}`}
      >
        {timeLeft}
      </span>
    </div>
  );
}

/* ── Main Quiz Engine ──────────────────────────────────── */

export default function QuizEngine() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "mixed") as QuizMode;

  /* ── State ── */
  const [questions, setQuestions] = useState<AlgebraQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [miniMode, setMiniMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  /* Timer state */
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxTime = miniMode ? 20 : 60;
  const currentQ = questions[currentIndex] as AlgebraQuestion | undefined;

  /* ── Build question set ── */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let pool: AlgebraQuestion[];

    switch (mode) {
      case "concept":
        pool =
          conceptFilter === "all"
            ? [...algebraQuestions]
            : algebraQuestions.filter((q) => q.concept === conceptFilter);
        break;
      case "formula":
        pool = [...algebraQuestions];
        break;
      case "ai-challenge":
        pool = [...algebraQuestions];
        break;
      case "mixed":
      default:
        pool = shuffle([...algebraQuestions]);
        break;
    }

    setQuestions(shuffle(pool));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResults([]);
    setAnsweredQuestions(new Set());
    setMarkedForReview(new Set());
    setIsPaletteOpen(false);
    setStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }, [mode, conceptFilter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ── Timer ── */
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

  // Stop timer at 0 but do not auto-submit or reveal answers.
  useEffect(() => {
    if (timeLeft === 0) {
      stopTimer();
    }
  }, [stopTimer, timeLeft]);

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  /* ── Handlers ── */
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

      const existing = results.find((r) => r.questionIndex === safeIndex);
      if (existing) {
        setSelectedAnswer(existing.selected);
        setIsAnswered(true);
        setSubmitError("");
        return;
      }

      setSelectedAnswer(null);
      setIsAnswered(false);
      setSubmitError("");
      if (started && !showAnalytics) {
        startTimer();
      }
    },
    [questions.length, results, showAnalytics, startTimer, started, stopTimer],
  );

  const goToQuestion = useCallback((questionNumber: number) => {
    if (questions.length === 0) return;
    const safeNumber = Math.max(1, Math.min(questionNumber, questions.length));
    showQuestion(safeNumber - 1);
  }, [questions.length, showQuestion]);

  const openPalette = useCallback(() => {
    setIsPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setIsPaletteOpen(false);
  }, []);

  const adaptDifficulty = useCallback((correct: boolean) => {
    const recent = [...results.slice(-4), { isCorrect: correct }];
    const recentCorrect = recent.filter((r) => r.isCorrect).length;

    if (recentCorrect >= 4 && difficulty !== "hard") {
      setDifficulty((d) => (d === "easy" ? "medium" : "hard"));
    } else if (recentCorrect <= 1 && difficulty !== "easy") {
      setDifficulty((d) => (d === "hard" ? "medium" : "easy"));
    }
  }, [difficulty, results]);

  const handleSelectAnswer = useCallback((index: number) => {
    if (isAnswered || !currentQ) return;
    if (index < 0 || index >= currentQ.options.length) return;

    setSelectedAnswer(index);
    setIsAnswered(true);
    stopTimer();

    const timeTaken = Math.max(1, maxTime - timeLeft);
    const isCorrect = index === currentQ.correctAnswer;

    if (isCorrect) {
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }

    setResults((prev) => [
      ...prev,
      {
        questionId: currentQ.id,
        questionIndex: currentIndex,
        selected: index,
        correct: currentQ.correctAnswer,
        isCorrect,
        timeTaken,
        concept: currentQ.concept,
        difficulty: currentQ.difficulty,
      },
    ]);
    setAnsweredQuestions((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setSubmitError("");
  }, [currentIndex, currentQ, isAnswered, maxTime, stopTimer, timeLeft]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    showQuestion(currentIndex - 1);
  }, [currentIndex, showQuestion]);

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else {
      stopTimer();
      setShowAnalytics(true);
    }
  }

  function handleRestart() {
    setQuestions(shuffle([...questions]));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResults([]);
    setAnsweredQuestions(new Set());
    setMarkedForReview(new Set());
    closePalette();
    setStreak(0);
    setBestStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }

  useEffect(() => {
    if (!started || showAnalytics) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }

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

      if (isAnswered || !currentQ) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const base = selectedAnswer === null ? 0 : Math.min(selectedAnswer + 1, currentQ.options.length - 1);
        handleSelectAnswer(base);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const base = selectedAnswer === null ? currentQ.options.length - 1 : Math.max(selectedAnswer - 1, 0);
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
    isAnswered,
    selectedAnswer,
    showAnalytics,
    showQuestion,
    started,
  ]);

  /* ── Computed stats ── */
  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length;
    const wrong = results.filter((r) => !r.isCorrect && r.selected !== null).length;
    const skipped = results.filter((r) => r.selected === null).length;
    const accuracy = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const avgTime =
      results.length > 0
        ? Math.round(results.reduce((a, r) => a + r.timeTaken, 0) / results.length)
        : 0;
    return { correct, wrong, skipped, accuracy, avgTime };
  }, [results]);

  /* ── Weak concepts (for analytics) ── */
  const weakConcepts = useMemo(() => {
    const conceptStats: Record<string, { correct: number; total: number }> = {};
    for (const r of results) {
      if (!conceptStats[r.concept]) conceptStats[r.concept] = { correct: 0, total: 0 };
      conceptStats[r.concept].total++;
      if (r.isCorrect) conceptStats[r.concept].correct++;
    }
    return Object.entries(conceptStats)
      .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.5)
      .map(([c, s]) => ({ concept: c, accuracy: Math.round((s.correct / s.total) * 100) }));
  }, [results]);

  /* ── Option style helper ── */
  function optionClass(index: number) {
    const base =
      "w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-sm";
    if (!isAnswered) {
      if (selectedAnswer === index)
        return `${base} border-indigo-400 bg-indigo-50 text-[var(--text-primary)] shadow-[0_8px_20px_rgba(79,70,229,0.18)]`;
      return `${base} border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40`;
    }
    // After answering
    if (index === currentQ!.correctAnswer)
      return `${base} border-emerald-400 bg-emerald-50 text-emerald-700`;
    if (index === selectedAnswer && index !== currentQ!.correctAnswer)
      return `${base} border-rose-400 bg-rose-50 text-rose-600`;
    return `${base} border-slate-200 bg-slate-50 text-slate-500`;
  }

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */

  /* ── Analytics Screen ── */
  if (showAnalytics) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto relative">
          <h1 className="animate-fade-in-up text-3xl font-bold mb-2 text-[var(--text-primary)]" style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
            Session <span className="gradient-text">Complete</span>
          </h1>
          <p className="animate-fade-in-up text-slate-500 mb-10" style={{ animationDelay: "100ms" }}>
            Here&apos;s how you performed in this {MODE_LABELS[mode]} session.
          </p>

          {/* Stats grid */}
          <div
            className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
            style={{ animationDelay: "200ms" }}
          >
            {[
              { label: "Correct", value: stats.correct, color: "text-emerald-600" },
              { label: "Wrong", value: stats.wrong, color: "text-red-500" },
              { label: "Accuracy", value: `${stats.accuracy}%`, color: "text-cyan-600" },
              { label: "Avg Time", value: `${stats.avgTime}s`, color: "text-amber-600" },
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
              <div className="text-xl font-bold text-cyan-600 flex items-center gap-2">
                <Flame className="w-5 h-5" /> {bestStreak}
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-slate-500 mb-1">Questions Done</div>
              <div className="text-xl font-bold text-[var(--text-primary)] flex items-center justify-center gap-2">
                <MathFraction numerator={results.length} denominator={questions.length} />
              </div>
            </div>
          </div>

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
                  <div key={wc.concept} className="flex items-center justify-between">
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
            >
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <Link
              href="/mathematics/algebra"
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

  /* ── Pre-start screen ── */
  if (!started) {
    return (
      <div className="concept-start min-h-screen relative overflow-hidden px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto text-center min-h-screen flex flex-col pt-20 sm:pt-24 pb-8">
          <h1
            className="text-[clamp(1.8rem,4vw,2.5rem)] font-bold mb-3 text-[var(--text-primary)]"
            style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            {MODE_LABELS[mode]}
          </h1>
          <p className="text-slate-500 mb-8 sm:mb-10">
            {mode === "concept" ? "Concept Practice · 60s per question" : `${MODE_LABELS[mode]} · 60s per question`}
          </p>

          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleStart}
              className="start-quiz-button mx-auto"
              aria-label="Start Quiz"
            >
              <Sparkles className="start-quiz-icon" aria-hidden="true" />
              <span className="start-quiz-label">Start Quiz</span>
            </button>
          </div>
        </div>

        <style jsx>{`
          .concept-start {
            background:
              radial-gradient(1200px 600px at 20% -10%, rgba(56, 189, 248, 0.18), transparent 60%),
              radial-gradient(1000px 540px at 85% 110%, rgba(16, 185, 129, 0.16), transparent 62%),
              linear-gradient(135deg, #f8fbff 0%, #edf4ff 45%, #f8fbff 100%);
          }

          .start-quiz-button {
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
            background: linear-gradient(130deg, #7c3aed 0%, #a21caf 48%, #2563eb 100%);
            background-size: 190% 190%;
            color: #ffffff;
            box-shadow:
              0 18px 32px rgba(37, 99, 235, 0.33),
              0 0 22px rgba(139, 92, 246, 0.36),
              0 0 40px rgba(168, 85, 247, 0.2),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.32);
            transition: transform 0.4s ease, box-shadow 0.4s ease, filter 0.4s ease;
            animation: button-breathe 3.4s ease-in-out infinite, gradient-shift 4.2s ease-in-out infinite;
          }

          .start-quiz-button::before,
          .start-quiz-button::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
          }

          .start-quiz-button::before {
            inset: 2px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.08) 42%, transparent 85%);
            opacity: 0.85;
          }

          .start-quiz-button::after {
            background: linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, 0.72) 47%, transparent 78%);
            transform: translateX(-140%);
            mix-blend-mode: screen;
            opacity: 0.92;
            animation: light-sweep 3s ease-in-out infinite;
          }

          .start-quiz-icon {
            position: relative;
            z-index: 2;
            width: 0.88rem;
            height: 0.88rem;
            stroke-width: 2.4;
            color: #ffffff;
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.55));
            animation: icon-twinkle 2.8s ease-in-out infinite;
          }

          .start-quiz-label {
            position: relative;
            z-index: 2;
            font-size: clamp(0.88rem, 2.5vw, 1rem);
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #ffffff;
            text-shadow: 0 2px 10px rgba(30, 41, 59, 0.34);
          }

          .start-quiz-button:hover {
            transform: translateY(-2px) scale(1.05);
            filter: brightness(1.12);
            box-shadow:
              0 22px 42px rgba(37, 99, 235, 0.4),
              0 0 30px rgba(139, 92, 246, 0.55),
              0 0 58px rgba(168, 85, 247, 0.33),
              inset 0 2px 0 rgba(255, 255, 255, 0.44);
          }

          .start-quiz-button:focus-visible {
            outline: 2px solid rgba(255, 255, 255, 0.72);
            outline-offset: 4px;
          }

          @keyframes light-sweep {
            0% {
              transform: translateX(-140%);
            }
            55%,
            100% {
              transform: translateX(140%);
            }
          }

          @keyframes button-breathe {
            0%,
            100% {
              transform: translateY(0) scale(1);
              box-shadow:
                0 18px 32px rgba(37, 99, 235, 0.33),
                0 0 22px rgba(139, 92, 246, 0.36),
                0 0 40px rgba(168, 85, 247, 0.2),
                inset 0 1.5px 0 rgba(255, 255, 255, 0.32);
            }
            50% {
              transform: translateY(-4px) scale(1.018);
              box-shadow:
                0 23px 40px rgba(37, 99, 235, 0.4),
                0 0 28px rgba(139, 92, 246, 0.48),
                0 0 52px rgba(168, 85, 247, 0.3),
                inset 0 2px 0 rgba(255, 255, 255, 0.42);
            }
          }

          @keyframes gradient-shift {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }

          @keyframes icon-twinkle {
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

          @media (max-width: 640px) {
            .start-quiz-button {
              width: min(72vw, 220px);
              min-height: 50px;
            }
          }
        `}</style>
      </div>
    );
  }

  /* ── Quiz Screen ── */
  if (!currentQ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        No questions available for this selection.
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "linear-gradient(165deg, #ecf4ff 0%, #eef8ff 38%, #f7fbff 100%)",
        fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
      }}
    >
      {/* Background */}

      {/* ── Top Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <Link
              href="/mathematics/algebra"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="text-sm font-semibold text-slate-700">
              Question {currentIndex + 1}/{questions.length}
            </div>

            <button
              onClick={openPalette}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Open question palette"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Question Area ── */}
      <div
        className={`pt-20 pb-40 px-3 sm:px-6 max-w-3xl mx-auto relative ${miniMode ? "pt-20" : ""}`}
      >
        {/* ── Question Number Strip ── */}
        <div className="relative z-10 pt-2 pb-2 mb-3">
          <QuestionNavigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredQuestions={answeredQuestions}
            markedForReview={markedForReview}
            onGoToQuestion={goToQuestion}
            onOpenPalette={openPalette}
            onClosePalette={closePalette}
            isPaletteOpen={isPaletteOpen}
          />
        </div>

        <div
          className="min-h-[calc(100svh-250px)] sm:min-h-[calc(100vh-230px)] flex flex-col"
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
          {/* Middle: Question Panel */}
          <div
            key={currentQ.id}
            className={`rounded-3xl border border-white/80 ${miniMode ? "p-5" : "p-6 sm:p-8"} mt-1 mb-4 shadow-[0_16px_38px_rgba(15,23,42,0.12)]`}
            style={{
              background: "linear-gradient(145deg, #ffffff 0%, #f3f8ff 100%)",
              opacity: 1,
              visibility: "visible",
            }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/25">
                {currentQ.concept}
              </span>
              {mode === "formula" && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/25">
                  {currentQ.formula}
                </span>
              )}
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/20 text-slate-500 border border-white/30">
                {currentQ.exam} {currentQ.year}
              </span>
            </div>

            <h2
              className={`font-semibold leading-relaxed ${
                miniMode ? "text-lg" : "text-xl sm:text-[1.55rem]"
              }`}
            >
              <MathText text={currentQ.question} />
            </h2>
          </div>

          {/* Lower: Options Panel */}
          <div className="mt-auto rounded-3xl border border-white/80 p-4 sm:p-6 bg-white/90 shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-600">
                <span>Time Left</span>
                <span>{timeLeft}s</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, (timeLeft / maxTime) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-3.5">
              {currentQ.options.map((opt, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleSelectAnswer(i)}
                  disabled={isAnswered}
                  className={optionClass(i)}
                  whileTap={!isAnswered ? { scale: 0.985 } : undefined}
                  animate={
                    !isAnswered && selectedAnswer === i
                      ? { scale: 1.015, y: -1 }
                      : { scale: 1, y: 0 }
                  }
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0 ${
                        isAnswered && i === currentQ.correctAnswer
                          ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                          : isAnswered && i === selectedAnswer
                            ? "border-rose-400 bg-rose-100 text-rose-600"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 text-left text-[0.98rem] leading-relaxed"><MathText text={opt} /></span>
                    {isAnswered && i === currentQ.correctAnswer && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0 animate-pulse" />
                    )}
                    {isAnswered &&
                      i === selectedAnswer &&
                      i !== currentQ.correctAnswer && (
                        <XCircle className="w-4 h-4 text-red-500 ml-auto shrink-0" />
                      )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Correct/Wrong status */}
        {isAnswered && (
          <div className="glass-card rounded-2xl p-4 mb-4 animate-fade-in-up">
            {selectedAnswer === currentQ.correctAnswer ? (
              <p className="text-emerald-600 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> You are correct.
              </p>
            ) : (
              <p className="text-red-500 font-semibold flex items-center gap-2">
                <XCircle className="w-4 h-4" /> You are wrong.
              </p>
            )}
          </div>
        )}

        {/* Solution panel */}
        {isAnswered && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up border-l-2 border-cyan-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-amber-600">Solution</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-2">
              <span className="text-[var(--text-primary)] font-medium">Correct Answer:</span>{" "}
              <MathText text={`${currentQ.options[currentQ.correctAnswer]} (${currentQ.answer})`} />
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              <span className="text-slate-600 font-medium">Concept:</span>{" "}
              {currentQ.concept} · <span className="text-slate-600 font-medium">Formula:</span>{" "}
              {currentQ.formula}
            </p>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md">
          <div
            className="max-w-3xl mx-auto px-3 sm:px-6 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#ece8ff] px-5 font-semibold text-[#3a3271] transition-colors hover:bg-[#e3ddff] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#2D2DB8] px-5 font-bold text-white transition-colors hover:bg-[#2525a3] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {currentIndex < questions.length - 1 ? (
                  <>Next <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Submit <BarChart3 className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
