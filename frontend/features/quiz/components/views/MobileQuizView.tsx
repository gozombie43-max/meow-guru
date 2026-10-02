"use client";
import "./mobile-quiz-view.css";
import { MobileQuestionNavigator } from "@/features/quiz/components/views/MobileQuestionNavigator";
import { MobileQuizFooter, MobileQuizHeader } from "@/features/quiz/components/views/MobileQuizChrome";
import RichContent from "@/components/RichContent";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import {
  QuizSettingsModal,
} from "@/features/quiz/components/ui/QuizSettingsModal";
import { MobileQuizMetadata } from "./MobileQuizMetadata";
import dynamic from "next/dynamic";
import { useState } from "react";

const SolutionBottomSheet = dynamic(
  () => import("@/features/quiz/components/ui/SolutionViews").then(module => module.SolutionBottomSheet),
  // Keep first-submit loading inside the optional panel, not the quiz route.
  { loading: () => null },
);
import { UptimeTimer } from "@/features/quiz/components/QuizTimer";
import { CircleCheck, XCircle } from "lucide-react";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

export type MobileQuizFields = Pick<
  QuizController,
  | "routeBase"
  | "slug"
  | "subjectConfig"
  | "theme"
  | "themeStyles"
  | "isSettingsOpen"
  | "setIsSettingsOpen"
  | "activeLang"
  | "isTranslating"
  | "setActiveLang"
  | "currentIndex"
  | "hideQuestionNumbers"
  | "openPalette"
  | "availableCount"
  | "hasMore"
  | "isFetchingMore"
  | "fetchMore"
  | "toggleTheme"
  | "handleToggleHideQuestionNumbers"
  | "hideViewSolution"
  | "handleToggleHideViewSolution"
  | "hideAiTutor"
  | "handleToggleHideAiTutor"
  | "handleToggleHideBoth"
  | "textSize"
  | "handleSetTextSize"
  | "textWeight"
  | "handleSetTextWeight"
  | "spacing"
  | "handleSetSpacing"
  | "questions"
  | "selectedAnswers"
  | "submittedQuestions"
  | "activeRailBtnRef"
  | "goToQuestion"
  | "currentQ"
  | "conceptColours"
  | "examDetailsRef"
  | "hasQuestionText"
  | "displayedQuestion"
  | "renderQuestionLine"
  | "displayedOptions"
  | "selectedAnswer"
  | "handleSelectAnswer"
  | "openSolution"
  | "title"
  | "submitError"
  | "handlePrev"
  | "handleNext"
  | "handleSubmitCurrent"
  | "isPaletteOpen"
  | "closePalette"
  | "isSolutionOpen"
  | "closeSolution"
  | "timerRef"
  | "results"
> & {
  hasDetailedExamLabel: boolean;
  compactExamLabel: string;
  fullExamLabel: string;
  isCurrentSubmitted: boolean;
  canViewSolution: boolean;
  canSubmit: boolean;
  handleBookmark?: () => void;
  bookmarked?: Set<string>;
};

export interface MobileQuizViewProps {
  configuration: Pick<MobileQuizFields, "routeBase" | "slug" | "subjectConfig" | "theme" | "themeStyles" | "toggleTheme" | "title">;
  settings: Pick<MobileQuizFields, "isSettingsOpen" | "setIsSettingsOpen" | "hideQuestionNumbers" | "handleToggleHideQuestionNumbers" | "hideViewSolution" | "handleToggleHideViewSolution" | "hideAiTutor" | "handleToggleHideAiTutor" | "handleToggleHideBoth" | "textSize" | "handleSetTextSize" | "textWeight" | "handleSetTextWeight" | "spacing" | "handleSetSpacing">;
  question: Pick<MobileQuizFields, "activeLang" | "isTranslating" | "setActiveLang" | "currentQ" | "conceptColours" | "hasDetailedExamLabel" | "examDetailsRef" | "compactExamLabel" | "fullExamLabel" | "hasQuestionText" | "displayedQuestion" | "renderQuestionLine" | "displayedOptions">;
  navigation: Pick<MobileQuizFields, "availableCount" | "hasMore" | "isFetchingMore" | "fetchMore" | "currentIndex" | "openPalette" | "questions" | "selectedAnswers" | "submittedQuestions" | "activeRailBtnRef" | "goToQuestion" | "handlePrev" | "handleNext" | "isPaletteOpen" | "closePalette">;
  answer: Pick<MobileQuizFields, "isCurrentSubmitted" | "selectedAnswer" | "handleSelectAnswer" | "submitError" | "handleSubmitCurrent" | "canSubmit" | "timerRef" | "results">;
  solution: Pick<MobileQuizFields, "openSolution" | "isSolutionOpen" | "closeSolution">;
}

