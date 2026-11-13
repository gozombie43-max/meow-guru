'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  NavAssistantIcon,
  NavHomeIcon,
  NavPlayIcon,
  NavTestIcon,
} from '@/components/BottomNavIcons';
import {
  PRIMARY_NAV_ITEMS,
  isPrimaryNavItemActive,
  type PrimaryNavItemId,
} from './nav-items';
import styles from './NavRail.module.css';

export interface NavRailItem {
  id: string;
  href: string;
  label: string;
  ariaLabel?: string;
  match?: 'exact' | 'prefix';
  icon?: ReactNode;
  badge?: number;
}

export interface NavRailProps {
  items?: readonly NavRailItem[];
  pathname?: string;
  collapsed?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

function renderDefaultNavIcon(id: string): ReactNode {
  switch (id as PrimaryNavItemId) {
    case 'home':
      return <NavHomeIcon className={styles.icon} />;
    case 'mock':
      return <NavTestIcon className={styles.icon} />;
    case 'assistant':
      return <NavAssistantIcon className={styles.icon} />;
    case 'play':
      return <NavPlayIcon className={styles.icon} />;
    case 'profile':
    default:
      return <User className={styles.icon} strokeWidth={1.75} aria-hidden="true" />;
  }
}

function joinClasses(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

const DEFAULT_RAIL_ITEMS: readonly NavRailItem[] = PRIMARY_NAV_ITEMS.map((item) => ({
  ...item,
  icon: undefined,
}));

/**
 * Desktop-only (>= 1024px) primary navigation rail styled with `--meow-*` tokens.
 * Hidden below `1024px` where `BottomNav` owns primary navigation.
 */
export function NavRail({
  items = DEFAULT_RAIL_ITEMS,
  pathname,
  collapsed = false,
  header,
  footer,
  ariaLabel = 'Primary desktop navigation',
  className,
}: NavRailProps) {
  const routerPathname = usePathname();
  const activePathname = pathname ?? routerPathname ?? '/';

  return (
    <nav
      data-meow-tokens=""
      data-meow-component="nav-rail"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={ariaLabel}
      className={joinClasses(styles.rail, collapsed && styles.railCollapsed, className)}
    >
      {header ? <div className={styles.header}>{header}</div> : null}

      <ul className={styles.list}>
        {items.map((item) => {
          const active = isPrimaryNavItemActive(activePathname, {
            href: item.href,
            match: item.match ?? 'prefix',
          });

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                prefetch={false}
                data-custom-focus="true"
                className={joinClasses(styles.link, active && styles.linkActive)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.ariaLabel ?? (collapsed ? item.label : undefined)}
                title={collapsed ? item.label : undefined}
              >
                <span className={styles.iconWrap} aria-hidden="true">
                  {item.icon ?? renderDefaultNavIcon(item.id)}
                </span>
                <span className={styles.label}>{item.label}</span>
                {!collapsed && typeof item.badge === 'number' && item.badge > 0 ? (
                  <span className={styles.badge}>{item.badge > 99 ? '99+' : item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </nav>
  );
}

export default NavRail;
