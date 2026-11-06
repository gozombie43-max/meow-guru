import { quizCorrectIndex } from '@meow/contracts/quiz-grading';
import { type Question as ApiQuestion } from '@/features/quiz/api/questions';
import { QuizMode, Difficulty, QuizQuestionRecord, ConceptColour, QuizQuestion } from '@/features/quiz/model/types';

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
  return quizCorrectIndex(question, options) ?? 0;
}

export function buildConceptColours(concepts: string[]): Record<string, ConceptColour> {
  const colours: Record<string, ConceptColour> = {};
  concepts.forEach((concept, index) => {
    colours[concept] = CONCEPT_PALETTE[index % CONCEPT_PALETTE.length];
  });
  return colours;
}



export { isStudyModeQuestion } from "@/features/quiz/api/questions";



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
  const id = question.questionUid || rawId || (index + 1);

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
    questionUid: question.questionUid,
    sessionAnchor: question.sessionAnchor,
    sessionPlaceholder: question.sessionPlaceholder,
    questionImageWidth: question.questionImageWidth,
    questionImageHeight: question.questionImageHeight,
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
    diagram: (question as ApiQuestion & { diagram?: Record<string, unknown> }).diagram,
    needs_diagram: (question as ApiQuestion & { needs_diagram?: boolean }).needs_diagram,
    word,
    letter,
    chapter,
    translations: question.translations,
    rawId,
  };
}

export function ensureUniqueQuestionIds(questions: QuizQuestionRecord[]): QuizQuestionRecord[] {
  const usedIds = new Set<string | number>();
  let _nextNumericId: number | null = null;
  const getNextNumericId = () => {
    if (_nextNumericId === null) {
      _nextNumericId = questions.reduce((highest, q) => {
        const num = typeof q.id === 'number' ? q.id : Number.parseInt(String(q.id).match(/\d+/)?.[0] || '0', 10);
        return Number.isFinite(num) ? Math.max(highest, num) : highest;
      }, 0) + 1;
    }
    return _nextNumericId++;
  };

  return questions.map((question) => {
    if (question.id !== undefined && question.id !== null && question.id !== '' && !usedIds.has(question.id)) {
      usedIds.add(question.id);
      return question;
    }

    let fallbackId: string | number = getNextNumericId();
    while (usedIds.has(fallbackId)) {
      fallbackId = getNextNumericId();
    }
    
    usedIds.add(fallbackId);
    return { ...question, id: fallbackId };
  });
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
  if (!submittedQuestions.has(index) || question.sessionPlaceholder) return "answered";
  if (selected === question.correctAnswer) return "correct";
  return "wrong";
}

export function statusClasses(status: QuestionStatus) {
  const base = "qstatus border transition-colors duration-200";
  if (status === "current") return `${base} qstatus--current`;
  if (status === "answered") return `${base} qstatus--answered`;
  if (status === "correct") return `${base} qstatus--correct`;
  if (status === "wrong") return `${base} qstatus--wrong`;
  return `${base} qstatus--empty`;
}

export const prefetchQuestionImage = (url?: string) => {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
};



export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}



export function formatMathBookSolutionLines(solution: string): string[] {
  if (!solution) return [];
  return solution
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[.,;]+$/.test(line));
}

