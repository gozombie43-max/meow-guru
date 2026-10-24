"use client";

import styles from "./ResultView.module.css";
import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  CircleCheck,
  Clock,
  Flame,
  Layers,
  LayoutGrid,
  ListChecks,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

export type ResultViewProps = Pick<
  QuizController,
  | "subjectConfig"
  | "theme"
  | "themeStyles"
  | "modeLabels"
  | "mode"
  | "stats"
  | "bestStreak"
  | "results"
  | "questions"
  | "conceptOptions"
  | "conceptColours"
  | "weakConcepts"
  | "handleRestart"
  | "routeBase"
  | "slug"
> &
  Partial<
    Pick<
      QuizController,
      "title" | "toggleTheme" | "showQuestion" | "availableCount"
    >
  >;

export function ResultView({
  subjectConfig,
  title,
  theme,
  themeStyles,
  modeLabels,
  mode,
  stats,
  bestStreak,
  results,
  questions,
  availableCount,
  conceptOptions,
  weakConcepts,
  handleRestart,
  showQuestion,
  routeBase,
  slug,
}: ResultViewProps) {
  const parentHref = routeBase ?? `/${subjectConfig.subjectId}/${slug}`;
  const allTopicsHref = `/${subjectConfig.subjectId}`;
  const modeLabel = modeLabels[mode] || "PYQ";
  const displayTitle = title || subjectConfig.subjectLabel || "Quiz Session";

  const attempted = results.length;
  const totalQuestions = Math.max(
    questions.length,
    availableCount ?? 0,
    attempted,
  );
  const unattempted = Math.max(0, totalQuestions - attempted);
  const completionPct =
    totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0;
  const totalTimeSeconds = results.reduce(
    (sum, item) => sum + (item.timeTaken || 0),
    0,
  );

  // Circular gauge geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clampedAccuracy = Math.max(0, Math.min(100, stats.accuracy));
  const strokeDashoffset =
    circumference - (clampedAccuracy / 100) * circumference;

  const gaugeStrokeColor =
    attempted === 0
      ? "var(--rv-accent)"
      : stats.accuracy >= 70
        ? "var(--rv-correct-solid)"
        : stats.accuracy >= 40
          ? "var(--rv-amber-solid)"
          : "var(--rv-wrong-solid)";

  const performanceTier =
    attempted === 0
      ? { label: "Session Ended", className: styles.tierGood }
      : stats.accuracy >= 75
        ? { label: "Excellent Mastery", className: styles.tierExcellent }
        : stats.accuracy >= 45
          ? { label: "Solid Progress", className: styles.tierGood }
          : { label: "Needs Practice", className: styles.tierPractice };

  // Build Concept Breakdown from actual session results so it never renders empty
  const conceptStatsMap = new Map<
    string,
    { concept: string; correct: number; total: number; pct: number }
  >();

  for (const option of conceptOptions) {
    const matching = results.filter((r) => r.concept === option);
    if (matching.length > 0) {
      const correctCount = matching.filter((r) => r.isCorrect).length;
      conceptStatsMap.set(option, {
        concept: option,
        correct: correctCount,
        total: matching.length,
        pct: Math.round((correctCount / matching.length) * 100),
      });
    }
  }

  for (const r of results) {
    const key = r.concept?.trim() || "General";
    if (!conceptStatsMap.has(key)) {
      const matching = results.filter(
        (item) => (item.concept?.trim() || "General") === key,
      );
      const correctCount = matching.filter((item) => item.isCorrect).length;
      conceptStatsMap.set(key, {
        concept: key,
        correct: correctCount,
        total: matching.length,
        pct: Math.round((correctCount / matching.length) * 100),
      });
    }
  }

  const conceptBreakdownItems = Array.from(conceptStatsMap.values());
  const orderedResults = [...results].sort(
    (a, b) => a.questionIndex - b.questionIndex,
  );

  const correctBarWidth =
    totalQuestions > 0 ? (stats.correct / totalQuestions) * 100 : 0;
  const wrongBarWidth =
    totalQuestions > 0 ? (stats.wrong / totalQuestions) * 100 : 0;

  return (
    <div
      className={`${subjectConfig.cssClassName} ${styles.resultRoot}`}
      data-theme={theme}
    >
      {themeStyles}

      {/* ── Top Chrome Header (Matches Quiz Engine Header) ── */}
      <header data-ui-chrome="header" className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            replace
            href={parentHref}
            data-ui-button="icon"
            className={styles.headerIconBtn}
            aria-label="Back to topic"
          >
            <ChevronLeft aria-hidden="true" />
          </Link>

          <div className={styles.headerCenter}>
            <p className={styles.headerTitle}>{displayTitle}</p>
            <span className={styles.headerSubtitle}>
              {modeLabel} • Session Summary
            </span>
          </div>

          <span className={styles.headerSpacer} aria-hidden="true" />
        </div>
      </header>

      {/* ── Main Scrollable Content Body ── */}
      <main className={styles.main}>
        <div className={styles.mainInner}>
          {/* 1. Hero Performance Summary Card */}
        <section className={styles.heroCard} aria-label="Session overview">
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <div className={styles.badgeRow}>
                <span className={styles.modeBadge}>
                  <Sparkles size={12} aria-hidden="true" />
                  <span>{modeLabel} Mode</span>
                </span>
                <span
                  className={`${styles.tierBadge} ${performanceTier.className}`}
                >
                  {performanceTier.label}
                </span>
              </div>

              <h1 className={styles.heroTitle}>
                Session{" "}
                <span className={styles.heroTitleAccent}>Complete</span>
              </h1>
              <p className={styles.heroDescription}>
                Here is how you performed in this {modeLabel} session.
              </p>
            </div>

            {/* Precision Accuracy Ring */}
            <div
              className={styles.gaugeWrap}
              role="img"
              aria-label={`Accuracy ${stats.accuracy}%`}
            >
              <svg
                className={styles.gaugeSvg}
                viewBox="0 0 92 92"
                aria-hidden="true"
              >
                <circle
                  className={styles.gaugeTrack}
                  cx="46"
                  cy="46"
                  r={radius}
                />
                <circle
                  className={styles.gaugeFill}
                  cx="46"
                  cy="46"
                  r={radius}
                  stroke={gaugeStrokeColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <span className={styles.gaugeValue}>{stats.accuracy}%</span>
                <span className={styles.gaugeLabel}>Accuracy</span>
              </div>
            </div>
          </div>

          {/* Segmented Session Progress Bar */}
          <div className={styles.distributionBlock}>
            <div className={styles.segmentedBar} aria-hidden="true">
              {stats.correct > 0 && (
                <div
                  className={styles.segmentCorrect}
                  style={{ width: `${Math.max(3, correctBarWidth)}%` }}
                />
              )}
              {stats.wrong > 0 && (
                <div
                  className={styles.segmentWrong}
                  style={{ width: `${Math.max(3, wrongBarWidth)}%` }}
                />
              )}
              <div className={styles.segmentSkipped} style={{ flex: 1 }} />
            </div>

            <div className={styles.distributionLegend}>
              <div className={styles.legendItems}>
                <span className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: "var(--rv-correct-solid)" }}
                  />
                  {stats.correct} Correct
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: "var(--rv-wrong-solid)" }}
                  />
                  {stats.wrong} Wrong
                </span>
                {unattempted > 0 && (
                  <span className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      style={{ background: "var(--rv-text-muted)" }}
                    />
                    {unattempted} Remaining
                  </span>
                )}
              </div>
              <span className={styles.legendCompletion}>
                {attempted} / {totalQuestions} Done ({completionPct}%)
              </span>
            </div>
          </div>
        </section>

        {/* 2. Redesigned 6-Card Metrics Grid */}
        <section className={styles.metricsGrid} aria-label="Performance metrics">
          {/* Correct */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Correct</span>
              <span className={`${styles.metricIconBox} ${styles.iconCorrect}`}>
                <CircleCheck size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valueCorrect}`}>
                {stats.correct}
              </div>
              <span className={styles.metricSub}>
                {attempted > 0
                  ? `${stats.correct} of ${attempted} answered`
                  : "No answers yet"}
              </span>
            </div>
          </div>

          {/* Wrong */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Wrong</span>
              <span className={`${styles.metricIconBox} ${styles.iconWrong}`}>
                <XCircle size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valueWrong}`}>
                {stats.wrong}
              </div>
              <span className={styles.metricSub}>
                {stats.wrong === 0 && attempted > 0
                  ? "Zero mistakes"
                  : `${stats.wrong} incorrect`}
              </span>
            </div>
          </div>

          {/* Accuracy */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Accuracy</span>
              <span className={`${styles.metricIconBox} ${styles.iconAccent}`}>
                <Target size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valueAccent}`}>
                {stats.accuracy}%
              </div>
              <span className={styles.metricSub}>Overall precision</span>
            </div>
          </div>

          {/* Avg Time */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Avg Time</span>
              <span className={`${styles.metricIconBox} ${styles.iconAmber}`}>
                <Clock size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valueAmber}`}>
                {stats.avgTime}s
              </div>
              <span className={styles.metricSub}>
                {totalTimeSeconds}s total time
              </span>
            </div>
          </div>

          {/* Best Streak */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Best Streak</span>
              <span className={`${styles.metricIconBox} ${styles.iconAmber}`}>
                <Flame size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={styles.metricValue}>{bestStreak}</div>
              <span className={styles.metricSub}>Consecutive correct</span>
            </div>
          </div>

          {/* Questions Done */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Questions Done</span>
              <span className={`${styles.metricIconBox} ${styles.iconAccent}`}>
                <CheckCheck size={16} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.metricBody}>
              <div className={styles.metricValue}>
                <span>{attempted}</span>
                <span className={styles.metricDenominator}>
                  / {totalQuestions}
                </span>
              </div>
              <span className={styles.metricSub}>
                {completionPct}% of set completed
              </span>
            </div>
          </div>
        </section>

        {/* 3. Interactive Session Question Map (Jump back to review any question) */}
        {orderedResults.length > 0 && (
          <section
            className={styles.sectionCard}
            aria-label="Attempted questions map"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span
                  className={`${styles.sectionIcon} ${styles.iconAccent}`}
                  aria-hidden="true"
                >
                  <ListChecks size={15} />
                </span>
                <h2 className={styles.sectionTitle}>Question Review Map</h2>
              </div>
              <span className={styles.sectionCountPill}>
                {orderedResults.length}{" "}
                {orderedResults.length === 1 ? "Question" : "Questions"}
              </span>
            </div>

            <div className={styles.questionMapGrid}>
              {orderedResults.map((item) => {
                const qNum = item.questionIndex + 1;
                return (
                  <button
                    key={`result-q-${item.questionIndex}`}
                    type="button"
                    data-ui-button="state"
                    onClick={() => showQuestion?.(item.questionIndex)}
                    className={`${styles.questionTile} ${
                      item.isCorrect
                        ? styles.questionTileCorrect
                        : styles.questionTileWrong
                    }`}
                    aria-label={`Review question ${qNum}, ${
                      item.isCorrect ? "correct" : "wrong"
                    }, ${item.timeTaken} seconds`}
                    title={`Question ${qNum} • ${
                      item.isCorrect ? "Correct" : "Wrong"
                    } (${item.timeTaken}s)`}
                  >
                    <span>{qNum}</span>
                    <span className={styles.questionTileTime}>
                      {item.timeTaken}s
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. Redesigned Concept Breakdown */}
        {conceptBreakdownItems.length > 0 && (
          <section
            className={styles.sectionCard}
            aria-label="Concept breakdown"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span
                  className={`${styles.sectionIcon} ${styles.iconAccent}`}
                  aria-hidden="true"
                >
                  <Layers size={15} />
                </span>
                <h2 className={styles.sectionTitle}>Concept Breakdown</h2>
              </div>
              <span className={styles.sectionCountPill}>
                {conceptBreakdownItems.length}{" "}
                {conceptBreakdownItems.length === 1 ? "Concept" : "Concepts"}
              </span>
            </div>

            <div className={styles.conceptList}>
              {conceptBreakdownItems.map((item) => {
                const pctClass =
                  item.pct >= 70
                    ? styles.pctHigh
                    : item.pct >= 40
                      ? styles.pctMid
                      : styles.pctLow;
                const fillColor =
                  item.pct >= 70
                    ? "var(--rv-correct-solid)"
                    : item.pct >= 40
                      ? "var(--rv-amber-solid)"
                      : "var(--rv-wrong-solid)";

                return (
                  <div key={item.concept} className={styles.conceptItem}>
                    <div className={styles.conceptItemTop}>
                      <span className={styles.conceptName}>{item.concept}</span>
                      <div className={styles.conceptMetaRight}>
                        <span className={styles.conceptFraction}>
                          {item.correct}/{item.total} correct
                        </span>
                        <span className={`${styles.conceptPctPill} ${pctClass}`}>
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                    <div className={styles.conceptBarTrack}>
                      <div
                        className={styles.conceptBarFill}
                        style={{
                          width: `${Math.max(item.pct, 4)}%`,
                          background: fillColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Redesigned Weak Areas — Needs Practice */}
        {weakConcepts.length > 0 && (
          <section
            className={styles.sectionCard}
            aria-label="Weak areas needing practice"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <span
                  className={`${styles.sectionIcon} ${styles.iconWrong}`}
                  aria-hidden="true"
                >
                  <AlertTriangle size={15} />
                </span>
                <h2 className={styles.sectionTitle}>
                  Weak Areas - Needs Practice
                </h2>
              </div>
              <span className={styles.sectionCountPill}>
                {weakConcepts.length} Flagged
              </span>
            </div>

            <div className={styles.weakList}>
              {weakConcepts.map((wc) => (
                <div key={wc.concept} className={styles.weakItem}>
                  <span className={styles.weakConceptName}>{wc.concept}</span>
                  <span className={styles.weakAccuracyBadge}>
                    {wc.accuracy}% accuracy
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </main>

      {/* ── Fixed Sticky Bottom Action Dock (Matches Quiz Engine .ios-series-dock) ── */}
      <footer data-ui-chrome="footer" className={styles.footerDock}>
        <div className={styles.footerInner}>
          <Link
            replace
            data-ui-button="secondary"
            href={parentHref}
            className={styles.secondaryActionBtn}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>Change Mode</span>
          </Link>

          <Link
            replace
            data-ui-button="secondary"
            href={allTopicsHref}
            className={styles.secondaryActionBtn}
          >
            <LayoutGrid aria-hidden="true" />
            <span>All Topics</span>
          </Link>

          <button
            type="button"
            data-ui-button="primary"
            onClick={handleRestart}
            className={styles.primaryActionBtn}
          >
            <RotateCcw aria-hidden="true" />
            <span>Practice Again</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
