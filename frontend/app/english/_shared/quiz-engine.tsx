"use client";

import MathRenderer from "@/components/MathRenderer";
import RichContent from "@/components/RichContent";
import ImageMCQ from "@/components/ImageMCQ";

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
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Target,
  RotateCcw,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { saveRecentQuiz, updateProgress, toggleBookmark } from "@/lib/userApi";
import { fetchQuestions, type Question as ApiQuestion } from "@/lib/api/questions";

type QuizMode =
  | "concept"
  | "formula"
  | "mixed"
  | "ai-challenge"
  | "easy"
  | "hard";
type Difficulty = "easy" | "medium" | "hard";
type EnglishQuestionRecord = EnglishQuestion & {
  quizName?: string;
  source?: string;
  quizId?: string;
};

type ConceptColour = { border: string; bg: string; text: string };

interface EnglishQuizEngineProps {
  title: string;
  slug: string;
}

interface EnglishQuestion {
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

const TOPIC_CONCEPTS: Record<string, string[]> = {
  "synonyms-antonyms": [
    "Synonym Selection",
    "Antonym Selection",
    "Contextual Usage",
    "Degree of Meaning",
  ],
  "homonyms-homophones": [
    "Same Sound Different Meaning",
    "Same Spelling Different Meaning",
    "Contextual Disambiguation",
  ],
  "one-word-substitution": [
    "People & Professions",
    "Places & Institutions",
    "Actions & Behaviors",
    "Science & Nature Terms",
  ],
  "idioms-phrases": [
    "Meaning Identification",
    "Correct Usage",
    "Fill in the Blank with Idiom",
    "Origin & Context",
  ],
  "spelling-misspelled-words": [
    "Detect the Misspelled Word",
    "Correct the Spelling",
    "Commonly Confused Words",
  ],
  "active-passive-voice": [
    "Simple Tense Conversions",
    "Modal Voice Change",
    "Interrogative & Negative",
    "Complex Sentences",
  ],
  "direct-indirect-narration": [
    "Statements",
    "Questions",
    "Commands & Requests",
    "Exclamations",
    "Tense Backshift Rules",
  ],
  "subject-verb-agreement": [
    "Collective Nouns",
    "Indefinite Pronouns",
    "Either/Neither",
    "Intervening Phrases",
    "Inversion",
  ],
  tenses: [
    "Simple Tenses",
    "Continuous Tenses",
    "Perfect Tenses",
    "Perfect Continuous",
    "Mixed Tense Errors",
  ],
  articles: [
    "A / An Usage",
    "The Usage",
    "Zero Article",
    "Articles with Proper Nouns",
  ],
  prepositions: [
    "Place & Position",
    "Time Prepositions",
    "Direction & Movement",
    "Phrasal Prepositions",
    "Idiomatic Use",
  ],
  conjunctions: [
    "Coordinating",
    "Subordinating",
    "Correlative Pairs",
    "Conjunctive Adverbs",
  ],
  modifiers: [
    "Dangling Modifiers",
    "Misplaced Modifiers",
    "Squinting Modifiers",
    "Adjective vs Adverb",
  ],
  pronouns: [
    "Pronoun-Antecedent Agreement",
    "Case of Pronouns",
    "Reflexive Pronouns",
    "Relative Pronouns",
  ],
  "sentence-structure": [
    "Simple / Compound / Complex",
    "Clause Types",
    "Phrase Types",
    "Transformation of Sentences",
  ],
  parallelism: [
    "Parallel Verbs",
    "Parallel Nouns & Phrases",
    "Correlative Parallelism",
    "List Parallelism",
  ],
  "spot-the-error-error-detection": [
    "Grammar Errors",
    "Word Choice Errors",
    "Punctuation Errors",
    "Part-wise Error Spotting",
  ],
  "sentence-correction-improvement": [
    "Replace Underlined Part",
    "Rewrite Correctly",
    "Choose Best Alternative",
    "No Improvement Cases",
  ],
  "fill-in-the-blanks": [
    "Grammar Based",
    "Vocabulary Based",
    "Double Blanks",
    "Contextual Inference",
  ],
  "cloze-test": [
    "Vocabulary Cloze",
    "Grammar Cloze",
    "Contextual Cloze",
    "Discourse Cloze",
  ],
  "reading-comprehension": [
    "Main Idea / Title",
    "Inference Questions",
    "Vocabulary in Context",
    "Author's Tone & Purpose",
    "Factual Detail",
    "Editorial / Current Affairs Passage",
    "Story-Based Passage",
  ],
  "para-jumbles": [
    "Identify Opening Sentence",
    "Logical Sequence",
    "Connector Words",
    "Pronoun Reference Links",
  ],
  "para-sentence-completion": [
    "Choose Best Concluding Sentence",
    "Opening Sentence Completion",
    "Contextual Fit",
    "Tone Matching",
  ],
};

const MODE_LABELS: Record<QuizMode, string> = {
  concept: "Concept Practice",
  formula: "Vocabulary Practice",
  mixed: "Mixed Practice",
  "ai-challenge": "Selection Way",
  easy: "Topic Mix",
  hard: "Tier 2",
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
  if (
    value === "formula" ||
    value === "mixed" ||
    value === "ai-challenge" ||
    value === "easy" ||
    value === "hard"
  ) {
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

function normalizeQuizTag(value?: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function matchesQuizTag(
  question: {
    quizName?: string;
    source?: string;
    quizId?: string;
  },
  tags: string[]
): boolean {
  const quizTag =
    normalizeQuizTag(question.quizName) ||
    normalizeQuizTag(question.quizId) ||
    normalizeQuizTag(question.source);

  return tags.includes(quizTag);
}

function isFormulaQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["careerwill", "vocabularybank"]);
}

function isMixedQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["pw", "mixedpractice"]);
}

function isAiChallengeQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["selectionway"]);
}

function isTaggedModeQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return (
    isFormulaQuestion(question) ||
    isMixedQuestion(question) ||
    isAiChallengeQuestion(question)
  );
}

function toEnglishQuestion(
  question: ApiQuestion,
  index: number,
  fallbackConcept: string
): EnglishQuestionRecord {
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
    quizName: question.quizName,
    source: (question as ApiQuestion & { source?: string }).source,
    quizId: (question as ApiQuestion & { quizId?: string }).quizId,
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
        className="w-full border-t border-slate-400 my-[2px]"
        style={{ minWidth: "1.2em" }}
      />
      <span className="text-slate-500 font-semibold" style={{ fontSize: "0.85em" }}>
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
  questions: EnglishQuestion[];
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
  questions: EnglishQuestion[];
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
  questions: EnglishQuestion[];
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
  questions: EnglishQuestion[];
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
  questions: EnglishQuestion[];
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

function ConceptBadge({
  concept,
  colours,
}: {
  concept: string;
  colours: Record<string, ConceptColour>;
}) {
  const colour = colours[concept] ?? DEFAULT_CONCEPT_COLOUR;
  return (
    <span
      style={{
        border: `1.5px solid ${colour.border}`,
        borderRadius: "999px",
        padding: "3px 12px",
        fontSize: "13px",
        color: colour.text,
        background: colour.bg,
        fontWeight: 500,
      }}
    >
      {concept}
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
              <h3 className="text-base font-semibold text-slate-800">
                Worked Solution
              </h3>
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

const prefetchQuestionImage = (url?: string) => {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
};

export default function EnglishQuizEngine({
  title,
  slug,
}: EnglishQuizEngineProps) {
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get("mode"));
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);

  const [allQuestions, setAllQuestions] = useState<EnglishQuestionRecord[]>([]);
  const [questions, setQuestions] = useState<EnglishQuestionRecord[]>([]);
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
    let pool: EnglishQuestionRecord[];

    if (mode === "concept") {
      pool =
        conceptFilter === "all"
          ? allQuestions.filter((q) => !isTaggedModeQuestion(q))
          : allQuestions.filter(
              (q) => q.concept === conceptFilter && !isTaggedModeQuestion(q)
            );
    } else if (mode === "formula") {
      pool = allQuestions.filter((q) => isFormulaQuestion(q));
    } else if (mode === "ai-challenge") {
      pool = allQuestions.filter((q) => isAiChallengeQuestion(q));
    } else if (mode === "hard") {
      pool = allQuestions.filter(
        (q) => !isTaggedModeQuestion(q) && q.difficulty === "hard"
      );
    } else if (mode === "easy") {
      pool = allQuestions.filter(
        (q) => !isTaggedModeQuestion(q) && q.difficulty === "easy"
      );
    } else {
      pool = allQuestions.filter((q) => isMixedQuestion(q));
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

    fetchQuestions({ subject: "english", topic: slug })
      .then((data) => {
        if (!active) return;
        setAllQuestions(data.map((item, index) => toEnglishQuestion(item, index, fallbackConcept)));
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
  const quizKey = `english:${slug}`;
  const quizHref = `/english/${slug}/quiz`;
  const resumeEntry = useMemo(() => {
    if (!resumeRequested) return null;
    return (
      user?.recentQuizzes?.find((entry) => entry.quizKey === quizKey) ?? null
    );
  }, [quizKey, resumeRequested, user?.recentQuizzes]);
  const resumeAppliedRef = useRef(false);
  const jumpAppliedRef = useRef(false);

  const maxTime = miniMode ? 20 : 60;
  const currentQ = questions[currentIndex] as EnglishQuestion | undefined;
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;
  const isImageQuestion = currentQ?.questionType === "image_mcq";

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

    let pool: EnglishQuestionRecord[];

    switch (mode) {
      case "concept":
        pool =
          conceptFilter === "all"
            ? allQuestions.filter((q) => !isTaggedModeQuestion(q))
            : allQuestions.filter(
                (q) => q.concept === conceptFilter && !isTaggedModeQuestion(q)
              );
        break;
      case "formula":
        pool = allQuestions.filter((q) => isFormulaQuestion(q));
        break;
      case "ai-challenge":
        pool = allQuestions.filter((q) => isAiChallengeQuestion(q));
        break;
      case "hard":
        pool = allQuestions.filter(
          (q) => !isTaggedModeQuestion(q) && q.difficulty === "hard"
        );
        break;
      case "easy":
        pool = allQuestions.filter(
          (q) => !isTaggedModeQuestion(q) && q.difficulty === "easy"
        );
        break;
      case "mixed":
      default:
        pool = shuffle(allQuestions.filter((q) => isMixedQuestion(q)));
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
        title,
        subject: "english",
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
      subject: "english",
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
      if (currentQ.questionType === "image_mcq") {
        setSelected(String.fromCharCode(97 + index));
      }
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions]
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

    if (currentQ.questionType === "image_mcq") {
      setSubmitted(true);
    }

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
        subject: "english",
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
    setQuestions([...questions].sort((a, b) => a.id - b.id));
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
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

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
                        <span className="text-sm text-slate-600">{concept}</span>
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
                    <span className="text-sm text-slate-600">{wc.concept}</span>
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
              href={`/english/${slug}`}
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              Change Mode
            </Link>
            <Link
              href="/english"
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
      <div className="quiz-start min-h-screen relative overflow-hidden px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto text-center min-h-screen flex flex-col pt-20 sm:pt-24 pb-8">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "#F5F3FF",
                color: "#7c3aed",
                border: "1px solid #7c3aed30",
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
                    conceptFilter === "all" ? "#7c3aed" : "#F5F3FF",
                  color: conceptFilter === "all" ? "#fff" : "#5B21B6",
                  border: `1.5px solid ${
                    conceptFilter === "all" ? "#7c3aed" : "#7c3aed40"
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
            <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-2 shadow-sm" style={{ minWidth: "280px" }}>
              <select
                value={examFilter || "all"}
                onChange={(e) => setExamFilter(e.target.value === "all" ? "" : e.target.value)}
                className="rounded-full border-none bg-transparent px-4 py-2 text-base font-semibold text-slate-700 outline-none focus:ring-0"
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
                  className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <p className="text-sm font-medium text-slate-600 mb-5">
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
        background:
          "linear-gradient(165deg, #f5f0ff 0%, #eef2ff 38%, #f8faff 100%)",
        fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
      }}
    >
      <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-[220px] items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-900">
                English Practice
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
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
              aria-label="Quiz options"
            >
              <Menu className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-[110px] pt-3 sm:px-6 sm:pt-4 lg:px-8 lg:pb-10">
        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="lg:flex-1">
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
          <button
            onClick={openPalette}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
            aria-label="Open question palette"
          >
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
            <div className="flex items-center mb-[14px] flex-wrap gap-2">
              <ConceptBadge concept={currentQ.concept} colours={conceptColours} />
              <span
                style={{
                  fontSize: "13px",
                  color: "#6B7280",
                  fontWeight: 500,
                }}
              >
                {currentQ.exam} {currentQ.year}
              </span>

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

            <div
              style={{
                fontSize: 18,
                fontWeight: 400,
                color: "#111827",
                lineHeight: 1.6,
                marginBottom: 28,
                letterSpacing: 0.01,
                paddingLeft: "0.3cm",
                paddingRight: "0.3cm",
              }}
            >
              <RichContent text={currentQ.question} className="leading-relaxed" />
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
              let border = "#E5E7EB",
                bg = "#FFFFFF",
                letterBg = "transparent",
                letterBorder = "#7C3AED",
                letterText = "#5B21B6";
              const letterFontWeight = 600;

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

                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 400,
                      color: "#111827",
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

        <div className="mt-6 hidden items-center justify-between border-t border-slate-200 pt-4 lg:flex">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
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
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 shadow-sm">
            {submitError}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
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
                ? "Next ->"
                : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
