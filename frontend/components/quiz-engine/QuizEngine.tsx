"use client";

import type { SubjectConfig } from "@/components/quiz-engine/types";

import MathRenderer from "@/components/MathRenderer";
import MathText from "@/components/MathText";
import RichContent from "@/components/RichContent";
import QuizChatbot from "@/components/QuizChatbot";
import { LangToggle } from "@/components/LangToggle";
import { useTranslatedQuestion } from "@/hooks/useTranslatedQuestion";
import ImageMCQ from "@/components/ImageMCQ";
import QuizCard, { type QuizQuestion as GeometryQuizQuestion } from "@/components/geometry/QuizCard";

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  XCircle,
  Menu,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  Search,
  Sun,
  Moon,
  Sparkles,
  Target,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/hooks/useTheme";
import { saveRecentQuiz, updateProgress, toggleBookmark } from "@/lib/userApi";
import { type Question as ApiQuestion } from "@/lib/api/questions";
import { useQuestions } from "@/hooks/useQuestions";
import { QuizMode, Difficulty, QuizQuestionRecord, ConceptColour, QuizQuestion, SessionResult, QuizTheme, ClassificationGroup } from "./types";
import { 
  setQuizThemeStorageKey, setQuizCssClass, setFormulaModeLabel,
  MODE_LABELS, setQuizTheme, initQuizTheme, useQuizTheme, toggleQuizTheme,
  normalizeMode, normalizeDifficulty, extractYear, resolveCorrectIndex, buildConceptColours,
  normalizeQuizTag, matchesQuizTag, isFormulaQuestion, isMixedQuestion, isAiChallengeQuestion,
  isTopicMixQuestion, isTier2Question, isTaggedModeQuestion, isStudyModeQuestion, toQuizQuestion, MathFraction,
  getQuestionStatus, statusClasses, formatMathBookSolutionLines, prefetchQuestionImage, ensureUniqueQuestionIds, DEFAULT_CONCEPT_COLOUR
} from "./utils";
import { QuizThemeStyles } from "./ui/QuizStyles";
import { SeriesConceptStart, SeriesFormulaStart } from "./ui/SeriesStartViews";
import { QuestionPaletteModal, QuestionPalettePanel } from "./ui/QuestionPalette";
import { QuestionNavigator, QuestionQuickBar } from "./ui/QuizNavigators";
import { ThemeToggle, ConceptBadge } from "./ui/SharedUI";
import { SolutionBottomSheet, SolutionSidePanel } from "./ui/SolutionViews";
import { QuizTimer, TimerCircle, QuizTimerRef } from "./QuizTimer";
import {
  buildQuizIndex,
  normalizeExamLabel,
  resolveIndexedQuestions,
} from "@/lib/quiz-index";



interface QuizEngineProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}




