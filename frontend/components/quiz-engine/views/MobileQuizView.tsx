"use client";
import { LangToggle } from "@/components/LangToggle";
import RichContent from "@/components/RichContent";
import {
  OptionTickIcon,
  QuizSettingsModal,
  SettingIcon,
} from "@/components/quiz-engine/ui/QuizSettingsModal";
import { ConceptBadge } from "@/components/quiz-engine/ui/SharedUI";
import { SolutionBottomSheet } from "@/components/quiz-engine/ui/SolutionViews";
import { getQuestionStatus } from "@/components/quiz-engine/utils";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Menu, X, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import type { QuizController } from "../hooks/useQuizController";
const QuizChatbot = dynamic(() => import("@/components/QuizChatbot"), {
  ssr: false,
});
export function MobileQuizView({
  subjectConfig,
  theme,
  themeStyles,
  isSettingsOpen,
  setIsSettingsOpen,
  activeLang,
  isTranslating,
  setActiveLang,
  currentIndex,
  hideQuestionNumbers,
  openPalette,
  toggleTheme,
  handleToggleHideQuestionNumbers,
  hideViewSolution,
  handleToggleHideViewSolution,
  hideAiTutor,
  handleToggleHideAiTutor,
  handleToggleHideBoth,
  questions,
  selectedAnswers,
  submittedQuestions,
  activeRailBtnRef,
  goToQuestion,
  currentQ,
  conceptColours,
  hasDetailedExamLabel,
  examDetailsRef,
  compactExamLabel,
  fullExamLabel,
  handleBookmark,
  bookmarked,
  hasQuestionText,
  displayedQuestion,
  renderQuestionLine,
  displayedOptions,
  isCurrentSubmitted,
  selectedAnswer,
  handleSelectAnswer,
  canViewSolution,
  openSolution,
  title,
  submitError,
  handlePrev,
  handleNext,
  handleSubmitCurrent,
  canSubmit,
  isPaletteOpen,
  closePalette,
  isSolutionOpen,
  closeSolution,
}: Pick<
  QuizController,
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
  | "questions"
  | "selectedAnswers"
  | "submittedQuestions"
  | "activeRailBtnRef"
  | "goToQuestion"
  | "currentQ"
  | "conceptColours"
  | "examDetailsRef"
  | "handleBookmark"
  | "bookmarked"
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
> & {
  hasDetailedExamLabel: boolean;
  compactExamLabel: string;
  fullExamLabel: string;
  isCurrentSubmitted: boolean;
  canViewSolution: boolean;
  canSubmit: boolean;
}) {
  if (!currentQ) return null;

  return (
    <div
      className={`ios-series-quiz ${subjectConfig.cssClassName}`}
      data-theme={theme}
    >
      {themeStyles}
      <div className="ios-series-device">
        <header className="ios-series-header">
          <button
            type="button"
            className={`ios-series-icon-button ${isSettingsOpen ? "is-active" : ""}`}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-label="Open quiz settings"
            aria-expanded={isSettingsOpen}
          >
            <SettingIcon />
          </button>
          <LangToggle
            active={activeLang}
            loading={isTranslating}
            onChange={setActiveLang}
          />
          {(() => {
            const qNum = currentIndex + 1;
            const digits = String(qNum).length;
            const sizeClass =
              digits <= 2
                ? "is-qnum-sm"
                : digits === 3
                  ? "is-qnum-md"
                  : "is-qnum-lg";
            return (
              <button
                type="button"
                className={`ios-series-icon-button ${hideQuestionNumbers ? `is-qnum ${sizeClass}` : ""}`}
                onClick={openPalette}
                aria-label={
                  hideQuestionNumbers
                    ? `Question ${qNum} - Open question navigator`
                    : "Open question navigator"
                }
              >
                {hideQuestionNumbers ? (
                  <span className="ios-series-palette-num">{qNum}</span>
                ) : (
                  <Menu aria-hidden="true" />
                )}
              </button>
            );
          })()}
        </header>

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
        />

        {!hideQuestionNumbers && (
          <nav className="ios-series-rail" aria-label="Question navigation">
            {questions.map((question, index) => {
              const status = getQuestionStatus({
                index,
                currentIndex,
                selectedAnswers,
                questions,
                submittedQuestions,
              });
              const statusLabel =
                status === "current"
                  ? "current"
                  : status === "correct"
                    ? "correct"
                    : status === "wrong"
                      ? "incorrect"
                      : status === "answered"
                        ? "answered"
                        : "unvisited";
              return (
                <button
                  key={`rail-${question.id}-${index}`}
                  type="button"
                  ref={index === currentIndex ? activeRailBtnRef : null}
                  onClick={() => goToQuestion(index + 1)}
                  className={`ios-series-question ${status === "current" ? "is-current" : ""} ${status === "correct" ? "is-correct" : ""} ${status === "wrong" ? "is-wrong" : ""} ${status === "answered" ? "is-unsubmitted" : ""}`}
                  aria-label={`Question ${index + 1}, ${statusLabel}`}
                  aria-current={index === currentIndex ? "step" : undefined}
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>
        )}

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
            <button
              type="button"
              className="ios-series-bookmark"
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
                  className={`ios-series-option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${isUserAnswer ? "is-user-answer" : ""} ${isDimmed ? "is-dimmed" : ""}`}
                >
                  <span className="ios-series-option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="ios-series-option-value">
                    <RichContent text={option} />
                  </span>
                  {(isUserAnswer || isCorrect || isWrong) && (
                    <span className="ios-series-option-status">
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
                    </span>
                  )}
                </button>
              );
            })}
          </section>

          {canViewSolution && (!hideViewSolution || !hideAiTutor) && (
            <div
              className={`ios-series-actions ${hideViewSolution || hideAiTutor ? "is-single-action" : ""}`}
            >
              {!hideViewSolution && (
                <button
                  type="button"
                  className="ios-series-solution"
                  onClick={openSolution}
                >
                  View solution
                </button>
              )}
              {!hideAiTutor && (
                <QuizChatbot
                  key={`ios-chat-${currentQ.id}`}
                  isVisible={isCurrentSubmitted}
                  questionNumber={currentIndex + 1}
                  topicTitle={title}
                  question={currentQ}
                  theme={theme}
                  renderTrigger={(onOpen) => (
                    <button
                      type="button"
                      className="ios-series-ai-btn"
                      onClick={onOpen}
                    >
                      Ask AI Tutor
                    </button>
                  )}
                />
              )}
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
            onClick={() =>
              isCurrentSubmitted ? handleNext() : handleSubmitCurrent()
            }
            disabled={!canSubmit && !isCurrentSubmitted}
            className="ios-series-footer-primary"
          >
            {!isCurrentSubmitted
              ? "Submit"
              : currentIndex < questions.length - 1
                ? "Next"
                : "Finish"}
          </button>
        </footer>

        {isPaletteOpen && (
          <div
            className="ios-series-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Question navigator"
          >
            <button
              type="button"
              className="ios-series-palette-backdrop"
              onClick={closePalette}
              aria-label="Close navigator"
            />
            <div className="ios-series-palette-panel">
              <div className="ios-series-palette-title">
                <span>Questions</span>
                <button
                  type="button"
                  onClick={closePalette}
                  aria-label="Close question navigator"
                >
                  <X />
                </button>
              </div>
              <div className="ios-series-palette-grid">
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
        correctOptionText={
          displayedOptions[currentQ.correctAnswer] ?? currentQ.answer ?? ""
        }
        onClose={closeSolution}
      />
      <style jsx global>{`
        .ios-series-quiz {
          --ios-accent: #007aff;
          --ios-option-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          min-height: 100svh;
          background: #000;
          color: #f2f2f7;
          font-family:
            -apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto",
            "Noto Sans", "Helvetica Neue", Arial, sans-serif;
          font-kerning: normal;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
        .ios-series-device {
          height: 100svh;
          display: flex;
          flex-direction: column;
          max-width: 430px;
          margin: 0 auto;
          background:
            radial-gradient(
              120% 50% at 50% -10%,
              rgba(94, 92, 230, 0.17),
              transparent 58%
            ),
            #000;
        }
        .ios-series-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: calc(env(safe-area-inset-top, 0px) + 8px) 14px 9px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        }
        .ios-series-icon-button {
          min-width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          color: #f2f2f7;
          background: #1c1c1e;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .ios-series-icon-button.is-active {
          border-color: #007aff;
          background: rgba(0, 122, 255, 0.22);
          color: #007aff;
        }
        .ios-series-icon-button.is-qnum {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }
        .ios-series-icon-button.is-qnum-sm {
          min-width: 34px;
          padding: 0 5px;
          font-size: 14px;
          letter-spacing: -0.01em;
        }
        .ios-series-icon-button.is-qnum-md {
          min-width: 40px;
          padding: 0 6px;
          font-size: 12.5px;
          letter-spacing: -0.02em;
        }
        .ios-series-icon-button.is-qnum-lg {
          min-width: 46px;
          padding: 0 7px;
          font-size: 11px;
          letter-spacing: -0.03em;
        }
        .ios-series-palette-num {
          display: inline-block;
          line-height: 1;
          font-weight: 700;
          text-align: center;
        }
        .ios-series-icon-button svg {
          width: 17px;
          height: 17px;
        }
        .ios-series-quiz .lang-toggle {
          flex: 0 1 auto;
          height: 34px;
        }
        .ios-series-quiz .lang-toggle-option {
          min-width: 0;
          height: 30px;
          padding-inline: 9px;
        }
        .ios-series-rail {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          scrollbar-width: none;
        }
        .ios-series-rail::-webkit-scrollbar {
          display: none;
        }
        .ios-series-question {
          position: relative;
          flex: 0 0 36px;
          height: 36px;
          border: 1px solid #252528;
          border-radius: 10px;
          background: #101010;
          color: #6c6c70;
          font-size: 13.5px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 140ms ease,
            color 140ms ease,
            border-color 140ms ease;
        }
        .ios-series-question::after {
          position: absolute;
          top: 2px;
          right: 4px;
          color: #8e8e93;
          font-size: 8px;
          font-weight: 800;
          line-height: 1;
        }
        .ios-series-question.is-current {
          border-color: #8e8e93;
          color: #f2f2f7;
          background: #101010;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .ios-series-question.is-correct,
        .ios-series-question.is-answered {
          border-color: #303034;
          background: #1b1b1d;
          color: #f2f2f7;
        }
        .ios-series-question.is-correct::after,
        .ios-series-question.is-answered::after {
          content: "✓";
        }
        .ios-series-question.is-wrong {
          border-color: #303034;
          background: #1b1b1d;
          color: #f2f2f7;
        }
        .ios-series-question.is-wrong::after {
          content: "×";
        }
        .ios-series-question.is-unsubmitted {
          border-color: #35353a;
          background: #242426;
          color: #e5e5ea;
        }
        .ios-series-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px 16px 8px;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .ios-series-content::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .ios-series-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          min-height: 24px;
          margin-bottom: 6px;
          color: rgba(235, 235, 245, 0.58);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
        }
        .ios-series-meta-items {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          flex: 1;
        }
        .ios-series-meta-separator {
          flex: none;
          color: rgba(235, 235, 245, 0.3);
        }
        .ios-series-exam-label {
          min-width: 0;
          line-height: 1.35;
        }
        .ios-series-exam-details {
          position: relative;
          min-width: 0;
        }
        .ios-series-exam-details summary {
          min-width: 0;
          padding: 2px 4px;
          margin: -2px -4px;
          border-radius: 6px;
          color: rgba(235, 235, 245, 0.72);
          line-height: 1.35;
          list-style: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-series-exam-details summary::-webkit-details-marker {
          display: none;
        }
        .ios-series-exam-details summary:focus-visible {
          outline: 2px solid #007aff;
          outline-offset: 2px;
        }
        .ios-series-exam-details[open] summary {
          color: #f2f2f7;
          background: rgba(255, 255, 255, 0.08);
        }
        .ios-series-exam-popover {
          position: absolute;
          z-index: 40;
          top: calc(100% + 9px);
          left: 50%;
          width: max-content;
          max-width: min(260px, calc(100vw - 40px));
          padding: 9px 11px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.88);
          background: #2c2c2e;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
          transform: translateX(-50%);
        }
        .ios-series-quiz .concept-badge {
          flex: none;
          letter-spacing: 0;
        }
        .ios-series-question-card {
          position: relative;
          min-height: 158px;
          padding: 20px 20px 22px 20px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 22px;
          background: #101010;
        }
        .ios-series-bookmark {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          padding: 0;
          border: 0;
          border-radius: 0;
          color: rgba(235, 235, 245, 0.58);
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
          margin-left: auto;
          transition:
            color 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-bookmark:active {
          color: rgba(242, 242, 247, 0.9);
          transform: scale(0.92);
        }
        .ios-series-bookmark svg {
          width: 17px;
          height: 17px;
        }
        .ios-series-prompt {
          color: rgba(242, 242, 247, 0.94);
          font-size: 17px;
          font-weight: 500;
          line-height: 1.62;
          letter-spacing: 0.002em;
        }
        .ios-series-prompt p {
          margin: 0;
        }
        .ios-series-prompt p + p {
          margin-top: 14px;
          font-family: Georgia, serif;
          font-size: 22px;
          font-weight: 400;
          letter-spacing: 0.02em;
        }
        .ios-series-quiz .ios-series-prompt .quote-highlight {
          font-weight: 500;
        }
        .ios-series-options {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .ios-series-option {
          width: 100%;
          min-height: 64px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 16px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          background: #101010;
          color: #f2f2f7;
          box-shadow: var(--ios-option-shadow);
          text-align: left;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            box-shadow 0.16s ease,
            opacity 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-option:not(:disabled):hover {
          border-color: rgba(0, 122, 255, 0.75);
          background: #242426;
        }
        .ios-series-option:not(:disabled):active {
          transform: scale(0.99);
        }
        .ios-series-option:disabled {
          cursor: default;
        }
        .ios-series-option.is-selected {
          border-color: #007aff;
          background: rgba(0, 122, 255, 0.15);
        }
        .ios-series-option.is-correct {
          border-color: rgba(255, 255, 255, 0.16);
          background: #101010;
        }
        .ios-series-option.is-wrong {
          border-color: rgba(255, 255, 255, 0.16);
          background: #101010;
        }
        .ios-series-option.is-user-answer.is-correct {
          border-color: rgba(48, 209, 88, 0.4);
          box-shadow:
            0 0 0 1px rgba(48, 209, 88, 0.12),
            var(--ios-option-shadow);
        }
        .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(255, 69, 58, 0.44);
          box-shadow:
            0 0 0 1px rgba(255, 69, 58, 0.12),
            var(--ios-option-shadow);
        }
        .ios-series-option.is-dimmed {
          opacity: 0.58;
        }
        .ios-series-option.is-user-answer {
          animation: ios-answer-reveal 0.26s cubic-bezier(0.2, 0.8, 0.3, 1);
        }
        .ios-series-option.is-correct {
          animation: ios-correct-glow 0.9s ease-out;
        }
        .ios-series-option.is-user-answer.is-correct {
          animation:
            ios-answer-reveal 0.26s cubic-bezier(0.2, 0.8, 0.3, 1),
            ios-correct-glow 0.9s ease-out;
        }
        @keyframes ios-answer-reveal {
          0%,
          100% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.03);
          }
        }
        @keyframes ios-correct-glow {
          0% {
            box-shadow: var(--ios-option-shadow);
          }
          45% {
            box-shadow:
              0 0 0 3px rgba(48, 209, 88, 0.2),
              0 0 18px rgba(48, 209, 88, 0.18),
              var(--ios-option-shadow);
          }
          100% {
            box-shadow:
              0 0 0 1px rgba(48, 209, 88, 0.1),
              var(--ios-option-shadow);
          }
        }
        .ios-series-option-letter {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 11px;
          background: #303033;
          color: rgba(235, 235, 245, 0.68);
          font-size: 14px;
          font-weight: 700;
        }
        .ios-series-option.is-selected .ios-series-option-letter {
          border-color: transparent;
          background: #007aff;
          color: #fff;
        }
        .ios-series-option.is-correct .ios-series-option-letter {
          border-color: transparent;
          background: #30d158;
          color: #ffffff;
        }
        .ios-series-option.is-wrong .ios-series-option-letter {
          border-color: transparent;
          background: #ff453a;
          color: #ffffff;
        }
        .ios-series-option-value {
          min-width: 0;
          color: rgba(242, 242, 247, 0.92);
          font-size: 16px;
          font-weight: 500;
          line-height: 1.52;
          letter-spacing: 0.002em;
        }
        .ios-series-option-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex: none;
        }
        .ios-series-your-answer {
          color: rgba(235, 235, 245, 0.55);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ios-series-answer-icon {
          width: 20px;
          height: 20px;
          flex: none;
        }
        .ios-series-option.is-correct .ios-series-answer-icon {
          color: #30d158;
        }
        .ios-series-option.is-wrong .ios-series-answer-icon {
          color: #ff453a;
        }
        .ios-series-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0 18px;
        }
        .ios-series-actions.is-single-action {
          grid-template-columns: 1fr;
        }
        .ios-series-solution,
        .ios-series-ai-btn {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          background: #101010;
          color: rgba(242, 242, 247, 0.82);
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-solution,
        .ios-series-ai-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .ios-series-solution::before,
        .ios-series-ai-btn::before {
          content: "";
          display: block;
          width: 18px;
          height: 18px;
          flex: none;
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
        }
        .ios-series-solution::before {
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
        .ios-series-ai-btn::before {
          background-image: url("/icons8-gemini-ai.svg");
        }
        .ios-series-solution:active,
        .ios-series-ai-btn:active {
          border-color: rgba(255, 255, 255, 0.22);
          background: #242426;
          transform: scale(0.99);
        }
        .ios-series-error {
          margin: 12px 2px 0;
          color: #ff9f9a;
          font-size: 13px;
          font-weight: 600;
        }
        .ios-series-footer {
          z-index: 30;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0),
            rgba(0, 0, 0, 0.94) 25%,
            #000
          );
          flex-shrink: 0;
        }
        .ios-series-footer button {
          min-width: 0;
          height: 52px;
          border-radius: 16px;
          font: inherit;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .ios-series-footer button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .ios-series-footer-secondary {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: #1c1c1e;
          color: #f2f2f7;
        }
        .ios-series-footer-primary {
          border: 0;
          background: var(--ios-accent);
          color: #fff;
          box-shadow: 0 4px 16px -4px rgba(0, 122, 255, 0.5);
        }
        .ios-series-footer-primary:not(:disabled):active {
          transform: scale(0.98);
        }
        .ios-series-palette {
          position: fixed;
          z-index: 70;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .ios-series-palette-backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(0, 0, 0, 0.64);
        }
        .ios-series-palette-panel {
          position: relative;
          width: min(430px, 100%);
          max-height: 75svh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-bottom: 0;
          border-radius: 24px 24px 0 0;
          background: #1c1c1e;
          box-shadow: 0 -16px 44px rgba(0, 0, 0, 0.45);
        }
        .ios-series-palette-title {
          position: relative;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #f2f2f7;
          font-size: 17px;
          font-weight: 700;
          background: #1c1c1e;
          z-index: 10;
        }
        .ios-series-palette-title span {
          text-align: center;
          font-size: 17px;
          font-weight: 700;
        }
        .ios-series-palette-title button {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 50%;
          background: #242426;
          color: #f2f2f7;
          cursor: pointer;
        }
        .ios-series-palette-title svg {
          width: 16px;
          height: 16px;
        }
        .ios-series-palette-grid {
          flex: 1;
          overflow-y: auto;
          padding: 18px 20px calc(env(safe-area-inset-bottom) + 24px);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-content: flex-start;
          gap: 12px;
        }
        .ios-series-palette-grid button {
          height: 43px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          background: #242426;
          color: rgba(235, 235, 245, 0.7);
          font: inherit;
          font-weight: 700;
          transition: all 0.15s ease;
        }
        .ios-series-palette-grid button.is-current {
          border-color: transparent;
          background: #007aff;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        }
        .ios-series-palette-grid button.is-correct,
        .ios-series-palette-grid button.is-answered {
          border-color: rgba(48, 209, 88, 0.6);
          background: rgba(48, 209, 88, 0.18);
          color: #30d158;
        }
        .ios-series-palette-grid button.is-wrong {
          border-color: rgba(255, 69, 58, 0.6);
          background: rgba(255, 69, 58, 0.18);
          color: #ff453a;
        }
        .ios-series-palette-grid button.is-unsubmitted {
          border-color: rgba(255, 159, 10, 0.6);
          background: rgba(255, 159, 10, 0.18);
          color: #ff9f0a;
        }
        @media (min-width: 431px) {
          .ios-series-device {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ios-series-option.is-user-answer,
          .ios-series-option.is-correct,
          .ios-series-option.is-user-answer.is-correct {
            animation: none;
          }
        }

        /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
        .ios-series-quiz[data-theme="light"] {
          --ios-accent: #0071e3;
          --ios-option-shadow: 0 3px 12px rgba(15, 23, 42, 0.07);
          background: #f6f8fa;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-device {
          background: #f6f8fa;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-header {
          border-color: #e6eaef;
          background: #f6f8fa;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-icon-button {
          border-color: #e6eaef;
          color: #57606a;
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-icon-button.is-active {
          border-color: #0071e3;
          color: #0071e3;
          background: #e8f2fe;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-num {
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-solution,
        .ios-series-quiz[data-theme="light"] .ios-series-ai-btn {
          border-color: #d8dee4;
          background: #ffffff;
          color: #424a53;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-solution:active,
        .ios-series-quiz[data-theme="light"] .ios-series-ai-btn:active {
          border-color: #c8d0d9;
          background: #f1f4f7;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-rail {
          border-color: #e6eaef;
          background: #f6f8fa;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question {
          border-color: #e1e4e8;
          background: #ffffff;
          color: #9aa0a6;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question::after {
          color: #73777c;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-current {
          color: #1d1d1f;
          background: #ffffff;
          border-color: #5f6368;
          box-shadow: inset 0 0 0 1px rgba(29, 29, 31, 0.06);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-correct,
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-answered {
          border-color: #d8dce0;
          background: #f3f4f5;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-wrong {
          border-color: #d8dce0;
          background: #f3f4f5;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-question.is-unsubmitted {
          border-color: #d8dce0;
          background: #eef0f2;
          color: #30343a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-meta-row {
          color: #57606a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-meta-separator {
          color: rgba(87, 96, 106, 0.42);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-exam-details summary {
          color: #424a53;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-exam-details[open]
          summary {
          color: #1d1d1f;
          background: #e6eaef;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-exam-popover {
          border-color: #d8dee4;
          color: #1d1d1f;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question-card {
          border-color: #e6eaef;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-bookmark {
          color: #57606a;
          background: transparent;
          box-shadow: none;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-bookmark:active {
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-prompt {
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option {
          border-color: #d8dee4;
          background: #ffffff;
          color: #1d1d1f;
          box-shadow: var(--ios-option-shadow);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-value {
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option:not(:disabled):hover {
          border-color: rgba(0, 113, 227, 0.4);
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-letter {
          border-color: transparent;
          background: #e6eaef;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-selected {
          border-color: #0071e3;
          background: #e6eaef;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-selected
          .ios-series-option-letter {
          color: #ffffff;
          background: #0071e3;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-correct {
          border-color: #e6eaef;
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-correct
          .ios-series-option-letter {
          color: #ffffff;
          background: #16a34a;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-wrong {
          border-color: #e6eaef;
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-user-answer.is-correct {
          border-color: rgba(22, 163, 74, 0.34);
          box-shadow:
            0 0 0 1px rgba(22, 163, 74, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(220, 38, 38, 0.36);
          box-shadow:
            0 0 0 1px rgba(220, 38, 38, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-your-answer {
          color: #6e7781;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-wrong
          .ios-series-option-letter {
          color: #ffffff;
          background: #dc2626;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer {
          border-top-color: #d8dee4;
          background: linear-gradient(
            180deg,
            rgba(246, 248, 250, 0),
            rgba(246, 248, 250, 0.96) 25%,
            #f6f8fa
          );
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-secondary {
          border-color: #e6eaef;
          background: #ffffff;
          color: #57606a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-primary {
          background: var(--ios-accent);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 16px -4px rgba(0, 113, 227, 0.5);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-panel {
          border-color: #e6eaef;
          background: #f6f8fa;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-title {
          color: #1d1d1f;
          border-bottom-color: #e6eaef;
          background: #f6f8fa;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-title button {
          border-color: #e6eaef;
          background: #ffffff;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button {
          border-color: #e6eaef;
          background: #ffffff;
          color: #1d1d1f;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-current {
          color: #ffffff;
          background: #0071e3;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-correct,
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-answered {
          border-color: #a5d6a7;
          background: #e8f5e9;
          color: #2e7d32;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-wrong {
          border-color: #ef9a9a;
          background: #ffebee;
          color: #c62828;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-unsubmitted {
          border-color: #ffe082;
          background: #fff8e1;
          color: #f57f17;
        }
      `}</style>
    </div>
  );
}
