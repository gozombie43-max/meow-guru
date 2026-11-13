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

export interface DashboardTemplateProps extends TemplateChromeProps, TemplateStateProps {
  /** Primary top hero card, daily goal, or streak banner. */
  hero?: ReactNode;
  /** Compact KPI strip rendered across mobile/tablet/desktop (`minmax(150px, 1fr)`). */
  primaryMetrics?: ReactNode;
  /** Optional secondary right column (`>= 1024px`) stacked cleanly below on mobile/tablet. */
  aside?: ReactNode;
  /** Optional footer region beneath the bento body. */
  footer?: ReactNode;
  /** Desktop primary bento grid column count (`2` or `3`, or `1` stacked). Defaults to `2`. */
  gridColumns?: 1 | 2 | 3;
  maxWidth?: string | number;
  children?: ReactNode;
}

/**
 * Canonical root hub & home workspace layout (`/`, `/play`, `/profile` summary).
 * Renders desktop `NavRail` (`>= 1024px`) and mobile `BottomNav` (`< 1024px`) by default;
 * callers can set `showBottomNav={false}` while legacy global chrome remains active.
 */
export function DashboardTemplate({
  hero,
  primaryMetrics,
  aside,
  footer,
  gridColumns = 2,
  maxWidth,
  children,
  showNavRail = true,
  showBottomNav = true,
  isLoading,
  isEmpty,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Loading dashboard...',
  defaultEmptyMessage = 'No dashboard activity available yet.',
  onRetry,
  retryLabel,
  ...chrome
}: DashboardTemplateProps) {
  return (
    <TemplateShell
      {...chrome}
      layout="dashboard"
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
        <div className={styles.dashboardStack}>
          {hero ? (
            <section className={styles.dashboardHero} data-meow-slot="hero">
              {hero}
            </section>
          ) : null}

          {primaryMetrics ? (
            <section className={styles.dashboardMetrics} data-meow-slot="primary-metrics">
              {primaryMetrics}
            </section>
          ) : null}

          {children || aside ? (
            <div
              className={joinClasses(
                styles.dashboardBody,
                Boolean(aside) && styles.dashboardBodyWithAside,
              )}
            >
              {children ? (
                <div
                  className={joinClasses(
                    styles.dashboardPrimary,
                    gridColumns === 2 && styles.dashboardPrimaryCols2,
                    gridColumns === 3 && styles.dashboardPrimaryCols3,
                  )}
                  data-meow-slot="primary-grid"
                >
                  {children}
                </div>
              ) : null}

              {aside ? (
                <aside className={styles.dashboardAside} data-meow-slot="aside">
                  {aside}
                </aside>
              ) : null}
            </div>
          ) : null}

          {footer ? (
            <div className={styles.dashboardFooter} data-meow-slot="footer">
              {footer}
            </div>
          ) : null}
        </div>
      </TemplateStateBoundary>
    </TemplateShell>
  );
}

export default DashboardTemplate;
