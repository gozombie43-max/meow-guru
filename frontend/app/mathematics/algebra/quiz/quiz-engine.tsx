"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Zap, Menu, Clock, Target,
  Trophy, CheckCircle2, XCircle, BarChart3, Flame,
  ChevronRight, ChevronLeft, RotateCcw, Lightbulb,
} from "lucide-react";
import {
  algebraQuestions,
  shuffle,
  type AlgebraQuestion,
  CONCEPTS,
} from "@/lib/algebra-questions";
import { generateAIBatch } from "@/lib/ai-generator";

/* ── Types ──────────────────────────────────────────────── */

type QuizMode = "concept" | "formula" | "mixed" | "ai-challenge";
type Difficulty = "easy" | "medium" | "hard";

interface SessionResult {
  questionId: number;
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

/* ── Question Navigator ────────────────────────────────── *
 * Scrollable strip of numbered buttons for quick jumping.
 * Color-coded: current=purple, correct=green, wrong=red,
 * unvisited=gray.
 * ──────────────────────────────────────────────────────────── */

function QuestionNavigator({
  total,
  currentIndex,
  results,
  onJump,
}: {
  total: number;
  currentIndex: number;
  results: SessionResult[];
  onJump: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Build a status map from results
  const statusMap = useMemo(() => {
    const map: Record<number, "correct" | "wrong" | "timeout"> = {};
    for (const r of results) {
      // Results are stored in order — the index in results array = question index
      const idx = results.indexOf(r);
      if (r.isCorrect) map[idx] = "correct";
      else if (r.selected === null) map[idx] = "timeout";
      else map[idx] = "wrong";
    }
    return map;
  }, [results]);

  // Keep the current button visible
  useEffect(() => {
    const btn = btnRefs.current[currentIndex];
    if (btn && scrollRef.current) {
      const container = scrollRef.current;
      const offsetLeft = btn.offsetLeft - container.offsetLeft;
      const scrollTo = offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
      container.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  }, [currentIndex]);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -200 : 200,
      behavior: "smooth",
    });
  }

  function btnClass(idx: number) {
    const base =
      "shrink-0 w-9 h-9 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border";
    if (idx === currentIndex)
      return `${base} bg-cyan-500/15 border-cyan-500/40 text-cyan-600 shadow-[0_0_12px_rgba(0,229,255,0.15)]`;
    const status = statusMap[idx];
    if (status === "correct")
      return `${base} bg-emerald-500/10 border-emerald-500/25 text-emerald-600`;
    if (status === "wrong" || status === "timeout")
      return `${base} bg-red-500/10 border-red-500/25 text-red-500`;
    return `${base} bg-white/15 border-white/25 text-slate-500 hover:bg-white/25 hover:border-white/40`;
  }

  return (
    <div className="glass rounded-xl p-2 flex items-center gap-1.5 mb-5">
      {/* Prev arrow */}
      <button
        onClick={() => scroll("left")}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[var(--text-primary)] hover:bg-white/15 transition-colors cursor-pointer"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable buttons */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            ref={(el) => { btnRefs.current[i] = el; }}
            onClick={() => onJump(i)}
            className={btnClass(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Next arrow */}
      <button
        onClick={() => scroll("right")}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[var(--text-primary)] hover:bg-white/15 transition-colors cursor-pointer"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
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

/* ── Progress Bar ──────────────────────────────────────── */

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
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
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [started, setStarted] = useState(false);

  /* Timer state */
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(Date.now());

  const maxTime = miniMode ? 20 : 60;

  /* ── Build question set ── */
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
        pool = generateAIBatch(shuffle(algebraQuestions), 50);
        break;
      case "mixed":
      default:
        pool = shuffle([...algebraQuestions]);
        break;
    }

    // Filter by adaptive difficulty
    if (mode !== "ai-challenge") {
      const filtered = pool.filter((q) => q.difficulty === difficulty);
      pool = filtered.length >= 5 ? filtered : pool;
    }

    setQuestions(shuffle(pool));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResults([]);
    setStreak(0);
    setShowAnalytics(false);
    setStarted(false);
  }, [mode, difficulty, conceptFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
    questionStartRef.current = Date.now();
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

  // Auto-lock when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && !isAnswered && started) {
      handleTimeout();
    }
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  /* ── Current question ── */
  const currentQ = questions[currentIndex] as AlgebraQuestion | undefined;

  /* ── Handlers ── */
  function handleStart() {
    setStarted(true);
    startTimer();
  }

