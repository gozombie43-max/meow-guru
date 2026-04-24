"use client";

import MathRenderer from "@/components/MathRenderer";
import MathText from "@/components/MathText";
import RichContent from "@/components/RichContent";
import Image from "next/image";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Menu,
  Brain,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sun,
  Moon,
  Sparkles,
  Target,
  RotateCcw,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { saveRecentQuiz, updateProgress, toggleBookmark } from "@/lib/userApi";
import { fetchQuestions, type Question as ApiQuestion } from "@/lib/api/questions";

type QuizMode = "concept" | "formula" | "mixed" | "ai-challenge";
type Difficulty = "easy" | "medium" | "hard";

type ConceptColour = { border: string; bg: string; text: string };

interface ReasoningQuizEngineProps {
  title: string;
  slug: string;
}

interface ReasoningQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;
  answer: string;
  difficulty: Difficulty;
  estimatedTime: number;
  year: string;
  exam: string;
  solution: string;
  questionType?: string;
  questionImage?: string;
  optionRegions?: Record<string, { x: number; y: number; w: number; h: number }>;
  correctLetter?: string;
}

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

type QuizTheme = "light" | "dark";

const QUIZ_THEME_STORAGE_KEY = "reasoning-quiz-theme";
const QUIZ_THEME_SWITCH_MS = 180;
let quizTheme: QuizTheme = "light";
let quizThemeInitialized = false;
let quizThemeSwitchTimer: number | null = null;
const quizThemeListeners = new Set<() => void>();

function notifyQuizThemeListeners() {
  quizThemeListeners.forEach((listener) => listener());
}

function syncQuizThemeToDom(
  nextTheme: QuizTheme,
  options?: {
    animate?: boolean;
  }
) {
  if (typeof document === "undefined") return;

  const applyTheme = () => {
    const containers = document.querySelectorAll<HTMLElement>(".reasoning-quiz");
    containers.forEach((container) => {
      container.dataset.theme = nextTheme;
    });
  };

  if (!options?.animate) {
    applyTheme();
    return;
  }

  const addSwitchingClass = () => {
    const containers = document.querySelectorAll<HTMLElement>(".reasoning-quiz");
    containers.forEach((container) => container.classList.add("theme-switching"));
  };

  const removeSwitchingClass = () => {
    const containers = document.querySelectorAll<HTMLElement>(
      ".reasoning-quiz.theme-switching"
    );
    containers.forEach((container) => container.classList.remove("theme-switching"));
  };

  addSwitchingClass();

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      applyTheme();
    });
  } else {
    applyTheme();
  }

  if (typeof window !== "undefined") {
    if (quizThemeSwitchTimer !== null) {
      window.clearTimeout(quizThemeSwitchTimer);
    }
    quizThemeSwitchTimer = window.setTimeout(() => {
      removeSwitchingClass();
    }, QUIZ_THEME_SWITCH_MS);
  } else {
    removeSwitchingClass();
  }
}

function setQuizTheme(nextTheme: QuizTheme) {
  if (quizTheme === nextTheme) {
    syncQuizThemeToDom(nextTheme);
    return;
  }
  quizTheme = nextTheme;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(QUIZ_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage write errors.
    }
  }
  syncQuizThemeToDom(nextTheme, { animate: true });
  notifyQuizThemeListeners();
}

function initQuizTheme() {
  if (quizThemeInitialized) return;
  quizThemeInitialized = true;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(QUIZ_THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        quizTheme = stored;
      }
    } catch {
      // Ignore storage read errors.
    }
  }
  syncQuizThemeToDom(quizTheme);
  notifyQuizThemeListeners();
}

function useQuizTheme() {
  useEffect(() => {
    initQuizTheme();
    syncQuizThemeToDom(quizTheme);
  }, []);

  return useSyncExternalStore(
    (listener) => {
      quizThemeListeners.add(listener);
      return () => quizThemeListeners.delete(listener);
    },
    () => quizTheme,
    () => "light"
  );
}

function toggleQuizTheme() {
  setQuizTheme(quizTheme === "dark" ? "light" : "dark");
}

const TOPIC_CONCEPTS: Record<string, string[]> = {
  "coding-decoding": [
    "Letter Coding",
    "Number Coding",
    "Symbolic Coding",
    "Numerical Operations",
    "Mixed Coding",
  ],
  "syllogism-inferences": [
    "Two Statement",
    "Three Statement",
    "Possibility Cases",
    "Drawing Inferences",
  ],
  "puzzle-seating-arrangement": [
    "Linear Seating",
    "Circular Seating",
    "Floor Puzzle",
    "Box Puzzle",
    "Day/Month Puzzle",
  ],
  series: [
    "Number Series",
    "Letter Series",
    "Figural Series",
    "Alpha-Numeric Series",
    "Trends",
  ],
  analogy: [
    "Semantic Analogy",
    "Symbolic/Number Analogy",
    "Figural Analogy",
    "Word Analogy",
  ],
  "classification-odd-one-out": [
    "Semantic Classification",
    "Figural Classification",
    "Symbolic Classification",
    "Number Based",
  ],
  "blood-relations": [
    "Family Tree",
    "Coded Blood Relations",
    "Statement Based",
  ],
  "direction-distance": [
    "Basic 8 Directions",
    "Distance Calculation",
    "Shadow Problems",
    "Space Orientation",
  ],
  "venn-diagram": [
    "Relationship Diagrams",
    "Finding Elements",
    "Shaded Region",
    "3-Circle Venn",
  ],
  inequalities: [
    "Direct Inequalities",
    "Coded Inequalities",
    "Mathematical Inequalities",
  ],
  "mathematical-symbolic-operations": [
    "BODMAS Based",
    "Symbol Substitution",
    "Sign Interchange",
    "Numerical Operations",
  ],
  "order-ranking": [
    "Position from Top/Bottom",
    "Rank in Row/Column",
    "Height/Weight Ordering",
  ],
  "statement-conclusion": [
    "Follows/Does Not Follow",
    "Implicit Conclusions",
    "Critical Thinking",
  ],
  "statement-assumptions": [
    "Implicit Assumptions",
    "Explicit Assumptions",
  ],
  "statement-arguments": [
    "Strong/Weak Arguments",
    "Course of Action",
    "Cause & Effect",
  ],
  "problem-solving-critical-thinking": [
    "Applied Logical Reasoning",
    "Step-based Problems",
    "Condition Based",
  ],
  "non-verbal-figures": [
    "Embedded Figures",
    "Figure Completion",
    "Counting Figures",
    "Figural Pattern",
  ],
  "paper-folding-cutting": [
    "Punched Hole",
    "Pattern Folding & Unfolding",
    "Figural Pattern-folding",
  ],
  "mirror-water-image": [
    "Letter/Number Mirror",
    "Clock Mirror Image",
    "Figural Mirror",
    "Water Image",
  ],
  "cube-dice": [
    "Open/Closed Dice",
    "Face Opposite",
    "Cube Painting & Cutting",
    "3D Orientation",
  ],
  matrix: [
    "Missing Number/Letter",
    "Row-Column Coding",
    "Figure Matrix",
  ],
  "logical-sequence-of-words": [
    "Dictionary Order",
    "Process/Hierarchy Order",
    "Word Building",
  ],
  "emotional-intelligence": [
    "Recognising Emotions",
    "Empathy Based",
    "Situational EQ",
    "Self-awareness",
  ],
  "social-intelligence": [
    "Socially Appropriate Responses",
    "Interpersonal Situations",
    "Group Behavior",
  ],
  "word-building": [
    "Form Words from Letters",
    "Find Words Within Words",
    "Meaningful Word Formation",
  ],
};

