"use client";

import type { SubjectConfig } from "@/components/quiz-engine/types";

import { normalizeExamLabel } from "@/lib/quiz-index";
import { QuizThemeProvider } from "./QuizThemeProvider";
import { ThemeToggle } from "./ui/SharedUI";

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

import { useQuizController } from "./hooks/useQuizController";
import { DesktopQuizView } from "./views/DesktopQuizView";
import { MobileQuizView } from "./views/MobileQuizView";
import { QuizStartView } from "./views/QuizStartView";
import { ResultView } from "./views/ResultView";
function QuizEngineContent(props: QuizEngineProps) {
  const {
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
    isLoading,
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
  } = useQuizController(props);
  if (showAnalytics)
    return (
      <ResultView
        subjectConfig={subjectConfig}
        theme={theme}
        themeStyles={themeStyles}
        modeLabels={modeLabels}
        mode={mode}
        stats={stats}
        bestStreak={bestStreak}
        results={results}
        questions={questions}
        conceptOptions={conceptOptions}
        conceptColours={conceptColours}
        weakConcepts={weakConcepts}
        handleRestart={handleRestart}
        routeBase={routeBase}
        slug={slug}
      />
    );

  if (!started)
    return (
      <QuizStartView
        isClassificationConceptMode={isClassificationConceptMode}
        subjectConfig={subjectConfig}
        title={title}
        slug={slug}
        routeBase={routeBase}
        classificationGroups={classificationGroups}
        classificationCategory={classificationCategory}
        classificationCategoryCounts={classificationCategoryCounts}
        examFilter={examFilter}
        examOptions={examOptions}
        selectedClassificationConcepts={selectedClassificationConcepts}
        conceptOptions={conceptOptions}
        availableCount={availableCount}
        isLoading={isLoading}
        setClassificationCategory={setClassificationCategory}
        setExamFilter={setExamFilter}
        setSelectedClassificationConcepts={setSelectedClassificationConcepts}
        handleStart={handleStart}
        mode={mode}
        classificationSearch={classificationSearch}
        selectedLetters={selectedLetters}
        handleToggleLetter={handleToggleLetter}
        handleSelectAllLetters={handleSelectAllLetters}
        letterCounts={letterCounts}
        availableLetters={availableLetters}
        setClassificationSearch={setClassificationSearch}
        resumeData={resumeData}
        theme={theme}
        handleResume={handleResume}
        handleRestartFromPopup={handleRestartFromPopup}
        handleCancelResume={handleCancelResume}
      />
    );

  if (!currentQ) {
    return (
      <div
        className={`${subjectConfig.cssClassName} min-h-dvh relative flex items-center justify-center`}
        data-theme={theme}
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
      <DesktopQuizView
        subjectConfig={subjectConfig}
        theme={theme}
        themeStyles={themeStyles}
        title={title}
        modeLabels={modeLabels}
        mode={mode}
        toggleTheme={toggleTheme}
        activeLang={activeLang}
        isTranslating={isTranslating}
        setActiveLang={setActiveLang}
        questions={questions}
        currentIndex={currentIndex}
        selectedAnswers={selectedAnswers}
        submittedQuestions={submittedQuestions}
        activeMacBtnRef={activeMacBtnRef}
        goToQuestion={goToQuestion}
        currentQ={currentQ}
        conceptColours={conceptColours}
        handleBookmark={handleBookmark}
        bookmarked={bookmarked}
        hasQuestionText={hasQuestionText}
        displayedQuestion={displayedQuestion}
        renderQuestionLine={renderQuestionLine}
        displayedOptions={displayedOptions}
        isCurrentSubmitted={isCurrentSubmitted}
        selectedAnswer={selectedAnswer}
        handleSelectAnswer={handleSelectAnswer}
        submitError={submitError}
        handlePrev={handlePrev}
        canViewSolution={canViewSolution}
        openSolution={openSolution}
        handleNext={handleNext}
        handleSubmitCurrent={handleSubmitCurrent}
        canSubmit={canSubmit}
        isSolutionOpen={isSolutionOpen}
        closeSolution={closeSolution}
      />
    );

  if (isIos)
    return (
      <MobileQuizView
        subjectConfig={subjectConfig}
        theme={theme}
        themeStyles={themeStyles}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        activeLang={activeLang}
        isTranslating={isTranslating}
        setActiveLang={setActiveLang}
        currentIndex={currentIndex}
        hideQuestionNumbers={hideQuestionNumbers}
        openPalette={openPalette}
        toggleTheme={toggleTheme}
        handleToggleHideQuestionNumbers={handleToggleHideQuestionNumbers}
        hideViewSolution={hideViewSolution}
        handleToggleHideViewSolution={handleToggleHideViewSolution}
        hideAiTutor={hideAiTutor}
        handleToggleHideAiTutor={handleToggleHideAiTutor}
        handleToggleHideBoth={handleToggleHideBoth}
        questions={questions}
        selectedAnswers={selectedAnswers}
        submittedQuestions={submittedQuestions}
        activeRailBtnRef={activeRailBtnRef}
        goToQuestion={goToQuestion}
        currentQ={currentQ}
        conceptColours={conceptColours}
        hasDetailedExamLabel={hasDetailedExamLabel}
        examDetailsRef={examDetailsRef}
        compactExamLabel={compactExamLabel}
        fullExamLabel={fullExamLabel}
        handleBookmark={handleBookmark}
        bookmarked={bookmarked}
        hasQuestionText={hasQuestionText}
        displayedQuestion={displayedQuestion}
        renderQuestionLine={renderQuestionLine}
        displayedOptions={displayedOptions}
        isCurrentSubmitted={isCurrentSubmitted}
        selectedAnswer={selectedAnswer}
        handleSelectAnswer={handleSelectAnswer}
        canViewSolution={canViewSolution}
        openSolution={openSolution}
        title={title}
        submitError={submitError}
        handlePrev={handlePrev}
        handleNext={handleNext}
        handleSubmitCurrent={handleSubmitCurrent}
        canSubmit={canSubmit}
        isPaletteOpen={isPaletteOpen}
        closePalette={closePalette}
        isSolutionOpen={isSolutionOpen}
        closeSolution={closeSolution}
      />
    );

  return null;
}
