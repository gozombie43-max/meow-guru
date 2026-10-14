'use client';

import Link from 'next/link';
import { hidesPrimaryNavigation, hidesPrimaryNavigationOnScroll } from '@/lib/shell-policy';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardList, Home as HomeIcon, Play } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { AiChatIcon } from '@/components/AiChatIcon';
import { useKeyboardOpen } from '@/components/VirtualKeyboardProvider';
import { useAuth } from '@/context/AuthContext';
import GoogleAvatarRing from '@/components/GoogleAvatarRing';

export default function BottomNav() {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname() || '/';
  const keyboardOpen = useKeyboardOpen();
  const shouldHideNav = hidesPrimaryNavigation(pathname) || keyboardOpen;
  const hideOnScroll = hidesPrimaryNavigationOnScroll(pathname);
  const [scrollState, setScrollState] = useState({ pathname, hidden: false });
  if (scrollState.pathname !== pathname) {
    setScrollState({ pathname, hidden: false });
  }
  const scrollHidden = hideOnScroll && scrollState.pathname === pathname && scrollState.hidden;
  const { theme } = useThemeMode();
  const { user } = useAuth();
  const isLightSurface = theme === 'light';

  useEffect(() => {
    if (shouldHideNav || !hideOnScroll) return;
    const positions = new WeakMap<Element, { top: number; distance: number }>();
    const root = document.scrollingElement || document.documentElement;
    positions.set(root, { top: root.scrollTop, distance: 0 });
    const show = () => setScrollState(previous => previous.pathname === pathname && !previous.hidden
      ? previous : { pathname, hidden: false });
    const onScroll = (event: Event) => {
      const target = event.target === document ? root : event.target;
      if (!(target instanceof HTMLElement) || target.closest('dialog, [role="dialog"], nav')) return;
      const max = target.scrollHeight - target.clientHeight;
      if (max <= 0) return;
      const top = Math.max(0, Math.min(target.scrollTop, max));
      const previous = positions.get(target) || { top: 0, distance: 0 };
      // Expanding content can clamp scrollTop near the bottom. That is a
      // layout adjustment, not an upward gesture that should reopen the bar.
      const delta = top - Math.min(previous.top, max);
      const distance = Math.sign(delta) === Math.sign(previous.distance) ? previous.distance + delta : delta;
      positions.set(target, { top, distance });
      if (delta === 0) return;
      if (top <= 8) { show(); return; }
      if (Math.abs(distance) < 12 || navRef.current?.querySelector(':focus-visible')) return;
      const hidden = distance > 0;
      setScrollState(previousState => previousState.pathname === pathname && previousState.hidden === hidden
        ? previousState : { pathname, hidden });
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Tab') show(); };
    // Capture also observes independently scrolling chapter/topic lists.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pathname, shouldHideNav, hideOnScroll]);

  useLayoutEffect(() => {
    const body = document.body;
    if (shouldHideNav || scrollHidden) {
      body.classList.remove('has-bottom-nav');
      return;
    }
    body.classList.add('has-bottom-nav');
    return () => body.classList.remove('has-bottom-nav');
  }, [shouldHideNav, scrollHidden]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const root = document.documentElement;
    if (!nav) {
      root.style.setProperty('--app-bottom-nav-occupied-height', '0px');
      return () => root.style.removeProperty('--app-bottom-nav-occupied-height');
    }
    const updateHeight = () => {
      root.style.setProperty('--app-bottom-nav-occupied-height', scrollHidden ? '0px' : `${nav.getBoundingClientRect().height}px`);
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
  }, [shouldHideNav, scrollHidden]);

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isProfile = pathname === '/profile' || pathname.startsWith('/profile/');

  return (
    <nav
      ref={navRef}
      data-ui-chrome="footer"
      className={`bottom-pill-nav${isLightSurface ? ' is-light' : ''}${scrollHidden ? ' is-hidden' : ''}`}
      inert={scrollHidden}
      aria-hidden={scrollHidden || undefined}
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
        <GoogleAvatarRing size={26} initial={user?.name?.trim().charAt(0).toUpperCase() || 'U'} avatarUrl={user?.avatar || undefined} />
        <span className="bottom-nav-label">You</span>
      </Link>
    </nav>
  );
}
