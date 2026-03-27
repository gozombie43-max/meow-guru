
"use client";

import MathRenderer from "@/components/MathRenderer";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Bookmark, BookmarkCheck, CheckCircle2, XCircle, Menu, Flame, Sparkles, Target, RotateCcw, X, ArrowLeft, ArrowRight, BarChart3, Lightbulb } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { updateProgress, toggleBookmark } from "@/lib/userApi";
import { trigonometryQuestions, getCorrectAnswerIndex, TrigonometryQuestion } from "@/lib/trigonometry-questions";

type QuizMode = "concept" | "formula" | "mixed" | "ai-challenge";

const MODE_LABELS: Record<QuizMode, string> = {
  concept: "Concept Practice",
  formula: "Formula Practice",
  mixed: "Mixed Practice",
  "ai-challenge": "AI Challenge",
};

export default function QuizEngine() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "concept") as QuizMode;
  const [questions, setQuestions] = useState<TrigonometryQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set());
  const [started, setStarted] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, token, refreshUser } = useAuth();
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(user?.bookmarks ?? []));

  useEffect(() => {
    setQuestions([...trigonometryQuestions]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }, [mode]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    if (timeLeft === 0) stopTimer();
  }, [stopTimer, timeLeft]);
  useEffect(() => () => stopTimer(), [stopTimer]);

  function handleStart() {
    setStarted(true);
    startTimer();
  }

  const showQuestion = useCallback((index: number) => {
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
  }, [questions.length, selectedAnswers, showAnalytics, startTimer, started, stopTimer, submittedQuestions]);

  const goToQuestion = useCallback((questionNumber: number) => {
    if (questions.length === 0) return;
    const safeNumber = Math.max(1, Math.min(questionNumber, questions.length));
    showQuestion(safeNumber - 1);
  }, [questions.length, showQuestion]);

  const handleSelectAnswer = useCallback((index: number) => {
    if (!questions[currentIndex]) return;
    if (submittedQuestions.has(currentIndex)) return;
    if (index < 0 || index >= questions[currentIndex].options.length) return;
    setSelectedAnswer(index);
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
    setSubmitError("");
  }, [currentIndex, questions, submittedQuestions]);

  const handleSubmitCurrent = useCallback(() => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    if (submittedQuestions.has(currentIndex)) return;
    const selected = selectedAnswers[currentIndex];
    if (selected === undefined) {
      setSubmitError("Please choose an option before submitting.");
      return;
    }
    stopTimer();
    const isCorrect = selected === getCorrectAnswerIndex(currentQ);
    setResults((prev) => [...prev, { questionId: currentQ.id, questionIndex: currentIndex, selected, correct: getCorrectAnswerIndex(currentQ), isCorrect }]);
    setSubmittedQuestions((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setSubmitError("");
  }, [currentIndex, questions, selectedAnswers, stopTimer, submittedQuestions]);

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

  // ── Pre-start Screen ─────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="concept-start min-h-screen relative overflow-hidden px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto text-center min-h-screen flex flex-col pt-20 sm:pt-24 pb-8">
          <h1 className="text-[clamp(1.8rem,4vw,2.5rem)] font-bold mb-3 text-[var(--text-primary)]">{MODE_LABELS[mode]}</h1>
          <p className="text-slate-500 mb-8 sm:mb-10">Concept Practice · 60s per question</p>
          <div className="flex-1 flex items-center justify-center">
            <button onClick={handleStart} className="start-quiz-button mx-auto" aria-label="Start Quiz">
              <Sparkles className="start-quiz-icon" aria-hidden="true" />
              <span className="start-quiz-label">Start Quiz</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── No questions guard ─────────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  if (!currentQ) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">No questions available for this selection.</div>;
  }

  const isCurrentSubmitted = submittedQuestions.has(currentIndex);
  const canSubmit = selectedAnswer !== null && !isCurrentSubmitted;

  // ── Quiz Screen ─────────────────────────────────────────────────────---
  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(165deg, #ecf4ff 0%, #eef8ff 38%, #f7fbff 100%)", fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif" }}>
      <main className="mx-auto max-w-3xl px-3 pb-[110px] pt-3 sm:px-6 sm:pt-4">
        <section className="mb-3 flex items-center justify-end gap-2">
          <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{timeLeft}s</div>
        </section>
        <section className="mb-4">
          <motion.div key={currentQ.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-6 py-6 sm:px-8 sm:py-8 min-h-[150px] sm:min-h-[180px]">
            <div className="flex items-center mb-[14px]">
              <span style={{ border: "1.5px solid #3B82F6", borderRadius: "999px", padding: "3px 12px", fontSize: "13px", color: "#3B82F6", background: "transparent", fontWeight: 500 }}>{currentQ.exam}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#111827", lineHeight: 1.6, marginBottom: 28, letterSpacing: 0.01 }}>
              <MathRenderer text={currentQ.text} className="leading-relaxed" />
            </div>
          </motion.div>
        </section>
        <section className="mb-5" style={{ marginTop: 28 }}>
          {currentQ.options.slice(0, 4).map((opt, i) => {
            let border = "#E5E7EB", bg = "#FFFFFF", letterBg = "transparent", letterBorder = "#3B82F6", letterText = "#1D4ED8", letterFontWeight = 600;
            if (isCurrentSubmitted && i === getCorrectAnswerIndex(currentQ)) {
              border = "#16A34A"; bg = "#F0FDF4"; letterBg = "#16A34A"; letterBorder = "#16A34A"; letterText = "#fff";
            } else if (isCurrentSubmitted && selectedAnswer === i && i !== getCorrectAnswerIndex(currentQ)) {
              border = "#DC2626"; bg = "#FEF2F2"; letterBg = "#DC2626"; letterBorder = "#DC2626"; letterText = "#fff";
            } else if (!isCurrentSubmitted && selectedAnswer === i) {
              border = "#2563EB"; bg = "#EFF6FF"; letterBg = "#2563EB"; letterBorder = "#2563EB"; letterText = "#fff";
            }
            return (
              <button key={i} onClick={() => handleSelectAnswer(i)} disabled={isCurrentSubmitted} type="button" style={{ width: "100%", height: 58, background: bg, border: `1.5px solid ${border}`, borderRadius: 16, padding: "0 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 12, cursor: isCurrentSubmitted ? "default" : "pointer", transition: "all 0.15s ease", fontSize: 17, fontWeight: 400, color: "#111827", outline: "none" }}>
                <span style={{ width: 34, height: 34, border: `1.5px solid ${letterBorder}`, borderRadius: "50%", background: letterBg, color: letterText, fontSize: 14, fontWeight: letterFontWeight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, transition: "all 0.15s ease" }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ fontSize: 17, fontWeight: 400, color: "#111827", lineHeight: 1.5 }}><MathRenderer text={opt} /></span>
                {isCurrentSubmitted && i === getCorrectAnswerIndex(currentQ) && (<CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" aria-label="Correct option" />)}
                {isCurrentSubmitted && selectedAnswer === i && i !== getCorrectAnswerIndex(currentQ) && (<XCircle className="ml-auto h-5 w-5 shrink-0 text-red-600" aria-label="Wrong option" />)}
              </button>
            );
          })}
        </section>
        {submitError && (<div className="fixed bottom-[86px] left-0 right-0 z-40 px-3 sm:px-6"><div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 shadow-sm">{submitError}</div></div>)}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md"><div className="mx-auto max-w-3xl px-3 pb-3 pt-3 sm:px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}><div className="grid grid-cols-2 gap-3"><button onClick={handlePrev} disabled={currentIndex === 0} className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45">Previous</button><button onClick={() => { if (!isCurrentSubmitted) { handleSubmitCurrent(); return; } handleNext(); }} disabled={!canSubmit && !isCurrentSubmitted} className={`inline-flex h-14 items-center justify-center rounded-2xl px-5 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isCurrentSubmitted ? "bg-blue-700 hover:bg-blue-800" : "bg-blue-600 hover:bg-blue-700"}`}>{!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next →" : "Finish"}</button></div></div></div>
      </main>
    </div>
  );
}
