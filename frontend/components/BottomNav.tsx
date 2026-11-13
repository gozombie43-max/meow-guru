'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { hidesPrimaryNavigation } from '@/lib/shell-policy';
import { useKeyboardOpen } from '@/components/VirtualKeyboardProvider';
import { useAuth } from '@/context/AuthContext';
import GoogleAvatarRing from '@/components/GoogleAvatarRing';
import { BottomNav as PatternBottomNav } from '@/design-system/patterns/BottomNav';

export default function BottomNav() {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname() || '/';
  const keyboardOpen = useKeyboardOpen();
  const shouldHideNav = hidesPrimaryNavigation(pathname) || keyboardOpen;
  const { user } = useAuth();

  useLayoutEffect(() => {
    const body = document.body;
    if (shouldHideNav) {
      body.classList.remove('has-bottom-nav');
      return;
    }
    body.classList.add('has-bottom-nav');
    return () => body.classList.remove('has-bottom-nav');
  }, [shouldHideNav]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const root = document.documentElement;
    if (!nav) {
      root.style.setProperty('--app-bottom-nav-occupied-height', '0px');
      return () => root.style.removeProperty('--app-bottom-nav-occupied-height');
    }

    const updateHeight = () => {
      root.style.setProperty(
        '--app-bottom-nav-occupied-height',
        `${nav.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeight);
      observer.observe(nav);
    }
    window.addEventListener('resize', updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      root.style.removeProperty('--app-bottom-nav-occupied-height');
    };
  }, [shouldHideNav]);

  if (shouldHideNav) return null;

  return (
    <PatternBottomNav
      ref={navRef}
      pathname={pathname}
      profileIcon={
        <GoogleAvatarRing
          size={28}
          initial={user?.name?.trim().charAt(0).toUpperCase() || 'U'}
          avatarUrl={user?.avatar || undefined}
        />
      }
    />
  );
}
