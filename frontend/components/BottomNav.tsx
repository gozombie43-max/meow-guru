'use client';

import Link from 'next/link';
import { hidesPrimaryNavigation } from '@/lib/shell-policy';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ClipboardList, Home as HomeIcon, Play, UserRound } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { AiChatIcon } from '@/components/AiChatIcon';
import { useKeyboardOpen } from '@/components/VirtualKeyboardProvider';

export default function BottomNav() {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname() || '/';
  const keyboardOpen = useKeyboardOpen();
  const shouldHideNav = hidesPrimaryNavigation(pathname) || keyboardOpen;
  const { theme } = useThemeMode();
  const isLightSurface = theme === 'light';

  useEffect(() => {
    const body = document.body;
    if (shouldHideNav) {
      body.classList.remove('has-bottom-nav');
      return;
    }
    body.classList.add('has-bottom-nav');
    return () => body.classList.remove('has-bottom-nav');
  }, [shouldHideNav]);

  useEffect(() => {
    const nav = navRef.current;
    const root = document.documentElement;
    if (!nav) {
      root.style.setProperty('--app-bottom-nav-occupied-height', '0px');
      return () => root.style.removeProperty('--app-bottom-nav-occupied-height');
    }
    const updateHeight = () => {
      root.style.setProperty('--app-bottom-nav-occupied-height', `${nav.getBoundingClientRect().height}px`);
    };
    updateHeight();
    
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeight);
      observer.observe(nav);
    }
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
      root.style.removeProperty('--app-bottom-nav-occupied-height');
    };
  }, [shouldHideNav]);

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isProfile = pathname === '/profile' || pathname.startsWith('/profile/');

  return (
    <nav
      ref={navRef}
      data-ui-chrome="footer"
      className={`bottom-pill-nav${isLightSurface ? ' is-light' : ''}`}
      aria-label="Primary"
    >
      <Link replace
        href="/"
        prefetch={false}
        className={`bottom-nav-item${isHome ? ' is-active' : ''}`}
        aria-current={isHome ? 'page' : undefined}
      >
        <HomeIcon className="bottom-nav-icon" />
        <span className="bottom-nav-label">Home</span>
      </Link>
      <Link replace
        href="/mock-test"
        prefetch={false}
        className={`bottom-nav-item${isMock ? ' is-active' : ''}`}
        aria-current={isMock ? 'page' : undefined}
      >
        <ClipboardList className="bottom-nav-icon" />
        <span className="bottom-nav-label">Mock</span>
      </Link>

      <Link replace
        href="/ai-chat"
        prefetch={false}
        className="bottom-nav-item"
        aria-label="AI Assistant"
      >
        <AiChatIcon className="bottom-nav-icon" />
        <span className="bottom-nav-label">Assistant</span>
      </Link>

      <Link replace
        href="/play"
        prefetch={false}
        className={`bottom-nav-item${isPlay ? ' is-active' : ''}`}
        aria-current={isPlay ? 'page' : undefined}
      >
        <Play className="bottom-nav-icon" />
        <span className="bottom-nav-label">Play</span>
      </Link>
      <Link replace
        href="/profile"
        prefetch={false}
        className={`bottom-nav-item${isProfile ? ' is-active' : ''}`}
        aria-current={isProfile ? 'page' : undefined}
      >
        <UserRound className="bottom-nav-icon" />
        <span className="bottom-nav-label">Profile</span>
      </Link>
    </nav>
  );
}
