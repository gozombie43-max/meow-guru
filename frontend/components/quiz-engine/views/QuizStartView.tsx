"use client";
import {
  SeriesConceptStart,
  SeriesFormulaStart,
} from "@/components/quiz-engine/ui/SeriesStartViews";
import type { QuizController } from "../hooks/useQuizController";
export function QuizStartView({
  isClassificationConceptMode,
  subjectConfig,
  title,
  slug,
  routeBase,
  classificationGroups,
  classificationCategory,
  classificationCategoryCounts,
  examFilter,
  examOptions,
  selectedClassificationConcepts,
  conceptOptions,
  availableCount,
  isLoading,
  setClassificationCategory,
  setExamFilter,
  setSelectedClassificationConcepts,
  handleStart,
  mode,
  classificationSearch,
  selectedLetters,
  handleToggleLetter,
  handleSelectAllLetters,
  letterCounts,
  availableLetters,
  setClassificationSearch,
  resumeData,
  theme,
  handleResume,
  handleRestartFromPopup,
  handleCancelResume,
}: Pick<
  QuizController,
  | "isClassificationConceptMode"
  | "subjectConfig"
  | "title"
  | "slug"
  | "routeBase"
  | "classificationGroups"
  | "classificationCategory"
  | "classificationCategoryCounts"
  | "examFilter"
  | "examOptions"
  | "selectedClassificationConcepts"
  | "conceptOptions"
  | "availableCount"
  | "isLoading"
  | "setClassificationCategory"
  | "setExamFilter"
  | "setSelectedClassificationConcepts"
  | "handleStart"
  | "mode"
  | "classificationSearch"
  | "selectedLetters"
  | "handleToggleLetter"
  | "handleSelectAllLetters"
  | "letterCounts"
  | "availableLetters"
  | "setClassificationSearch"
  | "resumeData"
  | "theme"
  | "handleResume"
  | "handleRestartFromPopup"
  | "handleCancelResume"
>) {
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
        isLoading={isLoading}
        onCategoryChange={setClassificationCategory}
        onExamChange={setExamFilter}
        onToggleGroup={(concepts) => {
          const allSelected = concepts.every((concept) =>
            selectedClassificationConcepts.has(concept),
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
        isLoading={isLoading}
        onExamChange={setExamFilter}
        groups={classificationGroups}
        category={classificationCategory}
        categoryCounts={classificationCategoryCounts}
        search={classificationSearch}
        selected={selectedClassificationConcepts}
        conceptCount={conceptOptions.length}
        selectedLetters={selectedLetters}
        onToggleLetter={handleToggleLetter}
        onSelectAllLetters={handleSelectAllLetters}
        letterCounts={letterCounts}
        availableLetters={availableLetters}
        onCategoryChange={setClassificationCategory}
        onSearchChange={setClassificationSearch}
        onToggleGroup={(concepts) => {
          const allSelected = concepts.every((concept) =>
            selectedClassificationConcepts.has(concept),
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
                    style={{
                      width: `${Math.min(100, ((resumeData.submittedQuestions?.length || 0) / availableCount) * 100)}%`,
                    }}
                  />
                </div>
                <span>
                  {resumeData.submittedQuestions?.length || 0}/{availableCount}
                </span>
              </div>
            </div>
            <div className="ios-resume-actions">
              <button
                type="button"
                className="ios-resume-btn blue action-resume"
                onClick={handleResume}
              >
                Resume
              </button>
              <button
                type="button"
                className="ios-resume-btn red action-restart"
                onClick={handleRestartFromPopup}
              >
                Restart
              </button>
              <button
                type="button"
                className="ios-resume-btn blue action-cancel"
                onClick={handleCancelResume}
              >
                Cancel
              </button>
            </div>
          </div>
          <style jsx>{`
            .ios-resume-backdrop {
              position: fixed;
              inset: 0;
              z-index: 99999;
              background: rgba(0, 0, 0, 0.6);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 24px;
              font-family:
                -apple-system, BlinkMacSystemFont, "SF Pro Text",
                "Helvetica Neue", sans-serif;
              backdrop-filter: blur(4px);
            }
            .ios-resume-modal {
              width: 100%;
              max-width: 320px;
              background: #2c2c2e;
              border-radius: 14px;
              overflow: hidden;
              box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
              border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .ios-resume-content {
              padding: 20px 16px;
              text-align: center;
              border-bottom: 0.5px solid rgba(255, 255, 255, 0.15);
            }
            .ios-resume-content h3 {
              margin: 0 0 6px 0;
              color: #fff;
              font-size: 17px;
              font-weight: 600;
            }
            .resume-question-info {
              margin: 4px 0 16px 0;
              color: #60a5fa;
              font-weight: 600;
              font-size: 15px;
            }
            .ios-resume-progress {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .ios-resume-track {
              flex: 1;
              height: 4px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 2px;
              overflow: hidden;
            }
            .ios-resume-bar {
              height: 100%;
              background: #0a84ff;
              border-radius: 2px;
            }
            .ios-resume-progress span {
              font-size: 13px;
              color: rgba(235, 235, 245, 0.6);
              font-variant-numeric: tabular-nums;
            }
            .ios-resume-actions {
              display: flex;
              flex-direction: column;
            }
            .ios-resume-btn {
              width: 100%;
              height: 50px;
              background: transparent;
              border: none;
              border-top: 0.5px solid rgba(255, 255, 255, 0.15);
              font-size: 17px;
              font-weight: 400;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .ios-resume-actions .ios-resume-btn:first-child {
              border-top: none;
            }
            .ios-resume-btn.blue {
              color: #0a84ff;
            }
            .ios-resume-btn.red {
              color: #ff453a;
            }
            .action-resume {
              font-weight: 600;
            }
            .action-cancel {
              font-weight: 400;
            }
            .ios-resume-btn:active {
              background: rgba(255, 255, 255, 0.1);
            }

            /* Light Theme Overrides */
            .ios-resume-backdrop[data-theme="light"] {
              background: rgba(0, 0, 0, 0.35);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-modal {
              background: #ffffff;
              border: 1px solid rgba(0, 0, 0, 0.1);
              box-shadow: 0 20px 48px rgba(0, 0, 0, 0.15);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-content {
              border-bottom-color: rgba(60, 60, 67, 0.18);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-content h3 {
              color: #000000;
            }
            .ios-resume-backdrop[data-theme="light"] .resume-question-info {
              color: #007aff;
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-track {
              background: rgba(0, 0, 0, 0.08);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-bar {
              background: #007aff;
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-progress span {
              color: rgba(60, 60, 67, 0.6);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-btn {
              border-top-color: rgba(60, 60, 67, 0.18);
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-btn.blue {
              color: #007aff;
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-btn.red {
              color: #ff3b30;
            }
            .ios-resume-backdrop[data-theme="light"] .ios-resume-btn:active {
              background: rgba(0, 0, 0, 0.05);
            }

            /* PC / Desktop optimization */
            @media (min-width: 640px) {
              .ios-resume-modal {
                max-width: 440px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 18px;
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
              }
              .ios-resume-actions {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                border-top: 0.5px solid rgba(255, 255, 255, 0.15);
              }
              .ios-resume-btn {
                height: 48px;
                font-size: 16px;
                border-top: none !important;
                border-right: 0.5px solid rgba(255, 255, 255, 0.15);
              }
              .ios-resume-btn:last-child {
                border-right: none;
              }
              .action-cancel {
                order: 1;
                font-weight: 500;
                color: rgba(235, 235, 245, 0.7);
              }
              .action-restart {
                order: 2;
                font-weight: 500;
              }
              .action-resume {
                order: 3;
                font-weight: 600;
              }

              .ios-resume-backdrop[data-theme="light"] .ios-resume-actions {
                border-top-color: rgba(60, 60, 67, 0.18);
              }
              .ios-resume-backdrop[data-theme="light"] .ios-resume-btn {
                border-right-color: rgba(60, 60, 67, 0.18);
              }
              .ios-resume-backdrop[data-theme="light"] .action-cancel {
                color: rgba(60, 60, 67, 0.65);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
