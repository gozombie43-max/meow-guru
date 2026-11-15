"use client";
import "./DesktopQuizView.css";
import "./custom-text-size.css";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { Bookmark, BookmarkCheck, Settings, XCircle } from "lucide-react";
import BackButton from "@/components/BackButton";
import { LangToggle } from "@/components/LangToggle";
import MathRenderer from "@/components/MathRenderer";
import RichContent from "@/components/RichContent";
import { OptionTickIcon, QuizSettingsModal } from "@/features/quiz/components/ui/QuizSettingsModal";
import { ConceptBadge } from "@/features/quiz/components/ui/SharedUI";
import { formatMathBookSolutionLines, getQuestionStatus } from "@/features/quiz/model/utils";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";
import transitionStyles from "./question-transition.module.css";

const QuizChatbot = dynamic(() => import("@/components/QuizChatbot"), {
  ssr: false,
});

export type DesktopQuizFields = Pick<
  QuizController,
  | "routeBase"
  | "slug"
  | "subjectConfig"
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
  configuration: Pick<DesktopQuizFields, "routeBase" | "slug" | "subjectConfig" | "themeStyles" | "title" | "modeLabels" | "mode" | "toggleTheme">;
  question: Pick<DesktopQuizFields, "activeLang" | "isTranslating" | "setActiveLang" | "currentQ" | "handleBookmark" | "bookmarked" | "hasQuestionText" | "displayedQuestion" | "renderQuestionLine" | "displayedOptions" | "displayedSolution">;
  navigation: Pick<DesktopQuizFields, "questions" | "currentIndex" | "selectedAnswers" | "submittedQuestions" | "activeMacBtnRef" | "goToQuestion" | "handlePrev" | "handleNext">;
  answer: Pick<DesktopQuizFields, "isCurrentSubmitted" | "selectedAnswer" | "handleSelectAnswer" | "submitError" | "canViewSolution" | "handleSubmitCurrent" | "canSubmit">;
  solution: Pick<DesktopQuizFields, "openSolution" | "isSolutionOpen" | "closeSolution">;
  settings: Pick<DesktopQuizFields, "isSettingsOpen" | "setIsSettingsOpen" | "hideQuestionNumbers" | "handleToggleHideQuestionNumbers" | "hideViewSolution" | "handleToggleHideViewSolution" | "hideAiTutor" | "handleToggleHideAiTutor" | "handleToggleHideBoth" | "textSize" | "handleSetTextSize" | "textWeight" | "handleSetTextWeight" | "spacing" | "handleSetSpacing">;
}

type SidebarMode = "palette" | "solution" | "ai";

