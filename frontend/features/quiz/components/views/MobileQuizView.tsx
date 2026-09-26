"use client";
import "./mobile-quiz-view.css";
import { MobileQuestionNavigator } from "@/features/quiz/components/views/MobileQuestionNavigator";
import { MobileQuizFooter, MobileQuizHeader } from "@/features/quiz/components/views/MobileQuizChrome";
import RichContent from "@/components/RichContent";
import {
  OptionTickIcon,
  QuizSettingsModal,
} from "@/features/quiz/components/ui/QuizSettingsModal";
import { ConceptBadge } from "@/features/quiz/components/ui/SharedUI";
import dynamic from "next/dynamic";
import { useState } from "react";

const SolutionBottomSheet = dynamic(() => import("@/features/quiz/components/ui/SolutionViews").then(module => module.SolutionBottomSheet));
import { UptimeTimer } from "@/features/quiz/components/QuizTimer";
import transitionStyles from "./question-transition.module.css";
import { XCircle } from "lucide-react";
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
  | "toggleTheme"
  | "handleToggleHideQuestionNumbers"
  | "hideViewSolution"
  | "handleToggleHideViewSolution"
  | "hideAiTutor"
  | "handleToggleHideAiTutor"
  | "handleToggleHideBoth"
  | "textSize"
  | "handleSetTextSize"
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
  settings: Pick<MobileQuizFields, "isSettingsOpen" | "setIsSettingsOpen" | "hideQuestionNumbers" | "handleToggleHideQuestionNumbers" | "hideViewSolution" | "handleToggleHideViewSolution" | "hideAiTutor" | "handleToggleHideAiTutor" | "handleToggleHideBoth" | "textSize" | "handleSetTextSize" | "spacing" | "handleSetSpacing">;
  question: Pick<MobileQuizFields, "activeLang" | "isTranslating" | "setActiveLang" | "currentQ" | "conceptColours" | "hasDetailedExamLabel" | "examDetailsRef" | "compactExamLabel" | "fullExamLabel" | "hasQuestionText" | "displayedQuestion" | "renderQuestionLine" | "displayedOptions">;
  navigation: Pick<MobileQuizFields, "currentIndex" | "openPalette" | "questions" | "selectedAnswers" | "submittedQuestions" | "activeRailBtnRef" | "goToQuestion" | "handlePrev" | "handleNext" | "isPaletteOpen" | "closePalette">;
  answer: Pick<MobileQuizFields, "isCurrentSubmitted" | "selectedAnswer" | "handleSelectAnswer" | "submitError" | "handleSubmitCurrent" | "canSubmit" | "timerRef" | "results">;
  solution: Pick<MobileQuizFields, "openSolution" | "isSolutionOpen" | "closeSolution">;
}

export function MobileQuizView({ configuration, settings, question, navigation, answer, solution }: MobileQuizViewProps) {
  const { routeBase, slug, subjectConfig, theme, themeStyles, toggleTheme, title } = configuration;
  const { isSettingsOpen, setIsSettingsOpen, hideQuestionNumbers, handleToggleHideQuestionNumbers, hideViewSolution, handleToggleHideViewSolution, hideAiTutor, handleToggleHideAiTutor, handleToggleHideBoth, textSize, handleSetTextSize, spacing, handleSetSpacing } = settings;
  const { activeLang, isTranslating, setActiveLang, currentQ, conceptColours, hasDetailedExamLabel, examDetailsRef, compactExamLabel, fullExamLabel, hasQuestionText, displayedQuestion, renderQuestionLine, displayedOptions } = question;
  const { currentIndex, openPalette, questions, selectedAnswers, submittedQuestions, activeRailBtnRef, goToQuestion, handlePrev, handleNext, isPaletteOpen, closePalette } = navigation;
  const { isCurrentSubmitted, selectedAnswer, handleSelectAnswer, submitError, handleSubmitCurrent, canSubmit, timerRef, results } = answer;
  const { openSolution, isSolutionOpen, closeSolution } = solution;

  // Keep the sheet mounted after first use so its close animation and focus
  // restoration still run, without loading it before the learner opens it.
  const [solutionLoaded, setSolutionLoaded] = useState(false);
  if (isSolutionOpen && !solutionLoaded) setSolutionLoaded(true);

  if (!currentQ) return null;

  return (
    <div
      className={`ios-series-quiz ${subjectConfig.cssClassName}`}
      data-theme={theme}
      data-text-size={textSize}
      data-spacing={spacing}
    >
      {themeStyles}
      <div className="ios-series-device">
        <MobileQuizHeader
          routeBase={routeBase}
          slug={slug}
          subjectConfig={subjectConfig}
          currentIndex={currentIndex}
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
        />

        <MobileQuestionNavigator
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
            <div className="ios-series-meta-items">
              <ConceptBadge
                concept={currentQ.concept}
                colours={conceptColours}
              />
              <span className="ios-series-meta-separator" aria-hidden="true">
                ·
              </span>
              {hasDetailedExamLabel ? (
                <details
                  className="ios-series-exam-details"
                  key={currentQ.id}
                  ref={examDetailsRef}
                >
                  <summary
                    aria-label={`${compactExamLabel}. Tap for full exam details`}
                  >
                    {compactExamLabel}
                  </summary>
                  <div className="ios-series-exam-popover" role="note">
                    {fullExamLabel}
                  </div>
                </details>
              ) : (
                <span className="ios-series-exam-label">
                  {compactExamLabel}
                </span>
              )}
            </div>
            <UptimeTimer
              ref={timerRef}
              currentIndex={currentIndex}
              isSubmitted={isCurrentSubmitted}
              submittedTime={results?.find((r) => r.questionIndex === currentIndex)?.timeTaken}
            />
          </div>

          <section
            key={`ios-question-${currentQ.id}`}
            className={`ios-series-question-card ${transitionStyles.mobile}`}
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
                    {isCurrentSubmitted ? (
                      <>
                        {isUserAnswer && (
                          <span className="ios-series-your-answer">
                            Your answer
                          </span>
                        )}
                        {isCorrect && (
                          <OptionTickIcon
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
