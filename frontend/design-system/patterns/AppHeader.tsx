'use client';

import type { CSSProperties, ReactNode } from 'react';
import { BackButton } from '../components/BackButton';
import styles from './AppHeader.module.css';

export type AppHeaderVariant = 'default' | 'compact' | 'transparent';

export interface AppHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  backHref?: string;
  backLabel?: string;
  onBeforeBack?: () => void;
  actions?: ReactNode;
  variant?: AppHeaderVariant;
  sticky?: boolean;
  centered?: boolean;
  maxWidth?: string | number;
  ariaLabel?: string;
  className?: string;
}

function joinClasses(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

/**
 * Canonical 56px + safe-top global page header backed by `--meow-*` tokens.
 * Leaves no blur or box-shadow and renders a built-in 44px `BackButton` when `backHref` is given.
 */
export function AppHeader({
  title,
  subtitle,
  leading,
  backHref,
  backLabel = 'Back',
  onBeforeBack,
  actions,
  variant = 'default',
  sticky = true,
  centered = false,
  maxWidth,
  ariaLabel,
  className,
}: AppHeaderProps) {
  const resolvedLeading =
    leading !== undefined ? (
      leading
    ) : backHref ? (
      <BackButton href={backHref} label={backLabel} onBeforeNavigate={onBeforeBack} />
    ) : null;

  const innerStyle: CSSProperties | undefined =
    maxWidth !== undefined
      ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }
      : undefined;

  return (
    <header
      data-meow-tokens=""
      data-meow-component="app-header"
      data-meow-variant={variant}
      data-ui-chrome="header"
      aria-label={ariaLabel}
      className={joinClasses(
        styles.header,
        sticky && styles.sticky,
        variant === 'compact' && styles.variantCompact,
        variant === 'transparent' && styles.variantTransparent,
        className,
      )}
    >
      <div className={joinClasses(styles.inner, centered && styles.innerCentered)} style={innerStyle}>
        {resolvedLeading || centered ? (
          <div className={styles.leading}>{resolvedLeading}</div>
        ) : null}

        <div className={styles.titleGroup}>
          {title ? <div className={styles.title}>{title}</div> : null}
          {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
        </div>

        {actions || centered ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}

export default AppHeader;
