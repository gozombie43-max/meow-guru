"use client";

import RichContent from "@/components/RichContent";
import MathRenderer from "@/components/MathRenderer";
import MathText from "@/components/MathText";
import ImageMCQ from "@/components/ImageMCQ";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  XCircle,
  Menu,
  Flame,
  Play,
  Target,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { saveRecentQuiz, updateProgress, toggleBookmark } from "@/lib/userApi";
import { fetchQuestions, type Question as ApiQuestion } from "@/lib/api/questions";
import { shuffle, type MensurationQuestion } from "@/lib/mensuration-questions";

// ── Types ───────────────────────────────────────────────────────────────────
type QuizMode = "all" | "concept" | "tier2" | "selection";
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

function normalizeDifficulty(value?: string): Difficulty {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("hard")) return "hard";
  if (lower.includes("easy")) return "easy";
  return "medium";
}

function extractYear(exam: string): string {
  const match = exam.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "";
}

function resolveCorrectIndex(question: ApiQuestion, options: string[]): number {
  const letter = (question.correctLetter ?? "").trim().toLowerCase();
  if (letter) {
    const idx = letter.charCodeAt(0) - 97;
    if (idx >= 0 && idx < options.length) return idx;
  }

  const answerText = String(question.correctAnswer ?? "").trim();
  if (answerText) {
    if (/^[a-z]$/i.test(answerText)) {
      const idx = answerText.toLowerCase().charCodeAt(0) - 97;
      if (idx >= 0 && idx < options.length) return idx;
    }

    const exact = options.findIndex((opt) => opt.trim() === answerText);
    if (exact >= 0) return exact;

    const numeric = Number(answerText);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0 && numeric < options.length) return numeric;
      if (numeric >= 1 && numeric <= options.length) return numeric - 1;
    }
  }

  return 0;
}

function toMensurationQuestion(question: ApiQuestion, index: number): MensurationQuestion {
  const isImage = question.questionType === "image_mcq";
  const imageOptionKeys =
    question.optionRegions && Object.keys(question.optionRegions).length > 0
      ? Object.keys(question.optionRegions).sort()
      : ["a", "b", "c", "d"];
  const options = isImage
    ? imageOptionKeys.map((key) => key.toUpperCase())
    : Array.isArray(question.options)
    ? question.options.map((opt) => String(opt))
    : [];
  const difficulty = normalizeDifficulty(question.difficulty);
  const correctAnswer = resolveCorrectIndex(question, options);
  const exam = String(question.exam ?? "");
  const concept =
    String(question.concept ?? question.chapter ?? question.topic ?? "").trim() ||
    "General";
  const numericId = Number.parseInt(question.id, 10);
  const id = Number.isFinite(numericId) ? numericId : index + 1;
  const rawAnswer = String(question.correctAnswer ?? "").trim();
  const answer = /^[a-z]$/i.test(rawAnswer)
    ? options[correctAnswer] ?? ""
    : rawAnswer || (options[correctAnswer] ?? "");
  const questionText = String(question.question ?? "").trim();
  const questionImageMarkdown =
    question.questionType !== "image_mcq" && question.questionImage
      ? `![question](${question.questionImage})`
      : "";
  const questionContent = questionText
    ? /!\[[^\]]*\]\([^)]+\)/.test(questionText) || !questionImageMarkdown
      ? questionText
      : `${questionText}\n\n${questionImageMarkdown}`
    : questionImageMarkdown;
  const solutionText = String(question.solution ?? "").trim();
  const solutionImageMarkdown = question.solutionImage
    ? `![solution](${question.solutionImage})`
    : "";
  const solution = solutionText
    ? /!\[[^\]]*\]\([^)]+\)/.test(solutionText) || !solutionImageMarkdown
      ? solutionText
      : `${solutionText}\n\n${solutionImageMarkdown}`
    : solutionImageMarkdown;

  return {
    id,
    concept,
    formula: "",
    question: questionContent,
    options,
    correctAnswer,
    answer,
    difficulty,
    estimatedTime: difficulty === "easy" ? 40 : difficulty === "hard" ? 80 : 60,
    year: extractYear(exam),
    exam,
    solution,
    questionType: question.questionType,
    questionImage: question.questionImage,
    optionRegions: question.optionRegions,
    correctLetter: question.correctLetter,
  };
}

// ── Constants ────────────────────────────────────────────────────────────────
const MODE_LABELS: Record<QuizMode, string> = {
  all: "PYQ",
  concept: "CareerWill",
  selection: "Selection Way",
  tier2: "Tier 2",
};

const CONCEPT_COLOURS: Record<string, { border: string; bg: string; text: string }> = {
  "Circle & Sector": {
    border: "#7C3AED",
    bg: "#F5F3FF",
    text: "#5B21B6",
  },
  "Triangle & Polygon": {
    border: "#0891B2",
    bg: "#ECFEFF",
    text: "#0E7490",
  },
  Quadrilateral: {
    border: "#2563EB",
    bg: "#EFF6FF",
    text: "#1D4ED8",
  },
  "2D Area & Perimeter": {
    border: "#059669",
    bg: "#ECFDF5",
    text: "#047857",
  },
  "3D Solids": {
    border: "#D97706",
    bg: "#FFFBEB",
    text: "#B45309",
  },
  "Cylinder, Cone & Sphere": {
    border: "#DB2777",
    bg: "#FDF2F8",
    text: "#BE185D",
  },
  "Ratio, Scaling & Similarity": {
    border: "#64748B",
    bg: "#F8FAFC",
    text: "#475569",
  },
  "Coordinate & Mixed Mensuration": {
    border: "#7E3AF2",
    bg: "#EEF2FF",
    text: "#5B21B6",
  },
};

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
    <span className={`inline-flex flex-col items-center leading-none ${className}`} role="math">
      <span className="text-[var(--text-primary)] font-bold" style={{ fontSize: "0.85em" }}>
        {numerator}
      </span>
      <span className="w-full border-t border-slate-400 my-[2px]" style={{ minWidth: "1.2em" }} />
      <span className="text-slate-500 font-semibold" style={{ fontSize: "0.85em" }}>
        {denominator}
      </span>
    </span>
  );
}

