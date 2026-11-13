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

export interface ListingTemplateProps extends TemplateChromeProps, TemplateStateProps {
  /** Optional header summary / intro strip above the sticky filter bar. */
  intro?: ReactNode;
  /** Sticky search/filter controls kept mounted during loading, error, and empty states. */
  filters?: ReactNode;
  /** Optional sort controls or count badge row directly above results. */
  toolbarActions?: ReactNode;
  /** Optional left facet sidebar (`>= 1024px`). */
  filterSidebar?: ReactNode;
  /** Optional bottom pagination / load-more bar. */
  pagination?: ReactNode;
  /** Results grid columns on tablet/desktop (`1`, `2`, or `3`). Defaults to `3`. */
  columns?: 1 | 2 | 3;
  /** Expand container from `1200px` to `1360px` for dense admin or data tables. */
  wide?: boolean;
  /** Override sticky filter top offset when custom non-sticky `header` is supplied. */
  hasStickyHeader?: boolean;
  maxWidth?: string | number;
  children?: ReactNode;
}

/**
 * Canonical browse, catalog, subject, and table collection shell.
 * Preserves sticky search/filter bars across loading and empty states so user
 * input focus and filter selections are never reset mid-query.
 */
export function ListingTemplate({
  intro,
  filters,
  toolbarActions,
  filterSidebar,
  pagination,
  columns = 3,
  wide = false,
  hasStickyHeader,
  maxWidth,
  children,
  showNavRail = false,
  showBottomNav = false,
  header,
  headerProps,
  isLoading,
  isEmpty,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Loading items...',
  defaultEmptyMessage = 'No matching items found.',
  onRetry,
  retryLabel,
  ...chrome
}: ListingTemplateProps) {
  const stickyHeaderActive =
    hasStickyHeader ??
    Boolean(
      (header !== undefined && header !== null) ||
        (headerProps && headerProps.sticky !== false),
    );
  const compactStickyHeader = stickyHeaderActive && headerProps?.variant === 'compact';

  return (
    <TemplateShell
      {...chrome}
      header={header}
      headerProps={headerProps}
      layout="listing"
      shellMode="standard"
      maxWidthPreset={wide ? 'wide' : 'standard'}
      maxWidth={maxWidth}
      showNavRail={showNavRail}
      showBottomNav={showBottomNav}
    >
      <div className={styles.listingStack}>
        {intro ? (
          <div className={styles.listingIntro} data-meow-slot="intro">
            {intro}
          </div>
        ) : null}

        {filters ? (
          <div
            className={joinClasses(
              styles.listingFilters,
              stickyHeaderActive && !compactStickyHeader && styles.listingFiltersUnderHeader,
              compactStickyHeader && styles.listingFiltersUnderCompactHeader,
            )}
            data-meow-slot="filters"
          >
            {filters}
          </div>
        ) : null}

        {toolbarActions ? (
          <div className={styles.listingToolbarActions} data-meow-slot="toolbar-actions">
            {toolbarActions}
          </div>
        ) : null}

        <div
          className={joinClasses(
            styles.listingWorkspace,
            Boolean(filterSidebar) && styles.listingWorkspaceWithSidebar,
          )}
        >
          {filterSidebar ? (
            <aside className={styles.listingSidebar} data-meow-slot="filter-sidebar">
              {filterSidebar}
            </aside>
          ) : null}

          <div className={styles.listingResultsColumn}>
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
              <div
                className={joinClasses(
                  styles.listingGrid,
                  columns === 2 && styles.listingGridCols2,
                  columns === 3 && styles.listingGridCols3,
                )}
                data-meow-slot="results"
              >
                {children}
              </div>

              {pagination ? (
                <div className={styles.listingPagination} data-meow-slot="pagination">
                  {pagination}
                </div>
              ) : null}
            </TemplateStateBoundary>
          </div>
        </div>
      </div>
    </TemplateShell>
  );
}

export default ListingTemplate;
