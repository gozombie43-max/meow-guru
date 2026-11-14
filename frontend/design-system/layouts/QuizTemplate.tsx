'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { AppHeaderProps } from '../patterns/AppHeader';
import {
  TemplateStateBoundary,
  joinClasses,
  renderHeaderNode,
  type TemplateStateProps,
} from './TemplateShell';
import styles from './Layouts.module.css';

export interface QuizTemplateProps extends TemplateStateProps {
  /** Top session bar (timer, counter, exit/back button). */
  topBar?: ReactNode;
  /** Convenience props rendered through canonical `AppHeader` when `topBar` is not given. */
  headerProps?: AppHeaderProps;
  /** Optional locked slim strip under `topBar` for overall progress bars or section tabs. */
  subBar?: ReactNode;
  /** Optional question palette (desktop `>= 1024px` right pane; mobile collapsible/below). */
  palette?: ReactNode;
  /** Control whether mobile/tablet renders `palette` inline below the stem or hides it (e.g. drawer trigger). */
  paletteMobileBehavior?: 'below' | 'hidden';
  /** Sticky bottom action bar (`Previous`, `Mark for Review`, `Next`, `Submit`). */
  actionBar?: ReactNode;
  /** Lock viewport cleanly to `100dvh` with internal reading scroll (default `true`). */
  lockedViewport?: boolean;
  /** Max measure for the primary reading column. Defaults to `760px`. */
  readingMaxWidth?: string | number;
  mainId?: string;
  skipLinkLabel?: string;
  showSkipLink?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Fullscreen zero-distraction quiz, mock test, rapid-fire, and flashcard workspace.
 * Enforces `100dvh` locked shell geometry with safe-area padding, independently scrollable
 * reading/palette panes, and always suppresses `BottomNav` and `NavRail`.
 */
export function QuizTemplate({
  topBar,
  headerProps,
  subBar,
  palette,
  paletteMobileBehavior = 'below',
  actionBar,
  lockedViewport = true,
  readingMaxWidth,
  mainId = 'meow-quiz-main',
  skipLinkLabel = 'Skip to question content',
  showSkipLink = true,
  className,
  children,
  isLoading,
  isEmpty,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Loading question...',
  defaultEmptyMessage = 'No questions available in this session.',
  onRetry,
  retryLabel,
}: QuizTemplateProps) {
  const resolvedTopBar = renderHeaderNode(topBar, headerProps);
  const readingStyle: CSSProperties | undefined =
    readingMaxWidth !== undefined
      ? {
          maxWidth:
            typeof readingMaxWidth === 'number'
              ? `${readingMaxWidth}px`
              : readingMaxWidth,
        }
      : undefined;

  return (
    <div
      data-meow-tokens=""
      data-meow-component="layout-template"
      data-meow-layout="quiz"
      data-meow-shell="fullscreen"
      data-locked-viewport={lockedViewport ? 'true' : 'false'}
      className={joinClasses(
        styles.root,
        lockedViewport && styles.quizLockedRoot,
        className,
      )}
    >
      {showSkipLink ? (
        <a href={`#${mainId}`} className={styles.skipLink}>
          {skipLinkLabel}
        </a>
      ) : null}

      {resolvedTopBar ? (
        <div className={styles.quizChromeTop} data-meow-slot="top-bar">
          {resolvedTopBar}
        </div>
      ) : null}

      {subBar ? (
        <div className={styles.quizSubBar} data-meow-slot="sub-bar">
          <div className={styles.quizSubBarInner}>{subBar}</div>
        </div>
      ) : null}

      <main
        id={mainId}
        tabIndex={-1}
        className={joinClasses(
          styles.quizMain,
          styles.maxWide,
          !lockedViewport && styles.quizUnlockedMain,
        )}
      >
        <div
          className={joinClasses(
            styles.quizSplit,
            Boolean(palette) && styles.quizSplitWithPalette,
          )}
        >
          <div className={styles.quizReadingScroll} data-meow-slot="reading-pane">
            <div className={styles.quizReadingMeasure} style={readingStyle}>
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
                {children}
              </TemplateStateBoundary>
            </div>
          </div>

          {palette ? (
            <aside
              className={joinClasses(
                styles.quizPalettePane,
                paletteMobileBehavior === 'hidden' && styles.quizPaletteHiddenMobile,
              )}
              data-meow-slot="palette"
            >
              {palette}
            </aside>
          ) : null}
        </div>
      </main>

      {actionBar ? (
        <div className={styles.quizActionBar} data-meow-slot="action-bar">
          <div className={styles.quizActionBarInner}>{actionBar}</div>
        </div>
      ) : null}
    </div>
  );
}

export default QuizTemplate;
