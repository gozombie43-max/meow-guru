"use client";
import "./DesktopQuizView.css";
import "./custom-text-size.css";
import type { CSSProperties } from "react";
import BackButton from "@/components/BackButton";
import { LangToggle } from "@/components/LangToggle";
import RichContent from "@/components/RichContent";
import { OptionTickIcon, QuizSettingsModal } from "@/features/quiz/components/ui/QuizSettingsModal";
import { ConceptBadge } from "@/features/quiz/components/ui/SharedUI";
import { SolutionBottomSheet } from "@/features/quiz/components/ui/SolutionViews";
import { getQuestionStatus } from "@/features/quiz/model/utils";
import transitionStyles from "./question-transition.module.css";
import { Bookmark, BookmarkCheck, Moon, Settings, Sun, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
const QuizChatbot = dynamic(() => import("@/components/QuizChatbot"), {
  ssr: false,
});
export type DesktopQuizFields = Pick<
  QuizController,
  | "routeBase"
  | "slug"
  | "subjectConfig"
  | "theme"
  | "themeStyles"
  | "title"
  | "modeLabels"
  | "mode"
  | "toggleTheme"
  | "activeLang"
  | "isTranslating"
  | "setActiveLang"
  | "questions"
  | "currentIndex"
  | "selectedAnswers"
  | "submittedQuestions"
  | "activeMacBtnRef"
  | "goToQuestion"
  | "currentQ"
  | "conceptColours"
  | "handleBookmark"
  | "bookmarked"
  | "hasQuestionText"
  | "displayedQuestion"
  | "renderQuestionLine"
  | "displayedOptions"
  | "displayedSolution"
  | "selectedAnswer"
  | "handleSelectAnswer"
  | "submitError"
  | "handlePrev"
  | "openSolution"
  | "handleNext"
  | "handleSubmitCurrent"
  | "isSolutionOpen"
  | "closeSolution"
  | "isSettingsOpen"
  | "setIsSettingsOpen"
  | "hideQuestionNumbers"
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
> & {
  isCurrentSubmitted: boolean;
  canViewSolution: boolean;
  canSubmit: boolean;
};
export interface DesktopQuizViewProps {
  configuration: Pick<DesktopQuizFields, "routeBase" | "slug" | "subjectConfig" | "theme" | "themeStyles" | "title" | "modeLabels" | "mode" | "toggleTheme">;
  question: Pick<DesktopQuizFields, "activeLang" | "isTranslating" | "setActiveLang" | "currentQ" | "conceptColours" | "handleBookmark" | "bookmarked" | "hasQuestionText" | "displayedQuestion" | "renderQuestionLine" | "displayedOptions" | "displayedSolution">;
  navigation: Pick<DesktopQuizFields, "questions" | "currentIndex" | "selectedAnswers" | "submittedQuestions" | "activeMacBtnRef" | "goToQuestion" | "handlePrev" | "handleNext">;
  answer: Pick<DesktopQuizFields, "isCurrentSubmitted" | "selectedAnswer" | "handleSelectAnswer" | "submitError" | "canViewSolution" | "handleSubmitCurrent" | "canSubmit">;
  solution: Pick<DesktopQuizFields, "openSolution" | "isSolutionOpen" | "closeSolution">;
  settings: Pick<DesktopQuizFields, "isSettingsOpen" | "setIsSettingsOpen" | "hideQuestionNumbers" | "handleToggleHideQuestionNumbers" | "hideViewSolution" | "handleToggleHideViewSolution" | "hideAiTutor" | "handleToggleHideAiTutor" | "handleToggleHideBoth" | "textSize" | "handleSetTextSize" | "textWeight" | "handleSetTextWeight" | "spacing" | "handleSetSpacing">;
}
export function DesktopQuizView({ configuration, question, navigation, answer, solution, settings }: DesktopQuizViewProps) {
  "use no memo"; // Virtualizer methods read mutable scroll state.
  const { routeBase, slug, subjectConfig, theme, themeStyles, title, modeLabels, mode, toggleTheme } = configuration;
  const { activeLang, isTranslating, setActiveLang, currentQ, conceptColours, handleBookmark, bookmarked, hasQuestionText, displayedQuestion, renderQuestionLine, displayedOptions, displayedSolution } = question;
  const { questions, currentIndex, selectedAnswers, submittedQuestions, activeMacBtnRef, goToQuestion, handlePrev, handleNext } = navigation;
  const { isCurrentSubmitted, selectedAnswer, handleSelectAnswer, submitError, canViewSolution, handleSubmitCurrent, canSubmit } = answer;
  const { openSolution, isSolutionOpen, closeSolution } = solution;
  const { isSettingsOpen, setIsSettingsOpen, hideQuestionNumbers, handleToggleHideQuestionNumbers, hideViewSolution, handleToggleHideViewSolution, hideAiTutor, handleToggleHideAiTutor, handleToggleHideBoth, textSize, handleSetTextSize, textWeight, handleSetTextWeight, spacing, handleSetSpacing } = settings;
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const large = questions.length > 100;
  // eslint-disable-next-line react-hooks/incompatible-library -- This component opts out above and retains the instance locally.
  const palette = useVirtualizer({ count: Math.ceil(questions.length / 4), getScrollElement: () => paletteRef.current, estimateSize: () => 52, overscan: 3, enabled: large, initialRect: { width: 220, height: 600 } });
  useEffect(() => { if (large) palette.scrollToIndex(Math.floor(currentIndex / 4), { align: 'auto' }); }, [large, currentIndex, palette]);

  if (!currentQ) return null;

  return (
    <div
      className={`mac-series-quiz ${subjectConfig.cssClassName}`}
      data-theme={theme}
      data-text-size={textSize}
      data-custom-text-size={typeof textSize === "number" ? "true" : undefined}
      style={typeof textSize === "number" ? { "--quiz-custom-text-size": `${textSize}px` } as CSSProperties : undefined}
      data-spacing={spacing}
      data-text-weight={textWeight}
    >
      {themeStyles}
      <div className="mac-series-desktop">
        <div className="mac-series-window">
          <header data-ui-chrome="header" className="mac-series-header">
            <BackButton href={routeBase ?? `/${subjectConfig.subjectId}/${slug}`} label="Leave quiz" />
            <div className="mac-series-title">
              {title} - {modeLabels[mode] || "Quiz"}
            </div>
            <div className="mac-series-header-right">
              {setIsSettingsOpen && (
                <button data-ui-button="icon"
                  type="button"
                  className={`mac-series-icon-button ${isSettingsOpen ? "is-active" : ""}`}
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  aria-label="Quiz settings"
                >
                  <Settings aria-hidden="true" />
                </button>
              )}
              <button data-ui-button="icon"
                type="button"
                className="mac-series-icon-button"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark" ? "Use light theme" : "Use dark theme"
                }
              >
                {theme === "dark" ? (
                  <Sun aria-hidden="true" />
                ) : (
                  <Moon aria-hidden="true" />
                )}
              </button>
              <LangToggle
                active={activeLang}
                loading={isTranslating}
                onChange={setActiveLang}
              />
            </div>
          </header>

          {setIsSettingsOpen && (
            <QuizSettingsModal
              isOpen={Boolean(isSettingsOpen)}
              onClose={() => setIsSettingsOpen(false)}
              theme={theme}
              onToggleTheme={toggleTheme}
              hideQuestionNumbers={Boolean(hideQuestionNumbers)}
              onToggleHideQuestionNumbers={handleToggleHideQuestionNumbers ?? (() => {})}
              hideViewSolution={Boolean(hideViewSolution)}
              onToggleHideViewSolution={handleToggleHideViewSolution ?? (() => {})}
              hideAiTutor={Boolean(hideAiTutor)}
              onToggleHideAiTutor={handleToggleHideAiTutor ?? (() => {})}
              onToggleHideBoth={handleToggleHideBoth ?? (() => {})}
              textSize={textSize}
              onTextSizeChange={handleSetTextSize}
              spacing={spacing}
              onSpacingChange={handleSetSpacing}
          textWeight={textWeight}
          onTextWeightChange={handleSetTextWeight}
            />
          )}

          <div className="mac-series-body">
            <aside className="mac-series-sidebar">
              <div className="mac-sidebar-title">
                <span>Questions</span>
              </div>
              <div ref={paletteRef} className="mac-series-palette-grid-wrap">
                <div className="mac-series-palette-grid" style={large ? { display: 'block', position: 'relative', height: palette.getTotalSize() } : undefined}>
                  {(large ? palette.getVirtualItems().flatMap(row => questions.slice(row.index * 4, row.index * 4 + 4).map((question, column) => ({ question, index: row.index * 4 + column, start: row.start, column }))) : questions.map((question, index) => ({ question, index, start: 0, column: 0 }))).map(({ question, index, start, column }) => {
                    const status = getQuestionStatus({
                      index,
                      currentIndex,
                      selectedAnswers,
                      questions,
                      submittedQuestions,
                    });
                    return (
                      <button data-ui-button="state"
                        key={`mac-palette-${question.id}-${index}`}
                        type="button"
                        ref={index === currentIndex ? activeMacBtnRef : null}
                        aria-label={`Go to question ${index + 1}`}
                        aria-current={index === currentIndex ? 'step' : undefined}
                        style={large ? { position: 'absolute', top: start, left: `calc(${column} * (100% + 8px) / 4)`, width: 'calc((100% - 24px) / 4)', height: 44 } : undefined}
                        className={`mac-palette-btn ${status === "current" ? "is-current" : ""} ${status === "answered" || status === "correct" ? "is-answered" : ""} ${status === "wrong" ? "is-wrong" : ""}`}
                        onClick={() => goToQuestion(index + 1)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <main className="mac-series-main">
              <div className="mac-series-meta-row">
                <ConceptBadge
                  concept={currentQ.concept}
                  colours={conceptColours}
                />
                <span>{currentQ.exam || `${title} concept practice`}</span>

                <button data-ui-button="state" data-ui-shape="icon"
                  type="button"
                  className="mac-series-bookmark"
                  onClick={handleBookmark}
                  aria-label={
                    bookmarked.has(String(currentQ.id))
                      ? "Remove bookmark"
                      : "Add bookmark"
                  }
                >
                  {bookmarked.has(String(currentQ.id)) ? (
                    <BookmarkCheck aria-hidden="true" />
                  ) : (
                    <Bookmark aria-hidden="true" />
                  )}
                </button>
              </div>

              <section
                key={currentQ.id}
                className={`mac-series-question-card ${transitionStyles.desktop}`}
              >
                {hasQuestionText && (
                  <div className="mac-series-prompt">
                    <RichContent
                      criticalImages
                      imageDimensions={{ width: currentQ.questionImageWidth, height: currentQ.questionImageHeight }}
                      text={displayedQuestion}
                      renderText={renderQuestionLine}
                    />
                  </div>
                )}
              </section>

              <section
                className="mac-series-options"
                aria-label="Answer options"
              >
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
                      onClick={() => handleSelectAnswer(index)}
                      className={`mac-series-option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${isUserAnswer ? "is-user-answer" : ""} ${isDimmed ? "is-dimmed" : ""}`}
                    >
                      <span className="mac-series-option-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="mac-series-option-value">
                        <RichContent text={option} />
                      </span>
                      {(isUserAnswer || isCorrect || isWrong) && (
                        <span className="mac-series-option-status">
                          {isUserAnswer && (
                            <span className="mac-series-your-answer">
                              Your answer
                            </span>
                          )}
                          {isCorrect && (
                            <OptionTickIcon
                              className="mac-series-answer-icon"
                              aria-label="Correct option"
                            />
                          )}
                          {isWrong && (
                            <XCircle
                              className="mac-series-answer-icon"
                              aria-label="Incorrect option"
                            />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </section>

              <div className="mac-series-actions">
                {submitError && (
                  <p className="mac-series-error">{submitError}</p>
                )}

                <div data-ui-chrome="footer" className="mac-series-footer-buttons">
                  <button data-ui-button="secondary"
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="mac-series-footer-secondary"
                  >
                    Previous
                  </button>
                  {canViewSolution && (!hideViewSolution) && (
                    <button data-ui-button="state"
                      type="button"
                      className="mac-series-footer-solution"
                      onClick={openSolution}
                    >
                      View solution
                    </button>
                  )}
                  {!hideAiTutor && (
                    <QuizChatbot
                      key={currentQ.id}
                      isVisible={isCurrentSubmitted}
                      questionNumber={currentIndex + 1}
                      topicTitle={title}
                      question={currentQ}
                      theme={theme}
                      activeLang={activeLang}
                      renderTrigger={(onOpen) => (
                        <button data-ui-button="state"
                          type="button"
                          className="mac-series-footer-ai"
                          onClick={onOpen}
                        >
                          Ask AI Tutor
                        </button>
                      )}
                    />
                  )}
                  <button data-ui-button="primary"
                    type="button"
                    onClick={() =>
                      isCurrentSubmitted ? handleNext() : handleSubmitCurrent()
                    }
                    disabled={!canSubmit && !isCurrentSubmitted}
                    className="mac-series-footer-primary"
                  >
                    {!isCurrentSubmitted
                      ? "Submit"
                      : currentIndex < questions.length - 1
                        ? "Next"
                        : "Finish"}
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
      <SolutionBottomSheet
        isOpen={isSolutionOpen}
        solution={displayedSolution ?? currentQ.solution ?? ""}
        questionNumber={currentIndex + 1}
        correctOptionIndex={currentQ.correctAnswer}
        correctOptionText={
          displayedOptions[currentQ.correctAnswer] ?? currentQ.answer ?? ""
        }
        onClose={closeSolution}
      />
    </div>
  );
}