function formatMathBookSolutionLines(solution: string): string[] {
  const base = solution
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s*(=>|→)\s*/g, " \\Rightarrow ")
    .trim();

  if (!base) return [];

  const expandedMath = base.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => {
    const cleanExpr = expr.trim();
    if (!cleanExpr.includes("\\Rightarrow")) {
      return `\\(${cleanExpr}\\)`;
    }

    const chunks = cleanExpr
      .split(/\s*\\Rightarrow\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    return chunks
      .map((chunk, index) =>
        index === 0 ? `\\[${chunk}\\]` : `\\[\\Rightarrow ${chunk}\\]`
      )
      .join("\n");
  });

  const withSentenceBreaks = expandedMath
    .replace(/\.\s+(?=[A-Z\\])/g, ".\n")
    .replace(/:\s+(?=[A-Z\\])/g, ":\n")
    .replace(/\n{3,}/g, "\n\n");

  return withSentenceBreaks
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function SolutionBottomSheet({
  isOpen,
  solution,
  questionNumber,
  correctOptionIndex,
  onClose,
}: {
  isOpen: boolean;
  solution: string;
  questionNumber: number;
  correctOptionIndex: number;
  onClose: () => void;
}) {
  const solutionLines = useMemo(
    () => formatMathBookSolutionLines(solution),
    [solution]
  );
  const solutionHasImage = /!\[[^\]]*\]\([^)]+\)/.test(solution);
  const optionLabel =
    correctOptionIndex >= 0 && correctOptionIndex < 26
      ? String.fromCharCode(97 + correctOptionIndex)
      : "a";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[95] bg-slate-900/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Question solution"
            className="absolute bottom-0 left-0 right-0 mx-auto flex h-[40vh] w-full max-w-3xl flex-col rounded-t-3xl border border-slate-200 bg-white px-5 pt-4 shadow-[0_-16px_44px_rgba(15,23,42,0.35)]"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
            }}
            initial={{ y: "108%", opacity: 0.98 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "108%", opacity: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 26,
              mass: 0.9,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Worked Solution</h3>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                aria-label="Close solution"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-2xl border border-slate-300 bg-[#f7f7f7] px-4 py-3 text-slate-900"
              style={{
                fontFamily:
                  "'Cambria Math', 'STIX Two Text', 'Times New Roman', serif",
                fontSize: 17,
                lineHeight: 1.7,
                textAlign: "left",
                paddingLeft: "0.3cm",
              }}
            >
              {solutionLines.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="mb-1 text-[18px] font-semibold text-slate-950">
                    Sol.{questionNumber}.({optionLabel})
                  </p>

                  {solutionHasImage ? (
                    <RichContent text={solution} />
                  ) : (
                    solutionLines.map((line, index) => {
                      const isDisplayEquation = /^\\\[[\s\S]*\\\]$/.test(line);
                      return (
                        <div
                          key={`worked-line-${index}`}
                          className={isDisplayEquation ? "text-center" : ""}
                          style={{
                            marginTop: isDisplayEquation ? "0.15rem" : "0",
                            marginBottom: isDisplayEquation ? "0.15rem" : "0",
                          }}
                        >
                          <MathRenderer text={line} className="leading-relaxed" />
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Solution is not available for this question yet.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SolutionSidePanel({
  isOpen,
  solution,
  questionNumber,
  correctOptionIndex,
  onClose,
}: {
  isOpen: boolean;
  solution: string;
  questionNumber: number;
  correctOptionIndex: number;
  onClose: () => void;
}) {
  const solutionLines = useMemo(
    () => formatMathBookSolutionLines(solution),
    [solution]
  );
  const solutionHasImage = /!\[[^\]]*\]\([^)]+\)/.test(solution);
  const optionLabel =
    correctOptionIndex >= 0 && correctOptionIndex < 26
      ? String.fromCharCode(97 + correctOptionIndex)
      : "a";

  if (!isOpen) return null;

  return (
    <div
      className="w-full min-h-[420px] rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Question solution"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-[15px] font-semibold text-slate-900">Worked Solution</p>
          <p className="text-[12px] font-medium text-slate-500">
            Sol.{questionNumber}.({optionLabel})
          </p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Close solution"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="max-h-[72vh] overflow-y-auto px-7 py-4"
        style={{
          fontFamily: "'Cambria Math', 'STIX Two Text', 'Times New Roman', serif",
          fontSize: 18,
          lineHeight: 1.8,
          textAlign: "left",
          letterSpacing: "-0.01em",
          paddingLeft: "28px",
          paddingRight: "24px",
        }}
      >
        {solutionLines.length > 0 ? (
          <div className="space-y-1.5">
            {solutionHasImage ? (
              <RichContent text={solution} />
            ) : (
              solutionLines.map((line, index) => {
                const isDisplayEquation = /^\\\[[\s\S]*\\\]$/.test(line);
                return (
                  <div
                    key={`worked-line-panel-${index}`}
                    className={isDisplayEquation ? "text-center" : ""}
                    style={{
                      marginTop: isDisplayEquation ? "0.15rem" : "0",
                      marginBottom: isDisplayEquation ? "0.15rem" : "0",
                    }}
                  >
                    <MathRenderer text={line} className="leading-relaxed" />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Solution is not available for this question yet.
          </p>
        )}
      </div>
    </div>
  );
}

const TOPIC_TABS = [
  { key: "all", label: "All" },
  { key: "cone", label: "Cone" },
  { key: "sphere", label: "Sphere" },
  { key: "cylinder", label: "Cylinder" },
  { key: "cube", label: "Cube" },
  { key: "pyramid", label: "Pyramid" },
] as const;

const CATEGORY_MATCHERS: Record<string, (value: string) => boolean> = {
  cone: (value) => /cone/i.test(value),
  sphere: (value) => /sphere|spherical/i.test(value),
  cylinder: (value) => /cylinder/i.test(value),
  cube: (value) => /cube|cuboid/i.test(value),
  pyramid: (value) => /pyramid/i.test(value),
};

function TopicIcon({ kind, active }: { kind: string; active: boolean }) {
  const stroke = active ? "#5b21b6" : "#b2b2c7";
  const fill = active ? "#5b21b6" : "#d7d7e8";

  switch (kind) {
    case "cone":
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18h16L12 5 4 18z" fill={fill} opacity="0.2" />
          <path d="M4 18h16" />
          <path d="M12 5 4 18h16L12 5z" />
          <ellipse cx="12" cy="18" rx="7" ry="2" />
        </svg>
      );
    case "sphere":
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="7" fill={fill} opacity="0.2" />
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case "cylinder":
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="6" rx="7" ry="3" fill={fill} opacity="0.2" />
          <path d="M5 6v10" />
          <path d="M19 6v10" />
          <ellipse cx="12" cy="16" rx="7" ry="3" />
        </svg>
      );
    case "cube":
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8 12 4 19 8 12 12 5 8z" fill={fill} opacity="0.2" />
          <path d="M5 8v8l7 4 7-4V8" />
          <path d="M12 12v8" />
          <path d="M5 8 12 12 19 8" />
        </svg>
      );
    case "pyramid":
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4 3 19h18L12 4z" fill={fill} opacity="0.2" />
          <path d="M12 4 3 19h18L12 4z" />
          <path d="M7 13h10" />
        </svg>
      );
    case "all":
    default:
      return (
        <svg viewBox="0 0 24 24" className="topic-icon" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 13h6l-1 9 9-11h-6l1-9z" />
        </svg>
      );
  }
}

// ── Question status helpers ──────────────────────────────────────────────────

type QuestionStatus = "current" | "answered" | "correct" | "wrong" | "not-answered";

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
  questions: MensurationQuestion[];
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
  questions: MensurationQuestion[];
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
              <h3 className="text-base font-semibold text-slate-800">Question Palette</h3>
              <button
                onClick={onClose}
                className="h-12 min-w-12 rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm"
                aria-label="Close question palette"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-md border border-violet-300 bg-violet-100 px-2 py-1">Current</span>
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1">Answered</span>
              <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">Correct</span>
              <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1">Wrong</span>
              <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1">Not Answered</span>
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

function QuestionPalettePanel({
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onGoToQuestion,
}: {
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: MensurationQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Question Palette</h3>
        <span className="text-xs font-semibold text-slate-500">
          {currentIndex + 1}/{total}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-md border border-violet-300 bg-violet-100 px-2 py-1">Current</span>
        <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1">Answered</span>
        <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">Correct</span>
        <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1">Wrong</span>
        <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1">Not Answered</span>
      </div>

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
              onClick={() => onGoToQuestion(index + 1)}
              className={`question-button min-h-12 rounded-xl text-sm font-semibold ${statusClasses(status)}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  questions: MensurationQuestion[];
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
                selectedAnswers,
                questions,
                submittedQuestions,
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
        selectedAnswers={selectedAnswers}
        questions={questions}
        submittedQuestions={submittedQuestions}
        onClose={onClosePalette}
        onGoToQuestion={onGoToQuestion}
      />
    </>
  );
}

function QuestionQuickBar({
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onGoToQuestion,
}: {
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: MensurationQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = quickButtonRefs.current[currentIndex];
    if (!activeButton) return;
    activeButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIndex]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="question-strip qnav-bar-scroll" style={{ scrollSnapType: "x mandatory" }}>
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
              ref={(element) => {
                quickButtonRefs.current[index] = element;
              }}
              onClick={() => onGoToQuestion(index + 1)}
              className={`h-8 w-8 min-h-8 min-w-8 rounded-lg text-xs font-semibold ${statusClasses(status)}`}
              aria-label={`Question ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

const prefetchQuestionImage = (url?: string) => {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
};

export default function MensurationQuizEngine() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "all") as QuizMode;
  const quizName = MODE_LABELS[mode];
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);

  const [questions, setQuestions] = useState<MensurationQuestion[]>([]);
  const [allQuestions, setAllQuestions] = useState<MensurationQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [miniMode, setMiniMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [topicSearch, setTopicSearch] = useState("");
  const [examFilter, setExamFilter] = useState<string>("");
  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchQuestions({ topic: "mensuration", quizName })
      .then((data) => {
        if (!active) return;
        setAllQuestions(data.map(toMensurationQuestion));
        setIsLoading(false);
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setAllQuestions([]);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [quizName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();

    const addListener =
      mediaQuery.addEventListener?.bind(mediaQuery) ??
      mediaQuery.addListener?.bind(mediaQuery);
    const removeListener =
      mediaQuery.removeEventListener?.bind(mediaQuery) ??
      mediaQuery.removeListener?.bind(mediaQuery);

    addListener?.("change", update);

    return () => {
      removeListener?.("change", update);
    };
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasInitSelection = useRef(false);

  const { user, token, refreshUser } = useAuth();
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(user?.bookmarks ?? []));
  const quizTitle = "Mensuration";
  const quizSlug = "mensuration";
  const quizKey = `mathematics:${quizSlug}`;
  const quizHref = `/mathematics/${quizSlug}/quiz`;
  const resumeEntry = useMemo(() => {
    if (!resumeRequested) return null;
    return (
      user?.recentQuizzes?.find((entry) => entry.quizKey === quizKey) ?? null
    );
  }, [quizKey, resumeRequested, user?.recentQuizzes]);
  const resumeAppliedRef = useRef(false);
  const jumpAppliedRef = useRef(false);

  const maxTime = miniMode ? 20 : 60;
  const currentQ = questions[currentIndex] as MensurationQuestion | undefined;
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;
  const isImageQuestion = currentQ?.questionType === "image_mcq";

  useEffect(() => {
    const next = questions[currentIndex + 1];
    if (next?.questionImage) {
      prefetchQuestionImage(next.questionImage);
    }
  }, [currentIndex, questions]);

  function normalizeExamName(exam: string): string {
    const normalized = (exam ?? "").trim();
    const upper = normalized.toUpperCase();
    if (upper.includes("SSC CGL") && upper.includes("TIER II")) return "SSC CGL Tier II";
    if (upper.includes("SSC CGL")) return "SSC CGL";
    if (upper.includes("SSC CHSL") && upper.includes("TIER II")) return "SSC CHSL Tier II";
    if (upper.includes("SSC CHSL")) return "SSC CHSL";
    if (upper.includes("SSC CPO")) return "SSC CPO";
    if (upper.includes("GRADUATE LEVEL")) return "Graduate Level";
    if (upper.includes("HIGHER SECONDARY")) return "Higher Secondary";
    if (upper.includes("LECTURER")) return "Lecturer";
    if (upper.includes("POLICE")) return "Police";
    if (upper.includes("RAILWAY")) return "Railway";

    const collapsed = normalized
      .replace(/\b(?:\d{1,4}|\d{1,2}TH|\d{1,2}ND|\d{1,2}ST|\d{1,2}RD|SHIFT|SESSION|SET|PAPER|SLOT|AFTERNOON|MORNING|EVENING|TIER\s*I+|LEVEL)\b/gi, "")
      .replace(/[\(\)\[\],\/\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return collapsed;
  }

  const examOptions = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach((q) => {
      const exam = normalizeExamName((q.exam ?? "").trim());
      if (exam) set.add(exam);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allQuestions]);

  const conceptOptions = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach((q) => {
      const concept = String(q.concept || "").trim();
      if (concept) set.add(concept);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allQuestions]);

  const selectedTopicSet = useMemo(() => new Set(selectedTopics), [selectedTopics]);

  const conceptDifficultyMap = useMemo(() => {
    const map: Record<string, { total: number; hard: number; medium: number; easy: number }> = {};
    allQuestions.forEach((q) => {
      const concept = String(q.concept || "").trim();
      if (!concept) return;
      if (!map[concept]) {
        map[concept] = { total: 0, hard: 0, medium: 0, easy: 0 };
      }
      map[concept].total += 1;
      if (q.difficulty === "hard") map[concept].hard += 1;
      else if (q.difficulty === "easy") map[concept].easy += 1;
      else map[concept].medium += 1;
    });

    const labelMap: Record<string, string> = {};
    Object.entries(map).forEach(([concept, stats]) => {
      if (stats.total === 0) {
        labelMap[concept] = "General";
        return;
      }
      const hardRatio = stats.hard / stats.total;
      const mediumRatio = stats.medium / stats.total;
      if (hardRatio >= 0.45) labelMap[concept] = "Advanced";
      else if (mediumRatio >= 0.45) labelMap[concept] = "Intermediate";
      else labelMap[concept] = "Basic";
    });
    return labelMap;
  }, [allQuestions]);

  const normalizedSearch = topicSearch.trim().toLowerCase();

  const filteredConceptOptions = useMemo(() => {
    return conceptOptions.filter((concept) => {
      if (normalizedSearch && !concept.toLowerCase().includes(normalizedSearch)) return false;
      if (activeCategory === "all") return true;
      const matcher = CATEGORY_MATCHERS[activeCategory];
      return matcher ? matcher(concept) : true;
    });
  }, [conceptOptions, normalizedSearch, activeCategory]);

  useEffect(() => {
    setSelectedTopics((prev) => {
      if (!hasInitSelection.current) {
        hasInitSelection.current = true;
        return conceptOptions;
      }
      if (prev.length === 0) return prev;
      const next = prev.filter((topic) => conceptOptions.includes(topic));
      return next.length > 0 ? next : conceptOptions;
    });
  }, [conceptOptions]);

  const availableCount = useMemo(() => {
    let pool: MensurationQuestion[] = [...allQuestions];

    if (mode === "tier2") {
      pool = allQuestions.filter((q) => q.difficulty === "hard");
    }

    if (selectedTopics.length === 0) {
      return 0;
    }

    if (selectedTopics.length < conceptOptions.length) {
      pool = pool.filter((q) => selectedTopicSet.has(q.concept));
    }

    if (examFilter.trim() !== "") {
      const examQuery = examFilter.trim().toLowerCase();
      pool = pool.filter((q) =>
        normalizeExamName((q.exam ?? "").trim()).toLowerCase().includes(examQuery)
      );
    }

    return pool.length;
  }, [allQuestions, mode, examFilter, selectedTopicSet, selectedTopics.length, conceptOptions.length]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (allQuestions.length === 0) {
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setSelected(null);
      setSubmitted(false);
      setResults([]);
      setSelectedAnswers({});
      setSubmittedQuestions(new Set());
      setIsPaletteOpen(false);
      setIsSolutionOpen(false);
      setStreak(0);
      setShowAnalytics(false);
      setStarted(false);
      setSubmitError("");
      return;
    }

    let pool: MensurationQuestion[];

    switch (mode) {
      case "tier2":
        pool = allQuestions.filter((q) => q.difficulty === "hard");
        break;
      default:
        pool = [...allQuestions];
        break;
    }

    if (selectedTopics.length === 0) {
      pool = [];
    } else if (selectedTopics.length < conceptOptions.length) {
      pool = pool.filter((q) => selectedTopicSet.has(q.concept));
    }

    if (examFilter.trim() !== "") {
      const examQuery = examFilter.trim().toLowerCase();
      pool = pool.filter((q) => {
        const norm = normalizeExamName((q.exam ?? "").trim()).toLowerCase();
        return norm.includes(examQuery);
      });
    }

    const nextQuestions = mode === "tier2" ? shuffle([...pool]) : [...pool].sort((a, b) => a.id - b.id);
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelected(null);
    setSubmitted(false);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setIsPaletteOpen(false);
    setIsSolutionOpen(false);
    setStreak(0);
    setBestStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }, [allQuestions, mode, examFilter, selectedTopicSet, selectedTopics.length, conceptOptions.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  useEffect(() => {
    if (!resumeRequested || resumeAppliedRef.current) return;
    if (!resumeEntry || resumeEntry.status === "completed") return;
    if (questions.length === 0) return;

    const safeIndex = Math.max(
      0,
      Math.min(resumeEntry.currentIndex ?? 0, questions.length - 1)
    );
    const savedAnswers = resumeEntry.selectedAnswers ?? {};
    const savedSubmitted = resumeEntry.submittedQuestions ?? [];
    const submittedSet = new Set<number>(savedSubmitted);

    stopTimer();
    setSelectedAnswers(savedAnswers);
    setSubmittedQuestions(submittedSet);
    const savedResults = Array.isArray(resumeEntry.results)
      ? (resumeEntry.results as SessionResult[])
      : [];
    setResults(savedResults);
    setShowAnalytics(false);
    setStarted(true);
    setCurrentIndex(safeIndex);
    const nextQuestion = questions[safeIndex];
    const existingSelection = savedAnswers[safeIndex];
    setSelectedAnswer(existingSelection ?? null);
    if (nextQuestion?.questionType === "image_mcq") {
      setSelected(
        existingSelection !== undefined
          ? String.fromCharCode(97 + existingSelection)
          : null
      );
      setSubmitted(submittedSet.has(safeIndex));
    } else {
      setSelected(null);
      setSubmitted(false);
    }
    setSubmitError("");
    setIsSolutionOpen(false);
    if (!submittedSet.has(safeIndex)) {
      startTimer();
    }

    resumeAppliedRef.current = true;
  }, [questions, resumeEntry, resumeRequested, startTimer, stopTimer]);

  useEffect(() => {
    if (!jumpIdRaw) return;
    if (!Number.isFinite(jumpId)) return;
    if (resumeRequested || jumpAppliedRef.current) return;
    if (questions.length === 0) return;

    const targetIndex = questions.findIndex((q) => q.id === jumpId);
    if (targetIndex < 0) return;

    stopTimer();
    setShowAnalytics(false);
    setStarted(true);
    setCurrentIndex(targetIndex);
    const nextQuestion = questions[targetIndex];
    const existingSelection = selectedAnswers[targetIndex];
    setSelectedAnswer(existingSelection ?? null);
    if (nextQuestion?.questionType === "image_mcq") {
      setSelected(
        existingSelection !== undefined
          ? String.fromCharCode(97 + existingSelection)
          : null
      );
      setSubmitted(submittedQuestions.has(targetIndex));
    } else {
      setSelected(null);
      setSubmitted(false);
    }
    setSubmitError("");
    setIsSolutionOpen(false);
    if (!submittedQuestions.has(targetIndex)) {
      startTimer();
    }

    jumpAppliedRef.current = true;
  }, [
    jumpId,
    jumpIdRaw,
    questions,
    resumeRequested,
    selectedAnswers,
    startTimer,
    stopTimer,
    submittedQuestions,
  ]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  useEffect(() => {
    if (!token || !started || showAnalytics) return;
    if (questions.length === 0) return;
    if (resumeRequested && !resumeAppliedRef.current) return;

    const submittedList = Array.from(submittedQuestions);
    const saveTimeout = window.setTimeout(() => {
      saveRecentQuiz(token, {
        quizKey,
        title: quizTitle,
        subject: "mathematics",
        slug: quizSlug,
        href: quizHref,
        mode,
        currentIndex,
        totalQuestions: questions.length,
        selectedAnswers,
        submittedQuestions: submittedList,
        results,
        status: "in-progress",
      }).catch(() => {});
    }, 600);

    return () => window.clearTimeout(saveTimeout);
  }, [
    currentIndex,
    mode,
    questions.length,
    quizHref,
    quizKey,
    quizSlug,
    quizTitle,
    resumeRequested,
    results,
    selectedAnswers,
    started,
    submittedQuestions,
    token,
    showAnalytics,
  ]);

  useEffect(() => {
    if (!token || !showAnalytics) return;
    if (questions.length === 0) return;

    const submittedList = Array.from(submittedQuestions);
    saveRecentQuiz(token, {
      quizKey,
      title: quizTitle,
      subject: "mathematics",
      slug: quizSlug,
      href: quizHref,
      mode,
      currentIndex,
      totalQuestions: questions.length,
      selectedAnswers,
      submittedQuestions: submittedList,
      results,
      status: "completed",
    }).catch(() => {});
  }, [
    currentIndex,
    mode,
    questions.length,
    quizHref,
    quizKey,
    quizSlug,
    quizTitle,
    results,
    selectedAnswers,
    submittedQuestions,
    token,
    showAnalytics,
  ]);

  function handleStart() {
    if (selectedTopics.length === 0) return;
    setStarted(true);
    startTimer();
  }

  const showQuestion = useCallback(
    (index: number) => {
      if (questions.length === 0) return;
      const safeIndex = Math.max(0, Math.min(index, questions.length - 1));
      stopTimer();
      setCurrentIndex(safeIndex);
      const nextQuestion = questions[safeIndex];
      const existingSelection = selectedAnswers[safeIndex];
      setSelectedAnswer(existingSelection !== undefined ? existingSelection : null);
      if (nextQuestion?.questionType === "image_mcq") {
        setSelected(
          existingSelection !== undefined
            ? String.fromCharCode(97 + existingSelection)
            : null
        );
        setSubmitted(submittedQuestions.has(safeIndex));
      } else {
        setSelected(null);
        setSubmitted(false);
      }
      setSubmitError("");
      setIsSolutionOpen(false);
      if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) {
        startTimer();
      }
    },
    [questions, selectedAnswers, showAnalytics, startTimer, started, stopTimer, submittedQuestions],
  );

  const goToQuestion = useCallback(
    (questionNumber: number) => {
      if (questions.length === 0) return;
      const safeNumber = Math.max(1, Math.min(questionNumber, questions.length));
      showQuestion(safeNumber - 1);
    },
    [questions.length, showQuestion],
  );

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  const openSolution = useCallback(() => setIsSolutionOpen(true), []);
  const closeSolution = useCallback(() => setIsSolutionOpen(false), []);

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
    [difficulty, results],
  );

  const handleSelectAnswer = useCallback(
    (index: number) => {
      if (!currentQ) return;
      if (submittedQuestions.has(currentIndex)) return;
      if (index < 0 || index >= currentQ.options.length) return;
      setSelectedAnswer(index);
      setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
      if (currentQ.questionType === "image_mcq") {
        setSelected(String.fromCharCode(97 + index));
      }
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions],
  );

  const handleSelectImageAnswer = useCallback(
    (letter: string) => {
      if (!currentQ) return;
      if (submittedQuestions.has(currentIndex)) return;
      const idx = letter.toLowerCase().charCodeAt(0) - 97;
      if (idx < 0 || idx >= currentQ.options.length) return;
      setSelected(letter);
      setSelectedAnswer(idx);
      setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: idx }));
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions],
  );

  const handleSubmitCurrent = useCallback(() => {
    if (!currentQ) return;
    if (submittedQuestions.has(currentIndex)) return;
    const selected = selectedAnswers[currentIndex];
    if (selected === undefined || selected === null) {
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
      updateProgress(token, currentQ.concept, 1, isCorrect ? 1 : 0).catch(() => {});
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
      const existingIndex = prev.findIndex((r) => r.questionIndex === currentIndex);
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

    if (currentQ.questionType === "image_mcq") {
      setSubmitted(true);
    }

    setSubmitError("");
  }, [adaptDifficulty, currentIndex, currentQ, maxTime, selectedAnswers, stopTimer, submittedQuestions, timeLeft, token]);

  const handleBookmarkAction = useCallback(async () => {
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
      await toggleBookmark(token, qId, action, {
        quizKey,
        title: quizTitle,
        subject: "mathematics",
        slug: quizSlug,
        href: quizHref,
        mode,
        questionIndex: currentIndex,
      });
    } catch {
      setBookmarked((prev) => {
        const next = new Set(prev);
        isBookmarked ? next.add(qId) : next.delete(qId);
        return next;
      });
    }
  }, [
    bookmarked,
    currentIndex,
    currentQ,
    mode,
    quizHref,
    quizKey,
    quizSlug,
    quizTitle,
    token,
  ]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    showQuestion(currentIndex - 1);
  }, [currentIndex, showQuestion]);

  const handleClearResponse = useCallback(() => {
    if (submittedQuestions.has(currentIndex)) return;
    setSelectedAnswer(null);
    setSelected(null);
    setSelectedAnswers((prev) => {
      if (!(currentIndex in prev)) return prev;
      const next = { ...prev };
      delete next[currentIndex];
      return next;
    });
    setSubmitError("");
  }, [currentIndex, submittedQuestions]);

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else {
      stopTimer();
      refreshUser();
      setIsSolutionOpen(false);
      setShowAnalytics(true);
    }
  }

  function handleRestart() {
    setQuestions(mode === "tier2" ? shuffle([...questions]) : [...questions].sort((a, b) => a.id - b.id));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelected(null);
    setSubmitted(false);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    closePalette();
    setIsSolutionOpen(false);
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
        const base = selectedAnswer === null ? 0 : Math.min(selectedAnswer + 1, currentQ.options.length - 1);
        setSelectedAnswer(base);
        setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: base }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const base = selectedAnswer === null ? currentQ.options.length - 1 : Math.max(selectedAnswer - 1, 0);
        setSelectedAnswer(base);
        setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: base }));
        return;
      }

      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= currentQ.options.length) {
        event.preventDefault();
        setSelectedAnswer(num - 1);
        setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: num - 1 }));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, currentQ, selectedAnswer, showAnalytics, showQuestion, started]);

  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length;
    const wrong = results.filter((r) => !r.isCorrect && r.selected !== null).length;
    const attempted = results.length;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const avgTime =
      results.length > 0
        ? Math.round(results.reduce((a, r) => a + r.timeTaken, 0) / results.length)
        : 0;
    return { correct, wrong, accuracy, avgTime };
  }, [results]);

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

  function formatClock(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const mins = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
    const secs = (safeSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  if (showAnalytics) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto relative">
          <h1
            className="animate-fade-in-up text-3xl font-bold mb-2 text-[var(--text-primary)]"
            style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            Session <span style={{ background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Complete</span>
          </h1>
          <p className="animate-fade-in-up text-slate-500 mb-10" style={{ animationDelay: "100ms" }}>
            Here&apos;s how you performed in this {MODE_LABELS[mode]} session.
          </p>

          {currentQ && (
            <div className="animate-fade-in-up mb-8 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4" style={{ animationDelay: "150ms" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-1">Key Formula</p>
              <p className="text-sm font-mono text-violet-800">{currentQ.formula}</p>
            </div>
          )}

          <div className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10" style={{ animationDelay: "200ms" }}>
            {[
              { label: "Correct", value: stats.correct, color: "text-emerald-600" },
              { label: "Wrong", value: stats.wrong, color: "text-red-500" },
              { label: "Accuracy", value: `${stats.accuracy}%`, color: "text-violet-600" },
              { label: "Avg Time", value: `${stats.avgTime}s`, color: "text-amber-600" },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="animate-fade-in-up grid grid-cols-2 gap-4 mb-10" style={{ animationDelay: "250ms" }}>
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-slate-500 mb-1">Best Streak</div>
              <div className="text-xl font-bold text-violet-600 flex items-center gap-2">
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

          {weakConcepts.length > 0 && (
            <div className="animate-fade-in-up glass-card rounded-xl p-6 mb-10" style={{ animationDelay: "350ms" }}>
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

          <div className="animate-fade-in-up flex flex-col sm:flex-row gap-4" style={{ animationDelay: "450ms" }}>
            <button onClick={handleRestart} className="btn-glow px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)", color: "#fff", border: "none" }}>
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <Link href="/mathematics/mensuration" className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer">Change Mode</Link>
            <Link href="/mathematics" className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer">All Topics</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    const activeTab = TOPIC_TABS.find((tab) => tab.key === activeCategory) ?? TOPIC_TABS[0];
    const sectionTitle = activeTab.key === "all" ? "All Topics" : activeTab.label;
    const isAllSelected = conceptOptions.length > 0 && selectedTopics.length === conceptOptions.length;
    const isFilteredAllSelected =
      filteredConceptOptions.length > 0 &&
      filteredConceptOptions.every((topic) => selectedTopicSet.has(topic));
    const canStart = selectedTopics.length > 0 && !isLoading;

    const toggleTopic = (topic: string) => {
      setSelectedTopics((prev) => {
        if (prev.includes(topic)) return prev.filter((item) => item !== topic);
        return [...prev, topic];
      });
    };

    const toggleFilteredSelection = () => {
      if (filteredConceptOptions.length === 0) return;
      setSelectedTopics((prev) => {
        const next = new Set(prev);
        const allSelected = filteredConceptOptions.every((topic) => next.has(topic));
        if (allSelected) {
          filteredConceptOptions.forEach((topic) => next.delete(topic));
        } else {
          filteredConceptOptions.forEach((topic) => next.add(topic));
        }
        return Array.from(next);
      });
    };

    return (
      <div className="mensuration-start">
        <div className="start-shell">
          <header className="start-nav">
            <Link href="/mathematics/mensuration" className="start-back" aria-label="Back to mensuration modes">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="start-nav-label">SELECT TOPIC</span>
            <span className="start-qs">{availableCount} Qs</span>
          </header>

          <div className="start-exam-card">
            <div className="exam-label">
              <span className="exam-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="exam-svg" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="12" height="16" rx="2" />
                  <path d="M9 2h6" />
                  <path d="M9 9h6" />
                  <path d="M9 13h6" />
                </svg>
              </span>
              <span>Exam</span>
            </div>
            <select
              value={examFilter || "all"}
              onChange={(e) => setExamFilter(e.target.value === "all" ? "" : e.target.value)}
              className="exam-select"
            >
              {examOptions.map((ex) => (
                <option key={ex} value={ex === "all" ? "all" : ex}>
                  {ex === "all" ? "All exams" : ex}
                </option>
              ))}
            </select>
          </div>

          <div className="start-search">
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="search-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search any topic..."
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
            />
          </div>

          <div className="start-tabs">
            {TOPIC_TABS.map((tab) => {
              const isActive = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveCategory(tab.key)}
                  className={`topic-tab${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                >
                  <TopicIcon kind={tab.key} active={isActive} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="topics-header">
            <h2>{sectionTitle}</h2>
            {filteredConceptOptions.length > 0 && (
              <button type="button" onClick={toggleFilteredSelection} className="select-all-btn">
                {isFilteredAllSelected ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          <div className="topics-list">
            {isLoading ? (
              <div className="topics-loader" role="status" aria-live="polite" aria-label="Loading topics">
                <span className="loader-dot dot-red" />
                <span className="loader-dot dot-blue" />
                <span className="loader-dot dot-green" />
                <span className="loader-dot dot-yellow" />
                <span className="loader-dot dot-orange" />
                <span className="loader-sr">Loading topics...</span>
              </div>
            ) : filteredConceptOptions.length === 0 ? (
              <div className="topics-empty">No topics match this filter.</div>
            ) : (
              filteredConceptOptions.map((topic, index) => {
                const isSelected = selectedTopicSet.has(topic);
                const difficultyLabel = conceptDifficultyMap[topic] ?? "General";
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`topic-card${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                  >
                    <div className={`topic-index${isSelected ? " is-selected" : ""}`}>{index + 1}</div>
                    <div className="topic-body">
                      <p className="topic-title">{topic}</p>
                      <p className="topic-meta">{difficultyLabel}</p>
                    </div>
                    <div className={`topic-check${isSelected ? " is-selected" : ""}`}>
                      {isSelected ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <span className="topic-check-empty" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="start-footer">
          <div className="footer-pill">
            <span className="pill-value">{isAllSelected ? "All" : selectedTopics.length}</span>
            <span className="pill-label">Topics</span>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="start-cta"
          >
            <Play className="h-4 w-4" />
            Start Quiz
          </button>
        </div>

        <style jsx>{`
          .mensuration-start {
            height: 100vh;
            overflow: hidden;
            background: linear-gradient(180deg, #f6f3ff 0%, #f7f5ff 65%, #f4f1ff 100%);
            font-family: "Poppins", "Inter", "Segoe UI", sans-serif;
            color: #1f1b2e;
            position: relative;
            display: flex;
            flex-direction: column;
          }
          .start-shell {
            max-width: 560px;
            margin: 0 auto;
            padding: 10px 14px 0;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .start-nav {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 12px;
            margin-bottom: 4px;
          }
          .start-back {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 1px solid #e3ddf2;
            background: #f0ecff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #6d5bd0;
            box-shadow: 0 6px 14px rgba(84, 72, 148, 0.12);
          }
          .start-nav-label {
            text-align: center;
            font-size: 0.78rem;
            letter-spacing: 0.28em;
            color: #9a93b0;
            font-weight: 600;
          }
          .start-qs {
            justify-self: end;
            font-size: 0.78rem;
            font-weight: 600;
            color: #6b5bd4;
            background: #ede9fe;
            padding: 5px 12px;
            border-radius: 999px;
          }
          .start-exam-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f0ecff;
            border-radius: 16px;
            padding: 8px 12px;
            border: 1px solid #e4def2;
            margin-bottom: 6px;
          }
          .exam-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            color: #3b3056;
          }
          .exam-icon {
            width: 30px;
            height: 30px;
            border-radius: 12px;
            background: #fff4e6;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #bb7b2f;
          }
          .exam-svg {
            width: 18px;
            height: 18px;
          }
          .exam-select {
            border: none;
            background: #ffffff;
            color: #3b3056;
            font-size: 0.9rem;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px #e4def2;
            cursor: pointer;
          }
          .start-search {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f0ecff;
            border-radius: 16px;
            padding: 8px 10px;
            border: 1px solid #e4def2;
            margin-bottom: 6px;
          }
          .start-search input {
            border: none;
            background: transparent;
            width: 100%;
            font-size: 0.9rem;
            color: #3b3056;
            outline: none;
          }
          .search-icon {
            width: 30px;
            height: 30px;
            border-radius: 12px;
            background: #f5f2ff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #9b95b1;
          }
          .search-svg {
            width: 18px;
            height: 18px;
          }
          .start-tabs {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 6px;
            border-bottom: 1px solid #e8e2f2;
            margin-bottom: 6px;
          }
          .start-tabs::-webkit-scrollbar {
            display: none;
          }
          .topic-tab {
            min-width: 60px;
            background: none;
            border: none;
            color: #a19bb6;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            position: relative;
            padding-bottom: 10px;
            cursor: pointer;
          }
          .topic-tab.is-active {
            color: #3b3056;
          }
          .topic-tab.is-active::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 10%;
            width: 80%;
            height: 2px;
            border-radius: 999px;
            background: #6d5bd4;
          }
          .topic-icon {
            width: 24px;
            height: 24px;
          }
          .topics-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .topics-header h2 {
            font-size: 1.12rem;
            font-weight: 700;
            margin: 0;
          }
          .select-all-btn {
            border: none;
            background: #eae5ff;
            color: #6d5bd4;
            font-size: 0.78rem;
            font-weight: 600;
            padding: 5px 12px;
            border-radius: 999px;
            cursor: pointer;
          }
          .topics-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding-bottom: 120px;
          }
          .topics-loader {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 28px 0;
          }
          .loader-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            animation: loader-bounce 1.1s infinite ease-in-out;
          }
          .loader-dot.dot-red {
            background: #ea4335;
            animation-delay: 0s;
          }
          .loader-dot.dot-blue {
            background: #4285f4;
            animation-delay: 0.12s;
          }
          .loader-dot.dot-green {
            background: #34a853;
            animation-delay: 0.24s;
          }
          .loader-dot.dot-yellow {
            background: #fbbc05;
            animation-delay: 0.36s;
          }
          .loader-dot.dot-orange {
            background: #f27c00;
            animation-delay: 0.48s;
          }
          .loader-sr {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
          }
          @keyframes loader-bounce {
            0%,
            80%,
            100% {
              transform: translateY(0);
              opacity: 0.7;
            }
            40% {
              transform: translateY(-10px);
              opacity: 1;
            }
          }
          .topic-card {
            border-radius: 16px;
            border: 1.5px solid #ebe6f6;
            background: #ffffff;
            padding: 8px 10px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 10px;
            box-shadow: 0 8px 18px rgba(76, 66, 131, 0.08);
            text-align: left;
            cursor: pointer;
          }
          .topic-card.is-selected {
            border-color: #6d5bd4;
            background: #f7f3ff;
          }
          .topic-index {
            width: 34px;
            height: 34px;
            border-radius: 12px;
            background: #f0ecff;
            color: #9c94b5;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.9rem;
          }
          .topic-index.is-selected {
            background: #6d5bd4;
            color: #ffffff;
          }
          .topic-title {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
            color: #2e2546;
          }
          .topic-meta {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: #9b95b1;
          }
          .topic-check {
            width: 26px;
            height: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #22c55e;
          }
          .topic-check-empty {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 2px solid #d6d0e8;
            display: inline-block;
          }
          .topics-empty {
            text-align: center;
            color: #9b95b1;
            background: #f7f5ff;
            padding: 16px 12px;
            border-radius: 16px;
            border: 1px dashed #ded7f0;
          }
          .start-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            background: #f4f1ff;
            border-top: 1px solid #e4def2;
            box-shadow: 0 -10px 26px rgba(76, 66, 131, 0.14);
            padding-bottom: calc(env(safe-area-inset-bottom) + 12px);
          }
          .footer-pill {
            background: #ffffff;
            border-radius: 14px;
            padding: 8px 12px;
            min-width: 64px;
            text-align: center;
            box-shadow: 0 6px 14px rgba(76, 66, 131, 0.12);
          }
          .pill-value {
            font-size: 0.95rem;
            font-weight: 700;
            color: #6d5bd4;
            display: block;
          }
          .pill-label {
            font-size: 0.68rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #b0a7c9;
          }
          .start-cta {
            border: none;
            border-radius: 14px;
            height: 52px;
            background: #5b43f0;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.95rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 16px 30px rgba(91, 67, 240, 0.32);
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          }
          .start-cta:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            box-shadow: none;
          }
          .start-cta:not(:disabled):hover {
            transform: translateY(-1px);
            box-shadow: 0 18px 32px rgba(91, 67, 240, 0.38);
          }
          @media (max-width: 640px) {
            .start-shell {
              padding: 6px 10px 0;
            }
            .start-nav {
              margin-bottom: 2px;
            }
            .start-nav-label {
              font-size: 0.7rem;
              letter-spacing: 0.2em;
            }
            .start-back {
              width: 38px;
              height: 38px;
            }
            .start-qs {
              font-size: 0.72rem;
              padding: 4px 10px;
            }
            .start-exam-card {
              padding: 6px 10px;
              margin-bottom: 5px;
            }
            .exam-icon {
              width: 26px;
              height: 26px;
              border-radius: 10px;
            }
            .exam-select {
              font-size: 0.82rem;
              padding: 4px 10px;
            }
            .start-search {
              padding: 6px 8px;
              margin-bottom: 5px;
            }
            .start-search input {
              font-size: 0.85rem;
            }
            .search-icon {
              width: 26px;
              height: 26px;
              border-radius: 10px;
            }
            .start-tabs {
              gap: 10px;
              padding-bottom: 5px;
              margin-bottom: 5px;
            }
            .topic-tab {
              min-width: 56px;
              font-size: 0.74rem;
              padding-bottom: 8px;
            }
            .topic-icon {
              width: 22px;
              height: 22px;
            }
            .topics-header h2 {
              font-size: 1.02rem;
            }
            .select-all-btn {
              font-size: 0.74rem;
              padding: 4px 10px;
            }
            .topics-list {
              gap: 7px;
              padding-bottom: 110px;
            }
            .topics-loader {
              gap: 10px;
              padding: 24px 0;
            }
            .loader-dot {
              width: 12px;
              height: 12px;
            }
            .topic-card {
              padding: 7px 9px;
              border-radius: 14px;
            }
            .topic-index {
              width: 30px;
              height: 30px;
              font-size: 0.82rem;
            }
            .topic-title {
              font-size: 0.9rem;
            }
            .topic-meta {
              font-size: 0.72rem;
            }
            .start-footer {
              gap: 10px;
              padding: 10px 12px;
              padding-bottom: calc(env(safe-area-inset-bottom) + 10px);
            }
            .footer-pill {
              padding: 6px 10px;
              min-width: 58px;
            }
            .pill-value {
              font-size: 0.9rem;
            }
            .pill-label {
              font-size: 0.6rem;
            }
            .start-cta {
              height: 46px;
              font-size: 0.9rem;
              border-radius: 12px;
            }
          }
          @media (max-width: 420px) {
            .start-shell {
              padding: 6px 8px 0;
            }
            .start-tabs {
              gap: 8px;
            }
            .topic-tab {
              min-width: 52px;
              font-size: 0.7rem;
            }
            .topics-list {
              padding-bottom: 100px;
            }
            .topics-loader {
              gap: 8px;
              padding: 20px 0;
            }
            .loader-dot {
              width: 11px;
              height: 11px;
            }
            .topic-card {
              padding: 6px 8px;
            }
            .topic-index {
              width: 28px;
              height: 28px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        No questions available for this selection.
      </div>
    );
  }

  const isCurrentSubmitted = submittedQuestions.has(currentIndex);
  const canSubmit = selectedAnswer !== null && !isCurrentSubmitted;
  const canViewSolution = isCurrentSubmitted;

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: "#f0f4f8",
        fontFamily: "'General Sans', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white lg:block shadow-sm">
        <div className="mx-auto flex w-full max-w-[1150px] items-center justify-between gap-4 px-6 lg:px-8 py-3">
          <div className="min-w-[240px]"></div>

          <div className="flex flex-1 items-center justify-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="nav-q-btn flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
              aria-label="Previous question"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="w-full max-w-[560px]">
              <QuestionQuickBar
                total={questions.length}
                currentIndex={currentIndex}
                selectedAnswers={selectedAnswers}
                questions={questions}
                submittedQuestions={submittedQuestions}
                onGoToQuestion={goToQuestion}
              />
            </div>
            <button
              onClick={handleNext}
              disabled={currentIndex >= questions.length - 1}
              className="nav-q-btn flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
              aria-label="Next question"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-[240px] items-center justify-end gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-[15px] font-bold text-red-600 tabular-nums tracking-wide">
                {formatClock(timeLeft)}
              </span>
            </div>
            <button className="flex h-10 items-center justify-center gap-1.5 px-3 rounded-lg transition-colors hover:bg-slate-100 text-slate-600">
              <Menu className="h-5 w-5" />
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1150px] px-4 sm:px-6 lg:px-8 pb-[110px] pt-3 sm:pt-4 lg:pb-10">
        <div className="lg:flex lg:items-start lg:gap-8 xl:gap-10 lg:justify-center">
          <div
            className="lg:flex-1 min-w-0 lg:ml-14 xl:ml-20 lg:max-w-[720px]"
            style={{ paddingTop: "clamp(24px, 3vw, 40px)" }}
          >
        <section className="mb-3 flex items-center justify-end gap-2 lg:hidden">
          {streak >= 2 && (
            <div className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-bold text-violet-600">
              <Flame className="w-3.5 h-3.5" />
              {streak}
            </div>
          )}
          <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {formatClock(timeLeft)}
          </div>
          <button onClick={openPalette} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden" aria-label="Open question palette">
            <Menu className="h-4 w-4" />
          </button>
        </section>

        <div className="mb-3 lg:hidden">
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

        <section className="mb-4" onTouchStart={(event) => {
          const touch = event.changedTouches[0];
          touchStartXRef.current = touch.clientX;
          touchStartYRef.current = touch.clientY;
        }} onTouchEnd={(event) => {
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
        }}>
          <motion.div key={currentQ.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`bg-white rounded-2xl shadow-[0_4px_20px_rgba(124,58,237,0.08)] px-6 py-6 sm:px-8 sm:py-8 ${isLongQuestion ? "min-h-[220px] sm:min-h-[260px]" : "min-h-[150px] sm:min-h-[180px]"}`}>
            <div className="flex items-center mb-[14px] flex-wrap gap-2">
              <ConceptBadge concept={currentQ.concept} />
              <span style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500 }}>
                {currentQ.exam} {currentQ.year}
              </span>
              <button onClick={handleBookmarkAction} className="ml-auto sm:ml-0 p-1.5 rounded-full hover:bg-slate-100 transition-colors" aria-label={bookmarked.has(String(currentQ.id)) ? "Remove bookmark" : "Add bookmark"}>
                {bookmarked.has(String(currentQ.id)) ? <BookmarkCheck className="w-5 h-5 text-violet-500" /> : <Bookmark className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, color: "#111827", lineHeight: 1.6, marginBottom: 28, letterSpacing: 0.01, paddingLeft: "0.3cm", paddingRight: "0.3cm" }}>
              <RichContent text={currentQ.question} renderText={(line) => <MathText text={line} />} />
            </div>
          </motion.div>
        </section>

        <section className="mb-5" style={{ marginTop: 28 }}>
          {isImageQuestion ? (
            <div className="flex flex-col gap-3">
              <ImageMCQ key={currentQ.id} data={currentQ} onAnswer={handleSelectImageAnswer} />
              <button
                type="button"
                disabled={submitted}
                onClick={() => {
                  if (!selected) {
                    setSubmitError("Please choose an option before submitting.");
                    return;
                  }
                  setSubmitted(true);
                  handleSubmitCurrent();
                }}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
              {submitted && (
                <div
                  className="text-sm font-semibold"
                  style={{
                    color:
                      selected?.toLowerCase() ===
                      (currentQ.correctLetter ?? "").toLowerCase()
                        ? "#16A34A"
                        : "#DC2626",
                  }}
                >
                  {selected?.toLowerCase() ===
                  (currentQ.correctLetter ?? "").toLowerCase()
                    ? "Correct"
                    : "Wrong"}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {currentQ.options.slice(0, 4).map((opt, i) => {
              let border = "#E5E7EB";
              let bg = "#FFFFFF";
              let letterBg = "transparent";
              let letterBorder = "#7C3AED";
              let letterText = "#5B21B6";
              const letterFontWeight = 600;

              if (isCurrentSubmitted && i === currentQ.correctAnswer) {
                border = "#16A34A";
                bg = "#F0FDF4";
                letterBg = "#16A34A";
                letterBorder = "#16A34A";
                letterText = "#fff";
              } else if (isCurrentSubmitted && selectedAnswer === i && i !== currentQ.correctAnswer) {
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
                    minHeight: 58,
                    background: bg,
                    border: `1.5px solid ${border}`,
                    borderRadius: 16,
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
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
                  <span style={{ width: 34, height: 34, border: `1.5px solid ${letterBorder}`, borderRadius: "50%", background: letterBg, color: letterText, fontSize: 14, fontWeight: letterFontWeight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, transition: "all 0.15s ease" }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div style={{ fontSize: 17, fontWeight: 400, color: "#111827", lineHeight: 1.5 }}>
                    <RichContent text={opt} renderText={(line) => <MathText text={line} />} />
                  </div>
                  {isCurrentSubmitted && i === currentQ.correctAnswer && (
                    <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" aria-label="Correct option" />
                  )}
                  {isCurrentSubmitted && selectedAnswer === i && i !== currentQ.correctAnswer && (
                    <XCircle className="ml-auto h-5 w-5 shrink-0 text-red-600" aria-label="Wrong option" />
                  )}
                </button>
              );
              })}
            </div>
          )}

          {canViewSolution && (
            <button
              type="button"
              onClick={openSolution}
              className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
            >
              View Solution
            </button>
          )}
        </section>

        <div className="mt-8 hidden items-center justify-between lg:flex px-1">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="inline-flex h-11 items-center justify-center gap-2 px-2 text-[15px] font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
            Previous
          </button>
          <div className="flex items-center gap-6">
            <button
              onClick={handleClearResponse}
              disabled={isCurrentSubmitted}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear Responses
            </button>
            <button
              onClick={handleNext}
              disabled={!isCurrentSubmitted}
              className="inline-flex h-11 items-center justify-center gap-2 px-2 text-[15px] font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {currentIndex < questions.length - 1 ? "Next" : "Finish"}
              {currentIndex < questions.length - 1 && (
                <ChevronRight className="h-[18px] w-[18px]" />
              )}
            </button>
            <button
              onClick={() => {
                if (!isCurrentSubmitted) {
                  handleSubmitCurrent();
                }
              }}
              disabled={!canSubmit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 shadow-sm"
            >
              <Send className="h-[18px] w-[18px]" />
              Submit
            </button>
          </div>
        </div>
        </div>

        <aside className="hidden lg:block lg:w-[360px]" style={{ marginTop: "32px" }}>
          <div className="sticky" style={{ top: "110px" }}>
            {isSolutionOpen ? (
              <SolutionSidePanel
                isOpen={isSolutionOpen}
                solution={currentQ.solution ?? ""}
                questionNumber={currentIndex + 1}
                correctOptionIndex={currentQ.correctAnswer}
                onClose={closeSolution}
              />
            ) : (
              <QuestionPalettePanel
                total={questions.length}
                currentIndex={currentIndex}
                selectedAnswers={selectedAnswers}
                questions={questions}
                submittedQuestions={submittedQuestions}
                onGoToQuestion={goToQuestion}
              />
            )}
          </div>
        </aside>
        </div>
      </main>

      {!isDesktop && (
        <SolutionBottomSheet
          isOpen={isSolutionOpen}
          solution={currentQ.solution ?? ""}
          questionNumber={currentIndex + 1}
          correctOptionIndex={currentQ.correctAnswer}
          onClose={closeSolution}
        />
      )}

      {submitError && (
        <div className="fixed bottom-[86px] left-0 right-0 z-40 px-3 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 shadow-sm">
            {submitError}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-3xl px-3 pb-3 pt-3 sm:px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
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
              {!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next →" : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
