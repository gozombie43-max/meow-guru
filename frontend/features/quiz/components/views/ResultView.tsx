"use client";

import styles from "./ResultView.module.css";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  Flame,
  Layers,
  LayoutGrid,
  ListChecks,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

function CelebrationBadgeIcon() {
  return (
    <div className={styles.celebrationBadgeWrap} aria-hidden="true">
      <svg viewBox="0 0 210 104" width="210" height="104" fill="none">
        <defs>
          <linearGradient id="rv-rosette-grad" x1="78" y1="16" x2="132" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <linearGradient id="rv-ribbon-left" x1="88" y1="68" x2="78" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="rv-ribbon-right" x1="122" y1="68" x2="132" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>

        <path d="M90 66l-13 28 11-5 7 8 7-26z" fill="url(#rv-ribbon-left)" />
        <path d="M120 66l13 28-11-5-7 8-7-26z" fill="url(#rv-ribbon-right)" />

        <path
          d="M105 15c3.2 0 5.4 2.8 8.3 3.7 3 1 6.4-.4 9 1.5 2.6 1.8 2.8 5.4 4.7 8 1.9 2.5 5.4 3.4 6.4 6.4 1 3-.9 6.1-.9 9.3 0 3.2 1.9 6.3.9 9.3-1 3-4.5 3.9-6.4 6.4-1.9 2.6-2.1 6.2-4.7 8-2.6 1.9-6 .5-9 1.5-2.9.9-5.1 3.7-8.3 3.7s-5.4-2.8-8.3-3.7c-3-1-6.4.4-9-1.5-2.6-1.8-2.8-5.4-4.7-8-1.9-2.5-5.4-3.4-6.4-6.4-1-3 .9-6.1.9-9.3 0-3.2-1.9-6.3-.9-9.3 1-3 4.5-3.9 6.4-6.4 1.9-2.6 2.1-6.2 4.7-8 2.6-1.9 6-.5 9-1.5 2.9-.9 5.1-3.7 8.3-3.7z"
          fill="url(#rv-rosette-grad)"
        />
        <circle cx="105" cy="45" r="21" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        <path
          d="M95.5 45.5l6.5 6.8 13-13.6"
          stroke="#ffffff"
          strokeWidth="4.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <rect x="44" y="13" width="12" height="5" rx="2.5" transform="rotate(-38 44 13)" fill="#3b82f6" />
        <rect x="20" y="34" width="14" height="5.5" rx="2.75" transform="rotate(-44 20 34)" fill="#9333ea" />
        <rect x="44" y="56" width="12" height="5" rx="2.5" transform="rotate(42 44 56)" fill="#fb923c" />
        <circle cx="31" cy="76" r="2.2" fill="#818cf8" />
        <path d="M56 26l1.5 3.5L61 31l-3.5 1.5L56 36l-1.5-3.5L51 31l3.5-1.5z" fill="#818cf8" />
        <path d="M21 56l1.6 3.8L26.5 61.5l-3.9 1.6L21 67l-1.6-3.9-3.9-1.6 3.9-1.7z" fill="#fbbf24" />

        <rect x="148" y="16" width="11" height="4.8" rx="2.4" transform="rotate(-42 148 16)" fill="#9333ea" />
        <rect x="160" y="34" width="14" height="5.2" rx="2.6" transform="rotate(-42 160 34)" fill="#f43f5e" />
        <rect x="188" y="42" width="11" height="4.5" rx="2.25" transform="rotate(-38 188 42)" fill="#38bdf8" />
        <rect x="176" y="70" width="12" height="4.8" rx="2.4" transform="rotate(-40 176 70)" fill="#f43f5e" />
        <path d="M174 14l1.7 4 4 1.7-4 1.7-1.7 4-1.7-4-4-1.7 4-1.7z" fill="#fbbf24" />
        <path d="M155 54l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#38bdf8" />
        <path d="M171 50l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#f472b6" />
      </svg>
    </div>
  );
}

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
  const completionPct =
    totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0;
  const totalTimeSeconds = results.reduce(
    (sum, item) => sum + (item.timeTaken || 0),
    0,
  );

  // Circular gauge geometry
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clampedAccuracy = Math.max(0, Math.min(100, stats.accuracy));
  const strokeDashoffset =
    circumference - (clampedAccuracy / 100) * circumference;

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
          <header className={styles.heroHeader}>
            <CelebrationBadgeIcon />
            <h1 className={styles.heroTitle}>
              Session <span className={styles.heroTitleAccent}>Complete</span>
            </h1>
            <p className={styles.heroDescription}>
              Here is how you performed in this {modeLabel} session.
            </p>
          </header>

          <div className={styles.heroSummaryCard}>
            <div
              className={styles.gaugeWrap}
              role="img"
              aria-label={`Accuracy ${stats.accuracy}%`}
            >
              <svg
                className={styles.gaugeSvg}
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="rv-accuracy-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#0a84ff" />
                    <stop offset="52%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <circle
                  className={styles.gaugeTrack}
                  cx="60"
                  cy="60"
                  r={radius}
                />
                <circle
                  className={styles.gaugeFill}
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="url(#rv-accuracy-gradient)"
                  strokeLinecap={clampedAccuracy > 0 ? "round" : "butt"}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <span className={styles.gaugeValue}>{stats.accuracy}%</span>
                <span className={styles.gaugeLabel}>Accuracy</span>
              </div>
            </div>

            <div className={styles.heroDivider} aria-hidden="true" />

            <div className={styles.heroStatsCol}>
              <div className={`${styles.statPillCard} ${styles.statPillCorrect}`}>
                <span
                  className={`${styles.statPillIcon} ${styles.statPillIconCorrect}`}
                  aria-hidden="true"
                >
                  <Check size={18} strokeWidth={2.75} />
                </span>
                <div className={styles.statPillCopy}>
                  <span className={styles.statPillValueCorrect}>
                    {stats.correct}
                  </span>
                  <span className={styles.statPillLabel}>Correct</span>
                </div>
              </div>

              <div className={`${styles.statPillCard} ${styles.statPillWrong}`}>
                <span
                  className={`${styles.statPillIcon} ${styles.statPillIconWrong}`}
                  aria-hidden="true"
                >
                  <X size={18} strokeWidth={2.75} />
                </span>
                <div className={styles.statPillCopy}>
                  <span className={styles.statPillValueWrong}>
                    {stats.wrong}
                  </span>
                  <span className={styles.statPillLabel}>Wrong</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Secondary Metrics Row */}
        <section className={styles.metricsGrid} aria-label="Performance metrics">
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