const MODE_LABELS: Record<QuizMode, string> = {
  concept: "Concept Practice",
  formula: "Pattern Practice",
  mixed: "Mixed Practice",
  "ai-challenge": "Selection Way",
};

const DEFAULT_CONCEPT_COLOUR: ConceptColour = {
  border: "#7C3AED",
  bg: "#F5F3FF",
  text: "#5B21B6",
};

const CONCEPT_PALETTE: ConceptColour[] = [
  DEFAULT_CONCEPT_COLOUR,
  { border: "#0EA5E9", bg: "#ECFEFF", text: "#0369A1" },
  { border: "#10B981", bg: "#ECFDF5", text: "#047857" },
  { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  { border: "#F43F5E", bg: "#FFF1F2", text: "#BE123C" },
  { border: "#2563EB", bg: "#EFF6FF", text: "#1D4ED8" },
  { border: "#14B8A6", bg: "#F0FDFA", text: "#0F766E" },
  { border: "#6B7280", bg: "#F8FAFC", text: "#475569" },
];

function normalizeMode(value: string | null): QuizMode {
  if (value === "formula" || value === "mixed" || value === "ai-challenge") {
    return value;
  }
  return "concept";
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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildConceptColours(concepts: string[]): Record<string, ConceptColour> {
  const colours: Record<string, ConceptColour> = {};
  concepts.forEach((concept, index) => {
    colours[concept] = CONCEPT_PALETTE[index % CONCEPT_PALETTE.length];
  });
  return colours;
}

function toReasoningQuestion(
  question: ApiQuestion,
  index: number,
  fallbackConcept: string
): ReasoningQuestion {
  const isImage = question.questionType === "image_mcq";
  const imageOptionKeys =
    question.optionRegions && Object.keys(question.optionRegions).length > 0
      ? Object.keys(question.optionRegions).sort()
      : ["a", "b", "c", "d"];
  const textOptions = Array.isArray(question.options)
    ? question.options.map((opt) => String(opt))
    : [];
  const options =
    textOptions.length > 0
      ? textOptions
      : isImage
      ? imageOptionKeys.map((key) => key.toUpperCase())
      : [];
  const difficulty = normalizeDifficulty(question.difficulty);
  const correctAnswer = resolveCorrectIndex(question, options);
  const exam = String(question.exam ?? "");
  const concept =
    String(question.concept ?? question.chapter ?? question.topic ?? "").trim() ||
    fallbackConcept ||
    "General";
  const numericId = Number.parseInt(question.id, 10);
  const id = Number.isFinite(numericId) ? numericId : index + 1;
  const rawAnswer = String(question.correctAnswer ?? "").trim();
  const answer = /^[a-z]$/i.test(rawAnswer)
    ? options[correctAnswer] ?? ""
    : rawAnswer || (options[correctAnswer] ?? "");

  return {
    id,
    concept,
    formula: "",
    question: String(question.question ?? ""),
    options,
    correctAnswer,
    answer,
    difficulty,
    estimatedTime: difficulty === "easy" ? 40 : difficulty === "hard" ? 80 : 60,
    year: extractYear(exam),
    exam,
    solution: String(question.solution ?? ""),
    questionType: question.questionType,
    questionImage: question.questionImage,
    optionRegions: question.optionRegions,
    correctLetter: question.correctLetter,
  };
}

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
        className="w-full border-t my-[2px]"
        style={{ minWidth: "1.2em", borderColor: "var(--quiz-divider)" }}
      />
      <span
        className="font-semibold"
        style={{ fontSize: "0.85em", color: "var(--quiz-text-muted)" }}
      >
        {denominator}
      </span>
    </span>
  );
}

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
  questions: ReasoningQuestion[];
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
  const base = "qstatus border transition-all duration-200";
  if (status === "current") return `${base} qstatus--current`;
  if (status === "answered") return `${base} qstatus--answered`;
  if (status === "correct") return `${base} qstatus--correct`;
  if (status === "wrong") return `${base} qstatus--wrong`;
  return `${base} qstatus--empty`;
}

