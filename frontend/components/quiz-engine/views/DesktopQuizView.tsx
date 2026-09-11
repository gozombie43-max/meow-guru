"use client";
import { LangToggle } from "@/components/LangToggle";
import RichContent from "@/components/RichContent";
import { OptionTickIcon, QuizSettingsModal } from "@/components/quiz-engine/ui/QuizSettingsModal";
import { ConceptBadge } from "@/components/quiz-engine/ui/SharedUI";
import { SolutionBottomSheet } from "@/components/quiz-engine/ui/SolutionViews";
import { getQuestionStatus } from "@/components/quiz-engine/utils";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Moon, Settings, Sun, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import type { QuizController } from "../hooks/useQuizController";
const QuizChatbot = dynamic(() => import("@/components/QuizChatbot"), {
  ssr: false,
});
export function DesktopQuizView({
  subjectConfig,
  theme,
  themeStyles,
  title,
  modeLabels,
  mode,
  toggleTheme,
  activeLang,
  isTranslating,
  setActiveLang,
  questions,
  currentIndex,
  selectedAnswers,
  submittedQuestions,
  activeMacBtnRef,
  goToQuestion,
  currentQ,
  conceptColours,
  handleBookmark,
  bookmarked,
  hasQuestionText,
  displayedQuestion,
  renderQuestionLine,
  displayedOptions,
  isCurrentSubmitted,
  selectedAnswer,
  handleSelectAnswer,
  submitError,
  handlePrev,
  canViewSolution,
  openSolution,
  handleNext,
  handleSubmitCurrent,
  canSubmit,
  isSolutionOpen,
  closeSolution,
  isSettingsOpen,
  setIsSettingsOpen,
  hideQuestionNumbers,
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
}: Pick<
  QuizController,
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
  | "spacing"
  | "handleSetSpacing"
> & {
  isCurrentSubmitted: boolean;
  canViewSolution: boolean;
  canSubmit: boolean;
}) {
  if (!currentQ) return null;

  return (
    <div
      className={`mac-series-quiz ${subjectConfig.cssClassName}`}
      data-theme={theme}
      data-text-size={textSize}
      data-spacing={spacing}
    >
      {themeStyles}
      <div className="mac-series-desktop">
        <div className="mac-series-window">
          <header data-ui-chrome="header" className="mac-series-header">
            <div className="mac-series-traffic-lights">
              <div className="mac-dot mac-red"></div>
              <div className="mac-dot mac-yellow"></div>
              <div className="mac-dot mac-green"></div>
            </div>
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
            />
          )}

          <div className="mac-series-body">
            <aside className="mac-series-sidebar">
              <div className="mac-sidebar-title">
                <span>Questions</span>
              </div>
              <div className="mac-series-palette-grid-wrap">
                <div className="mac-series-palette-grid">
                  {questions.map((question, index) => {
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
        solution={currentQ.solution ?? ""}
        questionNumber={currentIndex + 1}
        correctOptionIndex={currentQ.correctAnswer}
        correctOptionText={
          displayedOptions[currentQ.correctAnswer] ?? currentQ.answer ?? ""
        }
        onClose={closeSolution}
      />
      <style jsx global>{`
        .mac-series-quiz {
          min-height: 100svh;
          background: #0D0F12;
          color: #E7E9EC;
          font-family:
            "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
            Arial, sans-serif;
        }
        .mac-series-desktop {
          height: 100svh;
          width: 100%;
          padding: 0;
          background: #0D0F12;
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
          background: #13161A;
          border: none;
        }
        .mac-series-header {
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: #13161A;
          border-bottom: 1px solid #292E35;
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
        .mac-red {
          background: #ff5f56;
          border: 1px solid #e0443e;
        }
        .mac-yellow {
          background: #ffbd2e;
          border: 1px solid #dea123;
        }
        .mac-green {
          background: #27c93f;
          border: 1px solid #1aab29;
        }
        .mac-series-title {
          font-size: 14px;
          font-weight: 600;
          color: #E7E9EC;
          text-align: center;
          flex: 1;
        }
        .mac-series-header-right {
          display: flex;
          gap: 10px;
          width: auto;
          justify-content: flex-end;
          align-items: center;
        }
        .mac-series-icon-button {
          background: #181C21;
          border: 1px solid #292E35;
          color: #989EA7;
          cursor: pointer;
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }
        .mac-series-icon-button:hover {
          background: #292E35;
          color: #E7E9EC;
        }
        .mac-series-icon-button.is-active {
          border-color: #7296C4;
          color: #7296C4;
          background: #17263A;
        }
        .mac-series-icon-button svg {
          width: 16px;
          height: 16px;
        }
        .mac-series-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .mac-series-sidebar {
          width: 260px;
          background: #0D0F12;
          border-right: 1px solid #292E35;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }
        .mac-sidebar-title {
          flex: none;
          font-size: 14px;
          font-weight: 600;
          color: #E7E9EC;
          text-align: center;
          padding: 14px 16px;
          border-bottom: 1px solid #292E35;
          background: #13161A;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mac-sidebar-title span {
          text-align: center;
          font-size: 14px;
          font-weight: 600;
        }
        .mac-series-palette-grid-wrap {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
        }
        .mac-series-palette-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .mac-palette-btn {
          height: 36px;
          border-radius: 8px;
          border: 1px solid #292E35;
          background: #181C21;
          color: #989EA7;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mac-palette-btn:hover {
          background: #292E35;
          color: #E7E9EC;
        }
        .mac-palette-btn.is-current {
          background: #3D6A9E;
          border-color: #7296C4;
          color: #fff;
          box-shadow: 0 2px 8px rgba(61, 106, 158, 0.4);
        }
        .mac-palette-btn.is-answered {
          border-color: rgba(40, 117, 66, 0.6);
          background: rgba(40, 117, 66, 0.18);
          color: #4ade80;
        }
        .mac-palette-btn.is-wrong {
          border-color: rgba(163, 59, 54, 0.6);
          background: rgba(163, 59, 54, 0.18);
          color: #f87171;
        }

        .mac-series-main {
          flex: 1;
          padding: 28px 40px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: #13161A;
        }
        .mac-series-meta-row {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #989EA7;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .mac-series-quiz .concept-badge {
          border-radius: 6px;
          padding: 4px 10px;
        }
        .mac-series-bookmark {
          margin-left: auto;
          width: 32px;
          height: 32px;
          padding: 0;
          display: grid;
          place-items: center;
          background: #181C21;
          border: 1px solid #292E35;
          border-radius: 8px;
          color: #989EA7;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            color 0.16s ease,
            transform 0.16s ease;
        }
        .mac-series-bookmark:hover {
          border-color: #7296C4;
          background: #17263A;
          color: #E7E9EC;
        }
        .mac-series-bookmark:active {
          transform: scale(0.96);
        }
        .mac-series-bookmark svg {
          width: 18px;
          height: 18px;
        }

        .mac-series-question-card {
          margin-bottom: 24px;
        }

        .mac-series-prompt {
          font-size: 19px;
          font-weight: 500;
          line-height: 1.58;
          color: #E7E9EC;
        }

        .mac-series-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: auto;
        }
        .mac-series-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          min-height: 52px;
          border-radius: 14px;
          border: 1px solid #292E35;
          background: #181C21;
          color: #DDE0E4;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .mac-series-option:not(:disabled):hover {
          background: #1E232A;
          border-color: rgba(114, 150, 196, 0.4);
        }
        .mac-series-option:active {
          transform: scale(0.99);
        }
        .mac-series-quiz .mac-series-option:disabled,
        .mac-series-option:disabled {
          cursor: default;
          opacity: 1 !important;
        }
        .mac-series-option.is-selected {
          background: #17263A;
          border-color: #7296C4;
        }
        .mac-series-option.is-correct {
          background: #181C21;
          border-color: rgba(40, 117, 66, 0.6);
          color: #E7E9EC;
        }
        .mac-series-option.is-wrong {
          background: #181C21;
          border-color: rgba(163, 59, 54, 0.6);
          color: #E7E9EC;
        }
        .mac-series-option.is-user-answer.is-correct {
          border-color: rgba(40, 117, 66, 0.7);
          box-shadow: 0 0 0 1px rgba(40, 117, 66, 0.3);
        }
        .mac-series-option.is-user-answer.is-wrong {
          border-color: rgba(163, 59, 54, 0.7);
          box-shadow: 0 0 0 1px rgba(163, 59, 54, 0.3);
        }
        .mac-series-quiz .mac-series-option.is-dimmed,
        .mac-series-option.is-dimmed {
          opacity: 0.6 !important;
        }
        .mac-series-option-letter {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 8px;
          background: #242930;
          display: grid;
          place-items: center;
          font-size: 15px;
          font-weight: 600;
          color: #989EA7;
        }
        .mac-series-option.is-selected .mac-series-option-letter {
          background: #3D6A9E;
          color: #fff;
        }
        .mac-series-option.is-correct .mac-series-option-letter {
          background: #287542;
          color: #fff;
        }
        .mac-series-option.is-wrong .mac-series-option-letter {
          background: #a33b36;
          color: #fff;
        }
        .mac-series-option-value {
          font-size: 18px;
          font-weight: 400;
          line-height: 1.45;
          color: #DDE0E4;
        }
        .mac-series-option-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex: none;
        }
        .mac-series-your-answer {
          color: #989EA7;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .mac-series-answer-icon {
          width: 20px;
          height: 20px;
        }
        .mac-series-option.is-correct .mac-series-answer-icon {
          color: #4ade80;
        }
        .mac-series-option.is-wrong .mac-series-answer-icon {
          color: #f87171;
        }

        .mac-series-actions {
          margin-top: 32px;
        }
        .mac-series-error {
          color: #f87171;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .mac-series-footer-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .mac-series-footer-buttons button {
          padding: 10px 22px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mac-series-footer-buttons button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .mac-series-footer-secondary {
          background: #181C21;
          border: 1px solid #292E35;
          color: #E7E9EC;
        }
        .mac-series-footer-secondary:not(:disabled):hover {
          background: #242930;
        }
        .mac-series-footer-solution,
        .mac-series-footer-ai {
          background: #181C21;
          border: 1px solid #292E35;
          color: #989EA7;
        }
        .mac-series-footer-solution,
        .mac-series-footer-ai {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .mac-series-footer-solution::before,
        .mac-series-footer-ai::before {
          content: "";
          display: block;
          width: 18px;
          height: 18px;
          flex: none;
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
        }
        .mac-series-footer-solution::before {
          background: linear-gradient(
            135deg,
            #ca5df5 0%,
            #806cea 32%,
            #4d77e3 58%,
            #0a85d9 100%
          );
          -webkit-mask: url("/icons8-view-solution.svg?v=3") center/contain
            no-repeat;
          mask: url("/icons8-view-solution.svg?v=3") center/contain no-repeat;
        }
        .mac-series-footer-ai::before {
          background-image: url("/icons8-gemini-ai.svg");
        }
        .mac-series-footer-solution:not(:disabled):hover,
        .mac-series-footer-ai:not(:disabled):hover {
          background: #242930;
          border-color: #7296C4;
          color: #E7E9EC;
        }
        .mac-series-footer-primary {
          background: #3D6A9E;
          border: none;
          color: #fff;
          box-shadow: 0 2px 8px rgba(61, 106, 158, 0.4);
        }
        .mac-series-footer-primary:not(:disabled):hover {
          background: #4a7bb3;
        }

        /* Reading Comfort: Text Size Variations */
        .mac-series-quiz[data-text-size="sm"] .mac-series-prompt {
          font-size: 17px;
          line-height: 1.52;
        }
        .mac-series-quiz[data-text-size="sm"] .mac-series-option-value {
          font-size: 16px;
          line-height: 1.42;
        }
        .mac-series-quiz[data-text-size="md"] .mac-series-prompt {
          font-size: 19px;
          line-height: 1.58;
        }
        .mac-series-quiz[data-text-size="md"] .mac-series-option-value {
          font-size: 18px;
          line-height: 1.45;
        }
        .mac-series-quiz[data-text-size="lg"] .mac-series-prompt {
          font-size: 21px;
          line-height: 1.62;
        }
        .mac-series-quiz[data-text-size="lg"] .mac-series-option-value {
          font-size: 20px;
          line-height: 1.48;
        }

        /* Reading Comfort: Spacing Variations */
        .mac-series-quiz[data-spacing="compact"] .mac-series-options {
          gap: 8px;
        }
        .mac-series-quiz[data-spacing="compact"] .mac-series-option {
          min-height: 46px;
          padding: 8px 14px;
        }
        .mac-series-quiz[data-spacing="comfortable"] .mac-series-options {
          gap: 12px;
        }
        .mac-series-quiz[data-spacing="comfortable"] .mac-series-option {
          min-height: 52px;
          padding: 12px 16px;
        }

        /* Light Theme Overrides */
        .mac-series-quiz[data-theme="light"] {
          background: var(--light-canvas);
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-desktop {
          background: var(--light-canvas);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-window {
          background: #ffffff;
          border: 1px solid var(--light-border);
          box-shadow:
            0 20px 60px -10px rgba(15, 23, 42, 0.08),
            0 0 0 1px var(--light-border);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-header {
          background: var(--light-canvas);
          border-bottom: 1px solid var(--light-border);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-title {
          color: var(--light-text);
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-icon-button {
          color: var(--light-text-secondary);
          background: #ffffff;
          border: 1px solid var(--light-border);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-icon-button:hover {
          background: var(--light-accent-soft);
          color: var(--light-text);
        }

        .mac-series-quiz[data-theme="light"] .mac-series-sidebar {
          background: var(--light-canvas);
          border-right: 1px solid var(--light-border);
        }
        .mac-series-quiz[data-theme="light"] .mac-sidebar-title {
          color: var(--light-text);
          border-bottom: 1px solid var(--light-border);
          background: var(--light-canvas);
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn {
          background: #ffffff;
          color: var(--light-text);
          border: 1px solid var(--light-border);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn:hover {
          background: var(--light-canvas);
          border-color: var(--light-accent);
          color: var(--light-accent);
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-current {
          background: var(--light-accent);
          color: #fff;
          border-color: var(--light-accent);
          box-shadow: 0 3px 10px rgba(0, 122, 255, 0.35);
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-answered {
          background: #e8f5e9;
          border-color: #a5d6a7;
          color: #2e7d32;
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-wrong {
          background: #ffebee;
          border-color: #ef9a9a;
          color: #c62828;
          font-weight: 700;
        }

        .mac-series-quiz[data-theme="light"] .mac-series-main {
          background: var(--light-canvas);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-meta-row {
          color: var(--light-text-secondary);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-bookmark {
          border-color: var(--light-border);
          background: #ffffff;
          color: var(--light-text-secondary);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-bookmark:hover {
          border-color: #d8dee4;
          background: #f1f4f7;
          color: var(--light-accent);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-prompt {
          color: var(--light-text);
        }

        .mac-series-quiz[data-theme="light"] .mac-series-option:disabled {
          opacity: 1 !important;
          cursor: default;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-dimmed {
          opacity: 0.6 !important;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option {
          background: #ffffff;
          border: 1px solid #d8dee4;
          color: var(--light-text);
          box-shadow: none;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option-value {
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option:not(:disabled):hover {
          background: #ffffff;
          border-color: rgba(0, 113, 227, 0.4);
          box-shadow: 0 4px 14px rgba(0, 113, 227, 0.1);
          transform: none;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-selected {
          background: var(--light-accent-soft);
          border-color: var(--light-accent);
          color: var(--light-accent);
          box-shadow:
            0 0 0 1.5px var(--light-accent),
            0 4px 14px rgba(0, 113, 227, 0.14);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-selected
          .mac-series-option-value {
          color: var(--light-accent);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-correct {
          background: #ffffff;
          border-color: rgba(22, 163, 74, 0.45);
          color: var(--light-text);
          box-shadow: none;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-correct
          .mac-series-option-value {
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-wrong {
          background: #ffffff;
          border-color: rgba(220, 38, 38, 0.45);
          color: var(--light-text);
          box-shadow: none;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-wrong
          .mac-series-option-value {
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-user-answer.is-correct {
          border-color: rgba(22, 163, 74, 0.7);
          box-shadow:
            0 0 0 1.5px rgba(22, 163, 74, 0.25),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-user-answer.is-wrong {
          border-color: rgba(220, 38, 38, 0.7);
          box-shadow:
            0 0 0 1.5px rgba(220, 38, 38, 0.25),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-correct
          .mac-series-answer-icon {
          color: #16a34a;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-wrong
          .mac-series-answer-icon {
          color: #dc2626;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-your-answer {
          color: #6e7781;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option-letter {
          background: var(--light-accent-soft);
          color: var(--light-text);
          border-color: transparent;
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-selected
          .mac-series-option-letter {
          background: var(--light-accent);
          color: #fff;
          border-color: transparent;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-correct
          .mac-series-option-letter {
          background: #16a34a;
          color: #fff;
          border-color: transparent;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-wrong
          .mac-series-option-letter {
          background: #dc2626;
          color: #fff;
          border-color: transparent;
        }

        .mac-series-quiz[data-theme="light"] .mac-series-footer-secondary {
          background: #ffffff;
          border: 1px solid var(--light-border);
          color: var(--light-text-secondary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-secondary:not(:disabled):hover {
          background: var(--light-accent-soft);
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-footer-solution,
        .mac-series-quiz[data-theme="light"] .mac-series-footer-ai {
          background: #ffffff;
          border: 1px solid var(--light-border);
          color: var(--light-text-secondary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-solution:not(:disabled):hover,
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-ai:not(:disabled):hover {
          background: var(--light-accent-soft);
          border-color: #d8dee4;
          color: var(--light-text);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-footer-primary {
          background: var(--light-accent);
          border: none;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-primary:not(:disabled):hover {
          background: #0077ed;
        }

        /* Responsive fixes for Mac layout */
        @media (max-width: 900px) {
          .mac-series-body {
            flex-direction: column;
          }
          .mac-series-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #292E35;
            height: 120px;
            overflow-y: auto;
            padding: 12px;
          }
          .mac-series-palette-grid {
            display: flex;
            overflow-x: auto;
            padding-bottom: 8px;
          }
          .mac-palette-btn {
            flex: 0 0 36px;
          }
          .mac-series-options {
            grid-template-columns: 1fr;
          }
          .mac-series-main {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
