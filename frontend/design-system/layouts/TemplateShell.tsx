'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { AppHeader, type AppHeaderProps } from '../patterns/AppHeader';
import { BottomNav, type BottomNavProps } from '../patterns/BottomNav';
import { NavRail, type NavRailProps } from '../patterns/NavRail';
import styles from './Layouts.module.css';

export type LayoutTemplateKind =
  | 'dashboard'
  | 'listing'
  | 'quiz'
  | 'configuration'
  | 'analytics';

export type LayoutMaxWidth =
  | 'standard'
  | 'wide'
  | 'focused'
  | 'compact'
  | 'setup-split';

export interface TemplateStateProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: ReactNode;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  defaultLoadingLabel?: string;
  defaultEmptyMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export interface TemplateChromeProps {
  header?: ReactNode;
  headerProps?: AppHeaderProps;
  navRail?: ReactNode;
  navRailProps?: NavRailProps;
  showNavRail?: boolean;
  bottomNav?: ReactNode;
  bottomNavProps?: BottomNavProps;
  showBottomNav?: boolean;
  pathname?: string;
  mainId?: string;
  skipLinkLabel?: string;
  showSkipLink?: boolean;
  className?: string;
  mainClassName?: string;
}

export function joinClasses(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export function resolveMaxWidthClass(preset: LayoutMaxWidth): string {
  switch (preset) {
    case 'wide':
      return styles.maxWide;
    case 'focused':
      return styles.maxFocused;
    case 'compact':
      return styles.maxCompact;
    case 'setup-split':
      return styles.maxSetupSplit;
    case 'standard':
    default:
      return styles.maxStandard;
  }
}

export function resolveMaxWidthStyle(maxWidth?: string | number): CSSProperties | undefined {
  if (maxWidth === undefined) return undefined;
  return { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth };
}

export function renderHeaderNode(
  header?: ReactNode,
  headerProps?: AppHeaderProps,
): ReactNode {
  if (header !== undefined) return header;
  if (headerProps) return <AppHeader {...headerProps} />;
  return null;
}

/**
 * Shared boundary for loading, error, and empty states across all 5 canonical
 * page templates so callers retain chrome/navigation while displaying resilient UI.
 */
export function TemplateStateBoundary({
  isLoading = false,
  isEmpty = false,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Loading content...',
  defaultEmptyMessage = 'Nothing to display yet.',
  onRetry,
  retryLabel = 'Try again',
  children,
}: TemplateStateProps & { children?: ReactNode }) {
  if (isLoading) {
    if (loadingState !== undefined) return <>{loadingState}</>;
    return (
      <div
        className={styles.stateBox}
        role="status"
        aria-live="polite"
        data-meow-state="loading"
      >
        <Spinner size="lg" />
        <p className={styles.stateText}>{defaultLoadingLabel}</p>
      </div>
    );
  }

  if (error) {
    if (errorState !== undefined) return <>{errorState}</>;
    return (
      <div
        className={joinClasses(styles.stateBox, styles.stateBoxError)}
        role="alert"
        data-meow-state="error"
      >
        <p className={styles.stateTitle}>Something went wrong</p>
        {typeof error === 'boolean' ? null : <div className={styles.stateText}>{error}</div>}
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    if (emptyState !== undefined) return <>{emptyState}</>;
    return (
      <div className={styles.stateBox} role="status" data-meow-state="empty">
        <p className={styles.stateText}>{defaultEmptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

export interface InternalTemplateShellProps extends TemplateChromeProps {
  layout: LayoutTemplateKind;
  maxWidthPreset?: LayoutMaxWidth;
  maxWidth?: string | number;
  shellMode?: 'standard' | 'fullscreen';
  afterMain?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared frame composing `[data-meow-tokens]`, skip-to-content navigation,
 * desktop `NavRail` (>=1024px), `AppHeader`, `<main>` gutter geometry,
 * and mobile/tablet `BottomNav` (<1024px) for standard layout templates.
 */
export function TemplateShell({
  layout,
  maxWidthPreset = 'standard',
  maxWidth,
  shellMode = 'standard',
  header,
  headerProps,
  navRail,
  navRailProps,
  showNavRail = false,
  bottomNav,
  bottomNavProps,
  showBottomNav = false,
  pathname,
  mainId = 'meow-main-content',
  skipLinkLabel = 'Skip to main content',
  showSkipLink = true,
  className,
  mainClassName,
  afterMain,
  children,
}: InternalTemplateShellProps) {
  const isFullscreen = shellMode === 'fullscreen';

  const resolvedNavRail =
    !isFullscreen && navRail !== null && (navRail !== undefined || showNavRail)
      ? (navRail ?? (
          <NavRail
            {...navRailProps}
            pathname={navRailProps?.pathname ?? pathname}
          />
        ))
      : null;

  const resolvedBottomNav =
    !isFullscreen && bottomNav !== null && (bottomNav !== undefined || showBottomNav)
      ? (bottomNav ?? (
          <BottomNav
            {...bottomNavProps}
            pathname={bottomNavProps?.pathname ?? pathname}
          />
        ))
      : null;

  const resolvedHeader = renderHeaderNode(header, headerProps);

  return (
    <div
      data-meow-tokens=""
      data-meow-component="layout-template"
      data-meow-layout={layout}
      data-meow-shell={shellMode}
      data-has-bottom-nav={resolvedBottomNav ? 'true' : 'false'}
      className={joinClasses(
        styles.root,
        Boolean(resolvedBottomNav) && styles.hasBottomNav,
        className,
      )}
    >
      {showSkipLink ? (
        <a href={`#${mainId}`} className={styles.skipLink}>
          {skipLinkLabel}
        </a>
      ) : null}

      <div className={styles.shellFrame}>
        {resolvedNavRail ? (
          <div className={styles.navRailWrap} data-meow-slot="nav-rail">
            {resolvedNavRail}
          </div>
        ) : null}

        <div className={styles.contentColumn}>
          {resolvedHeader}

          <main
            id={mainId}
            tabIndex={-1}
            className={joinClasses(
              styles.main,
              resolveMaxWidthClass(maxWidthPreset),
              mainClassName,
            )}
            style={resolveMaxWidthStyle(maxWidth)}
          >
            {children}
          </main>

          {afterMain}
        </div>
      </div>

      {resolvedBottomNav ? (
        <div className={styles.bottomNavWrap} data-meow-slot="bottom-nav">
          {resolvedBottomNav}
        </div>
      ) : null}
    </div>
  );
}
