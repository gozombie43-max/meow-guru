"use client";
import { LangToggle } from "@/components/LangToggle";
import RichContent from "@/components/RichContent";
import { OptionTickIcon } from "@/components/quiz-engine/ui/QuizSettingsModal";
import { ConceptBadge } from "@/components/quiz-engine/ui/SharedUI";
import { SolutionBottomSheet } from "@/components/quiz-engine/ui/SolutionViews";
import { getQuestionStatus } from "@/components/quiz-engine/utils";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Moon, Sun, XCircle } from "lucide-react";
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
    >
      {themeStyles}
      <div className="mac-series-desktop">
        <div className="mac-series-window">
          <header className="mac-series-header">
            <div className="mac-series-traffic-lights">
              <div className="mac-dot mac-red"></div>
              <div className="mac-dot mac-yellow"></div>
              <div className="mac-dot mac-green"></div>
            </div>
            <div className="mac-series-title">
              {title} - {modeLabels[mode] || "Quiz"}
            </div>
            <div className="mac-series-header-right">
              <button
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
              </div>
            </aside>

            <main className="mac-series-main">
              <div className="mac-series-meta-row">
                <ConceptBadge
                  concept={currentQ.concept}
                  colours={conceptColours}
                />
                <span>{currentQ.exam || `${title} concept practice`}</span>

                <button
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
                    <button
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
                    <button
                      type="button"
                      className="mac-series-footer-solution"
                      onClick={openSolution}
                    >
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
                      <button
                        type="button"
                        className="mac-series-footer-ai"
                        onClick={onOpen}
                      >
                        Ask AI Tutor
                      </button>
                    )}
                  />
                  <button
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
          background: #000;
          color: #f2f2f7;
          font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
            Arial, sans-serif;
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
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          display: grid;
          place-items: center;
          padding: 4px;
          border-radius: 6px;
        }
        .mac-series-icon-button:hover {
          background: rgba(255, 255, 255, 0.1);
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
          background: rgba(0, 0, 0, 0.2);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }
        .mac-sidebar-title {
          flex: none;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          text-align: center;
          padding: 16px 16px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.14);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mac-sidebar-title span {
          text-align: center;
          font-size: 15px;
          font-weight: 700;
        }
        .mac-series-palette-grid-wrap {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
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
        .mac-palette-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .mac-palette-btn.is-current {
          background: #007aff;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        }
        .mac-palette-btn.is-answered {
          border-color: rgba(40, 205, 65, 0.5);
          color: #34c759;
        }
        .mac-palette-btn.is-wrong {
          border-color: rgba(255, 59, 48, 0.5);
          color: #ff3b30;
        }

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
          width: 32px;
          height: 32px;
          padding: 0;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            color 0.16s ease,
            transform 0.16s ease;
        }
        .mac-series-bookmark:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .mac-series-bookmark:active {
          transform: scale(0.96);
        }
        .mac-series-bookmark svg {
          width: 18px;
          height: 18px;
        }

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
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.07);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .mac-series-option:not(:disabled):hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .mac-series-option:active {
          transform: scale(0.98);
        }
        .mac-series-option:disabled {
          cursor: default;
        }
        .mac-series-option.is-selected {
          background: rgba(0, 122, 255, 0.15);
          border-color: #007aff;
        }
        .mac-series-option.is-correct {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.14);
        }
        .mac-series-option.is-wrong {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.14);
        }
        .mac-series-option.is-user-answer.is-correct {
          border-color: rgba(52, 199, 89, 0.38);
          box-shadow:
            0 0 0 1px rgba(52, 199, 89, 0.12),
            0 2px 10px rgba(0, 0, 0, 0.18);
        }
        .mac-series-option.is-user-answer.is-wrong {
          border-color: rgba(255, 59, 48, 0.42);
          box-shadow:
            0 0 0 1px rgba(255, 59, 48, 0.12),
            0 2px 10px rgba(0, 0, 0, 0.18);
        }
        .mac-series-option.is-dimmed {
          opacity: 0.58;
        }
        .mac-series-option-letter {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
        }
        .mac-series-option.is-selected .mac-series-option-letter {
          background: #007aff;
          color: #fff;
        }
        .mac-series-option.is-correct .mac-series-option-letter {
          background: #34c759;
          color: #fff;
        }
        .mac-series-option.is-wrong .mac-series-option-letter {
          background: #ff3b30;
          color: #fff;
        }
        .mac-series-option-value {
          font-size: 16px;
          font-weight: 500;
        }
        .mac-series-option-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex: none;
        }
        .mac-series-your-answer {
          color: rgba(235, 235, 245, 0.55);
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
          color: #34c759;
        }
        .mac-series-option.is-wrong .mac-series-answer-icon {
          color: #ff3b30;
        }

        .mac-series-actions {
          margin-top: 40px;
        }
        .mac-series-error {
          color: #ff3b30;
          font-size: 13px;
          margin-bottom: 12px;
        }
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
        .mac-series-footer-buttons button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mac-series-footer-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .mac-series-footer-secondary:not(:disabled):hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .mac-series-footer-solution,
        .mac-series-footer-ai {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.78);
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
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .mac-series-footer-primary {
          background: #007aff;
          border: none;
          color: #fff;
        }
        .mac-series-footer-primary:not(:disabled):hover {
          background: #0062cc;
        }
        /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
        .mac-series-quiz[data-theme="light"] {
          background: #f6f8fa;
          color: #1d1d1f;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-desktop {
          background: #f6f8fa;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-window {
          background: #ffffff;
          border: 1px solid #e6eaef;
          box-shadow:
            0 20px 60px -10px rgba(15, 23, 42, 0.08),
            0 0 0 1px #e6eaef;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-header {
          background: #f6f8fa;
          border-bottom: 1px solid #e6eaef;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-title {
          color: #1d1d1f;
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-icon-button {
          color: #57606a;
          background: #ffffff;
          border: 1px solid #e6eaef;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-icon-button:hover {
          background: #e6eaef;
          color: #1d1d1f;
        }

        .mac-series-quiz[data-theme="light"] .mac-series-sidebar {
          background: #f6f8fa;
          border-right: 1px solid #e6eaef;
        }
        .mac-series-quiz[data-theme="light"] .mac-sidebar-title {
          color: #1d1d1f;
          border-bottom: 1px solid #e6eaef;
          background: #f6f8fa;
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn {
          background: #ffffff;
          color: #1d1d1f;
          border: 1px solid #e6eaef;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn:hover {
          background: #f6f8fa;
          border-color: #0071e3;
          color: #0071e3;
        }
        .mac-series-quiz[data-theme="light"] .mac-palette-btn.is-current {
          background: #0071e3;
          color: #fff;
          border-color: #0071e3;
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
          background: #f6f8fa;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-meta-row {
          color: #57606a;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-bookmark {
          border-color: #e6eaef;
          background: #ffffff;
          color: #57606a;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-bookmark:hover {
          border-color: #d8dee4;
          background: #f1f4f7;
          color: #0071e3;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-prompt {
          color: #1d1d1f;
        }

        .mac-series-quiz[data-theme="light"] .mac-series-option {
          background: #ffffff;
          border: 1px solid #d8dee4;
          color: #1d1d1f;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option:not(:disabled):hover {
          background: #ffffff;
          border-color: rgba(0, 113, 227, 0.4);
          box-shadow: 0 4px 14px rgba(0, 113, 227, 0.1);
          transform: translateY(-1px);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-selected {
          background: #e6eaef;
          border-color: #0071e3;
          color: #0071e3;
          box-shadow:
            0 0 0 1.5px #0071e3,
            0 4px 14px rgba(0, 113, 227, 0.14);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-correct {
          background: #ffffff;
          border-color: #d8dee4;
          color: #1d1d1f;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option.is-wrong {
          background: #ffffff;
          border-color: #d8dee4;
          color: #1d1d1f;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-user-answer.is-correct {
          border-color: rgba(22, 163, 74, 0.34);
          box-shadow:
            0 0 0 1px rgba(22, 163, 74, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-user-answer.is-wrong {
          border-color: rgba(220, 38, 38, 0.36);
          box-shadow:
            0 0 0 1px rgba(220, 38, 38, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .mac-series-quiz[data-theme="light"] .mac-series-your-answer {
          color: #6e7781;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-option-letter {
          background: #e6eaef;
          color: #1d1d1f;
          border-color: transparent;
          font-weight: 700;
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-option.is-selected
          .mac-series-option-letter {
          background: #0071e3;
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
          border: 1px solid #e6eaef;
          color: #57606a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-secondary:not(:disabled):hover {
          background: #e6eaef;
          color: #1d1d1f;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-footer-solution,
        .mac-series-quiz[data-theme="light"] .mac-series-footer-ai {
          background: #ffffff;
          border: 1px solid #e6eaef;
          color: #57606a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-solution:not(:disabled):hover,
        .mac-series-quiz[data-theme="light"]
          .mac-series-footer-ai:not(:disabled):hover {
          background: #e6eaef;
          border-color: #d8dee4;
          color: #1d1d1f;
        }
        .mac-series-quiz[data-theme="light"] .mac-series-footer-primary {
          background: #0071e3;
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
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
