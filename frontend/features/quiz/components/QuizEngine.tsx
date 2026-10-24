"use client";

import type { SubjectConfig } from "@/features/quiz/model/types";
import dynamic from "next/dynamic";

import { normalizeExamLabel } from "@/lib/quiz-index";
import { QuizThemeProvider } from "@/features/quiz/components/QuizThemeProvider";

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

export default function QuizEngine(props: QuizEngineProps) {
  const preferredTheme =
    props.presentation === "ios-light" || props.presentation === "mac-light"
      ? "light"
      : props.presentation === "ios-dark" || props.presentation === "mac-dark"
        ? "dark"
        : undefined;
  const storageKey = `${props.subjectConfig.subjectId}-quiz-theme`;

  return (
    <QuizThemeProvider
      key={storageKey}
      storageKey={storageKey}
      preferredTheme={preferredTheme}
    >
      <QuizEngineContent
        key={`${props.subjectConfig.subjectId}:${props.slug}`}
        {...props}
      />
    </QuizThemeProvider>
  );
}

import { useQuizController } from "@/features/quiz/hooks/useQuizController";
import { mobileQuizViewModel, desktopQuizViewModel } from "../model/viewModels";
const viewLoading = () => (
  <div
    role="status"
    className="min-h-dvh flex items-center justify-center"
    style={{ background: "var(--background, var(--oled-canvas, #000000))", color: "var(--text-secondary, var(--oled-secondary, #a2a9b4))" }}
  >
    Loading quiz…
  </div>
);
const QuizStartView = dynamic(() => import('./views/QuizStartView').then(module => module.QuizStartView), { loading: viewLoading });
const DesktopQuizView = dynamic(() => import('./views/DesktopQuizView').then(module => module.DesktopQuizView), { loading: viewLoading });
import { MobileQuizView } from './views/MobileQuizView';
const ResultView = dynamic(() => import('./views/ResultView').then(module => module.ResultView), { loading: viewLoading });
function QuizEngineContent(props: QuizEngineProps) {
  const controller = useQuizController(props);
  const { showAnalytics, started, currentQ, subjectConfig, theme, themeStyles, submittedQuestions, currentIndex, selectedAnswer, title, isMac, isIos, resumeRequested } = controller;
  const isDark = theme === "dark";
  const shellBackground = isDark ? "var(--oled-canvas, #000000)" : "var(--light-canvas, #f5f7fa)";
  const shellText = isDark ? "var(--oled-text, #e5eaf0)" : "var(--light-text, #182438)";
  const shellSecondary = isDark ? "var(--oled-secondary, #a2a9b4)" : "var(--light-text-secondary, #526176)";

  if (showAnalytics)
    return (
      <ResultView {...controller} />
    );

  if (!started) {
    if (resumeRequested) {
      return (
        <div
          className={`${subjectConfig.cssClassName} min-h-dvh relative flex items-center justify-center`}
          data-theme={theme}
          style={{ background: shellBackground, color: shellText }}
          role="status"
        >
          {themeStyles}
          <div className="flex flex-col items-center text-center p-6" style={{ color: shellSecondary }}>
            <h1 className="text-2xl font-bold mb-2" style={{ color: shellText }}>Resuming your session...</h1>
            <p className="max-w-sm">Please wait while we load your previous answers and configure the engine.</p>
          </div>
        </div>
      );
    }
    return (
      <QuizStartView {...controller} />
    );
  }

  if (!currentQ) {
    const isQuestionLoading = controller.isLoading || controller.isFetchingMore ||
      Boolean(controller.questions[currentIndex]?.sessionPlaceholder && !controller.submitError);
    return (
      <div
        className={`${subjectConfig.cssClassName} min-h-dvh relative flex items-center justify-center`}
        data-theme={theme}
        style={{ background: shellBackground, color: shellText }}
      >
        {themeStyles}
        <div style={{ color: shellSecondary }} role="status" aria-busy={isQuestionLoading}>
          {isQuestionLoading
            ? "Loading quiz…"
            : controller.submitError || "No questions available for this selection."}
        </div>
      </div>
    );
  }

  const isCurrentSubmitted = submittedQuestions.has(currentIndex);
  const canSubmit = selectedAnswer !== null && !isCurrentSubmitted;
  const canViewSolution = isCurrentSubmitted;
  const fullExamLabel = currentQ.exam.trim() || `${title} concept practice`;
  const examFamily = normalizeExamLabel(currentQ.exam);
  const compactExamLabel =
    [examFamily, currentQ.year]
      .filter(
        (part, index, parts) => Boolean(part) && parts.indexOf(part) === index,
      )
      .join(" ") || fullExamLabel;
  const hasDetailedExamLabel =
    Boolean(currentQ.exam.trim()) && compactExamLabel !== fullExamLabel;
  if (isMac)
    return (
      <DesktopQuizView {...desktopQuizViewModel({ ...controller, isCurrentSubmitted, canSubmit, canViewSolution })} />
    );

  if (isIos)
    return (
      <MobileQuizView {...mobileQuizViewModel({ ...controller, isCurrentSubmitted, canSubmit, canViewSolution, hasDetailedExamLabel, compactExamLabel, fullExamLabel })} />
    );

  return null;
}