export default function QuizEngine({
  subjectConfig,
  title,
  slug,
  routeBase,
  presentation = "default",
}: QuizEngineProps) {

  // Initialize module-level variables from subjectConfig
  setQuizThemeStorageKey(`${subjectConfig.subjectId}-quiz-theme`);
  setQuizCssClass(subjectConfig.cssClassName);
  setFormulaModeLabel(subjectConfig.formulaModeLabel ?? "Pattern Practice");
  const searchParams = useSearchParams();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeRailBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeMacBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeRailBtnRef.current) {
      try {
        activeRailBtnRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } catch (e) {}
    }
    if (activeMacBtnRef.current) {
      try {
        activeMacBtnRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } catch (e) {}
    }
  }, [currentIndex]);

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isIos = presentation !== "default" ? presentation.startsWith("ios") : !isLargeScreen;
  const isMac = presentation !== "default" ? presentation.startsWith("mac") : isLargeScreen;
  const theme = useQuizTheme();

  useEffect(() => {
    if (presentation === "ios-light" || presentation === "mac-light") {
      setQuizTheme("light");
    } else if (presentation === "ios-dark" || presentation === "mac-dark") {
      setQuizTheme("dark");
    }
  }, [presentation]);
  const mode = normalizeMode(searchParams.get("mode"));
  const resumeRequested = searchParams.get("resume") === "1";
  const jumpIdRaw = searchParams.get("qid");
  const jumpId = Number.parseInt(jumpIdRaw ?? "", 10);

  const themeStyles = <QuizThemeStyles cssClassName={subjectConfig.cssClassName} />;

  const [allQuestions, setAllQuestions] = useState<QuizQuestionRecord[]>([]);
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [miniMode, setMiniMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [selectedClassificationConcepts, setSelectedClassificationConcepts] = useState<
    Set<string>
  >(() => new Set());
  const [examFilter, setExamFilter] = useState<string>("");
  const [classificationSearch, setClassificationSearch] = useState("");
  const [classificationCategory, setClassificationCategory] = useState<"All" | string>("All");
  const [openClassificationGroups, setOpenClassificationGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedClassificationGroups, setExpandedClassificationGroups] = useState<
    Record<string, boolean>
  >({});

  const baseConcepts = useMemo(() => subjectConfig.topicConcepts[slug] ?? [], [slug]);

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

  const questionIndex = useMemo(
    () =>
      buildQuizIndex(allQuestions, {
        getBucket: (question) => {
          if (isFormulaQuestion(question)) return "formula";
          if (isAiChallengeQuestion(question)) return "ai-challenge";
          if (isTier2Question(question)) return "hard";
          if (isTopicMixQuestion(question)) return "easy";
          if (isMixedQuestion(question)) return "mixed";
          return "concept";
        },
        getConcept: (question) => question.concept,
        getExam: (question) => question.exam,
        compare: (a, b) => a.id - b.id,
      }),
    [allQuestions]
  );

  const examOptions = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach((q) => {
      const exam = normalizeExamLabel((q.exam ?? "").trim());
      if (exam) set.add(exam);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allQuestions]);

  const classificationGroups = useMemo<ClassificationGroup[]>(() => {
    const search = classificationSearch.trim().toLowerCase();
    const grouped = subjectConfig.classificationCategories.map((category) => ({
      ...category,
      concepts: conceptOptions.filter((concept) => {
        if (subjectConfig.getClassificationCategoryId(concept) !== category.id) return false;
        if (classificationCategory !== "All" && classificationCategory !== category.label) {
          return false;
        }
        return !search || concept.toLowerCase().includes(search);
      }),
    })).filter((category) => category.concepts.length > 0);

    return grouped;
  }, [classificationCategory, classificationSearch, conceptOptions]);

  const isClassificationConceptMode = mode === "concept";

  const classificationCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        subjectConfig.classificationCategories.map((category) => [
          category.label,
          conceptOptions.filter(
            (concept) => subjectConfig.getClassificationCategoryId(concept) === category.id
          ).length,
        ])
      ),
    [conceptOptions]
  );

  const filteredQuestions = useMemo(() => {
    if (isClassificationConceptMode || slug === "series") {
      const selected = selectedClassificationConcepts;
      const baseQuestions = resolveIndexedQuestions(questionIndex, {
        bucket: mode,
        concept: "all",
        exam: examFilter,
      });

      if (selected.size === 0) return baseQuestions;
      return baseQuestions.filter((question) => selected.has(question.concept));
    }

    return resolveIndexedQuestions(questionIndex, {
      bucket: mode,
      concept: "all",
      exam: examFilter,
    });
  }, [
    questionIndex,
    mode,
    conceptFilter,
    examFilter,
    isClassificationConceptMode,
    selectedClassificationConcepts,
  ]);

  const availableCount = filteredQuestions.length;
  const router = useRouter();
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);

  const [started, setStarted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const timerRef = useRef<QuizTimerRef>(null);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const storageKey = `${subjectConfig.subjectId}_quiz_resume_${slug}_${mode}`;

  const { questions: apiQuestions, isLoading } = useQuestions({ subject: subjectConfig.subjectId, topic: slug });

  useEffect(() => {
    if (!apiQuestions) return;
    const fallbackConcept = baseConcepts[0] ?? "General";
    const quizOnlyQuestions = apiQuestions.filter((item) => !isStudyModeQuestion(item));
    setAllQuestions(
      ensureUniqueQuestionIds(
        quizOnlyQuestions.map((item, index) => toQuizQuestion(item, index, fallbackConcept))
      )
    );
  }, [apiQuestions, baseConcepts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();

    const addListener =
      mediaQuery.addEventListener?.bind(mediaQuery) ??
      mediaQuery.addListener?.bind(mediaQuery);
    const removeListener =
      mediaQuery.removeEventListener?.bind(mediaQuery) ??
      mediaQuery.removeListener?.bind(mediaQuery);

    addListener?.("change", update);

    return () => {
      removeListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    setConceptFilter("all");
    setSelectedClassificationConcepts(new Set());
    setExamFilter("");
  }, [slug]);

  
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const { user, token, refreshUser } = useAuth();
  const [bookmarked, setBookmarked] = useState<Set<string>>(
    new Set(user?.bookmarks ?? [])
  );
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

  const maxTime = miniMode ? 20 : 60;
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

    const nextQuestions = [...filteredQuestions];
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
  }, [allQuestions.length, filteredQuestions]);

  const stopTimer = useCallback(() => { timerRef.current?.stop(); }, []);

  const startTimer = useCallback(() => { timerRef.current?.start(maxTime); }, [maxTime]);



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
        subject: subjectConfig.subjectId,
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
      subject: subjectConfig.subjectId,
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

  useEffect(() => {
    if (typeof window === "undefined" || !started || questions.length === 0) return;
    if (submittedQuestions.size === 0) return;

    const stateToSave = {
      selectedAnswers,
      submittedQuestions: Array.from(submittedQuestions),
      currentIndex,
      mode,
      conceptFilter,
      examFilter,
      selectedClassificationConcepts: Array.from(selectedClassificationConcepts),
      difficulty,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (e) {}
  }, [
    started,
    questions.length,
    selectedAnswers,
    submittedQuestions,
    currentIndex,
    mode,
    conceptFilter,
    examFilter,
    selectedClassificationConcepts,
    difficulty,
    storageKey,
  ]);

  function handleStart() {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.submittedQuestions && parsed.submittedQuestions.length > 0) {
            setResumeData(parsed);
            return;
          }
        }
      } catch (e) {}
    }
    setStarted(true);
    startTimer();
  }

  function handleResume() {
    if (resumeData) {
      if (resumeData.selectedAnswers) setSelectedAnswers(resumeData.selectedAnswers);
      if (resumeData.submittedQuestions) setSubmittedQuestions(new Set(resumeData.submittedQuestions));
      if (resumeData.currentIndex !== undefined) setCurrentIndex(resumeData.currentIndex);
      if (resumeData.conceptFilter) setConceptFilter(resumeData.conceptFilter);
      if (resumeData.examFilter) setExamFilter(resumeData.examFilter);
      if (resumeData.selectedClassificationConcepts) setSelectedClassificationConcepts(new Set(resumeData.selectedClassificationConcepts));
      if (resumeData.difficulty) setDifficulty(resumeData.difficulty);
    }
    setResumeData(null);
    setStarted(true);
    startTimer();
  }

  function handleRestartFromPopup() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch (e) {}
    setResumeData(null);
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
    const timeTaken = Math.max(1, maxTime - (timerRef.current?.getTimeLeft() ?? 0));
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
        subject: subjectConfig.subjectId,
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
        className={`${subjectConfig.cssClassName} min-h-screen relative overflow-hidden`}
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
              href={routeBase ?? `/${subjectConfig.subjectId}/${slug}`}
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              Change Mode
            </Link>
            <Link
              href={`/${subjectConfig.subjectId}`}
              className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
            >
              All Topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isClassificationConceptStart = isClassificationConceptMode;
  const selectedConceptCount = selectedClassificationConcepts.size;
  const visibleClassificationConceptCount = classificationGroups.reduce(
    (total, category) => total + category.concepts.length,
    0
  );
  const classificationCoverage =
    selectedConceptCount === 0
      ? 100
      : Math.max(8, Math.min(100, Math.round((selectedConceptCount / conceptOptions.length) * 100)));
  const allClassificationConceptsSelected =
    selectedClassificationConcepts.size === conceptOptions.length && conceptOptions.length > 0;

  if (!started) {
    let startScreen;
    if (isClassificationConceptMode) {
      startScreen = (
        <SeriesConceptStart
          subjectConfig={subjectConfig}
          title={title}
          slug={slug}
          routeBase={routeBase}
          groups={classificationGroups}
          category={classificationCategory}
          categoryCounts={classificationCategoryCounts}
          examFilter={examFilter}
          examOptions={examOptions}
          selected={selectedClassificationConcepts}
          conceptCount={conceptOptions.length}
          questionCount={availableCount}
          onCategoryChange={setClassificationCategory}
          onExamChange={setExamFilter}
          onToggleGroup={(concepts) => {
            const allSelected = concepts.every((concept) =>
              selectedClassificationConcepts.has(concept)
            );
            setSelectedClassificationConcepts((previous) => {
              const next = new Set(previous);
              concepts.forEach((concept) => {
                if (allSelected) next.delete(concept);
                else next.add(concept);
              });
              return next;
            });
          }}
          onStart={handleStart}
        />
      );
    } else {
      startScreen = (
        <SeriesFormulaStart
          subjectConfig={subjectConfig}
          title={title}
          slug={slug}
          routeBase={routeBase}
          mode={mode}
          examFilter={examFilter}
          examOptions={examOptions}
          questionCount={availableCount}
          onExamChange={setExamFilter}
          groups={classificationGroups}
          category={classificationCategory}
          categoryCounts={classificationCategoryCounts}
          search={classificationSearch}
          selected={selectedClassificationConcepts}
          conceptCount={conceptOptions.length}
          onCategoryChange={setClassificationCategory}
          onSearchChange={setClassificationSearch}
          onToggleGroup={(concepts) => {
            const allSelected = concepts.every((concept) =>
              selectedClassificationConcepts.has(concept)
            );
            setSelectedClassificationConcepts((previous) => {
              const next = new Set(previous);
              concepts.forEach((concept) => {
                if (allSelected) next.delete(concept);
                else next.add(concept);
              });
              return next;
            });
          }}
          onStart={handleStart}
        />
      );
    }

    return (
      <>
        {startScreen}
        {resumeData && (
          <div className="ios-resume-backdrop" data-theme={theme}>
            <div className="ios-resume-modal">
              <div className="ios-resume-content">
                <h3>Resume Quiz?</h3>
                <p className="resume-question-info">
                  Resuming from Question {(resumeData.currentIndex ?? 0) + 1}
                </p>
                <div className="ios-resume-progress">
                  <div className="ios-resume-track">
                    <div 
                      className="ios-resume-bar" 
                      style={{ width: `${Math.min(100, ((resumeData.submittedQuestions?.length || 0) / availableCount) * 100)}%` }} 
                    />
                  </div>
                  <span>{resumeData.submittedQuestions?.length || 0}/{availableCount}</span>
                </div>
              </div>
              <div className="ios-resume-actions">
                <button type="button" className="ios-resume-btn blue action-resume" onClick={handleResume}>
                  Resume
                </button>
                <button type="button" className="ios-resume-btn red action-restart" onClick={handleRestartFromPopup}>
                  Restart
                </button>
                <button type="button" className="ios-resume-btn blue action-cancel" onClick={handleCancelResume}>
                  Cancel
                </button>
              </div>
            </div>
            <style jsx>{`
              .ios-resume-backdrop { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif; backdrop-filter: blur(4px); }
              .ios-resume-modal { width:100%; max-width:320px; background:#2c2c2e; border-radius:14px; overflow:hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); }
              .ios-resume-content { padding:20px 16px; text-align:center; border-bottom: 0.5px solid rgba(255,255,255,0.15); }
              .ios-resume-content h3 { margin:0 0 6px 0; color:#fff; font-size:17px; font-weight:600; }
              .resume-question-info { margin:4px 0 16px 0; color:#60a5fa; font-weight:600; font-size:15px; }
              .ios-resume-progress { display:flex; align-items:center; gap:12px; }
              .ios-resume-track { flex:1; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden; }
              .ios-resume-bar { height:100%; background:#0a84ff; border-radius:2px; }
              .ios-resume-progress span { font-size:13px; color:rgba(235,235,245,0.6); font-variant-numeric:tabular-nums; }
              .ios-resume-actions { display:flex; flex-direction:column; }
              .ios-resume-btn { width:100%; height:50px; background:transparent; border:none; border-top:0.5px solid rgba(255,255,255,0.15); font-size:17px; font-weight:400; cursor:pointer; display:flex; align-items:center; justify-content:center; }
              .ios-resume-actions .ios-resume-btn:first-child { border-top: none; }
              .ios-resume-btn.blue { color:#0a84ff; }
              .ios-resume-btn.red { color:#ff453a; }
              .action-resume { font-weight: 600; }
              .action-cancel { font-weight: 400; }
              .ios-resume-btn:active { background:rgba(255,255,255,0.1); }

              /* Light Theme Overrides */
              .ios-resume-backdrop[data-theme="light"] { background: rgba(0, 0, 0, 0.35); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-modal { background: #ffffff; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 20px 48px rgba(0,0,0,0.15); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-content { border-bottom-color: rgba(60,60,67,0.18); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-content h3 { color: #000000; }
              .ios-resume-backdrop[data-theme="light"] .resume-question-info { color: #007aff; }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-track { background: rgba(0,0,0,0.08); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-bar { background: #007aff; }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-progress span { color: rgba(60,60,67,0.6); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-btn { border-top-color: rgba(60,60,67,0.18); }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-btn.blue { color: #007aff; }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-btn.red { color: #ff3b30; }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-btn:active { background: rgba(0,0,0,0.05); }

              /* PC / Desktop optimization */
              @media (min-width: 640px) {
                .ios-resume-modal {
                  max-width: 440px;
                  border: 1px solid rgba(255,255,255,0.14);
                  border-radius: 18px;
                  box-shadow: 0 24px 48px rgba(0,0,0,0.5);
                }
                .ios-resume-actions {
                  display: grid;
                  grid-template-columns: 1fr 1fr 1fr;
                  border-top: 0.5px solid rgba(255,255,255,0.15);
                }
                .ios-resume-btn {
                  height: 48px;
                  font-size: 16px;
                  border-top: none !important;
                  border-right: 0.5px solid rgba(255,255,255,0.15);
                }
                .ios-resume-btn:last-child {
                  border-right: none;
                }
                .action-cancel { order: 1; font-weight: 500; color: rgba(235,235,245,0.7); }
                .action-restart { order: 2; font-weight: 500; }
                .action-resume { order: 3; font-weight: 600; }

                .ios-resume-backdrop[data-theme="light"] .ios-resume-actions { border-top-color: rgba(60,60,67,0.18); }
                .ios-resume-backdrop[data-theme="light"] .ios-resume-btn { border-right-color: rgba(60,60,67,0.18); }
                .ios-resume-backdrop[data-theme="light"] .action-cancel { color: rgba(60,60,67,0.65); }
              }
            `}</style>
          </div>
        )}
      </>
    );
  }

  if (!currentQ) {
    return (
      <div
        className={`${subjectConfig.cssClassName} min-h-screen relative flex items-center justify-center`}
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

  if (isMac) {
    return (
      <div className={`mac-series-quiz ${subjectConfig.cssClassName}`} data-theme={theme}>
        {themeStyles}
        <div className="mac-series-desktop">
          <div className="mac-series-window">
            <header className="mac-series-header">
              <div className="mac-series-traffic-lights">
                <div className="mac-dot mac-red"></div>
                <div className="mac-dot mac-yellow"></div>
                <div className="mac-dot mac-green"></div>
              </div>
              <div className="mac-series-title">{title} - {mode === "concept" ? "Concept Practice" : "Quiz"}</div>
              <div className="mac-series-header-right">
                <button
                  type="button"
                  className="mac-series-icon-button"
                  onClick={toggleQuizTheme}
                  aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
                >
                  {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                </button>
                <LangToggle
                  active={activeLang}
                  loading={isTranslating}
                  onChange={setActiveLang}
                />
              </div>
            </header>
            
            <div className="mac-series-body">
              <aside className="mac-series-sidebar">
                <div className="mac-sidebar-title">Questions</div>
                <div className="mac-series-palette-grid">
                  {questions.map((question, index) => {
                    const status = getQuestionStatus({
                      index,
                      currentIndex,
                      selectedAnswers,
                      questions,
                      submittedQuestions
                    });
                    return (
                      <button
                        key={`mac-palette-${question.id}-${index}`}
                        type="button"
                        ref={index === currentIndex ? activeMacBtnRef : null}
                        className={`mac-palette-btn ${status === "current" ? "is-current" : ""} ${status === "answered" || status === "correct" ? "is-answered" : ""} ${status === "wrong" ? "is-wrong" : ""}`}
                        onClick={() => goToQuestion(index + 1)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </aside>
              
              <main className="mac-series-main">
                <div className="mac-series-meta-row">
                  <ConceptBadge concept={currentQ.concept} colours={conceptColours} />
                  <span>{currentQ.exam || `${title} concept practice`}</span>
                  
                  <button
                    type="button"
                    className="mac-series-bookmark"
                    onClick={handleBookmark}
                    aria-label={bookmarked.has(String(currentQ.id)) ? "Remove bookmark" : "Add bookmark"}
                  >
                    {bookmarked.has(String(currentQ.id)) ? (
                      <BookmarkCheck aria-hidden="true" />
                    ) : (
                      <Bookmark aria-hidden="true" />
                    )}
                  </button>
                </div>

                <motion.section
                  key={currentQ.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mac-series-question-card"
                >
                  {hasQuestionText && (
                    <div className="mac-series-prompt">
                      <RichContent
                        text={displayedQuestion}
                        renderText={renderQuestionLine}
                      />
                    </div>
                  )}
                </motion.section>

                <section className="mac-series-options" aria-label="Answer options">
                  {displayedOptions.slice(0, 4).map((option, index) => {
                    const isCorrect = isCurrentSubmitted && index === currentQ.correctAnswer;
                    const isWrong =
                      isCurrentSubmitted && selectedAnswer === index && index !== currentQ.correctAnswer;
                    const isSelected = selectedAnswer === index;
                    return (
                      <button
                        key={`${currentQ.id}-${index}`}
                        type="button"
                        disabled={isCurrentSubmitted}
                        onClick={() => handleSelectAnswer(index)}
                        className={`mac-series-option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                      >
                        <span className="mac-series-option-letter">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="mac-series-option-value">
                          <RichContent text={option} />
                        </span>
                        {isCorrect && <CheckCircle2 className="mac-series-answer-icon" aria-label="Correct option" />}
                        {isWrong && <XCircle className="mac-series-answer-icon" aria-label="Incorrect option" />}
                      </button>
                    );
                  })}
                </section>

                <div className="mac-series-actions">
                  {submitError && <p className="mac-series-error">{submitError}</p>}
                  
                  <div className="mac-series-footer-buttons">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="mac-series-footer-secondary"
                    >
                      Previous
                    </button>
                    {canViewSolution && (
                      <button type="button" className="mac-series-footer-solution" onClick={openSolution}>
                        View solution
                      </button>
                    )}
                    <QuizChatbot
                      key={currentQ.id}
                      isVisible={isCurrentSubmitted}
                      questionNumber={currentIndex + 1}
                      topicTitle={title}
                      question={currentQ}
                      theme={theme}
                      renderTrigger={(onOpen) => (
                        <button type="button" className="mac-series-footer-ai" onClick={onOpen}>
                          Ask AI Tutor
                        </button>
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => (isCurrentSubmitted ? handleNext() : handleSubmitCurrent())}
                      disabled={!canSubmit && !isCurrentSubmitted}
                      className="mac-series-footer-primary"
                    >
                      {!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
                    </button>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
        <SolutionBottomSheet
          isOpen={isSolutionOpen}
          solution={currentQ.solution ?? ""}
          questionNumber={currentIndex + 1}
          correctOptionIndex={currentQ.correctAnswer}
          onClose={closeSolution}
        />
        <style jsx global>{`
          .mac-series-quiz {
            min-height: 100svh;
            background: #000;
            color: #f2f2f7;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .mac-series-desktop {
            height: 100svh;
            width: 100%;
            padding: 0;
            background: linear-gradient(135deg, #13151a, #000);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mac-series-window {
            width: 100%;
            height: 100%;
            max-width: none;
            display: flex;
            flex-direction: column;
            border-radius: 0;
            overflow: hidden;
            background: rgba(30, 30, 30, 0.85);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: none;
          }
          .mac-series-header {
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            user-select: none;
          }
          .mac-series-traffic-lights {
            display: flex;
            gap: 8px;
            width: 80px;
          }
          .mac-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }
          .mac-red { background: #ff5f56; border: 1px solid #e0443e; }
          .mac-yellow { background: #ffbd2e; border: 1px solid #dea123; }
          .mac-green { background: #27c93f; border: 1px solid #1aab29; }
          .mac-series-title {
            font-size: 14px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.8);
            text-align: center;
            flex: 1;
          }
          .mac-series-header-right {
            display: flex;
            gap: 12px;
            width: auto;
            justify-content: flex-end;
            align-items: center;
          }
          .mac-series-icon-button {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            display: grid;
            place-items: center;
            padding: 4px;
            border-radius: 6px;
          }
          .mac-series-icon-button:hover { background: rgba(255,255,255,0.1); }
          .mac-series-icon-button svg { width: 16px; height: 16px; }
          .mac-series-body {
            display: flex;
            flex: 1;
            overflow: hidden;
          }
          .mac-series-sidebar {
            width: 260px;
            background: rgba(0, 0, 0, 0.2);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            padding: 20px;
            overflow-y: auto;
          }
          .mac-sidebar-title {
            font-size: 12px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.5);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
          }
          .mac-series-palette-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .mac-palette-btn {
            height: 36px;
            border-radius: 8px;
            border: 1px solid transparent;
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.8);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .mac-palette-btn:hover { background: rgba(255, 255, 255, 0.15); }
          .mac-palette-btn.is-current { background: #007aff; color: #fff; box-shadow: 0 2px 8px rgba(0,122,255,0.4); }
          .mac-palette-btn.is-answered { border-color: rgba(40, 205, 65, 0.5); color: #34c759; }
          .mac-palette-btn.is-wrong { border-color: rgba(255, 59, 48, 0.5); color: #ff3b30; }
          
          .mac-series-main {
            flex: 1;
            padding: 32px 48px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .mac-series-meta-row {
            display: flex;
            align-items: center;
            gap: 12px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 24px;
          }
          .mac-series-quiz .concept-badge {
            border-radius: 6px;
            padding: 4px 10px;
          }
          .mac-series-bookmark {
            margin-left: auto;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
          }
          .mac-series-bookmark:hover { color: #fff; }
          .mac-series-bookmark svg { width: 18px; height: 18px; }
          
          .mac-series-prompt {
            font-size: 20px;
            font-weight: 500;
            line-height: 1.5;
            margin-bottom: 32px;
          }
          
          .mac-series-options {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: auto;
          }
          .mac-series-option {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
          }
          .mac-series-option:not(:disabled):hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }
          .mac-series-option:active { transform: scale(0.98); }
          .mac-series-option:disabled { cursor: default; }
          .mac-series-option.is-selected {
            background: rgba(0, 122, 255, 0.15);
            border-color: #007aff;
          }
          .mac-series-option.is-correct {
            background: rgba(40, 205, 65, 0.15);
            border-color: #34c759;
          }
          .mac-series-option.is-wrong {
            background: rgba(255, 59, 48, 0.15);
            border-color: #ff3b30;
          }
          .mac-series-option-letter {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            display: grid;
            place-items: center;
            font-size: 13px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.7);
          }
          .mac-series-option.is-selected .mac-series-option-letter { background: #007aff; color: #fff; }
          .mac-series-option.is-correct .mac-series-option-letter { background: #34c759; color: #fff; }
          .mac-series-option.is-wrong .mac-series-option-letter { background: #ff3b30; color: #fff; }
          .mac-series-option-value { font-size: 16px; font-weight: 500; }
          .mac-series-answer-icon { margin-left: auto; width: 20px; height: 20px; }
          .mac-series-option.is-correct .mac-series-answer-icon { color: #34c759; }
          .mac-series-option.is-wrong .mac-series-answer-icon { color: #ff3b30; }
          
          .mac-series-actions { margin-top: 40px; }
          .mac-series-error { color: #ff3b30; font-size: 13px; margin-bottom: 12px; }
          .mac-series-footer-buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }
          .mac-series-footer-buttons button {
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .mac-series-footer-buttons button:disabled { opacity: 0.5; cursor: not-allowed; }
          .mac-series-footer-secondary {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
          }
          .mac-series-footer-secondary:not(:disabled):hover { background: rgba(255, 255, 255, 0.15); }
          .mac-series-footer-solution {
            background: rgba(142, 68, 173, 0.2);
            border: 1px solid rgba(142, 68, 173, 0.5);
            color: #d2b4de;
          }
          .mac-series-footer-primary {
            background: #007aff;
            border: none;
            color: #fff;
          }
          .mac-series-footer-primary:not(:disabled):hover { background: #0062cc; }
          .mac-series-footer-ai {
            background: linear-gradient(135deg, #7c6df0, #f07c6d);
            border: none;
            color: #fff;
          }
          .mac-series-footer-ai:not(:disabled):hover { opacity: 0.9; }

          /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
          .mac-series-quiz[data-theme="light"] {
            background: #F6F8FA;
            color: #1d1d1f;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-desktop {
            background: #F6F8FA;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-window {
            background: #FFFFFF;
            border: 1px solid #E6EAEF;
            box-shadow: 0 20px 60px -10px rgba(15, 23, 42, 0.08), 0 0 0 1px #E6EAEF;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-header {
            background: #F6F8FA;
            border-bottom: 1px solid #E6EAEF;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-title { color: #1d1d1f; font-weight: 700; }
          .mac-series-quiz[data-theme="light"] .mac-series-icon-button {
            color: #57606a;
            background: #FFFFFF;
            border: 1px solid #E6EAEF;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-icon-button:hover { background: #E6EAEF; color: #1d1d1f; }
          
          .mac-series-quiz[data-theme="light"] .mac-series-sidebar {
            background: #E6EAEF;
            border-right: 1px solid #E6EAEF;
          }
          .mac-series-quiz[data-theme="light"] .mac-sidebar-title { color: #57606a; font-weight: 700; letter-spacing: 0.5px; }
          .mac-series-quiz[data-theme="light"] .mac-palette-btn {
            background: #FFFFFF;
            color: #1d1d1f;
            border: 1px solid #E6EAEF;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          }
          .mac-series-quiz[data-theme="light"] .mac-palette-btn:hover { background: #F6F8FA; border-color: #0071e3; color: #0071e3; }
          .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-current { background: #0071e3; color: #fff; border-color: #0071e3; box-shadow: 0 3px 10px rgba(0,122,255,0.35); font-weight: 700; }
          .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-answered { background: #e8f5e9; border-color: #a5d6a7; color: #2e7d32; font-weight: 700; }
          .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-wrong { background: #ffebee; border-color: #ef9a9a; color: #c62828; font-weight: 700; }

          .mac-series-quiz[data-theme="light"] .mac-series-main { background: #F6F8FA; }
          .mac-series-quiz[data-theme="light"] .mac-series-meta-row { color: #57606a; }
          .mac-series-quiz[data-theme="light"] .mac-series-bookmark { color: #57606a; }
          .mac-series-quiz[data-theme="light"] .mac-series-bookmark:hover { color: #0071e3; }
          .mac-series-quiz[data-theme="light"] .mac-series-prompt { color: #1d1d1f; }
          
          .mac-series-quiz[data-theme="light"] .mac-series-option {
            background: #FFFFFF;
            border: 1px solid #E6EAEF;
            color: #1d1d1f;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          }
          .mac-series-quiz[data-theme="light"] .mac-series-option:not(:disabled):hover {
            background: #FFFFFF;
            border-color: rgba(0, 113, 227, 0.4);
            box-shadow: 0 4px 14px rgba(0, 113, 227, 0.1);
            transform: translateY(-1px);
          }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-selected { background: #E6EAEF; border-color: #0071e3; color: #0071e3; box-shadow: 0 0 0 1.5px #0071e3, 0 4px 14px rgba(0, 113, 227, 0.14); }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-correct { background: #f0fdf4; border-color: #16a34a; color: #15803d; box-shadow: 0 0 0 1.5px #16a34a; }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-wrong { background: #fef2f2; border-color: #dc2626; color: #b91c1c; box-shadow: 0 0 0 1.5px #dc2626; }
          .mac-series-quiz[data-theme="light"] .mac-series-option-letter {
            background: #E6EAEF;
            color: #1d1d1f;
            border: 1px solid #E6EAEF;
            font-weight: 700;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-selected .mac-series-option-letter { background: #0071e3; color: #fff; border-color: #0071e3; }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-correct .mac-series-option-letter { background: #16a34a; color: #fff; border-color: #16a34a; }
          .mac-series-quiz[data-theme="light"] .mac-series-option.is-wrong .mac-series-option-letter { background: #dc2626; color: #fff; border-color: #dc2626; }

          .mac-series-quiz[data-theme="light"] .mac-series-footer-secondary {
            background: #FFFFFF;
            border: 1px solid #E6EAEF;
            color: #57606a;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          }
          .mac-series-quiz[data-theme="light"] .mac-series-footer-secondary:not(:disabled):hover { background: #E6EAEF; color: #1d1d1f; }
          .mac-series-quiz[data-theme="light"] .mac-series-footer-solution {
            background: #E6EAEF;
            border: 1px solid #E6EAEF;
            color: #0071e3;
          }
          .mac-series-quiz[data-theme="light"] .mac-series-footer-solution:not(:disabled):hover { background: #FFFFFF; border-color: #0071e3; }
          .mac-series-quiz[data-theme="light"] .mac-series-footer-primary {
            background: #0071e3;
            border: none;
            color: #FFFFFF;
            box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
          }
          .mac-series-quiz[data-theme="light"] .mac-series-footer-primary:not(:disabled):hover { background: #0077ed; }
          
          /* Responsive fixes for Mac layout */
          @media (max-width: 900px) {
            .mac-series-body { flex-direction: column; }
            .mac-series-sidebar { width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.1); height: 120px; overflow-y: auto; padding: 12px; }
            .mac-series-palette-grid { display: flex; overflow-x: auto; padding-bottom: 8px; }
            .mac-palette-btn { flex: 0 0 36px; }
            .mac-series-options { grid-template-columns: 1fr; }
            .mac-series-main { padding: 24px; }
          }
        `}</style>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className={`ios-series-quiz ${subjectConfig.cssClassName}`} data-theme={theme}>
        {themeStyles}
        <div className="ios-series-device">
          <header className="ios-series-header">
            <button
              type="button"
              className="ios-series-icon-button"
              onClick={toggleQuizTheme}
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <LangToggle
              active={activeLang}
              loading={isTranslating}
              onChange={setActiveLang}
            />
            <button
              type="button"
              className="ios-series-icon-button"
              onClick={openPalette}
              aria-label="Open question navigator"
            >
              <Menu aria-hidden="true" />
            </button>
          </header>

          <nav className="ios-series-rail" aria-label="Question navigation">
            {questions.map((question, index) => {
              const status = getQuestionStatus({
                index,
                currentIndex,
                selectedAnswers,
                questions,
                submittedQuestions
              });
              return (
                <button
                  key={`rail-${question.id}-${index}`}
                  type="button"
                  ref={index === currentIndex ? activeRailBtnRef : null}
                  onClick={() => goToQuestion(index + 1)}
                  className={`ios-series-question ${status === "current" ? "is-current" : ""} ${status === "correct" ? "is-correct" : ""} ${status === "wrong" ? "is-wrong" : ""} ${status === "answered" ? "is-unsubmitted" : ""}`}
                  aria-label={`Question ${index + 1}`}
                  aria-current={index === currentIndex ? "step" : undefined}
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>

          <main className="ios-series-content">
            <div className="ios-series-meta-row">
              <ConceptBadge concept={currentQ.concept} colours={conceptColours} />
              <span>{currentQ.exam || `${title} concept practice`}</span>
              <button
                type="button"
                className="ios-series-bookmark"
                onClick={handleBookmark}
                aria-label={bookmarked.has(String(currentQ.id)) ? "Remove bookmark" : "Add bookmark"}
              >
                {bookmarked.has(String(currentQ.id)) ? (
                  <BookmarkCheck aria-hidden="true" />
                ) : (
                  <Bookmark aria-hidden="true" />
                )}
              </button>
            </div>

            <motion.section
              key={`ios-question-${currentQ.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="ios-series-question-card"
            >
              {hasQuestionText && (
                <div className="ios-series-prompt">
                  <RichContent
                    text={displayedQuestion}
                    renderText={renderQuestionLine}
                  />
                </div>
              )}
            </motion.section>

            <section className="ios-series-options" aria-label="Answer options">
              {displayedOptions.slice(0, 4).map((option, index) => {
                const isCorrect = isCurrentSubmitted && index === currentQ.correctAnswer;
                const isWrong =
                  isCurrentSubmitted && selectedAnswer === index && index !== currentQ.correctAnswer;
                const isSelected = selectedAnswer === index;
                return (
                  <button
                    key={`${currentQ.id}-${index}`}
                    type="button"
                    disabled={isCurrentSubmitted}
                    onClick={() => handleSelectAnswer(index)}
                    className={`ios-series-option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                  >
                    <span className="ios-series-option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="ios-series-option-value">
                      <RichContent text={option} />
                    </span>
                    {isCorrect && <CheckCircle2 className="ios-series-answer-icon" aria-label="Correct option" />}
                    {isWrong && <XCircle className="ios-series-answer-icon" aria-label="Incorrect option" />}
                  </button>
                );
              })}
            </section>

            {canViewSolution && (
              <div className="ios-series-actions">
                <button type="button" className="ios-series-solution" onClick={openSolution}>
                  View solution
                </button>
                <QuizChatbot
                  key={`ios-chat-${currentQ.id}`}
                  isVisible={isCurrentSubmitted}
                  questionNumber={currentIndex + 1}
                  topicTitle={title}
                  question={currentQ}
                  theme={theme}
                  renderTrigger={(onOpen) => (
                    <button type="button" className="ios-series-ai-btn" onClick={onOpen}>
                      Ask AI Tutor
                    </button>
                  )}
                />
              </div>
            )}
            {submitError && <p className="ios-series-error">{submitError}</p>}
          </main>

          <footer className="ios-series-footer">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="ios-series-footer-secondary"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => (isCurrentSubmitted ? handleNext() : handleSubmitCurrent())}
              disabled={!canSubmit && !isCurrentSubmitted}
              className="ios-series-footer-primary"
            >
              {!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
            </button>
          </footer>

          {isPaletteOpen && (
            <div className="ios-series-palette" role="dialog" aria-modal="true" aria-label="Question navigator">
              <button type="button" className="ios-series-palette-backdrop" onClick={closePalette} aria-label="Close navigator" />
              <div className="ios-series-palette-panel">
                <div className="ios-series-palette-title">
                  <span>Questions</span>
                  <button type="button" onClick={closePalette} aria-label="Close question navigator"><X /></button>
                </div>
                <div className="ios-series-palette-grid">
                  {questions.map((question, index) => {
                    const status = getQuestionStatus({
                      index,
                      currentIndex,
                      selectedAnswers,
                      questions,
                      submittedQuestions
                    });
                    return (
                      <button
                        key={`palette-${question.id}-${index}`}
                        type="button"
                        className={`${status === "current" ? "is-current" : ""} ${status === "correct" ? "is-correct" : ""} ${status === "wrong" ? "is-wrong" : ""} ${status === "answered" ? "is-unsubmitted" : ""}`}
                        onClick={() => {
                          goToQuestion(index + 1);
                          closePalette();
                        }}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <SolutionBottomSheet
          isOpen={isSolutionOpen}
          solution={currentQ.solution ?? ""}
          questionNumber={currentIndex + 1}
          correctOptionIndex={currentQ.correctAnswer}
          onClose={closeSolution}
        />
        <style jsx global>{`
          .ios-series-quiz {
            min-height: 100svh;
            background: #000;
            color: #f2f2f7;
            font-family: "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
          }
          .ios-series-device {
            height: 100svh;
            display: flex;
            flex-direction: column;
            max-width: 430px;
            margin: 0 auto;
            background: radial-gradient(120% 50% at 50% -10%, rgba(94, 92, 230, .17), transparent 58%), #000;
          }
          .ios-series-header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:calc(env(safe-area-inset-top) + 12px) 16px 14px; border-bottom:1px solid rgba(255,255,255,.09); }
          .ios-series-icon-button { width:36px; height:36px; display:grid; place-items:center; padding:0; border:1px solid rgba(255,255,255,.09); border-radius:11px; color:#f2f2f7; background:#1c1c1e; cursor:pointer; }
          .ios-series-icon-button svg { width:17px; height:17px; }
          .ios-series-quiz .lang-toggle { flex:0 1 auto; }
          .ios-series-quiz .lang-toggle-option { min-width:0; padding-inline:9px; }
          .ios-series-rail { display:flex; gap:8px; overflow-x:auto; padding:16px; border-bottom:1px solid rgba(255,255,255,.09); scrollbar-width:none; }
          .ios-series-rail::-webkit-scrollbar { display:none; }
          .ios-series-question { flex:0 0 44px; height:44px; border:1px solid rgba(255,255,255,.14); border-radius:13px; background:#1c1c1e; color:rgba(235,235,245,.6); font-size:15px; font-weight:700; cursor:pointer; }
          .ios-series-question.is-current { border-color:transparent; color:#fff; background:#007aff; box-shadow:0 4px 14px -2px rgba(0,122,255,.55); }
          .ios-series-question.is-correct, .ios-series-question.is-answered { border-color:rgba(48,209,88,.6); background:rgba(48,209,88,.18); color:#30d158; }
          .ios-series-question.is-wrong { border-color:rgba(255,69,58,.6); background:rgba(255,69,58,.18); color:#ff453a; }
          .ios-series-question.is-unsubmitted { border-color:rgba(255,159,10,.6); background:rgba(255,159,10,.18); color:#ff9f0a; }
          .ios-series-content { flex: 1; overflow-y: auto; padding: 18px 16px 8px; }
          .ios-series-meta-row { display:flex; align-items:center; gap:9px; min-width:0; margin-bottom:16px; color:rgba(235,235,245,.42); font-size:12px; font-weight:600; }
          .ios-series-meta-row > span { flex: 1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .ios-series-quiz .concept-badge { flex:none; border-radius:8px; padding:6px 10px; letter-spacing:0; }
          .ios-series-question-card { position:relative; min-height:158px; padding:20px 20px 22px 20px; border:1px solid rgba(255,255,255,.14); border-radius:22px; background:linear-gradient(180deg,#242426,#1c1c1e); }
          .ios-series-bookmark { display:grid; place-items:center; width:32px; height:32px; border:0; border-radius:9px; color:rgba(235,235,245,.48); background:transparent; cursor:pointer; flex-shrink: 0; margin-left: auto; }
          .ios-series-bookmark svg { width:20px; height:20px; }
          .ios-series-prompt { color:#f2f2f7; font-size:16px; font-weight:500; line-height:1.48; }
          .ios-series-prompt p { margin:0; }
          .ios-series-prompt p + p { margin-top:14px; font-family:Georgia,serif; font-size:22px; font-weight:400; letter-spacing:.02em; }
          .ios-series-options { display:grid; gap:12px; margin-top:16px; }
          .ios-series-option { width:100%; min-height:64px; display:flex; align-items:center; gap:14px; padding:13px 16px; border:1px solid rgba(255,255,255,.14); border-radius:18px; background:#1c1c1e; color:#f2f2f7; text-align:left; cursor:pointer; transition:background .16s ease,border-color .16s ease,transform .16s ease; }
          .ios-series-option:not(:disabled):hover { border-color:rgba(0,122,255,.75); background:#242426; }
          .ios-series-option:not(:disabled):active { transform:scale(.99); }
          .ios-series-option:disabled { cursor:default; }
          .ios-series-option.is-selected { border-color:#007aff; background:rgba(0,122,255,.15); }
          .ios-series-option.is-correct { border-color:#30d158; background:rgba(48,209,88,.14); }
          .ios-series-option.is-wrong { border-color:#ff453a; background:rgba(255,69,58,.14); }
          .ios-series-option-letter { width:36px; height:36px; flex:0 0 36px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:#242426; color:rgba(235,235,245,.68); font-size:14px; font-weight:700; }
          .ios-series-option.is-selected .ios-series-option-letter { border-color:#007aff; background:#007aff; color:#fff; }
          .ios-series-option.is-correct .ios-series-option-letter { border-color:#30d158; background:#30d158; color:#071b0d; }
          .ios-series-option.is-wrong .ios-series-option-letter { border-color:#ff453a; background:#ff453a; color:#fff; }
          .ios-series-option-value { min-width:0; font-size:17px; font-weight:600; line-height:1.4; }
          .ios-series-answer-icon { width:20px; height:20px; margin-left:auto; flex:none; }
          .ios-series-option.is-correct .ios-series-answer-icon { color:#30d158; }
          .ios-series-option.is-wrong .ios-series-answer-icon { color:#ff6961; }
          .ios-series-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:14px; }
          .ios-series-solution { width:100%; min-width:0; min-height:46px; border:1px solid rgba(191,90,242,.4); border-radius:14px; background:transparent; color:#e5c2ff; font:inherit; font-size:14px; font-weight:700; cursor:pointer; }
          .ios-series-ai-btn { width:100%; min-width:0; min-height:46px; border:1px solid #14b8a6; border-radius:14px; background:transparent; color:#5eead4; font:inherit; font-size:14px; font-weight:700; cursor:pointer; }
          .ios-series-ai-btn:active { opacity:0.8; }
          .ios-series-error { margin:12px 2px 0; color:#ff9f9a; font-size:13px; font-weight:600; }
          .ios-series-footer { z-index:30; display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; max-width:430px; margin:0 auto; padding:14px 16px calc(env(safe-area-inset-bottom) + 14px); background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.94) 25%,#000); flex-shrink: 0; }
          .ios-series-footer button { min-width:0; height:52px; border-radius:16px; font:inherit; font-size:16px; font-weight:700; cursor:pointer; }
          .ios-series-footer button:disabled { opacity:.42; cursor:not-allowed; }
          .ios-series-footer-secondary { border:1px solid rgba(255,255,255,.14); background:#1c1c1e; color:#f2f2f7; }
          .ios-series-footer-primary { border:0; background:#007aff; color:#fff; box-shadow:0 4px 16px -4px rgba(0,122,255,0.5); }
          .ios-series-footer-primary:not(:disabled):active { transform:scale(.98); }
          .ios-series-palette { position:fixed; z-index:70; inset:0; display:flex; align-items:flex-end; justify-content:center; }
          .ios-series-palette-backdrop { position:absolute; inset:0; border:0; background:rgba(0,0,0,.64); }
          .ios-series-palette-panel { position:relative; width:min(430px,100%); max-height:75svh; display:flex; flex-direction:column; overflow:hidden; padding:0; border:1px solid rgba(255,255,255,.14); border-bottom:0; border-radius:24px 24px 0 0; background:#1c1c1e; box-shadow:0 -16px 44px rgba(0,0,0,.45); }
          .ios-series-palette-title { flex:none; display:flex; align-items:center; justify-content:space-between; padding:18px 20px 16px; border-bottom:1px solid rgba(255,255,255,.1); color:#f2f2f7; font-size:18px; font-weight:700; background:#1c1c1e; z-index:10; }
          .ios-series-palette-title button { display:grid; place-items:center; width:32px; height:32px; padding:0; border:1px solid rgba(255,255,255,.14); border-radius:50%; background:#242426; color:#f2f2f7; cursor:pointer; }
          .ios-series-palette-title svg { width:16px; height:16px; }
          .ios-series-palette-grid { flex:1; overflow-y:auto; padding:18px 20px calc(env(safe-area-inset-bottom) + 24px); display:grid; grid-template-columns:repeat(5,1fr); align-content:flex-start; gap:12px; }
          .ios-series-palette-grid button { height:43px; border:1px solid rgba(255,255,255,.14); border-radius:12px; background:#242426; color:rgba(235,235,245,.7); font:inherit; font-weight:700; transition:all 0.15s ease; }
          .ios-series-palette-grid button.is-current { border-color:transparent; background:#007aff; color:#fff; box-shadow:0 2px 8px rgba(0,122,255,0.4); }
          .ios-series-palette-grid button.is-correct, .ios-series-palette-grid button.is-answered { border-color:rgba(48,209,88,.6); background:rgba(48,209,88,.18); color:#30d158; }
          .ios-series-palette-grid button.is-wrong { border-color:rgba(255,69,58,.6); background:rgba(255,69,58,.18); color:#ff453a; }
          .ios-series-palette-grid button.is-unsubmitted { border-color:rgba(255,159,10,.6); background:rgba(255,159,10,.18); color:#ff9f0a; }
          @media (min-width:431px) { .ios-series-device { box-shadow:0 0 0 1px rgba(255,255,255,.08); } }

          /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
          .ios-series-quiz[data-theme="light"] { background: #F6F8FA; color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-device { background: #F6F8FA; }
          .ios-series-quiz[data-theme="light"] .ios-series-header { border-color: #E6EAEF; background: #F6F8FA; }
          .ios-series-quiz[data-theme="light"] .ios-series-icon-button { border-color: #E6EAEF; color: #57606a; background: #FFFFFF; }
          .ios-series-quiz[data-theme="light"] .ios-series-rail { border-color: #E6EAEF; background: #E6EAEF; }
          .ios-series-quiz[data-theme="light"] .ios-series-question { border-color: #E6EAEF; background: #FFFFFF; color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-question.is-current { color: #FFFFFF; background: #0071e3; border-color: #0071e3; box-shadow: 0 4px 14px -2px rgba(0,113,227,0.4); }
          .ios-series-quiz[data-theme="light"] .ios-series-question.is-correct, .ios-series-quiz[data-theme="light"] .ios-series-question.is-answered { border-color: #a5d6a7; background: #e8f5e9; color: #2e7d32; }
          .ios-series-quiz[data-theme="light"] .ios-series-question.is-wrong { border-color: #ef9a9a; background: #ffebee; color: #c62828; }
          .ios-series-quiz[data-theme="light"] .ios-series-question.is-unsubmitted { border-color: #ffe082; background: #fff8e1; color: #f57f17; }
          .ios-series-quiz[data-theme="light"] .ios-series-meta-row { color: #57606a; }
          .ios-series-quiz[data-theme="light"] .ios-series-question-card { border-color: #E6EAEF; background: #FFFFFF; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04); }
          .ios-series-quiz[data-theme="light"] .ios-series-bookmark { color: #57606a; }
          .ios-series-quiz[data-theme="light"] .ios-series-prompt { color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-option { border-color: #E6EAEF; background: #FFFFFF; color: #1d1d1f; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03); }
          .ios-series-quiz[data-theme="light"] .ios-series-option:not(:disabled):hover { border-color: rgba(0, 113, 227, 0.4); background: #FFFFFF; }
          .ios-series-quiz[data-theme="light"] .ios-series-option-letter { border-color: #E6EAEF; background: #E6EAEF; color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-selected { border-color: #0071e3; background: #E6EAEF; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-selected .ios-series-option-letter { color: #FFFFFF; background: #0071e3; border-color: #0071e3; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-correct { border-color: #16a34a; background: #f0fdf4; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-correct .ios-series-option-letter { color: #FFFFFF; background: #16a34a; border-color: #16a34a; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-wrong { border-color: #dc2626; background: #fef2f2; }
          .ios-series-quiz[data-theme="light"] .ios-series-option.is-wrong .ios-series-option-letter { color: #FFFFFF; background: #dc2626; border-color: #dc2626; }
          .ios-series-quiz[data-theme="light"] .ios-series-footer { background: linear-gradient(180deg, rgba(246,248,250,0), rgba(246,248,250,.96) 25%, #F6F8FA); }
          .ios-series-quiz[data-theme="light"] .ios-series-footer-secondary { border-color: #E6EAEF; background: #FFFFFF; color: #57606a; }
          .ios-series-quiz[data-theme="light"] .ios-series-footer-primary { background: #0071e3; color: #FFFFFF; border: none; box-shadow: 0 4px 16px -4px rgba(0,113,227,0.5); }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-backdrop { background: rgba(0,0,0,.4); }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-panel { border-color: #E6EAEF; background: #F6F8FA; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-title { color: #1d1d1f; border-bottom-color: #E6EAEF; background: #F6F8FA; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-title button { border-color: #E6EAEF; background: #FFFFFF; color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button { border-color: #E6EAEF; background: #FFFFFF; color: #1d1d1f; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button.is-current { color: #FFFFFF; background: #0071e3; box-shadow: 0 2px 8px rgba(0,122,255,0.4); }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button.is-correct, .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button.is-answered { border-color: #a5d6a7; background: #e8f5e9; color: #2e7d32; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button.is-wrong { border-color: #ef9a9a; background: #ffebee; color: #c62828; }
          .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button.is-unsubmitted { border-color: #ffe082; background: #fff8e1; color: #f57f17; }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={`${subjectConfig.cssClassName} min-h-screen relative overflow-x-hidden`}
      data-theme={theme}
      style={{
        background: "var(--quiz-bg)",
        color: "var(--quiz-text)",
        fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
      }}
    >
      {themeStyles}
      <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white lg:block shadow-sm">
        <div className="mx-auto flex w-full max-w-[1150px] items-center justify-between gap-4 px-6 lg:px-8 py-3">
          <div className="min-w-[240px]"></div>

          <div className="flex flex-1 items-center justify-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="nav-q-btn flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
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
              className="nav-q-btn flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
              aria-label="Next question"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-[240px] items-center justify-end gap-3">
            <LangToggle
              active={activeLang}
              loading={isTranslating}
              onChange={setActiveLang}
            />
            <QuizTimer ref={timerRef} maxTime={maxTime} />
            <ThemeToggle />
            <button className="flex h-10 items-center justify-center gap-1.5 px-3 rounded-lg transition-colors hover:bg-slate-100 text-slate-600">
              <Menu className="h-5 w-5" />
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-6 sm:pt-4 lg:max-w-[1150px] lg:px-8 lg:pb-10 flex-1">
        <div className="lg:flex lg:items-start lg:justify-center lg:gap-8 lg:pt-8 xl:gap-10">
          <div className="min-w-0 lg:max-w-[720px] lg:flex-1">
            <section className="mb-3 flex items-center justify-between gap-3 lg:hidden">
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-2">
                <LangToggle
                  active={activeLang}
                  loading={isTranslating}
                  onChange={setActiveLang}
                />
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
                className={`quiz-card rounded-2xl px-6 py-6 sm:px-8 sm:py-8 lg:pl-[72px] lg:pr-[32px] ${
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
                <div className="mb-[14px] flex items-center flex-wrap gap-2">
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

                {Boolean(currentQ.diagram || currentQ.needs_diagram) ? (
                  <div className="flex justify-center my-4">
                    <QuizCard
                      question={{
                        id: String(currentQ.id),
                        question: displayedQuestion,
                        options: displayedOptions.slice(0, 4),
                        answer: displayedOptions[currentQ.correctAnswer] ?? currentQ.answer,
                        explanation: currentQ.formula || undefined,
                        diagram: currentQ.diagram,
                        needs_diagram: currentQ.needs_diagram,
                      }}
                      selectedAnswer={
                        selectedAnswer === null
                          ? null
                          : displayedOptions[selectedAnswer] ?? null
                      }
                      submitted={isCurrentSubmitted}
                      onAnswer={(opt: string) => {
                        const optionIndex = displayedOptions.findIndex(
                          (item: string) => item === opt
                        );
                        if (optionIndex >= 0 && !isCurrentSubmitted) {
                          handleSelectAnswer(optionIndex);
                        }
                      }}
                    />
                  </div>
                ) : currentQ.questionType === "image_mcq" ? (
                  <div className="flex flex-col gap-3 my-4">
                    <ImageMCQ
                      key={currentQ.id}
                      data={currentQ as any}
                      onAnswer={(idx: number) => {
                        if (!isCurrentSubmitted) {
                          handleSelectAnswer(idx);
                        }
                      }}
                    />
                  </div>
                ) : (
                  hasQuestionText && (
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 500,
                        color: "var(--quiz-text)",
                        lineHeight: 1.75,
                        marginBottom: 28,
                        letterSpacing: 0.015,
                        fontFamily: "'Poppins', 'SF Pro Text', 'Segoe UI', sans-serif",
                        paddingLeft: "0.3cm",
                        paddingRight: "0.3cm",
                      }}
                    >
                      <RichContent
                        text={displayedQuestion}
                        className="leading-relaxed"
                        renderText={renderQuestionLine}
                      />
                    </div>
                  )
                )}
              </motion.div>
            </section>

            <section className="mb-5" style={{ marginTop: 28, display: Boolean(currentQ.diagram || currentQ.needs_diagram) || currentQ.questionType === 'image_mcq' ? 'none' : 'block' }}>
              <div
                className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible"
                style={{ paddingBottom: 96, WebkitOverflowScrolling: "touch" }}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {displayedOptions.slice(0, 4).map((opt, i) => {
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
                            e.currentTarget.style.background =
                              "var(--quiz-option-hover-bg)";
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isCurrentSubmitted && selectedAnswer !== i) {
                            e.currentTarget.style.borderColor =
                              "var(--quiz-option-border)";
                            e.currentTarget.style.background =
                              "var(--quiz-option-bg)";
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

            <div className="mt-8 hidden items-center justify-between lg:flex px-1">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex h-11 items-center justify-center gap-2 px-2 text-[15px] font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
                Previous
              </button>
              <div className="flex items-center gap-6">
                <button
                  onClick={handleClearResponse}
                  disabled={isCurrentSubmitted}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Clear Responses
                </button>
                <button
                  onClick={handleNext}
                  disabled={!isCurrentSubmitted}
                  className="inline-flex h-11 items-center justify-center gap-2 px-2 text-[15px] font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {currentIndex < questions.length - 1 ? "Next" : "Finish"}
                  {currentIndex < questions.length - 1 && (
                    <ChevronRight className="h-[18px] w-[18px]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (!isCurrentSubmitted) {
                      handleSubmitCurrent();
                    }
                  }}
                  disabled={!canSubmit}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 shadow-sm"
                >
                  <Send className="h-[18px] w-[18px]" />
                  Submit
                </button>
              </div>
            </div>
          </div>

          <aside className="hidden lg:block lg:w-[360px] lg:shrink-0">
            <div className="sticky" style={{ top: "110px" }}>
              {isSolutionOpen ? (
                <SolutionSidePanel
                  isOpen={isSolutionOpen}
                  solution={currentQ.solution ?? ""}
                  questionNumber={currentIndex + 1}
                  correctOptionIndex={currentQ.correctAnswer}
                  onClose={closeSolution}
                />
              ) : (
                <QuestionPalettePanel
                  total={questions.length}
                  currentIndex={currentIndex}
                  selectedAnswers={selectedAnswers}
                  questions={questions}
                  submittedQuestions={submittedQuestions}
                  onGoToQuestion={goToQuestion}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      {!isDesktop && (
        <SolutionBottomSheet
          isOpen={isSolutionOpen}
          solution={currentQ.solution ?? ""}
          questionNumber={currentIndex + 1}
          correctOptionIndex={currentQ.correctAnswer}
          onClose={closeSolution}
        />
      )}

      <QuizChatbot
        key={currentQ.id}
        isVisible={isCurrentSubmitted}
        questionNumber={currentIndex + 1}
        topicTitle={title}
        question={currentQ}
        theme={theme}
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
        className="sticky bottom-0 z-50 border-t backdrop-blur-md lg:hidden"
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
