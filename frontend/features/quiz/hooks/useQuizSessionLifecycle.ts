"use client";
import type { useQuizFilters } from "@/components/quiz-engine/hooks/useQuizFilters";
import { useQuizResume } from "@/components/quiz-engine/hooks/useQuizResume";
import { useQuizSync } from "@/components/quiz-engine/hooks/useQuizSync";
import { useQuizTimer } from "@/components/quiz-engine/hooks/useQuizTimer";
import type { SessionResult,SubjectConfig } from "@/components/quiz-engine/types";
import { useAuth } from "@/context/AuthContext";
import { useEffect,useMemo,useRef,useState } from "react";
import { useQuizAnswerLifecycle } from "./useQuizAnswerLifecycle";
import { useQuizNavigation } from "./useQuizNavigation";

export function useQuizSessionLifecycle({ subjectConfig, title, slug, mode, routeBase, resumeRequested,
  jumpIdRaw, filters, closePalette }: {
  subjectConfig: SubjectConfig; title: string; slug: string; mode: string; routeBase?: string;
  resumeRequested: boolean; jumpIdRaw: string | null; filters: ReturnType<typeof useQuizFilters>;
  closePalette: () => void;
}) {
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);
  const { questions, hasMore, fetchMore, conceptFilter, setConceptFilter, examFilter, setExamFilter,
    selectedClassificationConcepts, setSelectedClassificationConcepts } = filters;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);
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
  const answers = useQuizAnswerLifecycle({ currentIndex, currentQ, token, timer });
  const { selectedAnswers, setSelectedAnswers, submittedQuestions, setSubmittedQuestions,
    difficulty, setDifficulty, results, setResults, setSubmitError } = answers;
  // Restore incoming session state before children render the active question.
  // Timers and page requests remain effects; state restoration is a guarded transition.
  const [initialization, setInitialization] = useState<{ kind: "resume" | "jump"; index: number; submitted: boolean } | null>(null);
  const savedIndex = resumeEntry?.currentIndex ?? 0;
  const readyResume = resumeRequested && resumeEntry && resumeEntry.status !== "completed"
    && questions.length > 0 && (savedIndex < questions.length || !hasMore);
  const targetIndex = jumpIdRaw && Number.isFinite(jumpId)
    ? questions.findIndex(question => question.id === jumpId) : -1;
  if (!initialization && (readyResume || (!resumeRequested && targetIndex >= 0))) {
    const index = readyResume ? Math.max(0, Math.min(savedIndex, questions.length - 1)) : targetIndex;
    const savedAnswers = readyResume ? resumeEntry.selectedAnswers ?? {} : selectedAnswers;
    const savedSubmitted = readyResume ? new Set(resumeEntry.submittedQuestions ?? []) : submittedQuestions;
    setInitialization({ kind: readyResume ? "resume" : "jump", index, submitted: savedSubmitted.has(index) });
    if (readyResume) {
      setSelectedAnswers(savedAnswers); setSubmittedQuestions(savedSubmitted);
      setResults(Array.isArray(resumeEntry.results) ? resumeEntry.results as SessionResult[] : []);
    }
    setShowAnalytics(false); setStarted(true); setCurrentIndex(index);
    setSubmitError(""); setIsSolutionOpen(false);
  }
  useEffect(() => {
    if (!initialization) return;
    resumeAppliedRef.current = initialization.kind === "resume";
    stopTimer();
    if (!initialization.submitted) startTimer();
  }, [initialization, startTimer, stopTimer]);
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


  const navigation = useQuizNavigation({ questions, currentIndex, setCurrentIndex, started, showAnalytics,
    setShowAnalytics, setIsSolutionOpen, hasMore, fetchMore, refreshUser, answers, timer });
  function handleRestart() {
    stopTimer(); setCurrentIndex(0); answers.resetAnswers(); closePalette();
    setIsSolutionOpen(false); setShowAnalytics(false); setStarted(false);
  }
  return { ...answers, ...navigation, ...timer, currentIndex, started, showAnalytics,
    isSolutionOpen, setIsSolutionOpen, currentQ, user, token, quizHref,
    resumeData, handleStart, handleResume, handleRestartFromPopup, handleCancelResume, handleRestart };
}
