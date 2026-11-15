"use client";
import { MacOsQuizStartStudioProps } from "./seriesStart.model";
import { MacOsQuizStartStudio } from "./MacOsQuizStartStudio";
import { IosQuizStartMobile } from "./IosQuizStartMobile";
import { useQuizTheme } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";

export function UnifiedQuizStartView(props: MacOsQuizStartStudioProps) {
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
