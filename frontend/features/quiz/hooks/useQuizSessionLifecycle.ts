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
import useSWR from 'swr';
import api from '@/shared/api/client';

export function useQuizSessionLifecycle({ subjectConfig, title, slug, mode, routeBase, resumeRequested,
  jumpIdRaw, filters, closePalette }: {
  subjectConfig: SubjectConfig; title: string; slug: string; mode: string; routeBase?: string;
  resumeRequested: boolean; jumpIdRaw: string | null; filters: ReturnType<typeof useQuizFilters>;
  closePalette: () => void;
}) {
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);
  const { questions, hasMore, fetchMore, conceptFilter, setConceptFilter, examFilter, setExamFilter,
    selectedClassificationConcepts, setSelectedClassificationConcepts, ensureQuestion } = filters;
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
  const resumeSummary = useMemo(() => {
    if (!resumeRequested) return null;
    return (
      user?.recentQuizzes?.find((entry) => entry.quizKey === quizKey) ?? null
    );
  }, [quizKey, resumeRequested, user?.recentQuizzes]);
  const { data: resumeDetail } = useSWR(resumeSummary && !resumeSummary.selectedAnswers
    ? `/users/me/recent-quizzes/${encodeURIComponent(quizKey)}` : null,
    async (url: string) => (await api.get(url)).data.quiz as NonNullable<typeof resumeSummary>,
    { revalidateOnFocus: false });
  const resumeEntry = resumeSummary?.selectedAnswers ? resumeSummary : resumeDetail;
  const resumeAppliedRef = useRef(false);

  const currentQ = questions[currentIndex]?.sessionPlaceholder ? undefined : questions[currentIndex];
  useEffect(() => {
    if (!started || !questions[currentIndex]?.sessionPlaceholder || !ensureQuestion) return;
    void ensureQuestion(currentIndex).catch(() => dispatch({ type: 'ERROR', message: 'Could not load this question. Please try again.' }));
  }, [started, currentIndex, questions, ensureQuestion]);
  useEffect(() => {
    if (started && !showAnalytics && hasMore && currentIndex >= questions.length - 3) void fetchMore();
  }, [started, showAnalytics, hasMore, currentIndex, questions.length, fetchMore]);
  const answers = useQuizAnswerLifecycle({ currentQ, token, timer, state, dispatch });
  const initialization = state.restored;
  const anchorIndex = resumeEntry?.questionAnchor ? questions.findIndex(question => question.sessionAnchor === resumeEntry.questionAnchor) : -1;
  const savedIndex = anchorIndex >= 0 ? anchorIndex : resumeEntry?.currentIndex ?? 0;
  const readyResume = resumeRequested && resumeEntry && resumeEntry.status !== "completed"
    && questions.length > 0 && (savedIndex < questions.length || !hasMore) && !questions[savedIndex]?.sessionPlaceholder;
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

  const sessionFilters = useMemo(() => ({ exam: examFilter || undefined,
    concept: Array.from(selectedClassificationConcepts).join(',') || undefined,
    letter: Array.from(filters.selectedLetters ?? []).join(',') || undefined,
  }), [examFilter, selectedClassificationConcepts, filters.selectedLetters]);
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
    sessionFilters,
  });

  function handleStart() {
    if (loadResume()) return;
    dispatch({ type: 'START' });
    startTimer();
  }

  function handleResume() {
    if (resumeData) {
      filters.setResumeWindow?.({ index: resumeData.currentIndex, anchor: resumeData.questionAnchor,
        filters: { exam: resumeData.examFilter, concept: resumeData.selectedClassificationConcepts?.join(',') } });
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
    filters.setResumeWindow?.({ index: 0 });
    clearResume();
    dispatch({ type: 'START' });
    startTimer();
  }

  function handleCancelResume() {
    setResumeData(null);
  }


  const navigationRequest = useRef(0);
  const showQuestion = useCallback((index: number) => {
    if (!questions.length) return;
    const safeIndex = Math.max(0, Math.min(index, questions.length - 1));
    const request = ++navigationRequest.current;
    const navigate = () => {
      if (request !== navigationRequest.current) return;
      stopTimer();
      dispatch({ type: 'NAVIGATE', index: safeIndex, count: questions.length });
      if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) startTimer();
    };
    if (questions[safeIndex]?.sessionPlaceholder && ensureQuestion) {
      void ensureQuestion(safeIndex).then(navigate).catch(() => dispatch({ type: 'ERROR', message: 'Could not load this question. Please try again.' }));
      return;
    }
    navigate();
  }, [questions, ensureQuestion, stopTimer, started, showAnalytics, submittedQuestions, startTimer, dispatch]);
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
