"use client";
import { MacOsQuizStartStudioProps } from './seriesStart.model';
import { MacOsQuizStartStudio } from './MacOsQuizStartStudio';
import { IosQuizStartMobile } from './IosQuizStartMobile';

import { SubjectConfig, ClassificationGroup, QuizMode } from "@/features/quiz/model/types";
import { useQuizTheme } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";

// ── Complete Topic Icon Mapping Across All 4 Subjects ────────────────────────

// ── Subject Fallback Icons ───────────────────────────────────────────────────

// ── Mode Metadata ─────────────────────────────────────────────────────────────

// ── Alphabet definition for letter filtering ──────────────────────────────────

// ── macOS Unified Quiz Start Studio Component ─────────────────────────────────

// ── iOS Mobile Quiz Start Component (< 768px) ─────────────────────────────────

// ── Responsive Unified Wrapper ────────────────────────────────────────────────
function UnifiedQuizStartView(props: MacOsQuizStartStudioProps) {
  const quizTheme = useQuizTheme();

  return (
    <div className={styles.pageRoot} data-theme={quizTheme}>
      {/* Desktop PC View (macOS Studio Layout >= 768px) */}
      <div className={styles.desktopContainer}>
        <MacOsQuizStartStudio {...props} />
      </div>

      {/* Mobile Handheld View (iOS Style Layout < 768px) */}
      <div className={styles.mobileContainer}>
        <IosQuizStartMobile {...props} />
      </div>
    </div>
  );
}

export function SeriesConceptStart(props: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}) {
  return <UnifiedQuizStartView {...props} mode="concept" />;
}

export function SeriesFormulaStart(props: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode: QuizMode;
  examFilter: string;
  examOptions: string[];
  questionCount: number;
  onExamChange: (exam: string) => void;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  search?: string;
  selected: Set<string>;
  conceptCount: number;
  selectedLetters?: Set<string>;
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: () => void;
  letterCounts?: Record<string, number>;
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}) {
  return <UnifiedQuizStartView {...props} />;
}
