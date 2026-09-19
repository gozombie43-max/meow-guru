"use client";
import { useQuizLeaveGuard } from "@/hooks/useAppNavigation";
import { buildSessionAnalytics } from "@/features/quiz/model/sessionAnalytics";
import type { SubjectConfig } from "@/features/quiz/model/types";
import {
  normalizeMode,
  prefetchQuestionImage,
} from "@/features/quiz/model/utils";
import { useTranslatedQuestion } from "@/hooks/useTranslatedQuestion";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useQuizBookmarks } from "@/features/quiz/hooks/useQuizBookmarks";
import { useQuizFilters } from "@/features/quiz/hooks/useQuizFilters";
import { useQuizPresentation } from "@/features/quiz/hooks/useQuizPresentation";
import { useQuizSessionLifecycle } from "@/features/quiz/hooks/useQuizSessionLifecycle";
import { useQuizKeyboard } from "@/features/quiz/hooks/useQuizKeyboard";

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
  const { activeRailBtnRef, activeMacBtnRef, examDetailsRef, isIos, isMac, theme, toggleTheme,
    modeLabels, themeStyles, isPaletteOpen, isSettingsOpen, setIsSettingsOpen,
    hideQuestionNumbers, hideViewSolution, hideAiTutor, textSize, spacing,
    handleToggleHideQuestionNumbers, handleToggleHideViewSolution, handleToggleHideAiTutor,
    handleToggleHideBoth, handleSetTextSize, handleSetSpacing, openPalette, closePalette,
    isDesktop, touchStartXRef, touchStartYRef, scrollActiveQuestion, renderQuestionLine } = useQuizPresentation(subjectConfig, presentation);
  const mode = normalizeMode(searchParams.get("mode"));
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");

  const filters = useQuizFilters({ subjectConfig, slug, questionTopic, mode, initialLetterParam: searchParams.get("letter") });
  const {
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
    examOptions,
    classificationGroups,
    groupingStatus,
    isClassificationConceptMode,
    selectedLetters,
    availableLetters,
    letterCounts,
    handleToggleLetter,
    handleSelectAllLetters,
    classificationCategoryCounts,
    questions,
    availableCount,
    isLoading,
  } = filters;

  const { currentIndex, started, showAnalytics, isSolutionOpen, setIsSolutionOpen, currentQ,
    user, token, quizHref, resumeData, handleStart, handleResume, handleRestartFromPopup,
    handleCancelResume, handleRestart, selectedAnswers, submittedQuestions, selectedAnswer,
    bestStreak, results, submitError, handleSelectAnswer, handleSubmitCurrent, handleClearResponse,
    showQuestion, goToQuestion, handlePrev, handleNext, timerRef, maxTime } = useQuizSessionLifecycle({
      subjectConfig, title, slug, mode, routeBase, resumeRequested, jumpIdRaw, filters, closePalette,
    });
  const quizKey = `${subjectConfig.subjectId}:${slug}`;
  useQuizLeaveGuard(started && !showAnalytics, routeBase ?? `/${subjectConfig.subjectId}/${slug}`);

  useEffect(() => { scrollActiveQuestion(); }, [currentIndex, scrollActiveQuestion]);

  useEffect(() => {
    if (hasMore && !isFetchingMore && currentIndex >= questions.length - 5) {
      fetchMore();
    }
  }, [currentIndex, questions.length, hasMore, isFetchingMore, fetchMore]);
  const isLongQuestion = (currentQ?.question?.length ?? 0) > 180;
  const isImageQuestion = currentQ?.questionType === "image_mcq";
  const hasQuestionText = Boolean(currentQ?.question?.trim());
  const {
    activeLang,
    setActiveLang,
    isTranslating,
    displayedQuestion,
    displayedOptions,
  } = useTranslatedQuestion(currentQ, isImageQuestion, questions.slice(currentIndex + 1, currentIndex + 4), `${subjectConfig.subjectId} ${slug}`);

  useEffect(() => {
    const next = questions[currentIndex + 1];
    if (next?.questionImage) {
      prefetchQuestionImage(next.questionImage);
    }
  }, [currentIndex, questions]);

  const openSolution = useCallback(() => setIsSolutionOpen(true), [setIsSolutionOpen]);
  const closeSolution = useCallback(() => setIsSolutionOpen(false), [setIsSolutionOpen]);

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
    groupingStatus,
    classificationCategory,
    classificationCategoryCounts,
    examFilter,
    setExamFilter,
    examOptions,
    selectedClassificationConcepts,
    availableCount,
    isLoading,
    setClassificationCategory,
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
    textSize,
    handleSetTextSize,
    spacing,
    handleSetSpacing,
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
