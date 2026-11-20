import { quizCorrectIndex } from '@meow/contracts/quiz-grading';
import { type Question as ApiQuestion } from '@/features/quiz/api/questions';
import { QuizMode, Difficulty, QuizQuestionRecord, QuizQuestion } from '@/features/quiz/model/types';
import { canonicalQuestionKey } from './constants';

export const MODE_LABELS: Record<QuizMode, string> = {
  concept: "PYQ",
  formula: "CareerWill",
  mixed: "PW",
  "ai-challenge": "Selection Way",
  easy: "Topic Mix",
  hard: "Tier 2",
};

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
  // Session payloads omit the answer key; -1 means "not revealed yet" so the UI
  // never grades against a guessed option before the server responds.
  return quizCorrectIndex(question, options) ?? -1;
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
  const seenCanonicalKeys = new Set<string>();
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

  const unique: QuizQuestionRecord[] = [];
  for (const question of questions) {
    if (question.sessionPlaceholder) {
      unique.push(question);
      continue;
    }

    const canonical = canonicalQuestionKey(question);
    if (canonical) {
      if (seenCanonicalKeys.has(canonical)) {
        // Drop true duplicates instead of minting synthetic IDs that render duplicate questions.
        continue;
      }
      seenCanonicalKeys.add(canonical);
    }

    if (question.id !== undefined && question.id !== null && question.id !== '' && !usedIds.has(question.id)) {
      usedIds.add(question.id);
      unique.push(question);
      continue;
    }

    // Only assign a fallback ID when a distinct question genuinely lacks a usable ID.
    let fallbackId: string | number = getNextNumericId();
    while (usedIds.has(fallbackId)) {
      fallbackId = getNextNumericId();
    }
    usedIds.add(fallbackId);
    unique.push({ ...question, id: fallbackId });
  }
  return unique;
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
  if (!submittedQuestions.has(index) || question.sessionPlaceholder || question.correctAnswer < 0) return "answered";
  if (selected === question.correctAnswer) return "correct";
  return "wrong";
}

export function formatMathBookSolutionLines(solution: string): string[] {
  if (!solution) return [];
  return solution
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[.,;]+$/.test(line));
}

export function prefetchQuestionImage(url: string) {
  if (typeof window === "undefined" || !url) return;
  const img = new window.Image();
  img.src = url;
}


