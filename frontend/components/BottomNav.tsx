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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

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
  return (
    <>
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
        <button
          className={`bottom-nav-item${isMenuOpen ? ' is-active' : ''}`}
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="bottom-nav-menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <Video className="bottom-nav-icon" />
          <span className="bottom-nav-label">Videos</span>
        </button>
      </nav>

      <div
        className={`bottom-menu-backdrop${isMenuOpen ? ' is-open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden={!isMenuOpen}
      />

      <div
        id="bottom-nav-menu"
        className={`bottom-menu-sheet${isMenuOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isMenuOpen}
      >
        <div className="bottom-menu-title">Videos</div>
      </div>
    </>
  );
}
