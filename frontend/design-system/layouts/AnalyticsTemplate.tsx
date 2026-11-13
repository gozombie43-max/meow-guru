'use client';

import type { ReactNode } from 'react';
import {
  TemplateShell,
  TemplateStateBoundary,
  joinClasses,
  type TemplateChromeProps,
  type TemplateStateProps,
} from './TemplateShell';
import styles from './Layouts.module.css';

export interface AnalyticsTemplateProps extends TemplateChromeProps, TemplateStateProps {
  /** Top score summary / rank verdict hero card. */
  hero?: ReactNode;
  /** Responsive KPI grid (`2x2` mobile, up to `4x1` tablet/desktop). */
  kpis?: ReactNode;
  /** Override tablet/desktop KPI column count (`2`, `3`, or `4`). Defaults to `4`. */
  kpiColumns?: 2 | 3 | 4;
  /** Two-column (`>= 768px`) section for charts and topic accuracy breakdowns. */
  breakdown?: ReactNode;
  /** Sticky/bottom review & retry action footer (`--safe-bottom` aware). */
  actions?: ReactNode;
  maxWidth?: string | number;
  children?: ReactNode;
}

/**
 * Fullscreen test results, score analytics, question review, and leaderboard shell.
 * Omits `BottomNav` by default and structures hero score, responsive KPI strips,
 * side-by-side breakdown widgets, and full-width review lists.
 */
export function AnalyticsTemplate({
  hero,
  kpis,
  kpiColumns = 4,
  breakdown,
  actions,
  maxWidth,
  children,
  showNavRail = false,
  showBottomNav = false,
  isLoading,
  isEmpty,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Calculating performance insights...',
  defaultEmptyMessage = 'No analytics recorded for this session yet.',
  onRetry,
  retryLabel,
  ...chrome
}: AnalyticsTemplateProps) {
  return (
    <TemplateShell
      {...chrome}
      layout="analytics"
      shellMode="standard"
      maxWidthPreset="standard"
      maxWidth={maxWidth}
      showNavRail={showNavRail}
      showBottomNav={showBottomNav}
    >
      <TemplateStateBoundary
        isLoading={isLoading}
        isEmpty={isEmpty}
        error={error}
        loadingState={loadingState}
        emptyState={emptyState}
        errorState={errorState}
        defaultLoadingLabel={defaultLoadingLabel}
        defaultEmptyMessage={defaultEmptyMessage}
        onRetry={onRetry}
        retryLabel={retryLabel}
      >
        <div className={styles.analyticsStack}>
          {hero ? (
            <section className={styles.analyticsHero} data-meow-slot="hero">
              {hero}
            </section>
          ) : null}

          {kpis ? (
            <section
              className={joinClasses(
                styles.analyticsKpis,
                kpiColumns === 2 && styles.analyticsKpisCols2,
                kpiColumns === 3 && styles.analyticsKpisCols3,
              )}
              data-meow-slot="kpis"
            >
              {kpis}
            </section>
          ) : null}

          {breakdown ? (
            <section className={styles.analyticsBreakdown} data-meow-slot="breakdown">
              {breakdown}
            </section>
          ) : null}

          {children ? (
            <section className={styles.analyticsDetails} data-meow-slot="details">
              {children}
            </section>
          ) : null}

          {actions ? (
            <footer className={styles.analyticsFooter} data-meow-slot="actions">
              {actions}
            </footer>
          ) : null}
        </div>
      </TemplateStateBoundary>
    </TemplateShell>
  );
}

export default AnalyticsTemplate;
