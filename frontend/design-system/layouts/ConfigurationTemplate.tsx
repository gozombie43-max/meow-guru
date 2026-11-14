'use client';

import type { ReactNode } from 'react';
import {
  TemplateShell,
  TemplateStateBoundary,
  joinClasses,
  resolveMaxWidthClass,
  resolveMaxWidthStyle,
  type LayoutMaxWidth,
  type TemplateChromeProps,
  type TemplateStateProps,
} from './TemplateShell';
import styles from './Layouts.module.css';

export type ConfigurationVariant = 'setup' | 'settings' | 'auth';

export interface ConfigurationTemplateProps extends TemplateChromeProps, TemplateStateProps {
  /** Shell geometry preset: `'setup'` (720px / 1080px split), `'settings'` (720px), `'auth'` (440px centered). */
  variant?: ConfigurationVariant;
  /** Optional header/brand block rendered above form fields (especially in `'auth'` or setup). */
  hero?: ReactNode;
  /** Optional sticky desktop (`>= 1024px`) live preview / session summary column (`340px`). */
  summary?: ReactNode;
  /** Sticky mobile CTA bar (`--safe-bottom` aware) / inline footer action container. */
  actionBar?: ReactNode;
  /** Optional legal/helper footer under auth or settings content. */
  footer?: ReactNode;
  maxWidth?: string | number;
  children?: ReactNode;
}

function resolveConfigurationMaxWidth(
  variant: ConfigurationVariant,
  hasSummary: boolean,
): LayoutMaxWidth {
  if (variant === 'auth') return 'compact';
  if (variant === 'setup' && hasSummary) return 'setup-split';
  return 'focused';
}

/**
 * Focused form, quiz/study setup, settings, profile editing, and auth shell.
 * Supports centered single-column (`720px` setup/settings, `440px` auth) as well as
 * desktop two-column setup + live summary (`1080px`), with sticky mobile bottom CTA bar.
 */
export function ConfigurationTemplate({
  variant = 'setup',
  hero,
  summary,
  actionBar,
  footer,
  maxWidth,
  children,
  showNavRail = false,
  showBottomNav = false,
  bottomNav,
  bottomNavProps,
  mainClassName,
  isLoading,
  isEmpty,
  error,
  loadingState,
  emptyState,
  errorState,
  defaultLoadingLabel = 'Loading options...',
  defaultEmptyMessage = 'No configurable options available.',
  onRetry,
  retryLabel,
  ...chrome
}: ConfigurationTemplateProps) {
  const hasSummary = variant === 'setup' && Boolean(summary);
  const maxWidthPreset = resolveConfigurationMaxWidth(variant, hasSummary);
  const bottomNavRendered = bottomNav !== null && (bottomNav !== undefined || showBottomNav);

  const resolvedActionBar =
    actionBar && !isLoading && !error ? (
      <div
        className={joinClasses(
          styles.configActionBar,
          bottomNavRendered && styles.configActionBarWithBottomNav,
        )}
        data-meow-slot="action-bar"
      >
        <div
          className={joinClasses(
            styles.configActionBarInner,
            resolveMaxWidthClass(maxWidthPreset),
          )}
          style={resolveMaxWidthStyle(maxWidth)}
        >
          {actionBar}
        </div>
      </div>
    ) : null;

  return (
    <TemplateShell
      {...chrome}
      layout="configuration"
      shellMode="standard"
      maxWidthPreset={maxWidthPreset}
      maxWidth={maxWidth}
      showNavRail={showNavRail}
      showBottomNav={showBottomNav}
      bottomNav={bottomNav}
      bottomNavProps={bottomNavProps}
      mainClassName={joinClasses(
        variant === 'auth' && styles.configAuthMain,
        mainClassName,
      )}
      afterMain={resolvedActionBar}
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
        {variant === 'auth' ? (
          <div className={styles.configAuthContainer}>
            {hero ? <div data-meow-slot="hero">{hero}</div> : null}
            <div className={styles.configBody} data-meow-slot="form-body">
              {children}
            </div>
            {footer ? <div data-meow-slot="footer">{footer}</div> : null}
          </div>
        ) : (
          <div className={styles.configStack}>
            {hero ? <div data-meow-slot="hero">{hero}</div> : null}

            <div
              className={joinClasses(
                styles.configGrid,
                hasSummary && styles.configGridWithSummary,
              )}
            >
              <div className={styles.configBody} data-meow-slot="form-body">
                {children}
              </div>

              {hasSummary ? (
                <aside
                  className={joinClasses(styles.configSummary, styles.configSummarySticky)}
                  data-meow-slot="summary"
                >
                  {summary}
                </aside>
              ) : null}
            </div>

            {footer ? <div data-meow-slot="footer">{footer}</div> : null}
          </div>
        )}
      </TemplateStateBoundary>
    </TemplateShell>
  );
}

export default ConfigurationTemplate;
