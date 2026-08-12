'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Home as HomeIcon, Play, Video, Infinity } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { AiChatIcon } from '@/components/AiChatIcon';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const isQuizRoute = pathname.split('/').includes('quiz');
  const isNotesViewRoute = pathname === '/notes/view' || pathname.startsWith('/notes/view/');
  const isAiChat = pathname === '/ai-chat' || pathname.startsWith('/ai-chat/');
  const isResourceRoute = pathname === '/resource' || pathname.startsWith('/resource/');
  const isStudyModeRoute =
    normalizedPathname === '/english/synonyms-antonyms/study-mode' ||
    normalizedPathname.startsWith('/english/synonyms-antonyms/study-mode/') ||
    normalizedPathname === '/english/one-word-substitution/study-mode' ||
    normalizedPathname.startsWith('/english/one-word-substitution/study-mode/') ||
    normalizedPathname === '/english/idioms-phrases/study-mode' ||
    normalizedPathname.startsWith('/english/idioms-phrases/study-mode/');
  const formulaNotesSubjects = [
    '/mathematics/',
    '/reasoning/',
    '/english/',
    '/general-awareness/',
  ];
  const isFormulaNotesRoute =
    formulaNotesSubjects.some((prefix) => normalizedPathname.startsWith(prefix)) &&
    normalizedPathname.endsWith('/formula-notes');
  const isAccessCodeRoute = pathname === '/access-code' || pathname.startsWith('/access-code/');
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const shouldHideNav =
    isQuizRoute ||
    isNotesViewRoute ||
    isFormulaNotesRoute ||
    isResourceRoute ||
    isStudyModeRoute ||
    isAccessCodeRoute ||
    isDashboardRoute ||
    isAiChat;
  const { theme } = useThemeMode();
  const lightSurfacePrefixes = [
    '/',
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

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isVideos = pathname === '/videos' || pathname.startsWith('/videos/');

  return (
    <nav
      className={`bottom-pill-nav${isLightSurface ? ' is-light' : ''}`}
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
        href="/ai-chat"
        className={`bottom-nav-item${isAiChat ? ' is-active' : ''}`}
        aria-label="AI Assistant"
        aria-current={isAiChat ? 'page' : undefined}
      >
        <AiChatIcon className="bottom-nav-icon" style={{ width: '38px', height: '38px', color: 'currentColor' }} />
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
