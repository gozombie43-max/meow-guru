"use client";
import { UnifiedQuizStartView } from "@/features/quiz/components/ui/SeriesStartViews";
import { QuizResumeDialog } from "@/features/quiz/components/ui/QuizResumeDialog";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";
import styles from "@/features/quiz/components/views/QuizStartView.module.css";

export function QuizStartView({
  subjectConfig,
  title,
  slug,
  routeBase,
  classificationGroups,
  groupingStatus,
  examFilter,
  examOptions,
  selectedClassificationConcepts,
  conceptOptions,
  availableCount,
  isLoading,
  setExamFilter,
  setSelectedClassificationConcepts,
  handleStart,
  mode,
  classificationSearch,
  selectedLetters,
  handleToggleLetter,
  handleSelectAllLetters,
  letterCounts,
  setClassificationSearch,
  resumeData,
  theme,
  handleResume,
  handleRestartFromPopup,
  handleCancelResume,
}: Pick<
  QuizController,
  | "subjectConfig"
  | "title"
  | "slug"
  | "routeBase"
  | "classificationGroups"
  | "groupingStatus"
  | "examFilter"
  | "examOptions"
  | "selectedClassificationConcepts"
  | "conceptOptions"
  | "availableCount"
  | "isLoading"
  | "setExamFilter"
  | "setSelectedClassificationConcepts"
  | "handleStart"
  | "mode"
  | "classificationSearch"
  | "selectedLetters"
  | "handleToggleLetter"
  | "handleSelectAllLetters"
  | "letterCounts"
  | "setClassificationSearch"
  | "resumeData"
  | "theme"
  | "handleResume"
  | "handleRestartFromPopup"
  | "handleCancelResume"
>) {
  const handleToggleGroup = (concepts: string[]) => {
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
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.content} ${resumeData ? styles.isBlurred : ""}`}
        aria-hidden={Boolean(resumeData)}
      >
        <UnifiedQuizStartView
          subjectConfig={subjectConfig}
          title={title}
          slug={slug}
          routeBase={routeBase}
          mode={mode}
          groups={classificationGroups}
          groupingStatus={groupingStatus}
          examFilter={examFilter}
          examOptions={examOptions}
          selected={selectedClassificationConcepts}
          conceptCount={conceptOptions.length}
          questionCount={availableCount}
          isLoading={isLoading}
          search={classificationSearch}
          selectedLetters={selectedLetters}
          onToggleLetter={handleToggleLetter}
          onSelectAllLetters={handleSelectAllLetters}
          letterCounts={letterCounts}
          onExamChange={setExamFilter}
          onSearchChange={setClassificationSearch}
          onToggleGroup={handleToggleGroup}
          onStart={handleStart}
        />
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
