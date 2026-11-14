'use client';

import { forwardRef, type ReactNode } from 'react';
import Link from 'next/link';
import {
  NavAssistantIcon,
  NavHomeIcon,
  NavPlayIcon,
  NavTestIcon,
} from '@/components/BottomNavIcons';
import {
  PRIMARY_NAV_ITEMS,
  isPrimaryNavItemActive,
  type PrimaryNavItem,
  type PrimaryNavItemId,
} from './nav-items';
import styles from './BottomNav.module.css';

export interface BottomNavProps {
  items?: readonly PrimaryNavItem[];
  pathname?: string;
  isHidden?: boolean;
  /** Optional custom icon/avatar rendered for the `profile` item. */
  profileIcon?: ReactNode;
  badges?: Partial<Record<PrimaryNavItemId, number | boolean>>;
  ariaLabel?: string;
  className?: string;
}

function renderDefaultItemIcon(id: PrimaryNavItemId): ReactNode {
  switch (id) {
    case 'home':
      return <NavHomeIcon className={`bottom-nav-icon ${styles.icon}`} />;
    case 'mock':
      return <NavTestIcon className={`bottom-nav-icon ${styles.icon}`} />;
    case 'assistant':
      return <NavAssistantIcon className={`bottom-nav-icon ${styles.icon}`} />;
    case 'play':
      return <NavPlayIcon className={`bottom-nav-icon ${styles.icon}`} />;
    case 'profile':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`bottom-nav-icon ${styles.icon}`}
          aria-hidden="true"
          focusable="false"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

function joinClasses(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

/** Canonical mobile/tablet bottom navigation bar (< 1024px) styled with `--meow-*` tokens. */
export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav(
  {
    items = PRIMARY_NAV_ITEMS,
    pathname = '/',
    isHidden = false,
    profileIcon,
    badges,
    ariaLabel = 'Primary',
    className,
  },
  ref,
) {
  return (
    <nav
      ref={ref}
      data-meow-tokens=""
      data-meow-component="bottom-nav"
      data-meow-motion="bottom-nav"
      data-ui-chrome="footer"
      aria-label={ariaLabel}
      aria-hidden={isHidden ? 'true' : undefined}
      className={joinClasses(
        'bottom-pill-nav',
        styles.nav,
        isHidden && 'is-hidden',
        isHidden && styles.hidden,
        className,
      )}
    >
      {items.map((item) => {
        const active = isPrimaryNavItemActive(pathname, item);
        const badge = badges?.[item.id];
        const iconNode =
          item.id === 'profile' && profileIcon ? profileIcon : renderDefaultItemIcon(item.id);

        return (
          <Link
            key={item.id}
            replace
            href={item.href}
            prefetch={false}
            tabIndex={isHidden ? -1 : undefined}
            data-custom-focus="true"
            className={joinClasses(
              'bottom-nav-item',
              styles.item,
              active && 'is-active',
              active && styles.itemActive,
            )}
            aria-label={item.ariaLabel}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.iconWrap} aria-hidden="true">
              {iconNode}
              {typeof badge === 'number' && badge > 0 ? (
                <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>
              ) : badge === true ? (
                <span className={styles.badgeDot} />
              ) : null}
            </span>
            <span className={joinClasses('bottom-nav-label', styles.label)}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
});

export default BottomNav;