export function DesktopQuizView({ configuration, question, navigation, answer, solution, settings }: DesktopQuizViewProps) {
  "use no memo"; // Virtualizer methods read mutable scroll state.
  const { routeBase, slug, subjectConfig, themeStyles, title, modeLabels, mode, toggleTheme } = configuration;
  const { activeLang, isTranslating, setActiveLang, currentQ, handleBookmark, bookmarked, hasQuestionText, displayedQuestion, renderQuestionLine, displayedOptions, displayedSolution } = question;
  const { questions, currentIndex, selectedAnswers, submittedQuestions, activeMacBtnRef, goToQuestion, handlePrev, handleNext } = navigation;
  const { isCurrentSubmitted, selectedAnswer, handleSelectAnswer, submitError, canViewSolution, handleSubmitCurrent, canSubmit } = answer;
  const { openSolution, isSolutionOpen, closeSolution } = solution;
  const { isSettingsOpen, setIsSettingsOpen, hideQuestionNumbers, handleToggleHideQuestionNumbers, hideViewSolution, handleToggleHideViewSolution, hideAiTutor, handleToggleHideAiTutor, handleToggleHideBoth, textSize, handleSetTextSize, textWeight, handleSetTextWeight, spacing, handleSetSpacing } = settings;

  const [sidebarPanel, setSidebarPanel] = useState<{
    questionId: string;
    mode: SidebarMode;
  }>({ questionId: "", mode: "palette" });

  const currentQuestionId = String(currentQ?.id ?? "");
  const activeSidebarMode: SidebarMode =
    sidebarPanel.questionId === currentQuestionId
      ? sidebarPanel.mode
      : isSolutionOpen && canViewSolution && !hideViewSolution
        ? "solution"
        : "palette";

  const selectSidebarMode = (nextMode: SidebarMode) => {
    setSidebarPanel({ questionId: currentQuestionId, mode: nextMode });
    if (nextMode === "solution") {
      openSolution();
    } else if (isSolutionOpen) {
      closeSolution();
    }
  };

  const toggleSidebarMode = (targetMode: "solution" | "ai") => {
    if (activeSidebarMode === targetMode) {
      selectSidebarMode("palette");
    } else {
      selectSidebarMode(targetMode);
    }
  };

  const paletteRef = useRef<HTMLDivElement | null>(null);
  const large = questions.length > 100;
  // eslint-disable-next-line react-hooks/incompatible-library -- This component opts out above and retains the instance locally.
  const palette = useVirtualizer({
    count: Math.ceil(questions.length / 5),
    getScrollElement: () => paletteRef.current,
    estimateSize: () => 46,
    overscan: 3,
    enabled: large && activeSidebarMode === "palette",
    initialRect: { width: 296, height: 600 },
  });

  useEffect(() => {
    if (large && activeSidebarMode === "palette") {
      palette.scrollToIndex(Math.floor(currentIndex / 5), { align: "auto" });
    }
  }, [large, currentIndex, palette, activeSidebarMode]);

  const rawSolution = displayedSolution ?? currentQ?.solution ?? "";
  const solutionLines = useMemo(
    () => formatMathBookSolutionLines(rawSolution),
    [rawSolution],
  );
  const solutionHasImage = /!\[[^\]]*\]\([^)]+\)/.test(rawSolution);

  if (!currentQ) return null;

  const isBookmarked = bookmarked.has(String(currentQ.id));
  const modeLabel = modeLabels[mode] || "Quiz";
  const correctOptionLabel =
    currentQ.correctAnswer >= 0 && currentQ.correctAnswer < 26
      ? String.fromCharCode(65 + currentQ.correctAnswer)
      : "A";
  const correctOptionText =
    displayedOptions[currentQ.correctAnswer] ?? currentQ.answer ?? "";
  const showSidebarTabs =
    isCurrentSubmitted && ((canViewSolution && !hideViewSolution) || !hideAiTutor);

  return (
    <div
      className={`mac-series-quiz ${subjectConfig.cssClassName}`}
      data-theme="light"
      data-text-size={textSize}
      data-custom-text-size={typeof textSize === "number" ? "true" : undefined}
      style={typeof textSize === "number" ? ({ "--quiz-custom-text-size": `${textSize}px` } as CSSProperties) : undefined}
      data-spacing={spacing}
      data-text-weight={textWeight}
    >
      {themeStyles}
      <div className="mac-series-desktop">
        <div className="mac-series-window">
          <header data-meow-component="app-header" className="mac-series-header">
            <div className="mac-series-header-left">
              <BackButton href={routeBase ?? `/${subjectConfig.subjectId}/${slug}`} label="Leave quiz" />
              <span className="mac-series-header-divider" aria-hidden="true" />
              <div className="mac-series-title">{title}</div>
              <span className="mac-series-mode-pill">{modeLabel}</span>
            </div>

            <div className="mac-series-header-right">
              <span className="mac-series-progress-pill">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <LangToggle
                active={activeLang}
                loading={isTranslating}
                onChange={setActiveLang}
              />
              {setIsSettingsOpen && (
                <button
                  type="button"
                  className={`mac-series-icon-button ${isSettingsOpen ? "is-active" : ""}`}
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  aria-label="Quiz settings"
                >
                  <Settings aria-hidden="true" />
                </button>
              )}
            </div>
          </header>

          {setIsSettingsOpen && (
            <QuizSettingsModal
              isOpen={Boolean(isSettingsOpen)}
              onClose={() => setIsSettingsOpen(false)}
              theme="light"
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
            <aside
              className={`mac-series-sidebar ${activeSidebarMode !== "palette" ? "is-panel-open" : ""}`}
            >
              <div className="mac-sidebar-header">
                {showSidebarTabs ? (
                  <div className="mac-sidebar-tabs" role="tablist" aria-label="Sidebar view">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSidebarMode === "palette"}
                      className={`mac-sidebar-tab ${activeSidebarMode === "palette" ? "is-active" : ""}`}
                      onClick={() => selectSidebarMode("palette")}
                    >
                      <span>Questions</span>
                      <span className="mac-sidebar-tab-badge">
                        {submittedQuestions.size}/{questions.length}
                      </span>
                    </button>
                    {canViewSolution && !hideViewSolution && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeSidebarMode === "solution"}
                        className={`mac-sidebar-tab ${activeSidebarMode === "solution" ? "is-active" : ""}`}
                        onClick={() => selectSidebarMode("solution")}
                      >
                        Solution
                      </button>
                    )}
                    {!hideAiTutor && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeSidebarMode === "ai"}
                        className={`mac-sidebar-tab ${activeSidebarMode === "ai" ? "is-active" : ""}`}
                        onClick={() => selectSidebarMode("ai")}
                      >
                        AI Tutor
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mac-sidebar-title">
                    <span>Questions</span>
                    <span className="mac-sidebar-count">
                      {submittedQuestions.size} / {questions.length}
                    </span>
                  </div>
                )}

                {activeSidebarMode === "palette" && (
                  <div className="mac-sidebar-legend" aria-hidden="true">
                    <span className="mac-legend-item">
                      <i className="mac-legend-dot is-current" />
                      Current
                    </span>
                    <span className="mac-legend-item">
                      <i className="mac-legend-dot is-answered" />
                      Correct
                    </span>
                    <span className="mac-legend-item">
                      <i className="mac-legend-dot is-wrong" />
                      Wrong
                    </span>
                  </div>
                )}
              </div>

              {activeSidebarMode === "palette" && (
                <div ref={paletteRef} className="mac-series-palette-grid-wrap">
                  <div
                    className="mac-series-palette-grid"
                    style={large ? { display: "block", position: "relative", height: palette.getTotalSize() } : undefined}
                  >
                    {(large
                      ? palette.getVirtualItems().flatMap((row) =>
                          questions
                            .slice(row.index * 5, row.index * 5 + 5)
                            .map((qItem, column) => ({
                              question: qItem,
                              index: row.index * 5 + column,
                              start: row.start,
                              column,
                            })),
                        )
                      : questions.map((qItem, index) => ({
                          question: qItem,
                          index,
                          start: 0,
                          column: 0,
                        }))
                    ).map(({ question: qItem, index, start, column }) => {
                      const status = getQuestionStatus({
                        index,
                        currentIndex,
                        selectedAnswers,
                        questions,
                        submittedQuestions,
                      });
                      return (
                        <button
                          key={`mac-palette-${qItem.id}-${index}`}
                          type="button"
                          ref={index === currentIndex ? activeMacBtnRef : null}
                          aria-label={`Go to question ${index + 1}`}
                          aria-current={index === currentIndex ? "step" : undefined}
                          style={
                            large
                              ? {
                                  position: "absolute",
                                  top: start,
                                  left: `calc(${column} * (100% + 8px) / 5)`,
                                  width: "calc((100% - 32px) / 5)",
                                  height: 38,
                                }
                              : undefined
                          }
                          className={`mac-palette-btn ${status === "current" ? "is-current" : ""} ${status === "answered" || status === "correct" ? "is-answered" : ""} ${status === "wrong" ? "is-wrong" : ""}`}
                          onClick={() => goToQuestion(index + 1)}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSidebarMode === "solution" && (
                <div className="mac-sidebar-solution" aria-label="Question solution">
                  <div className="mac-sidebar-solution-summary">
                    <span className="mac-sidebar-solution-badge">
                      Option ({correctOptionLabel}) is correct
                    </span>
                    {correctOptionText && (
                      <div className="mac-sidebar-solution-answer">
                        <RichContent text={correctOptionText} />
                      </div>
                    )}
                  </div>

                  <div className="mac-sidebar-solution-body">
                    {solutionLines.length > 0 ? (
                      solutionHasImage ? (
                        <RichContent text={rawSolution} />
                      ) : (
                        solutionLines.map((line: string, index: number) => {
                          const isDisplayEquation = /^\\\[[\s\S]*\\\]$/.test(line);
                          return (
                            <div
                              key={`desktop-sol-line-${index}`}
                              className={`mac-sidebar-solution-step ${isDisplayEquation ? "is-equation" : ""}`}
                            >
                              <MathRenderer text={line} className="leading-relaxed" />
                            </div>
                          );
                        })
                      )
                    ) : (
                      <p className="mac-sidebar-solution-empty">
                        Solution is not available for this question yet.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeSidebarMode === "ai" && !hideAiTutor && (
                <div className="mac-sidebar-ai">
                  <QuizChatbot
                    key={`inline-ai-${currentQ.id}`}
                    inline
                    open
                    onOpenChange={(open) => {
                      if (!open) selectSidebarMode("palette");
                    }}
                    isVisible={isCurrentSubmitted}
                    questionNumber={currentIndex + 1}
                    topicTitle={title}
                    question={currentQ}
                    theme="light"
                    activeLang={activeLang}
                  />
                </div>
              )}
            </aside>

            <main className="mac-series-main">
              <div className="mac-series-canvas">
                <div className="mac-series-content">
                  <section
                    key={currentQ.id}
                    className={`mac-series-question-card ${transitionStyles.desktop}`}
                  >
                    <div className="mac-series-meta-row">
                      <span className="mac-series-q-badge">Q{currentIndex + 1}</span>
                      {currentQ.concept && (
                        <span className="mac-series-concept-pill">
                          <ConceptBadge concept={currentQ.concept} />
                        </span>
                      )}
                      <span className="mac-series-exam-pill">
                        {currentQ.exam || `${title} concept practice`}
                      </span>

                      <button
                        type="button"
                        className={`mac-series-bookmark ${isBookmarked ? "is-bookmarked" : ""}`}
                        onClick={handleBookmark}
                        aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                      >
                        {isBookmarked ? (
                          <BookmarkCheck aria-hidden="true" />
                        ) : (
                          <Bookmark aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {hasQuestionText && (
                      <div className="mac-series-prompt">
                        <RichContent
                          criticalImages
                          imageDimensions={{
                            width: currentQ.questionImageWidth,
                            height: currentQ.questionImageHeight,
                          }}
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
                      const isRevealed = isCurrentSubmitted && currentQ.correctAnswer >= 0;
                      const isCorrect = isRevealed && index === currentQ.correctAnswer;
                      const isWrong =
                        isRevealed &&
                        selectedAnswer === index &&
                        index !== currentQ.correctAnswer;
                      const isSelected = selectedAnswer === index;
                      const isUserAnswer = isCurrentSubmitted && isSelected;
                      const isDimmed = isRevealed && !isCorrect && !isWrong;

                      return (
                        <button
                          key={`${currentQ.id}-${index}`}
                          type="button"
                          disabled={isCurrentSubmitted}
                          onClick={() => handleSelectAnswer(index)}
                          className={`mac-series-option ${isSelected && !isCurrentSubmitted ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${isUserAnswer ? "is-user-answer" : ""} ${isDimmed ? "is-dimmed" : ""}`}
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
                                  {isCorrect || isWrong ? "Your answer" : "Checking…"}
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
                </div>
              </div>

              <footer className="mac-series-actions">
                <div className="mac-series-actions-inner">
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

                    <div className="mac-series-footer-right">
                      {canViewSolution && !hideViewSolution && (
                        <button
                          type="button"
                          className={`mac-series-footer-solution ${activeSidebarMode === "solution" ? "is-active" : ""}`}
                          onClick={() => toggleSidebarMode("solution")}
                        >
                          {activeSidebarMode === "solution" ? "Hide solution" : "View solution"}
                        </button>
                      )}
                      {isCurrentSubmitted && !hideAiTutor && (
                        <button
                          type="button"
                          className={`mac-series-footer-ai ${activeSidebarMode === "ai" ? "is-active" : ""}`}
                          onClick={() => toggleSidebarMode("ai")}
                        >
                          {activeSidebarMode === "ai" ? "Hide AI Tutor" : "Ask AI Tutor"}
                        </button>
                      )}
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
                </div>
              </footer>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