export function MobileQuizView({ configuration, settings, question, navigation, answer, solution }: MobileQuizViewProps) {
  const appNavigation = useAppNavigation();
  const { routeBase, slug, subjectConfig, theme, themeStyles, toggleTheme, title } = configuration;
  const { isSettingsOpen, setIsSettingsOpen, hideQuestionNumbers, handleToggleHideQuestionNumbers, hideViewSolution, handleToggleHideViewSolution, hideAiTutor, handleToggleHideAiTutor, handleToggleHideBoth, textSize, handleSetTextSize, textWeight, handleSetTextWeight, spacing, handleSetSpacing } = settings;
  const { activeLang, isTranslating, setActiveLang, currentQ, compactExamLabel, fullExamLabel, hasQuestionText, displayedQuestion, renderQuestionLine, displayedOptions } = question;
  const { currentIndex, openPalette, questions, selectedAnswers, submittedQuestions, activeRailBtnRef, goToQuestion, handlePrev, handleNext, isPaletteOpen, closePalette } = navigation;
  const { isCurrentSubmitted, selectedAnswer, handleSelectAnswer, submitError, handleSubmitCurrent, canSubmit, timerRef, results } = answer;
  const { openSolution, isSolutionOpen, closeSolution } = solution;

  // Load as soon as Solution becomes available, before the first tap. Keep it
  // mounted afterwards so dismissal can finish before focus is restored.
  const [solutionLoaded, setSolutionLoaded] = useState(false);
  if ((isCurrentSubmitted || isSolutionOpen) && !solutionLoaded) setSolutionLoaded(true);

  if (!currentQ) return null;

  return (
    <div
      className={`ios-series-quiz ${subjectConfig.cssClassName}`}
      data-theme={theme}
      data-language={activeLang}
      data-text-size={textSize}
      data-spacing={spacing}
      data-text-weight={textWeight}
    >
      {themeStyles}
      <div className="ios-series-device">
        <MobileQuizHeader
          routeBase={routeBase}
          slug={slug}
          subjectConfig={subjectConfig}
          currentIndex={currentIndex}
          questions={questions}
          hasMore={navigation.hasMore}
          availableCount={navigation.availableCount}
          hideQuestionNumbers={hideQuestionNumbers}
          openPalette={openPalette}
          activeLang={activeLang}
          isSettingsOpen={isSettingsOpen}
          isTranslating={isTranslating}
          setActiveLang={setActiveLang}
          setIsSettingsOpen={setIsSettingsOpen}
        />

        <QuizSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onLeaveQuiz={() => {
            setIsSettingsOpen(false);
            appNavigation.replace(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          hideQuestionNumbers={hideQuestionNumbers}
          onToggleHideQuestionNumbers={handleToggleHideQuestionNumbers}
          hideViewSolution={hideViewSolution}
          onToggleHideViewSolution={handleToggleHideViewSolution}
          hideAiTutor={hideAiTutor}
          onToggleHideAiTutor={handleToggleHideAiTutor}
          onToggleHideBoth={handleToggleHideBoth}
          textSize={textSize}
          onTextSizeChange={handleSetTextSize}
          spacing={spacing}
          onSpacingChange={handleSetSpacing}
          textWeight={textWeight}
          onTextWeightChange={handleSetTextWeight}
        />

        <MobileQuestionNavigator
          hasMore={navigation.hasMore}
          isFetchingMore={navigation.isFetchingMore}
          fetchMore={navigation.fetchMore}
          activeRailBtnRef={activeRailBtnRef}
          closePalette={closePalette}
          currentIndex={currentIndex}
          goToQuestion={goToQuestion}
          hideQuestionNumbers={hideQuestionNumbers}
          isPaletteOpen={isPaletteOpen}
          questions={questions}
          selectedAnswers={selectedAnswers}
          submittedQuestions={submittedQuestions}
        />

        <main className="ios-series-content">
          <div className="ios-series-meta-row">
            <MobileQuizMetadata
              key={currentQ.id}
              topic={currentQ.concept || title}
              compactExamLabel={compactExamLabel}
              fullExamLabel={fullExamLabel}
            />
            <UptimeTimer
              ref={timerRef}
              currentIndex={currentIndex}
              isSubmitted={isCurrentSubmitted}
              submittedTime={results?.find((r) => r.questionIndex === currentIndex)?.timeTaken}
            />
          </div>

          <section
            key={`ios-question-${currentQ.id}`}
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
          </section>

          <section className="ios-series-options" aria-label="Answer options">
            {displayedOptions.slice(0, 4).map((option, index) => {
              const isCorrect =
                isCurrentSubmitted && index === currentQ.correctAnswer;
              const isWrong =
                isCurrentSubmitted &&
                selectedAnswer === index &&
                index !== currentQ.correctAnswer;
              const isSelected = selectedAnswer === index;
              const isUserAnswer = isCurrentSubmitted && isSelected;
              const isDimmed = isCurrentSubmitted && !isCorrect && !isWrong;
              return (
                <button data-ui-button="state"
                  key={`${currentQ.id}-${index}`}
                  type="button"
                  disabled={isCurrentSubmitted}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectAnswer(index)}
                  className={`ios-series-option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${isUserAnswer ? "is-user-answer" : ""} ${isDimmed ? "is-dimmed" : ""}`}
                >
                  <span className="ios-series-option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="ios-series-option-value">
                    <RichContent text={option} />
                  </span>
                  <span className="ios-series-option-status">
                    {(isCorrect || isWrong) ? (
                      <>
                        {isUserAnswer && (
                          <span className="ios-series-your-answer">
                            Your answer
                          </span>
                        )}
                        {isCorrect && (
                          <CircleCheck
                            className="ios-series-answer-icon"
                            aria-label="Correct option"
                          />
                        )}
                        {isWrong && (
                          <XCircle
                            className="ios-series-answer-icon"
                            aria-label="Incorrect option"
                          />
                        )}
                        {!isCorrect && !isWrong && (
                          <span className="ios-series-option-radio is-dimmed" aria-hidden="true" />
                        )}
                      </>
                    ) : (
                      <span
                        className={`ios-series-option-radio ${isSelected ? "is-selected" : ""}`}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </section>

          {submitError && <p className="ios-series-error">{submitError}</p>}
        </main>

        <MobileQuizFooter
          canSubmit={canSubmit}
          currentIndex={currentIndex}
          handleNext={handleNext}
          handlePrev={handlePrev}
          handleSubmitCurrent={handleSubmitCurrent}
          isCurrentSubmitted={isCurrentSubmitted}
          questions={questions}
          currentQ={currentQ}
          openSolution={openSolution}
          title={title}
          theme={theme}
          activeLang={activeLang}
          hideViewSolution={hideViewSolution}
          hideAiTutor={hideAiTutor}
        />

      </div>
      {solutionLoaded && <SolutionBottomSheet
        isOpen={isSolutionOpen}
        solution={currentQ.solution ?? ""}
        questionNumber={currentIndex + 1}
        correctOptionIndex={currentQ.correctAnswer}
        correctOptionText={
          displayedOptions[currentQ.correctAnswer] ?? currentQ.answer ?? ""
        }
        onClose={closeSolution}
      />}
    </div>
  );
}
