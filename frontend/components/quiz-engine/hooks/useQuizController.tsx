"use client";
import { useQuizResume } from "./useQuizResume";
import MathText from "@/components/MathText";
import {
  useQuizTheme,
  useQuizThemeControls,
} from "@/components/quiz-engine/QuizThemeProvider";
import { QuizTimerRef } from "@/components/quiz-engine/QuizTimer";
import { buildSessionAnalytics } from "@/components/quiz-engine/sessionAnalytics";
import type { SubjectConfig } from "@/components/quiz-engine/types";
import {
  Difficulty,
  QuizQuestion,
  SessionResult,
} from "@/components/quiz-engine/types";
import { QuizThemeStyles } from "@/components/quiz-engine/ui/QuizStyles";
import { useQuizPreferences } from "@/components/quiz-engine/useQuizPreferences";
import {
  MODE_LABELS,
  normalizeMode,
  prefetchQuestionImage,
} from "@/components/quiz-engine/utils";
import { useAuth } from "@/context/AuthContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslatedQuestion } from "@/hooks/useTranslatedQuestion";
import { saveRecentQuiz, updateProgress } from "@/lib/userApi";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuizBookmarks } from "./useQuizBookmarks";
import { useQuizFilters } from "./useQuizFilters";
import { useQuizKeyboard } from "./useQuizKeyboard";
import { useQuizSync } from "./useQuizSync";
import { useQuizTimer } from "./useQuizTimer";

interface QuizEngineProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  questionTopic?: string;
  routeBase?: string;
  presentation?:
    | "default"
    | "ios-dark"
    | "ios-light"
    | "mac-dark"
    | "mac-light";
}

