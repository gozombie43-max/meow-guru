import React, { useEffect, useSyncExternalStore } from 'react';
import { type Question as ApiQuestion } from '@/lib/api/questions';
import { QuizMode, Difficulty, QuizQuestionRecord, ConceptColour, QuizQuestion, SessionResult, QuizTheme, ClassificationGroup } from './types';

export let QUIZ_THEME_STORAGE_KEY = "quiz-theme"; // set dynamically by component
export let QUIZ_CSS_CLASS = "quiz"; // set dynamically by component
export let FORMULA_MODE_LABEL = "Pattern Practice"; // set dynamically by component
export const QUIZ_THEME_SWITCH_MS = 180;
export let quizTheme: QuizTheme = "light";
export let quizThemeInitialized = false;
export let quizThemeSwitchTimer: number | null = null;
export const quizThemeListeners = new Set<() => void>();

export function notifyQuizThemeListeners() {
  quizThemeListeners.forEach((listener) => listener());
}

export function syncQuizThemeToDom(
  nextTheme: QuizTheme,
  options?: {
    animate?: boolean;
  }
) {
  if (typeof document === "undefined") return;

  const applyTheme = () => {
    const containers = document.querySelectorAll<HTMLElement>(`.${QUIZ_CSS_CLASS}`);
    containers.forEach((container) => {
      container.dataset.theme = nextTheme;
    });
  };

  if (!options?.animate) {
    applyTheme();
    return;
  }

  const addSwitchingClass = () => {
    const containers = document.querySelectorAll<HTMLElement>(`.${QUIZ_CSS_CLASS}`);
    containers.forEach((container) => container.classList.add("theme-switching"));
  };

  const removeSwitchingClass = () => {
    const containers = document.querySelectorAll<HTMLElement>(`.${QUIZ_CSS_CLASS}.theme-switching`);
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

export function setQuizTheme(nextTheme: QuizTheme) {
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

export function initQuizTheme() {
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

export function useQuizTheme() {
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

export function toggleQuizTheme() {
  setQuizTheme(quizTheme === "dark" ? "light" : "dark");
}

// subjectConfig.topicConcepts: provided via subjectConfig.topicConcepts

export const MODE_LABELS: Record<QuizMode, string> = {
  concept: "PYQ",
  formula: "CareerWill",
  mixed: "PW",
  "ai-challenge": "Selection Way",
  easy: "Topic Mix",
  hard: "Tier 2",
};

export const DEFAULT_CONCEPT_COLOUR: ConceptColour = {
  border: "#7C3AED",
  bg: "#F5F3FF",
  text: "#5B21B6",
};

export const CONCEPT_PALETTE: ConceptColour[] = [
  DEFAULT_CONCEPT_COLOUR,
  { border: "#0EA5E9", bg: "#ECFEFF", text: "#0369A1" },
  { border: "#10B981", bg: "#ECFDF5", text: "#047857" },
  { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  { border: "#F43F5E", bg: "#FFF1F2", text: "#BE123C" },
  { border: "#2563EB", bg: "#EFF6FF", text: "#1D4ED8" },
  { border: "#14B8A6", bg: "#F0FDFA", text: "#0F766E" },
  { border: "#6B7280", bg: "#F8FAFC", text: "#475569" },
];



export function normalizeMode(value: string | null): QuizMode {
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

export function normalizeDifficulty(value?: string): Difficulty {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("hard")) return "hard";
  if (lower.includes("easy")) return "easy";
  return "medium";
}

export function extractYear(exam: string): string {
  const match = exam.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "";
}

export function resolveCorrectIndex(question: ApiQuestion, options: string[]): number {
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

export function buildConceptColours(concepts: string[]): Record<string, ConceptColour> {
  const colours: Record<string, ConceptColour> = {};
  concepts.forEach((concept, index) => {
    colours[concept] = CONCEPT_PALETTE[index % CONCEPT_PALETTE.length];
  });
  return colours;
}

export function normalizeQuizTag(value?: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function matchesQuizTag(
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

export function isFormulaQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
  topic?: string;
  letter?: string;
  word?: string;
}): boolean {
  if (matchesQuizTag(question, ["careerwill", "patternbank", "formula", "formulabank", "vocabularybank", "factbank", "antosynopyq"])) {
    return true;
  }
  const normalizedTopic = normalizeQuizTag(question.topic);
  if (normalizedTopic === "antosynopyq") return true;
  if (typeof question.letter === "string" && question.letter.trim()) return true;
  if (typeof question.word === "string" && question.word.trim()) return true;
  return false;
}

export function isMixedQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["pw", "mixedpractice", "mixedpw"]);
}

export function isAiChallengeQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["selectionway", "aichallenge"]);
}

export function isTopicMixQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["topicmix"]);
}

export function isTier2Question(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
}): boolean {
  return matchesQuizTag(question, ["tier2", "tier2hard"]);
}

