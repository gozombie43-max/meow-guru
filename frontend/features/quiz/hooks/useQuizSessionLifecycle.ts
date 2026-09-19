"use client";
import type { useQuizFilters } from "@/features/quiz/hooks/useQuizFilters";
import { useQuizResume } from "@/features/quiz/hooks/useQuizResume";
import { useQuizSync } from "@/features/quiz/hooks/useQuizSync";
import { useQuizTimer } from "@/features/quiz/hooks/useQuizTimer";
import type { SessionResult,SubjectConfig } from "@/features/quiz/model/types";
import { useAuth } from "@/context/AuthContext";
import { useCallback,useEffect,useMemo,useRef,useReducer } from "react";
import { useQuizAnswerLifecycle } from "./useQuizAnswerLifecycle";
import { initialQuizSession, quizSessionReducer } from "../model/sessionReducer";

export function useQuizSessionLifecycle({ subjectConfig, title, slug, mode, routeBase, resumeRequested,
  jumpIdRaw, filters, closePalette }: {
  subjectConfig: SubjectConfig; title: string; slug: string; mode: string; routeBase?: string;
  resumeRequested: boolean; jumpIdRaw: string | null; filters: ReturnType<typeof useQuizFilters>;
  closePalette: () => void;
}) {
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);
  const { questions, hasMore, fetchMore, conceptFilter, setConceptFilter, examFilter, setExamFilter,
    selectedClassificationConcepts, setSelectedClassificationConcepts } = filters;
  const [state, dispatch] = useReducer(quizSessionReducer, undefined, initialQuizSession);
  const { currentIndex, selectedAnswers, submittedQuestions, difficulty, results } = state;
  const started = state.phase !== 'idle';
  const showAnalytics = state.phase === 'completed';
  const isSolutionOpen = state.phase === 'solution';
  const setIsSolutionOpen = useCallback((open: boolean) => dispatch({ type: 'SOLUTION', open }), [dispatch]);
  const timer = useQuizTimer();
  const { startTimer, stopTimer } = timer;
  const storageKey = `${subjectConfig.subjectId}_quiz_resume_${slug}_${mode}`;
  const { resumeData, setResumeData, loadResume, clearResume } = useQuizResume(storageKey);

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

  const currentQ = questions[currentIndex];
  const answers = useQuizAnswerLifecycle({ currentQ, token, timer, state, dispatch });
  const initialization = state.restored;
  const savedIndex = resumeEntry?.currentIndex ?? 0;
  const readyResume = resumeRequested && resumeEntry && resumeEntry.status !== "completed"
    && questions.length > 0 && (savedIndex < questions.length || !hasMore);
  const targetIndex = jumpIdRaw && Number.isFinite(jumpId)
    ? questions.findIndex(question => question.id === jumpId) : -1;
  useEffect(() => {
    if (initialization || !(readyResume || (!resumeRequested && targetIndex >= 0))) return;
    const index = readyResume ? Math.max(0, Math.min(savedIndex, questions.length - 1)) : targetIndex;
    const savedSubmitted = readyResume ? resumeEntry.submittedQuestions ?? [] : [];
    // One atomic transition synchronizes asynchronously loaded server session data.
    dispatch({ type: 'RESTORE', snapshot: { currentIndex: index,
      selectedAnswers: readyResume ? resumeEntry.selectedAnswers ?? {} : {},
      submittedQuestions: savedSubmitted,
      results: readyResume && Array.isArray(resumeEntry.results) ? resumeEntry.results as SessionResult[] : [],
    } });
    resumeAppliedRef.current = Boolean(readyResume);
    stopTimer();
    if (!savedSubmitted.includes(index)) startTimer();
  }, [initialization, readyResume, resumeRequested, targetIndex, savedIndex, questions.length, resumeEntry, startTimer, stopTimer]);
  useEffect(() => {
    if (initialization || !hasMore || questions.length === 0) return;
    if ((resumeRequested && resumeEntry?.status !== "completed" && savedIndex >= questions.length)
      || (!resumeRequested && jumpIdRaw && Number.isFinite(jumpId) && targetIndex < 0)) void fetchMore();
  }, [initialization, hasMore, questions.length, resumeRequested, resumeEntry?.status, savedIndex, jumpIdRaw, jumpId, targetIndex, fetchMore]);

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
    dispatch({ type: 'START' });
    startTimer();
  }

  function handleResume() {
    if (resumeData) {
      dispatch({ type: 'RESTORE', snapshot: resumeData });
      if (resumeData.conceptFilter) setConceptFilter(resumeData.conceptFilter);
      if (resumeData.examFilter) setExamFilter(resumeData.examFilter);
      if (resumeData.selectedClassificationConcepts)
        setSelectedClassificationConcepts(
          new Set(resumeData.selectedClassificationConcepts),
        );
    }
    setResumeData(null);
    dispatch({ type: 'START' });
    if (!resumeData?.submittedQuestions?.includes(resumeData.currentIndex ?? 0)) startTimer();
  }

  function handleRestartFromPopup() {
    clearResume();
    dispatch({ type: 'START' });
    startTimer();
  }

  function handleCancelResume() {
    setResumeData(null);
  }


  const showQuestion = useCallback((index: number) => {
    if (!questions.length) return;
    const safeIndex = Math.max(0, Math.min(index, questions.length - 1));
    stopTimer();
    dispatch({ type: 'NAVIGATE', index: safeIndex, count: questions.length });
    if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) startTimer();
  }, [questions.length, stopTimer, started, showAnalytics, submittedQuestions, startTimer, dispatch]);
  const goToQuestion = useCallback((number: number) => showQuestion(number - 1), [showQuestion]);
  const handlePrev = useCallback(() => { if (currentIndex > 0) showQuestion(currentIndex - 1); }, [currentIndex, showQuestion]);
  function handleNext() {
    if (currentIndex < questions.length - 1) showQuestion(currentIndex + 1);
    else if (hasMore) {
      void fetchMore();
      dispatch({ type: 'ERROR', message: 'Loading the next questions. Please try Next again shortly.' });
    } else {
      stopTimer(); refreshUser(); dispatch({ type: 'FINISH' });
    }
  }
  function handleRestart() {
    stopTimer(); answers.resetAnswers(); closePalette();
  }
  const navigation = { showQuestion, goToQuestion, handlePrev, handleNext };
  return { ...answers, ...navigation, ...timer, currentIndex, started, showAnalytics,
    isSolutionOpen, setIsSolutionOpen, currentQ, user, token, quizHref,
    resumeData, handleStart, handleResume, handleRestartFromPopup, handleCancelResume, handleRestart };
}
