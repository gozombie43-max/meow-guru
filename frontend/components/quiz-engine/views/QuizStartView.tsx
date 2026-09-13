"use client";
import {
  SeriesConceptStart,
  SeriesFormulaStart,
} from "@/components/quiz-engine/ui/SeriesStartViews";
import { QuizResumeDialog } from "../ui/QuizResumeDialog";
import type { QuizController } from "../hooks/useQuizController";
import styles from "./QuizStartView.module.css";
export function QuizStartView({
  isClassificationConceptMode,
  subjectConfig,
  title,
  slug,
  routeBase,
  classificationGroups,
  groupingStatus,
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
  | "groupingStatus"
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
        groupingStatus={groupingStatus}
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
        groupingStatus={groupingStatus}
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
    <div className={styles.wrapper}>
      <div
        className={`${styles.content} ${resumeData ? styles.isBlurred : ""}`}
        aria-hidden={Boolean(resumeData)}
      >
        {startScreen}
      </div>
      {resumeData && (
        <QuizResumeDialog
          theme={theme}
          currentIndex={resumeData.currentIndex ?? 0}
          answered={resumeData.submittedQuestions?.length ?? 0}
          total={availableCount}
          onResume={handleResume}
          onRestart={handleRestartFromPopup}
          onCancel={handleCancelResume}
        />
      )}
    </div>
  );
}