function ReasoningQuizThemeStyles() {
  return (
    <style jsx global>{`
      .reasoning-quiz {
        --quiz-bg: linear-gradient(165deg, #f5f0ff 0%, #eef2ff 38%, #f8faff 100%);
        --quiz-start-bg: radial-gradient(
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
        --quiz-text: #111827;
        --quiz-text-muted: #6b7280;
        --quiz-text-soft: #94a3b8;
        --quiz-surface: rgba(255, 255, 255, 0.95);
        --quiz-surface-muted: rgba(248, 250, 252, 0.95);
        --quiz-nav-bg: rgba(255, 255, 255, 0.9);
        --quiz-nav-inner-bg: rgba(241, 245, 249, 0.95);
        --quiz-nav-border: rgba(226, 232, 240, 0.9);
        --quiz-card-bg: #ffffff;
        --quiz-card-border: #e5e7eb;
        --quiz-card-shadow: 0 4px 20px rgba(124, 58, 237, 0.08);
        --quiz-card-blur: blur(0px);
        --quiz-border: #e5e7eb;
        --quiz-border-strong: #cbd5e1;
        --quiz-divider: #9ca3af;
        --quiz-pill-bg: #f5f3ff;
        --quiz-pill-text: #5b21b6;
        --quiz-pill-border: rgba(124, 58, 237, 0.25);
        --quiz-accent-bg: #ede9fe;
        --quiz-accent-border: rgba(124, 58, 237, 0.35);
        --quiz-accent-text: #7c3aed;
        --quiz-overlay: rgba(15, 23, 42, 0.45);
        --quiz-option-bg: #ffffff;
        --quiz-option-border: #e5e7eb;
        --quiz-option-hover-bg: #f5f3ff;
        --quiz-option-hover-border: #c4b5fd;
        --quiz-option-text: #111827;
        --quiz-option-label-bg: transparent;
        --quiz-option-label-border: #7c3aed;
        --quiz-option-label-text: #5b21b6;
        --quiz-option-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
        --quiz-option-selected-shadow: 0 12px 24px rgba(124, 58, 237, 0.22);
        --quiz-option-selected-bg: #f5f3ff;
        --quiz-option-selected-border: #7c3aed;
        --quiz-option-selected-label-bg: #7c3aed;
        --quiz-option-selected-label-border: #7c3aed;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: #f0fdf4;
        --quiz-option-correct-border: #16a34a;
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: #fef2f2;
        --quiz-option-wrong-border: #dc2626;
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: rgba(255, 255, 255, 0.95);
        --quiz-secondary-bg: #f1f5f9;
        --quiz-secondary-border: #cbd5e1;
        --quiz-secondary-text: #475569;
        --quiz-error-bg: #fff1f2;
        --quiz-error-border: #fecdd3;
        --quiz-error-text: #be123c;
        --quiz-ring-track: rgba(15, 23, 42, 0.08);
        --quiz-quote-bg: rgba(124, 58, 237, 0.12);
        --quiz-quote-border: rgba(124, 58, 237, 0.35);
        --quiz-quote-text: #5b21b6;
        --quiz-selected-icon: #7c3aed;
        --quiz-toggle-bg: rgba(255, 255, 255, 0.9);
        --quiz-toggle-border: rgba(148, 163, 184, 0.45);
        --quiz-toggle-track: rgba(226, 232, 240, 0.9);
        --quiz-toggle-thumb: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
        --quiz-status-current-bg: #7c3aed;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #7c3aed;
        --quiz-status-current-shadow: 0 10px 25px rgba(124, 58, 237, 0.45);
        --quiz-status-answered-bg: #fef3c7;
        --quiz-status-answered-text: #b45309;
        --quiz-status-answered-border: #fcd34d;
        --quiz-status-correct-bg: #dcfce7;
        --quiz-status-correct-text: #15803d;
        --quiz-status-correct-border: #86efac;
        --quiz-status-wrong-bg: #ffe4e6;
        --quiz-status-wrong-text: #be123c;
        --quiz-status-wrong-border: #fda4af;
        --quiz-status-empty-bg: #f1f5f9;
        --quiz-status-empty-text: #475569;
        --quiz-status-empty-border: #cbd5e1;
        --text-primary: var(--quiz-text);
      }

      .reasoning-quiz[data-theme="dark"] {
        color-scheme: dark;
        --quiz-bg: linear-gradient(165deg, #0b1020 0%, #0f172a 45%, #0b0f1a 100%);
        --quiz-start-bg: radial-gradient(
            900px 420px at 20% -10%,
            rgba(124, 58, 237, 0.22),
            transparent 60%
          ),
          radial-gradient(
            900px 500px at 85% 110%,
            rgba(37, 99, 235, 0.2),
            transparent 62%
          ),
          linear-gradient(150deg, #0b1020 0%, #0f172a 40%, #0b0f1a 100%);
        --quiz-text: #ffffff;
        --quiz-text-muted: #94a3b8;
        --quiz-text-soft: #7683a2;
        --quiz-surface: #141b2d;
        --quiz-surface-muted: #101728;
        --quiz-nav-bg: #131a2a;
        --quiz-nav-inner-bg: #0f1525;
        --quiz-nav-border: #232c42;
        --quiz-card-bg: linear-gradient(
          150deg,
          rgba(255, 255, 255, 0.14) 0%,
          rgba(255, 255, 255, 0.1) 45%,
          rgba(148, 163, 184, 0.08) 100%
        );
        --quiz-card-border: rgba(255, 255, 255, 0.28);
        --quiz-card-shadow: 0 22px 40px rgba(2, 6, 23, 0.55),
          0 0 22px rgba(99, 102, 241, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.35),
          inset 0 -12px 24px rgba(2, 6, 23, 0.28);
        --quiz-card-blur: blur(12px) saturate(150%);
        --quiz-border: #232c42;
        --quiz-border-strong: #2f3b56;
        --quiz-divider: #3b4866;
        --quiz-pill-bg: rgba(124, 58, 237, 0.18);
        --quiz-pill-text: #c4b5fd;
        --quiz-pill-border: rgba(124, 58, 237, 0.45);
        --quiz-accent-bg: rgba(124, 58, 237, 0.2);
        --quiz-accent-border: rgba(124, 58, 237, 0.5);
        --quiz-accent-text: #ddd6fe;
        --quiz-overlay: rgba(2, 6, 23, 0.65);
        --quiz-option-bg: #151c2d;
        --quiz-option-border: #2b3550;
        --quiz-option-hover-bg: #1a2340;
        --quiz-option-hover-border: #7c3aed;
        --quiz-option-text: #ffffff;
        --quiz-option-label-bg: #0f1525;
        --quiz-option-label-border: #2b3550;
        --quiz-option-label-text: #cbd5f5;
        --quiz-option-shadow: 0 10px 22px rgba(2, 6, 23, 0.45);
        --quiz-option-selected-shadow: 0 16px 28px rgba(124, 58, 237, 0.4);
        --quiz-option-selected-bg: rgba(124, 58, 237, 0.35);
        --quiz-option-selected-border: #8b5cf6;
        --quiz-option-selected-label-bg: #8b5cf6;
        --quiz-option-selected-label-border: #8b5cf6;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: rgba(22, 163, 74, 0.18);
        --quiz-option-correct-border: #16a34a;
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: rgba(220, 38, 38, 0.18);
        --quiz-option-wrong-border: #dc2626;
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: rgba(12, 16, 30, 0.95);
        --quiz-secondary-bg: #1b2337;
        --quiz-secondary-border: #2f3b56;
        --quiz-secondary-text: #e2e8f0;
        --quiz-error-bg: rgba(248, 113, 113, 0.16);
        --quiz-error-border: rgba(248, 113, 113, 0.35);
        --quiz-error-text: #fca5a5;
        --quiz-ring-track: rgba(226, 232, 240, 0.08);
        --quiz-quote-bg: rgba(124, 58, 237, 0.22);
        --quiz-quote-border: rgba(124, 58, 237, 0.5);
        --quiz-quote-text: #e9d5ff;
        --quiz-selected-icon: #c4b5fd;
        --quiz-toggle-bg: #121826;
        --quiz-toggle-border: #1f2a3d;
        --quiz-toggle-track: #0b1020;
        --quiz-toggle-thumb: linear-gradient(135deg, #1f2937 0%, #0b1020 100%);
        --quiz-status-current-bg: #8b5cf6;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #a78bfa;
        --quiz-status-current-shadow: 0 14px 26px rgba(124, 58, 237, 0.5);
        --quiz-status-answered-bg: rgba(34, 197, 94, 0.18);
        --quiz-status-answered-text: #4ade80;
        --quiz-status-answered-border: rgba(34, 197, 94, 0.6);
        --quiz-status-correct-bg: rgba(34, 197, 94, 0.22);
        --quiz-status-correct-text: #4ade80;
        --quiz-status-correct-border: rgba(34, 197, 94, 0.7);
        --quiz-status-wrong-bg: rgba(244, 63, 94, 0.22);
        --quiz-status-wrong-text: #fb7185;
        --quiz-status-wrong-border: rgba(244, 63, 94, 0.6);
        --quiz-status-empty-bg: rgba(15, 23, 42, 0.9);
        --quiz-status-empty-text: #94a3b8;
        --quiz-status-empty-border: #2b3550;
      }

      .reasoning-quiz .quiz-start {
        background: var(--quiz-start-bg);
        color: var(--quiz-text);
      }

      .reasoning-quiz .qstatus {
        border: 1px solid var(--quiz-status-empty-border);
      }
      .reasoning-quiz .qstatus--current {
        background: var(--quiz-status-current-bg);
        color: var(--quiz-status-current-text);
        border-color: var(--quiz-status-current-border);
        box-shadow: var(--quiz-status-current-shadow);
        transform: scale(1.1);
        z-index: 10;
      }
      .reasoning-quiz .qstatus--answered {
        background: var(--quiz-status-answered-bg);
        color: var(--quiz-status-answered-text);
        border-color: var(--quiz-status-answered-border);
      }
      .reasoning-quiz .qstatus--correct {
        background: var(--quiz-status-correct-bg);
        color: var(--quiz-status-correct-text);
        border-color: var(--quiz-status-correct-border);
      }
      .reasoning-quiz .qstatus--wrong {
        background: var(--quiz-status-wrong-bg);
        color: var(--quiz-status-wrong-text);
        border-color: var(--quiz-status-wrong-border);
      }
      .reasoning-quiz .qstatus--empty {
        background: var(--quiz-status-empty-bg);
        color: var(--quiz-status-empty-text);
        border-color: var(--quiz-status-empty-border);
      }

      .reasoning-quiz .concept-badge {
        border: 1.5px solid var(--concept-border);
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: lowercase;
        color: var(--concept-text);
        background: var(--concept-bg);
        letter-spacing: 0.04em;
      }
      .reasoning-quiz[data-theme="dark"] .concept-badge {
        border-color: var(--quiz-pill-border);
        background: var(--quiz-pill-bg);
        color: var(--quiz-pill-text);
      }

      .reasoning-quiz .quote-highlight {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        margin: 0 2px;
        border-radius: 10px;
        border: 1px solid var(--quiz-quote-border);
        background: var(--quiz-quote-bg);
        color: var(--quiz-quote-text);
        font-weight: 600;
      }

      .reasoning-quiz .quiz-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .reasoning-quiz .quiz-topbar-group {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .reasoning-quiz .quiz-option {
        border-radius: 18px;
        box-shadow: var(--quiz-option-shadow);
      }
      .reasoning-quiz .quiz-option.is-selected {
        box-shadow: var(--quiz-option-selected-shadow);
      }
      .reasoning-quiz .quiz-option-letter {
        border-radius: 12px;
      }

      .reasoning-quiz .qnum-chip {
        border-radius: 12px;
      }

      .reasoning-quiz .quiz-icon-button {
        background: var(--quiz-surface);
        border: 1px solid var(--quiz-border);
        color: var(--quiz-text-muted);
      }
      .reasoning-quiz .quiz-icon-button:hover {
        background: var(--quiz-surface-muted);
      }

      .reasoning-quiz .quiz-bookmark:hover {
        background: var(--quiz-surface-muted);
      }

      .reasoning-quiz .theme-toggle {
        width: 64px;
        height: 34px;
        padding: 2px;
        border-radius: 999px;
        border: 1px solid var(--quiz-toggle-border);
        background: var(--quiz-toggle-bg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .reasoning-quiz .theme-toggle-track {
        width: 100%;
        height: 100%;
        border-radius: 999px;
        background: var(--quiz-toggle-track);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 7px;
      }
      .reasoning-quiz .theme-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: var(--quiz-toggle-thumb);
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        transition: transform 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
      }
      .reasoning-quiz .theme-toggle-icon {
        width: 16px;
        height: 16px;
        z-index: 1;
        transition: opacity 0.2s ease;
      }
      .reasoning-quiz .theme-toggle--light .theme-toggle-icon--sun {
        color: #f59e0b;
        opacity: 1;
      }
      .reasoning-quiz .theme-toggle--light .theme-toggle-icon--moon {
        color: #94a3b8;
        opacity: 0.5;
      }
      .reasoning-quiz .theme-toggle--dark .theme-toggle-thumb {
        transform: translateX(30px);
        background: linear-gradient(135deg, #1f2937 0%, #0b1020 100%);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
      }
      .reasoning-quiz .theme-toggle--dark .theme-toggle-icon--sun {
        color: #fbbf24;
        opacity: 0.4;
      }
      .reasoning-quiz .theme-toggle--dark .theme-toggle-icon--moon {
        color: #e2e8f0;
        opacity: 1;
      }

      .reasoning-quiz[data-theme="dark"] .glass-card {
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      .reasoning-quiz[data-theme="dark"] .glass-card:hover {
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        border-color: rgba(148, 163, 184, 0.35);
      }
      .reasoning-quiz[data-theme="dark"] .btn-outline {
        background: rgba(15, 23, 42, 0.4);
        border-color: rgba(148, 163, 184, 0.35);
        color: #e2e8f0;
      }
      .reasoning-quiz[data-theme="dark"] .btn-outline:hover {
        background: rgba(30, 41, 59, 0.6);
      }

      .reasoning-quiz.theme-switching .quiz-card,
      .reasoning-quiz.theme-switching .glass-card,
      .reasoning-quiz.theme-switching .quiz-option {
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        transition: none !important;
      }

      .reasoning-quiz.theme-switching .quiz-start-button,
      .reasoning-quiz.theme-switching .quiz-start-button::after,
      .reasoning-quiz.theme-switching .quiz-start-icon {
        animation: none !important;
      }
    `}</style>
  );
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
  questions: ReasoningQuestion[];
  submittedQuestions: Set<number>;
  onClose: () => void;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] bg-[var(--quiz-overlay)] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full w-full p-4"
            style={{ background: "var(--quiz-surface)", color: "var(--quiz-text)" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--quiz-text)]">
                Question Palette
              </h3>
              <button
                onClick={onClose}
                className="quiz-icon-button h-12 min-w-12 rounded-xl shadow-sm transition-colors"
                aria-label="Close question palette"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
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
              <span
                className="rounded-md border px-2 py-1"
                style={{
                  background: "var(--quiz-status-empty-bg)",
                  borderColor: "var(--quiz-status-empty-border)",
                  color: "var(--quiz-status-empty-text)",
                }}
              >
                Not Answered
              </span>
            </div>

            <div
              className="rounded-2xl border p-3 shadow-sm"
              style={{ background: "var(--quiz-card-bg)", borderColor: "var(--quiz-border)" }}
            >
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
  questions: ReasoningQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  return (
    <div
      className="rounded-2xl border p-4 shadow-sm"
      style={{ background: "var(--quiz-card-bg)", borderColor: "var(--quiz-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[color:var(--quiz-text)]">
          Question Palette
        </h3>
        <span className="text-xs font-semibold text-[color:var(--quiz-text-muted)]">
          {currentIndex + 1}/{total}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
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
        <span
          className="rounded-md border px-2 py-1"
          style={{
            background: "var(--quiz-status-empty-bg)",
            borderColor: "var(--quiz-status-empty-border)",
            color: "var(--quiz-status-empty-text)",
          }}
        >
          Not Answered
        </span>
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
  questions: ReasoningQuestion[];
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
      <div
        className="rounded-2xl border p-2 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur"
        style={{ background: "var(--quiz-nav-bg)", borderColor: "var(--quiz-nav-border)" }}
      >
        <div
          className="rounded-xl border px-1 py-1.5"
          style={{ background: "var(--quiz-nav-inner-bg)", borderColor: "var(--quiz-nav-border)" }}
        >
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
  questions: ReasoningQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
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
              ref={(el) => {
                quickButtonRefs.current[index] = el;
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
}

function ThemeToggle() {
  const theme = useQuizTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleQuizTheme}
      className={`theme-toggle ${isDark ? "theme-toggle--dark" : "theme-toggle--light"}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
    >
      <span className="theme-toggle-track">
        <Sun className="theme-toggle-icon theme-toggle-icon--sun" aria-hidden="true" />
        <Moon className="theme-toggle-icon theme-toggle-icon--moon" aria-hidden="true" />
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}

function ConceptBadge({
  concept,
  colours,
}: {
  concept: string;
  colours: Record<string, ConceptColour>;
}) {
  const colour = colours[concept] ?? DEFAULT_CONCEPT_COLOUR;
  const badgeStyle: React.CSSProperties = {
    ["--concept-border" as string]: colour.border,
    ["--concept-bg" as string]: colour.bg,
    ["--concept-text" as string]: colour.text,
  };
  const label = concept.trim().replace(/\s+/g, "_").toLowerCase();
  return (
    <span className="concept-badge" style={badgeStyle}>
      {label}
    </span>
  );
}

function formatMathBookSolutionLines(solution: string): string[] {
  const base = solution
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s*=>\s*/g, " \\Rightarrow ")
    .trim();

  if (!base) return [];

  const expandedMath = base.replace(/\\\(([^]*?)\\\)/g, (_match, expr: string) => {
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
          className="fixed inset-0 z-[95] bg-[var(--quiz-overlay)]"
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
            className="absolute bottom-0 left-0 right-0 mx-auto flex h-[40vh] w-full max-w-3xl flex-col rounded-t-3xl border px-5 pt-4 shadow-[0_-16px_44px_rgba(15,23,42,0.35)]"
            style={{
              background: "var(--quiz-card-bg)",
              borderColor: "var(--quiz-border)",
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
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--quiz-border-strong)]" />

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--quiz-text)]">
                Worked Solution
              </h3>
              <button
                onClick={onClose}
                className="quiz-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                aria-label="Close solution"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-2xl border px-4 py-3 text-[color:var(--quiz-text)]"
              style={{
                background: "var(--quiz-surface-muted)",
                borderColor: "var(--quiz-border)",
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
                  <p className="mb-1 text-[18px] font-semibold text-[color:var(--quiz-text)]">
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
                <p className="text-sm text-[color:var(--quiz-text-muted)]">
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

const prefetchQuestionImage = (url?: string) => {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
};

export default function ReasoningQuizEngine({
  title,
  slug,
}: ReasoningQuizEngineProps) {
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get("mode"));
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);

  const themeStyles = <ReasoningQuizThemeStyles />;

  const [allQuestions, setAllQuestions] = useState<ReasoningQuestion[]>([]);
  const [questions, setQuestions] = useState<ReasoningQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [miniMode, setMiniMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(
    {}
  );
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [examFilter, setExamFilter] = useState<string>("");

  const baseConcepts = useMemo(() => TOPIC_CONCEPTS[slug] ?? [], [slug]);

  const conceptOptions = useMemo(() => {
    const set = new Set<string>();
    baseConcepts.forEach((concept) => set.add(concept));
    allQuestions.forEach((question) => {
      if (question.concept) set.add(question.concept);
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ["General"];
  }, [allQuestions, baseConcepts]);

  const conceptColours = useMemo(
    () => buildConceptColours(conceptOptions),
    [conceptOptions]
  );

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

  const availableCount = useMemo(() => {
    let pool: ReasoningQuestion[];

    if (mode === "concept") {
      pool =
        conceptFilter === "all"
          ? [...allQuestions]
          : allQuestions.filter((q) => q.concept === conceptFilter);
    } else {
      pool = [...allQuestions];
    }

    if (examFilter.trim() !== "") {
      const examQuery = examFilter.trim().toLowerCase();
      pool = pool.filter((q) =>
        normalizeExamName((q.exam ?? "").trim()).toLowerCase().includes(examQuery)
      );
    }

    return pool.length;
  }, [allQuestions, mode, conceptFilter, examFilter]);

  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const fallbackConcept = baseConcepts[0] ?? "General";

    fetchQuestions({ subject: "reasoning", topic: slug })
      .then((data) => {
        if (!active) return;
        setAllQuestions(data.map((item, index) => toReasoningQuestion(item, index, fallbackConcept)));
      })
      .catch((error) => {
        console.error(error);
        if (active) setAllQuestions([]);
      });

    return () => {
      active = false;
    };
  }, [baseConcepts, slug]);

  useEffect(() => {
    setConceptFilter("all");
    setExamFilter("");
  }, [slug]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const { user, token, refreshUser } = useAuth();
  const [bookmarked, setBookmarked] = useState<Set<string>>(
    new Set(user?.bookmarks ?? [])
  );
  const quizKey = `reasoning:${slug}`;
  const quizHref = `/reasoning/${slug}/quiz`;
  const resumeEntry = useMemo(() => {
    if (!resumeRequested) return null;
    return (
      user?.recentQuizzes?.find((entry) => entry.quizKey === quizKey) ?? null
    );
  }, [quizKey, resumeRequested, user?.recentQuizzes]);
  const resumeAppliedRef = useRef(false);
  const jumpAppliedRef = useRef(false);

  const maxTime = miniMode ? 20 : 60;
  const currentQ = questions[currentIndex] as ReasoningQuestion | undefined;
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;
  const hasQuestionText = Boolean(currentQ?.question?.trim());
  const hasQuestionImage = Boolean(currentQ?.questionImage);

  const renderQuestionLine = useCallback((line: string) => {
    const chunks = line.split(/'([^']+)'/g);
    return chunks.map((chunk, index) => {
      const key = `question-chunk-${index}`;
      if (index % 2 === 1) {
        return (
          <span key={key} className="quote-highlight">
            <MathText text={`'${chunk}'`} />
          </span>
        );
      }
      return <MathText key={key} text={chunk} />;
    });
  }, []);

  useEffect(() => {
    const next = questions[currentIndex + 1];
    if (next?.questionImage) {
      prefetchQuestionImage(next.questionImage);
    }
  }, [currentIndex, questions]);

  useEffect(() => {
    if (allQuestions.length === 0) {
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedAnswer(null);
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

    let pool: ReasoningQuestion[];

    switch (mode) {
      case "concept":
        pool =
          conceptFilter === "all"
            ? [...allQuestions]
            : allQuestions.filter((q) => q.concept === conceptFilter);
        break;
      case "formula":
      case "ai-challenge":
        pool = [...allQuestions];
        break;
      case "mixed":
      default:
        pool = shuffle([...allQuestions]);
        break;
    }

    if (examFilter.trim() !== "") {
      const examQuery = examFilter.trim().toLowerCase();
      pool = pool.filter((q) => {
        const norm = normalizeExamName((q.exam ?? "").trim()).toLowerCase();
        return norm.includes(examQuery);
      });
    }

    const nextQuestions = [...pool].sort((a, b) => a.id - b.id);
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setIsPaletteOpen(false);
    setIsSolutionOpen(false);
    setStreak(0);
    setShowAnalytics(false);
    setStarted(false);
    setSubmitError("");
  }, [allQuestions, mode, conceptFilter, examFilter]);

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
    const existingSelection = savedAnswers[safeIndex];
    setSelectedAnswer(existingSelection ?? null);
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
    const existingSelection = selectedAnswers[targetIndex];
    setSelectedAnswer(existingSelection ?? null);
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
        title,
        subject: "reasoning",
        slug,
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
    resumeRequested,
    results,
    selectedAnswers,
    slug,
    started,
    submittedQuestions,
    title,
    token,
    showAnalytics,
  ]);

  useEffect(() => {
    if (!token || !showAnalytics) return;
    if (questions.length === 0) return;

    const submittedList = Array.from(submittedQuestions);
    saveRecentQuiz(token, {
      quizKey,
      title,
      subject: "reasoning",
      slug,
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
    results,
    selectedAnswers,
    slug,
    submittedQuestions,
    title,
    token,
    showAnalytics,
  ]);

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
      const nextQuestion = questions[safeIndex];
      const existingSelection = selectedAnswers[safeIndex];
      setSelectedAnswer(existingSelection ?? null);
      setSubmitError("");
      setIsSolutionOpen(false);
      if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) {
        startTimer();
      }
    },
    [
      questions,
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
      const safeNumber = Math.max(1, Math.min(questionNumber, questions.length));
      showQuestion(safeNumber - 1);
    },
    [questions.length, showQuestion]
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
      await toggleBookmark(token, qId, action, {
        quizKey,
        title,
        subject: "reasoning",
        slug,
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
    slug,
    title,
    token,
  ]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    showQuestion(currentIndex - 1);
  }, [currentIndex, showQuestion]);

  const handleClearResponse = useCallback(() => {
    if (submittedQuestions.has(currentIndex)) return;
    setSelectedAnswer(null);
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
    setQuestions([...questions].sort((a, b) => a.id - b.id));
    setCurrentIndex(0);
    setSelectedAnswer(null);
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

  function formatClock(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const mins = Math.floor(safeSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (safeSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  if (showAnalytics) {
    return (
      <div
        className="reasoning-quiz min-h-screen relative overflow-hidden"
        data-theme="light"
        style={{ background: "var(--quiz-bg)", color: "var(--quiz-text)" }}
      >
        {themeStyles}
        <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto relative">
          <div className="mb-6 flex justify-end">
            <ThemeToggle />
          </div>
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
            className="animate-fade-in-up text-[color:var(--quiz-text-muted)] mb-10"
            style={{ animationDelay: "100ms" }}
          >
            Here is how you performed in this {MODE_LABELS[mode]} session.
          </p>

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
                <div className="text-xs text-[color:var(--quiz-text-soft)] mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div
            className="animate-fade-in-up grid grid-cols-2 gap-4 mb-10"
            style={{ animationDelay: "250ms" }}
          >
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-[color:var(--quiz-text-soft)] mb-1">
                Best Streak
              </div>
              <div className="text-xl font-bold text-violet-600 flex items-center gap-2">
                <Flame className="w-5 h-5" /> {bestStreak}
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="text-sm text-[color:var(--quiz-text-soft)] mb-1">
                Questions Done
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)] flex items-center justify-center gap-2">
                <MathFraction
                  numerator={results.length}
                  denominator={questions.length}
                />
              </div>
            </div>
          </div>

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
                {conceptOptions.map((concept) => {
                  const conceptResults = results.filter(
                    (r) => r.concept === concept
                  );
                  if (conceptResults.length === 0) return null;
                  const correct = conceptResults.filter(
                    (r) => r.isCorrect
                  ).length;
                  const pct = Math.round(
                    (correct / conceptResults.length) * 100
                  );
                  const col = conceptColours[concept] ?? DEFAULT_CONCEPT_COLOUR;
                  return (
                    <div key={concept}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[color:var(--quiz-text-muted)]">
                          {concept}
                        </span>
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
                      <div className="h-1.5 w-full rounded-full bg-[var(--quiz-surface-muted)] overflow-hidden">
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

          {weakConcepts.length > 0 && (
            <div
              className="animate-fade-in-up glass-card rounded-xl p-6 mb-10"
              style={{ animationDelay: "350ms" }}
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                <Target className="w-4 h-4 text-red-500" />
                Weak Areas - Needs Practice
              </h3>
              <div className="space-y-3">
                {weakConcepts.map((wc) => (
                  <div
                    key={wc.concept}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-[color:var(--quiz-text-muted)]">
                      {wc.concept}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/25">
                      {wc.accuracy}% accuracy
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              href={`/reasoning/${slug}`}
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              Change Mode
            </Link>
            <Link
              href="/reasoning"
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              All Topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div
        className="reasoning-quiz quiz-start min-h-screen relative overflow-hidden px-4 sm:px-6"
        data-theme="light"
      >
        {themeStyles}
        <div className="w-full max-w-2xl mx-auto text-center min-h-screen flex flex-col pt-20 sm:pt-24 pb-8">
          <div className="mb-6 flex justify-end">
            <ThemeToggle />
          </div>
          <div className="mb-2 flex items-center justify-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "var(--quiz-pill-bg)",
                color: "var(--quiz-pill-text)",
                border: "1px solid var(--quiz-pill-border)",
              }}
            >
              {title}
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

          {mode === "concept" && (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setConceptFilter("all")}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  background:
                    conceptFilter === "all" ? "#7c3aed" : "var(--quiz-pill-bg)",
                  color:
                    conceptFilter === "all" ? "#fff" : "var(--quiz-pill-text)",
                  border: `1.5px solid ${
                    conceptFilter === "all"
                      ? "#7c3aed"
                      : "var(--quiz-pill-border)"
                  }`,
                }}
              >
                All
              </button>
              {conceptOptions.map((concept) => {
                const col = conceptColours[concept] ?? DEFAULT_CONCEPT_COLOUR;
                const isActive = conceptFilter === concept;
                return (
                  <button
                    key={concept}
                    onClick={() => setConceptFilter(concept)}
                    className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      background: isActive ? col.text : col.bg,
                      color: isActive ? "#fff" : col.text,
                      border: `1.5px solid ${col.border}`,
                    }}
                  >
                    {concept}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-5 flex items-center justify-center" style={{ marginTop: "1cm" }}>
            <div
              className="flex items-center gap-2 rounded-full border px-3 py-2 shadow-sm"
              style={{ minWidth: "280px", background: "var(--quiz-surface)", borderColor: "var(--quiz-pill-border)" }}
            >
              <select
                value={examFilter || "all"}
                onChange={(e) => setExamFilter(e.target.value === "all" ? "" : e.target.value)}
                className="rounded-full border-none bg-transparent px-4 py-2 text-base font-semibold text-[color:var(--quiz-text)] outline-none focus:ring-0"
                style={{ minWidth: "220px" }}
              >
                {examOptions.map((ex) => (
                  <option key={ex} value={ex === "all" ? "all" : ex}>
                    {ex === "all" ? "All exams" : ex}
                  </option>
                ))}
              </select>

              {examFilter !== "" && (
                <button
                  onClick={() => setExamFilter("")}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "var(--quiz-accent-bg)", color: "var(--quiz-accent-text)" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <p className="text-sm font-medium text-[color:var(--quiz-text-muted)] mb-5">
            {availableCount} questions available
          </p>

          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleStart}
              className="quiz-start-button mx-auto"
              aria-label="Start Quiz"
            >
              <Sparkles className="quiz-start-icon" aria-hidden="true" />
              <span className="quiz-start-label">Start Quiz</span>
            </button>
          </div>
        </div>

        <style jsx>{`
          .quiz-start {
            background: var(--quiz-start-bg);
          }
          .quiz-start-button {
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
            animation: quiz-breathe 3.4s ease-in-out infinite;
          }
          .quiz-start-button::before,
          .quiz-start-button::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
          }
          .quiz-start-button::before {
            inset: 2px;
            background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.42),
              rgba(255, 255, 255, 0.08) 42%,
              transparent 85%
            );
            opacity: 0.85;
          }
          .quiz-start-button::after {
            background: linear-gradient(
              100deg,
              transparent 18%,
              rgba(255, 255, 255, 0.72) 47%,
              transparent 78%
            );
            transform: translateX(-140%);
            mix-blend-mode: screen;
            opacity: 0.92;
            animation: quiz-sweep 3s ease-in-out infinite;
          }
          .quiz-start-icon {
            position: relative;
            z-index: 2;
            width: 0.88rem;
            height: 0.88rem;
            stroke-width: 2.4;
            color: #ffffff;
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.55));
            animation: quiz-twinkle 2.8s ease-in-out infinite;
          }
          .quiz-start-label {
            position: relative;
            z-index: 2;
            font-size: clamp(0.88rem, 2.5vw, 1rem);
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #ffffff;
            text-shadow: 0 2px 10px rgba(30, 41, 59, 0.34);
          }
          .quiz-start-button:hover {
            transform: translateY(-2px) scale(1.05);
            filter: brightness(1.12);
            box-shadow: 0 22px 42px rgba(124, 58, 237, 0.45),
              0 0 30px rgba(79, 70, 229, 0.45), 0 0 58px rgba(37, 99, 235, 0.3),
              inset 0 2px 0 rgba(255, 255, 255, 0.44);
          }
          .quiz-start-button:focus-visible {
            outline: 2px solid rgba(255, 255, 255, 0.72);
            outline-offset: 4px;
          }
          @keyframes quiz-sweep {
            0% {
              transform: translateX(-140%);
            }
            55%,
            100% {
              transform: translateX(140%);
            }
          }
          @keyframes quiz-breathe {
            0%,
            100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-4px) scale(1.018);
            }
          }
          @keyframes quiz-gradient {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes quiz-twinkle {
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

  if (!currentQ) {
    return (
      <div
        className="reasoning-quiz min-h-screen relative flex items-center justify-center"
        data-theme="light"
        style={{ background: "var(--quiz-bg)", color: "var(--quiz-text)" }}
      >
        {themeStyles}
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="text-[color:var(--quiz-text-muted)]">
          No questions available for this selection.
        </div>
      </div>
    );
  }

  const isCurrentSubmitted = submittedQuestions.has(currentIndex);
  const canSubmit = selectedAnswer !== null && !isCurrentSubmitted;
  const canViewSolution = isCurrentSubmitted;

  return (
    <div
      className="reasoning-quiz min-h-screen relative overflow-x-hidden"
      data-theme="light"
      style={{
        background: "var(--quiz-bg)",
        color: "var(--quiz-text)",
        fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
      }}
    >
      {themeStyles}
      <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-[220px] items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-900">
                Reasoning Practice
              </h1>
              <p className="text-xs text-slate-500">
                Chapter - {currentQ.concept || title}
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
              aria-label="Next question"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold tracking-wide text-red-600 tabular-nums">
                {formatClock(timeLeft)}
              </span>
            </div>
            <ThemeToggle />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
              aria-label="Quiz options"
            >
              <Menu className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-[160px] pt-3 sm:px-6 sm:pb-[110px] sm:pt-4 lg:px-8 lg:pb-10">
        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="lg:flex-1">
        <section className="quiz-topbar lg:hidden">
          <div className="quiz-topbar-group">
            <ThemeToggle />
          </div>
          <div className="quiz-topbar-group">
            <button
              onClick={openPalette}
              className="quiz-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden"
              aria-label="Open question palette"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
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
            className={`quiz-card rounded-2xl px-6 py-6 sm:px-8 sm:py-8 ${
              isLongQuestion
                ? "min-h-[220px] sm:min-h-[260px]"
                : "min-h-[150px] sm:min-h-[180px]"
            }`}
            style={{
              background: "var(--quiz-card-bg)",
              boxShadow: "var(--quiz-card-shadow)",
              border: "1px solid var(--quiz-card-border)",
              backdropFilter: "var(--quiz-card-blur)",
              WebkitBackdropFilter: "var(--quiz-card-blur)",
            }}
          >
            <div className="flex items-center mb-[14px] flex-wrap gap-2">
              <ConceptBadge concept={currentQ.concept} colours={conceptColours} />
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--quiz-text-muted)",
                  fontWeight: 500,
                }}
              >
                {currentQ.exam} {currentQ.year}
              </span>

              <button
                onClick={handleBookmark}
                className="ml-auto sm:ml-0 p-1.5 rounded-full quiz-bookmark transition-colors"
                aria-label={
                  bookmarked.has(String(currentQ.id))
                    ? "Remove bookmark"
                    : "Add bookmark"
                }
              >
                {bookmarked.has(String(currentQ.id)) ? (
                  <BookmarkCheck className="w-5 h-5 text-violet-500" />
                ) : (
                  <Bookmark className="w-5 h-5 text-[color:var(--quiz-text-soft)]" />
                )}
              </button>
            </div>

            {hasQuestionText && (
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--quiz-text)",
                  lineHeight: 1.75,
                  marginBottom: hasQuestionImage ? 18 : 28,
                  letterSpacing: 0.015,
                  fontFamily: "'Poppins', 'SF Pro Text', 'Segoe UI', sans-serif",
                  paddingLeft: "0.3cm",
                  paddingRight: "0.3cm",
                }}
              >
                <RichContent
                  text={currentQ.question}
                  className="leading-relaxed"
                  renderText={renderQuestionLine}
                />
              </div>
            )}

            {hasQuestionImage && currentQ.questionImage && (
              <div className="mt-3 sm:mt-4">
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: "var(--quiz-border)", background: "var(--quiz-surface-muted)" }}
                >
                  <Image
                    src={currentQ.questionImage}
                    alt="Question"
                    width={720}
                    height={480}
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="h-auto w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </motion.div>
        </section>

        <section className="mb-5" style={{ marginTop: 28 }}>
          <div
            className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible"
            style={{ paddingBottom: 96, WebkitOverflowScrolling: "touch" }}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {currentQ.options.slice(0, 4).map((opt, i) => {
                let border = "var(--quiz-option-border)",
                  bg = "var(--quiz-option-bg)",
                  letterBg = "var(--quiz-option-label-bg)",
                  letterBorder = "var(--quiz-option-label-border)",
                  letterText = "var(--quiz-option-label-text)",
                  shadow = "var(--quiz-option-shadow)";
                const letterFontWeight = 600;
                const isSelected = selectedAnswer === i;

                if (isCurrentSubmitted && i === currentQ.correctAnswer) {
                  border = "var(--quiz-option-correct-border)";
                  bg = "var(--quiz-option-correct-bg)";
                  letterBg = "var(--quiz-option-correct-label-bg)";
                  letterBorder = "var(--quiz-option-correct-label-border)";
                  letterText = "var(--quiz-option-correct-label-text)";
                } else if (
                  isCurrentSubmitted &&
                  selectedAnswer === i &&
                  i !== currentQ.correctAnswer
                ) {
                  border = "var(--quiz-option-wrong-border)";
                  bg = "var(--quiz-option-wrong-bg)";
                  letterBg = "var(--quiz-option-wrong-label-bg)";
                  letterBorder = "var(--quiz-option-wrong-label-border)";
                  letterText = "var(--quiz-option-wrong-label-text)";
                } else if (!isCurrentSubmitted && selectedAnswer === i) {
                  border = "var(--quiz-option-selected-border)";
                  bg = "var(--quiz-option-selected-bg)";
                  letterBg = "var(--quiz-option-selected-label-bg)";
                  letterBorder = "var(--quiz-option-selected-label-border)";
                  letterText = "var(--quiz-option-selected-label-text)";
                }

                if (isSelected) {
                  shadow = "var(--quiz-option-selected-shadow)";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectAnswer(i)}
                    disabled={isCurrentSubmitted}
                    type="button"
                    className={`quiz-option${isSelected ? " is-selected" : ""}`}
                    style={{
                      width: "100%",
                      minHeight: 64,
                      background: bg,
                      border: `1.5px solid ${border}`,
                      borderRadius: 18,
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      boxShadow: shadow,
                      cursor: isCurrentSubmitted ? "default" : "pointer",
                      transition: "all 0.15s ease",
                      fontSize: 16,
                      fontWeight: 500,
                      color: "var(--quiz-option-text)",
                      outline: "none",
                    }}
                    onMouseOver={(e) => {
                      if (!isCurrentSubmitted && selectedAnswer !== i) {
                        e.currentTarget.style.borderColor =
                          "var(--quiz-option-hover-border)";
                        e.currentTarget.style.background = "var(--quiz-option-hover-bg)";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isCurrentSubmitted && selectedAnswer !== i) {
                        e.currentTarget.style.borderColor = "var(--quiz-option-border)";
                        e.currentTarget.style.background = "var(--quiz-option-bg)";
                      }
                    }}
                  >
                    <span
                      className="quiz-option-letter"
                      style={{
                        width: 36,
                        height: 36,
                        border: `1.5px solid ${letterBorder}`,
                        borderRadius: 12,
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

                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: "var(--quiz-option-text)",
                        lineHeight: 1.5,
                      }}
                    >
                      <RichContent text={opt} />
                    </div>

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
            </div>

            {canViewSolution && (
              <button
                type="button"
                onClick={openSolution}
                className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition-colors"
                style={{
                  background: "var(--quiz-accent-bg)",
                  borderColor: "var(--quiz-accent-border)",
                  color: "var(--quiz-accent-text)",
                }}
              >
                View Solution
              </button>
            )}
          </div>
        </section>

        <div className="mt-6 hidden items-center justify-between border-t pt-4 lg:flex" style={{ borderColor: "var(--quiz-border)" }}>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="inline-flex h-12 items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: "var(--quiz-secondary-bg)",
              borderColor: "var(--quiz-secondary-border)",
              color: "var(--quiz-secondary-text)",
            }}
          >
            Previous
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearResponse}
              disabled={isCurrentSubmitted}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear Response
            </button>
            <button
              onClick={handleNext}
              disabled={!isCurrentSubmitted}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {currentIndex < questions.length - 1 ? "Next →" : "Finish"}
            </button>
            <button
              onClick={() => {
                if (!isCurrentSubmitted) {
                  handleSubmitCurrent();
                }
              }}
              disabled={!canSubmit}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Submit
            </button>
          </div>
        </div>
        </div>

        <aside className="hidden lg:block lg:w-[320px]">
          <div className="sticky top-24">
            <QuestionPalettePanel
              total={questions.length}
              currentIndex={currentIndex}
              selectedAnswers={selectedAnswers}
              questions={questions}
              submittedQuestions={submittedQuestions}
              onGoToQuestion={goToQuestion}
            />
          </div>
        </aside>
        </div>
      </main>

      <SolutionBottomSheet
        isOpen={isSolutionOpen}
        solution={currentQ.solution ?? ""}
        questionNumber={currentIndex + 1}
        correctOptionIndex={currentQ.correctAnswer}
        onClose={closeSolution}
      />

      {submitError && (
        <div className="fixed bottom-[86px] left-0 right-0 z-40 px-3 sm:px-6">
          <div
            className="mx-auto max-w-3xl rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm"
            style={{
              background: "var(--quiz-error-bg)",
              borderColor: "var(--quiz-error-border)",
              color: "var(--quiz-error-text)",
            }}
          >
            {submitError}
          </div>
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md lg:hidden"
        style={{ background: "var(--quiz-footer-bg)", borderColor: "var(--quiz-border)" }}
      >
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
              className="inline-flex h-16 items-center justify-center rounded-2xl border px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: "var(--quiz-secondary-bg)",
                borderColor: "var(--quiz-secondary-border)",
                color: "var(--quiz-secondary-text)",
              }}
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
              className="inline-flex h-16 items-center justify-center rounded-2xl px-6 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: isCurrentSubmitted
                  ? "linear-gradient(135deg, #5b21b6 0%, #1d4ed8 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              }}
            >
              {!isCurrentSubmitted
                ? "Submit"
                : currentIndex < questions.length - 1
                ? "Next ->"
                : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
