'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Home as HomeIcon, Play, Video } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const isQuizRoute = pathname.split('/').includes('quiz');
  const isNotesViewRoute = pathname === '/notes/view' || pathname.startsWith('/notes/view/');
  const isAiChat = pathname === '/ai-chat' || pathname.startsWith('/ai-chat/');
  const isResourceRoute = pathname === '/resource' || pathname.startsWith('/resource/');
  const isStudyModeRoute =
    normalizedPathname === '/english/synonyms-antonyms/study-mode' ||
    normalizedPathname.startsWith('/english/synonyms-antonyms/study-mode/');
  const formulaNotesSubjects = [
    '/mathematics/',
    '/reasoning/',
    '/english/',
    '/general-awareness/',
  ];
  const isFormulaNotesRoute =
    formulaNotesSubjects.some((prefix) => normalizedPathname.startsWith(prefix)) &&
    normalizedPathname.endsWith('/formula-notes');
  const shouldHideNav =
    isQuizRoute ||
    isNotesViewRoute ||
    isFormulaNotesRoute ||
    isResourceRoute ||
    isStudyModeRoute;
  const { theme } = useThemeMode();
  const [isNavHidden, setIsNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const lightSurfacePrefixes = [
    '/mathematics',
    '/reasoning',
    '/english',
    '/adaptive-quiz',
    '/general-awareness',
    '/ai-chat',
    '/dashboard',
    '/admin',
    '/login',
    '/register',
    '/videos',
    '/mock-test',
    '/play',
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
    if (shouldHideNav) return;

    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current + 6;
      const scrollingUp = currentScrollY < lastScrollY.current - 6;

      if (currentScrollY < 12 || scrollingUp) {
        setIsNavHidden(false);
      } else if (scrollingDown) {
        setIsNavHidden(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [shouldHideNav]);

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isVideos = pathname === '/videos' || pathname.startsWith('/videos/');

  return (
    <nav
      className={`bottom-pill-nav${isLightSurface ? ' is-light' : ''}${isNavHidden ? ' is-hidden' : ''}`}
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

      <div className="bottom-nav-center-item">
        <Link
          href="/ai-chat"
          className={`bottom-nav-center-btn${isAiChat ? ' is-active' : ''}`}
          aria-label="AI Assistant"
          aria-current={isAiChat ? 'page' : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8"
          >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            <path d="M10.5 7.5L11 9.5L13 10L11 10.5L10.5 12.5L10 10.5L8 10L10 9.5L10.5 7.5z" fill="currentColor" />
            <path d="M14.5 12L14.8 13.2L16 13.5L14.8 13.8L14.5 15L14.2 13.8L13 13.5L14.2 13.2L14.5 12z" fill="currentColor" />
          </svg>
        </Link>
      </div>

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