export function useQuizController({
  subjectConfig,
  title,
  slug,
  questionTopic,
  routeBase,
  presentation = "default",
}: QuizEngineProps) {
  const searchParams = useSearchParams();
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeRailBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeMacBtnRef = useRef<HTMLButtonElement | null>(null);
  const examDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (activeRailBtnRef.current) {
      try {
        activeRailBtnRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      } catch {}
    }
    if (activeMacBtnRef.current) {
      try {
        activeMacBtnRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      } catch {}
    }
  }, [currentIndex]);

  useEffect(() => {
    const dismissExamDetails = (event: PointerEvent) => {
      const details = examDetailsRef.current;
      if (!details?.open) return;

      const summary = details.querySelector("summary");
      if (event.target instanceof Node && summary?.contains(event.target))
        return;

      details.removeAttribute("open");
    };

    document.addEventListener("pointerdown", dismissExamDetails);
    return () =>
      document.removeEventListener("pointerdown", dismissExamDetails);
  }, []);

  const isLargeScreen = useMediaQuery("(min-width: 769px)");

  const isIos =
    presentation !== "default"
      ? presentation.startsWith("ios")
      : !isLargeScreen;
  const isMac =
    presentation !== "default" ? presentation.startsWith("mac") : isLargeScreen;
  const theme = useQuizTheme();
  const { toggleTheme } = useQuizThemeControls();
  const modeLabels = useMemo(
    () => ({
      ...MODE_LABELS,
      formula: subjectConfig.formulaModeLabel ?? MODE_LABELS.formula,
    }),
    [subjectConfig.formulaModeLabel],
  );
  const mode = normalizeMode(searchParams.get("mode"));
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);

  const themeStyles = (
    <QuizThemeStyles cssClassName={subjectConfig.cssClassName} />
  );

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    hideQuestionNumbers,
    hideViewSolution,
    hideAiTutor,
    toggleHideQuestionNumbers: handleToggleHideQuestionNumbers,
    toggleHideViewSolution: handleToggleHideViewSolution,
    toggleHideAiTutor: handleToggleHideAiTutor,
    toggleHideBoth: handleToggleHideBoth,
  } = useQuizPreferences();

  const {
    conceptFilter,
    setConceptFilter,
    selectedClassificationConcepts,
    setSelectedClassificationConcepts,
    examFilter,
    setExamFilter,
    classificationSearch,
    setClassificationSearch,
    classificationCategory,
    setClassificationCategory,
    hasMore,
    isFetchingMore,
    fetchMore,
    conceptOptions,
    conceptColours,
    questionIndex,
    examOptions,
    classificationGroups,
    isClassificationConceptMode,
    selectedLetters,
    availableLetters,
    letterCounts,
    handleToggleLetter,
    handleSelectAllLetters,
    classificationCategoryCounts,
    questions,
    availableCount,
  } = useQuizFilters({
    subjectConfig,
    slug,
    questionTopic,
    mode,
    initialLetterParam: searchParams.get("letter"),
  });

  useEffect(() => {
    if (hasMore && !isFetchingMore && currentIndex >= questions.length - 5) {
      fetchMore();
    }
  }, [currentIndex, questions.length, hasMore, isFetchingMore, fetchMore]);
  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { timerRef, maxTime, startTimer, stopTimer } = useQuizTimer();
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const storageKey = `${subjectConfig.subjectId}_quiz_resume_${slug}_${mode}`;
  const { resumeData, setResumeData, loadResume, clearResume } = useQuizResume(storageKey);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const { user, token, refreshUser } = useAuth();
  const quizKey = `${subjectConfig.subjectId}:${slug}`;
  const quizHref = `${routeBase ?? `/${subjectConfig.subjectId}/${slug}`}/quiz`;
  const resumeEntry = useMemo(() => {
    if (!resumeRequested) return null;
    return (
      user?.recentQuizzes?.find((entry) => entry.quizKey === quizKey) ?? null
    );
  }, [quizKey, resumeRequested, user?.recentQuizzes]);
  const resumeAppliedRef = useRef(false);
  const jumpAppliedRef = useRef(false);

  const currentQ = questions[currentIndex] as QuizQuestion | undefined;
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;
  const isImageQuestion = currentQ?.questionType === "image_mcq";
  const hasQuestionText = Boolean(currentQ?.question?.trim());
  const {
    activeLang,
    setActiveLang,
    isTranslating,
    displayedQuestion,
    displayedOptions,
  } = useTranslatedQuestion(currentQ, isImageQuestion);

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
    if (!resumeRequested || resumeAppliedRef.current) return;
    if (!resumeEntry || resumeEntry.status === "completed") return;
    if (questions.length === 0) return;
    if ((resumeEntry.currentIndex ?? 0) >= questions.length && hasMore) {
      void fetchMore();
      return;
    }

    const safeIndex = Math.max(
      0,
      Math.min(resumeEntry.currentIndex ?? 0, questions.length - 1),
    );
    const savedAnswers = resumeEntry.selectedAnswers ?? {};
    const savedSubmitted = resumeEntry.submittedQuestions ?? [];
    const submittedSet = new Set<number>(savedSubmitted);

    stopTimer();
    // Hydrate quiz progress from the explicit resume request in the URL.
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
  }, [
    questions,
    resumeEntry,
    resumeRequested,
    startTimer,
    stopTimer,
    hasMore,
    fetchMore,
  ]);

  useEffect(() => {
    if (!jumpIdRaw) return;
    if (!Number.isFinite(jumpId)) return;
    if (resumeRequested || jumpAppliedRef.current) return;
    if (questions.length === 0) return;

    const targetIndex = questions.findIndex((q) => q.id === jumpId);
    if (targetIndex < 0) {
      if (hasMore) void fetchMore();
      return;
    }

    stopTimer();
    // Apply the explicit question deep-link after API questions are available.
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
    hasMore,
    fetchMore,
    jumpId,
    jumpIdRaw,
    questions,
    resumeRequested,
    selectedAnswers,
    startTimer,
    stopTimer,
    submittedQuestions,
  ]);

  useQuizSync({
    token,
    started,
    showAnalytics,
    questions,
    quizKey,
    title,
    subjectId: subjectConfig.subjectId,
    slug,
    quizHref,
    mode,
    currentIndex,
    selectedAnswers,
    submittedQuestions,
    results,
    resumeRequested,
    resumeAppliedRef,
    storageKey,
    conceptFilter,
    examFilter,
    selectedClassificationConcepts,
    difficulty,
  });

  function handleStart() {
    if (loadResume()) return;
    setStarted(true);
    startTimer();
  }

  function handleResume() {
    if (resumeData) {
      if (resumeData.selectedAnswers)
        setSelectedAnswers(resumeData.selectedAnswers);
      if (resumeData.submittedQuestions)
        setSubmittedQuestions(new Set(resumeData.submittedQuestions));
      if (resumeData.currentIndex !== undefined)
        setCurrentIndex(resumeData.currentIndex);
      if (resumeData.conceptFilter) setConceptFilter(resumeData.conceptFilter);
      if (resumeData.examFilter) setExamFilter(resumeData.examFilter);
      if (resumeData.selectedClassificationConcepts)
        setSelectedClassificationConcepts(
          new Set(resumeData.selectedClassificationConcepts),
        );
      if (resumeData.difficulty) setDifficulty(resumeData.difficulty);
    }
    setResumeData(null);
    setStarted(true);
    startTimer();
  }

  function handleRestartFromPopup() {
    clearResume();
    setStarted(true);
    startTimer();
  }

  function handleCancelResume() {
    setResumeData(null);
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
    ],
  );

  const goToQuestion = useCallback(
    (questionNumber: number) => {
      if (questions.length === 0) return;
      const safeNumber = Math.max(
        1,
        Math.min(questionNumber, questions.length),
      );
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
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions],
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
    const timeTaken = Math.max(
      1,
      maxTime - (timerRef.current?.getTimeLeft() ?? 0),
    );
    const isCorrect = selected === currentQ.correctAnswer;
    adaptDifficulty(isCorrect);

    try {
      navigator.vibrate?.(isCorrect ? [12, 35, 18] : 20);
    } catch {}

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
        () => {},
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
        (r) => r.questionIndex === currentIndex,
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
    token,
  ]);

  const { bookmarked, handleBookmark } = useQuizBookmarks({
    currentQ,
    token,
    initialBookmarks: user?.bookmarks,
    meta: {
      quizKey,
      title,
      subject: subjectConfig.subjectId,
      slug,
      href: quizHref,
      mode,
      questionIndex: currentIndex,
    },
  });

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
    } else if (hasMore) {
      void fetchMore();
      setSubmitError(
        "Loading the next questions. Please try Next again shortly.",
      );
    } else {
      stopTimer();
      refreshUser();
      setIsSolutionOpen(false);
      setShowAnalytics(true);
    }
  }

  function handleRestart() {
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

  useQuizKeyboard({
    enabled: started && !showAnalytics,
    currentIndex,
    currentQ,
    selectedAnswer,
    handleSelectAnswer,
    showQuestion,
  });

  const { stats, weakConcepts } = useMemo(
    () => buildSessionAnalytics(results),
    [results],
  );

  return {
    showAnalytics,
    subjectConfig,
    theme,
    themeStyles,
    modeLabels,
    mode,
    stats,
    bestStreak,
    results,
    questions,
    conceptOptions,
    conceptColours,
    weakConcepts,
    handleRestart,
    routeBase,
    slug,
    started,
    isClassificationConceptMode,
    title,
    classificationGroups,
    classificationCategory,
    classificationCategoryCounts,
    examFilter,
    examOptions,
    selectedClassificationConcepts,
    availableCount,
    setClassificationCategory,
    setExamFilter,
    setSelectedClassificationConcepts,
    handleStart,
    classificationSearch,
    selectedLetters,
    handleToggleLetter,
    handleSelectAllLetters,
    letterCounts,
    availableLetters,
    setClassificationSearch,
    resumeData,
    handleResume,
    handleRestartFromPopup,
    handleCancelResume,
    currentQ,
    submittedQuestions,
    currentIndex,
    selectedAnswer,
    isMac,
    toggleTheme,
    activeLang,
    isTranslating,
    setActiveLang,
    selectedAnswers,
    activeMacBtnRef,
    goToQuestion,
    handleBookmark,
    bookmarked,
    hasQuestionText,
    displayedQuestion,
    renderQuestionLine,
    displayedOptions,
    handleSelectAnswer,
    submitError,
    handlePrev,
    openSolution,
    handleNext,
    handleSubmitCurrent,
    isSolutionOpen,
    closeSolution,
    isIos,
    isSettingsOpen,
    setIsSettingsOpen,
    hideQuestionNumbers,
    openPalette,
    handleToggleHideQuestionNumbers,
    hideViewSolution,
    handleToggleHideViewSolution,
    hideAiTutor,
    handleToggleHideAiTutor,
    handleToggleHideBoth,
    activeRailBtnRef,
    examDetailsRef,
    isPaletteOpen,
    closePalette,
    timerRef,
    maxTime,
    touchStartXRef,
    touchStartYRef,
    showQuestion,
    isLongQuestion,
    handleClearResponse,
    isDesktop,
  };
}
export type QuizController = ReturnType<typeof useQuizController>;