  function handleTimeout() {
    if (!currentQ) return;
    setIsAnswered(true);
    stopTimer();
    const timeTaken = Math.round((Date.now() - questionStartRef.current) / 1000);
    setStreak(0);
    setResults((prev) => [
      ...prev,
      {
        questionId: currentQ.id,
        selected: null,
        correct: currentQ.correctAnswer,
        isCorrect: false,
        timeTaken,
        concept: currentQ.concept,
        difficulty: currentQ.difficulty,
      },
    ]);
  }

  function handleSelectAnswer(index: number) {
    if (isAnswered || !currentQ) return;
    setSelectedAnswer(index);
    setIsAnswered(true);
    stopTimer();

    const timeTaken = Math.round((Date.now() - questionStartRef.current) / 1000);
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
        selected: index,
        correct: currentQ.correctAnswer,
        isCorrect,
        timeTaken,
        concept: currentQ.concept,
        difficulty: currentQ.difficulty,
      },
    ]);

    // Adaptive difficulty
    adaptDifficulty(isCorrect);
  }

  function adaptDifficulty(correct: boolean) {
    const recent = [...results.slice(-4), { isCorrect: correct }];
    const recentCorrect = recent.filter((r) => r.isCorrect).length;

    if (recentCorrect >= 4 && difficulty !== "hard") {
      setDifficulty((d) => (d === "easy" ? "medium" : "hard"));
    } else if (recentCorrect <= 1 && difficulty !== "easy") {
      setDifficulty((d) => (d === "hard" ? "medium" : "easy"));
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      startTimer();
    } else {
      stopTimer();
      setShowAnalytics(true);
    }
  }

  function handleJumpTo(index: number) {
    if (index === currentIndex) return;
    // Only allow jumping to unanswered future questions or already-answered ones
    setCurrentIndex(index);
    setSelectedAnswer(null);
    // If this question was already answered, show it as answered
    if (index < results.length) {
      const prev = results[index];
      setSelectedAnswer(prev.selected);
      setIsAnswered(true);
      stopTimer();
    } else {
      setIsAnswered(false);
      startTimer();
    }
  }

  function handleRestart() {
    setQuestions(shuffle([...questions]));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResults([]);
    setStreak(0);
    setBestStreak(0);
    setShowAnalytics(false);
    setStarted(false);
  }

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
      "w-full text-left px-5 py-4 rounded-xl border transition-all duration-300 cursor-pointer";
    if (!isAnswered) {
      if (selectedAnswer === index)
        return `${base} border-cyan-400/40 bg-cyan-500/10 text-[var(--text-primary)]`;
      return `${base} border-white/30 bg-white/10 text-slate-600 hover:border-white/45 hover:bg-white/18`;
    }
    // After answering
    if (index === currentQ!.correctAnswer)
      return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-700`;
    if (index === selectedAnswer && index !== currentQ!.correctAnswer)
      return `${base} border-red-500/40 bg-red-500/10 text-red-600`;
    return `${base} border-white/20 bg-white/5 text-slate-400`;
  }

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */

  /* ── Analytics Screen ── */
  if (showAnalytics) {
    return (
      <div className="min-h-screen relative overflow-hidden">

        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 glass">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-cyan-500" />
              <span className="text-xl font-bold tracking-tight gradient-text font-sans">SSC AI</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Menu">
              <Menu className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </nav>

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
      <div className="min-h-screen relative overflow-hidden">

        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 glass">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-cyan-500" />
              <span className="text-xl font-bold tracking-tight gradient-text font-sans">SSC AI</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Menu">
              <Menu className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </nav>

        <div className="pt-28 pb-20 px-6 max-w-2xl mx-auto relative text-center">
          <Link
            href="/mathematics/algebra"
            className="animate-fade-in-up inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-primary)] transition-colors mb-12 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Algebra
          </Link>

          <h1
            className="animate-fade-in-up text-[clamp(1.8rem,4vw,2.5rem)] font-bold mb-4 text-[var(--text-primary)]"
            style={{ animationDelay: "100ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            {MODE_LABELS[mode]}
          </h1>
          <p
            className="animate-fade-in-up text-slate-500 mb-8"
            style={{ animationDelay: "200ms" }}
          >
            {questions.length} questions loaded · {miniMode ? "20s" : "60s"} per question
          </p>

          {/* Controls */}
          <div
            className="animate-fade-in-up space-y-6 mb-10"
            style={{ animationDelay: "300ms" }}
          >
            {/* Mini mode toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm text-slate-500">Mini Mode</span>
              <button
                onClick={() => setMiniMode((m) => !m)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  miniMode ? "bg-cyan-500" : "bg-white/20"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    miniMode ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {/* Concept filter (concept mode) */}
            {mode === "concept" && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-slate-500">Filter by Concept</span>
                <select
                  value={conceptFilter}
                  onChange={(e) => setConceptFilter(e.target.value)}
                  className="glass-input px-4 py-2 text-sm outline-none"
                >
                  <option value="all">All Concepts</option>
                  {CONCEPTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Difficulty */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-slate-500 mr-2">Starting Difficulty</span>
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border capitalize cursor-pointer transition-all ${
                    difficulty === d
                      ? DIFFICULTY_COLORS[d]
                      : "text-slate-500 border-white/25 bg-transparent hover:bg-white/10"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="animate-fade-in-up btn-glow px-10 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 mx-auto cursor-pointer"
            style={{ animationDelay: "400ms" }}
          >
            Start Quiz <ChevronRight className="w-5 h-5" />
          </button>
        </div>
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}

      {/* ── Top Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            <Link
              href="/mathematics/algebra"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-primary)] transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="hidden sm:inline">Exit Quiz</span>
            </Link>

            <div className="flex items-center gap-3">
              {/* Streak badge */}
              {streak >= 2 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 text-xs font-semibold">
                  <Flame className="w-3 h-3" /> {streak}
                </div>
              )}

              {/* Mini mode indicator */}
              {miniMode && (
                <div className="px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-600 text-[11px] font-medium">
                  MINI
                </div>
              )}

              {/* Timer */}
              <TimerCircle timeLeft={timeLeft} maxTime={maxTime} mini={miniMode} />
            </div>
          </div>
          <ProgressBar current={currentIndex + 1} total={questions.length} />
        </div>
      </div>

      {/* ── Question Area ── */}
      <div
        className={`pt-24 pb-20 px-6 max-w-3xl mx-auto relative ${miniMode ? "pt-22" : ""}`}
      >
        {/* Question Navigator */}
        <QuestionNavigator
          total={questions.length}
          currentIndex={currentIndex}
          results={results}
          onJump={handleJumpTo}
        />

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-6 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <MathFraction
              numerator={<span className="text-[var(--text-primary)] font-semibold">{currentIndex + 1}</span>}
              denominator={questions.length}
              className="text-sm"
            />
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> {stats.correct}
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="w-3.5 h-3.5" /> {stats.wrong}
            </span>
            {stats.accuracy > 0 && (
              <span className="text-slate-500">{stats.accuracy}%</span>
            )}
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full border capitalize ${DIFFICULTY_COLORS[difficulty]}`}
          >
            {difficulty}
          </span>
        </div>

        {/* Question Card */}
        <div
          key={currentQ.id}
          className={`glass-card rounded-2xl ${miniMode ? "p-5" : "p-7 sm:p-8"} mb-6 animate-fade-in-up`}
        >
          {/* Tags */}
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

          {/* Question text */}
          <h2
            className={`font-semibold leading-relaxed mb-7 ${
              miniMode ? "text-base" : "text-lg sm:text-xl"
            }`}
          >
            <MathText text={currentQ.question} />
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectAnswer(i)}
                disabled={isAnswered}
                className={optionClass(i)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-medium shrink-0 ${
                      isAnswered && i === currentQ.correctAnswer
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                        : isAnswered && i === selectedAnswer
                          ? "border-red-500/50 bg-red-500/10 text-red-500"
                          : "border-white/25 text-slate-500"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span><MathText text={opt} /></span>
                  {isAnswered && i === currentQ.correctAnswer && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                  )}
                  {isAnswered &&
                    i === selectedAnswer &&
                    i !== currentQ.correctAnswer && (
                      <XCircle className="w-4 h-4 text-red-500 ml-auto shrink-0" />
                    )}
                </div>
              </button>
            ))}
          </div>
        </div>

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
            {selectedAnswer === null && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Time expired — question was skipped.
              </p>
            )}
          </div>
        )}

        {/* Next button */}
        {isAnswered && (
          <button
            onClick={handleNext}
            className="btn-glow px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto cursor-pointer animate-fade-in-up"
          >
            {currentIndex < questions.length - 1 ? (
              <>
                Next Question <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                View Results <BarChart3 className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