export function isStudyModeQuestion(question: {
  questionType?: string;
  quizName?: string;
  word?: string;
  meanings?: any[];
}): boolean {
  if (!question || typeof question !== "object") return false;
  const qType = String(question.questionType || "").trim().toLowerCase();
  if (qType === "study-mode" || qType === "studymode") return true;
  if (String(question.quizName || "").trim().toLowerCase() === "study mode") return true;
  if (typeof question.word === "string" && question.word.trim() && Array.isArray(question.meanings)) return true;
  return false;
}

export function isTaggedModeQuestion(question: {
  quizName?: string;
  source?: string;
  quizId?: string;
  topic?: string;
  letter?: string;
  word?: string;
}): boolean {
  return (
    isFormulaQuestion(question) ||
    isMixedQuestion(question) ||
    isAiChallengeQuestion(question) ||
    isTopicMixQuestion(question) ||
    isTier2Question(question)
  );
}

export function toQuizQuestion(
  question: ApiQuestion,
  index: number,
  fallbackConcept: string
): QuizQuestionRecord {
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
  const word = question.word ? String(question.word).trim() : undefined;
  const letter = (
    question.letter ||
    (word ? word.charAt(0) : "")
  )
    .trim()
    .toUpperCase() || undefined;
  const chapter = question.chapter ? String(question.chapter).trim() : undefined;
  const rawConcept = String(question.concept ?? "").trim();
  const concept =
    rawConcept ||
    chapter ||
    (letter ? `Letter ${letter}` : "") ||
    String(question.topic ?? "").trim() ||
    fallbackConcept ||
    "General";

  const rawId = String(question.id ?? "");
  const numericId = Number.parseInt(rawId, 10);
  let id = Number.isFinite(numericId) ? numericId : index + 1;
  if (!Number.isFinite(numericId)) {
    const digitMatch = rawId.match(/\d+/);
    if (digitMatch) {
      const parsedMatch = Number.parseInt(digitMatch[0], 10);
      if (Number.isFinite(parsedMatch)) id = parsedMatch;
    }
  }

  const rawAnswer = String(question.correctAnswer ?? "").trim();
  const answer = /^[a-z]$/i.test(rawAnswer)
    ? options[correctAnswer] ?? ""
    : rawAnswer || (options[correctAnswer] ?? "");
  const questionText = String(question.question ?? "").trim();
  const questionImageMarkdown = question.questionImage
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
    quizName: question.quizName,
    source: (question as ApiQuestion & { source?: string }).source,
    quizId: (question as ApiQuestion & { quizId?: string }).quizId,
    diagram: (question as any).diagram,
    needs_diagram: (question as any).needs_diagram,
    word,
    letter,
    chapter,
    rawId,
  };
}


export function ensureUniqueQuestionIds(questions: QuizQuestionRecord[]): QuizQuestionRecord[] {
  const usedIds = new Set<number>();
  let nextId = questions.reduce((highestId, question) => Math.max(highestId, question.id), 0) + 1;

  return questions.map((question) => {
    if (question.id > 0 && !usedIds.has(question.id)) {
      usedIds.add(question.id);
      return question;
    }

    while (usedIds.has(nextId)) {
      nextId += 1;
    }

    const id = nextId;
    usedIds.add(id);
    nextId += 1;
    return { ...question, id };
  });
}
export function MathFraction({
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

export function getQuestionStatus({
  index,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
}: {
  index: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: QuizQuestion[];
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

export function statusClasses(status: QuestionStatus) {
  const base = "qstatus border transition-all duration-200";
  if (status === "current") return `${base} qstatus--current`;
  if (status === "answered") return `${base} qstatus--answered`;
  if (status === "correct") return `${base} qstatus--correct`;
  if (status === "wrong") return `${base} qstatus--wrong`;
  return `${base} qstatus--empty`;
}



export function setQuizThemeStorageKey(key: string) { QUIZ_THEME_STORAGE_KEY = key; }
export function setQuizCssClass(cls: string) { QUIZ_CSS_CLASS = cls; }
export function setFormulaModeLabel(lbl: string) { FORMULA_MODE_LABEL = lbl; MODE_LABELS.formula = lbl; }

export const prefetchQuestionImage = (url?: string) => {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
};


export function formatMathBookSolutionLines(solution: string): string[] {
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

