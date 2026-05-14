'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClipboardList, Home as HomeIcon, Play, Video } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const isQuizRoute = pathname.split('/').includes('quiz');
  const isNotesViewRoute = pathname === '/notes/view' || pathname.startsWith('/notes/view/');
  const shouldHideNav = isQuizRoute || isNotesViewRoute;
  const { theme } = useThemeMode();
  const [isScrolled, setIsScrolled] = useState(false);
  const lightSurfacePrefixes = [
    '/mathematics',
    '/reasoning',
    '/english',
    '/general-awareness',
    '/dashboard',
    '/admin',
    '/login',
    '/register',
    '/videos',
  ];
  const isLightSurface =
    theme === 'light' &&
    lightSurfacePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

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
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };

    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isVideos = pathname === '/videos' || pathname.startsWith('/videos/');
  return (
    <nav
      className={`bottom-pill-nav${isLightSurface ? ' is-light' : ''}${
        isScrolled ? ' is-scrolled' : ''
      }`}
      aria-label="Primary"
    >
      <Link
        href="/"
        className={`bottom-nav-item${isHome ? ' is-active' : ''}`}
        aria-current={isHome ? 'page' : undefined}
      >
        <HomeIcon className="bottom-nav-icon" />
        <span className="bottom-nav-label">Home</span>
      </Link>
      <Link
        href="/mock-test"
        className={`bottom-nav-item${isMock ? ' is-active' : ''}`}
        aria-current={isMock ? 'page' : undefined}
      >
        <ClipboardList className="bottom-nav-icon" />
        <span className="bottom-nav-label">Mock</span>
      </Link>
      <Link
        href="/play"
        className={`bottom-nav-item${isPlay ? ' is-active' : ''}`}
        aria-current={isPlay ? 'page' : undefined}
      >
        <Play className="bottom-nav-icon" />
        <span className="bottom-nav-label">Play</span>
      </Link>
      <Link
        href="/videos"
        className={`bottom-nav-item${isVideos ? ' is-active' : ''}`}
        aria-current={isVideos ? 'page' : undefined}
      >
        <Video className="bottom-nav-icon" />
        <span className="bottom-nav-label">Videos</span>
      </Link>
    </nav>
  );
}
