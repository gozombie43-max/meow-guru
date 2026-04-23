'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClipboardList, Home as HomeIcon, Menu, Moon, Play, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'ui-theme';
type ThemeMode = 'light' | 'dark';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const isQuizRoute = pathname.split('/').includes('quiz');
  const isNotesViewRoute = pathname === '/notes/view' || pathname.startsWith('/notes/view/');
  const shouldHideNav = isQuizRoute || isNotesViewRoute;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
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
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initialTheme: ThemeMode =
      stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light';
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.toggle('theme-dark', theme === 'dark');
    body.classList.toggle('theme-light', theme === 'light');
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
  const isDarkMode = theme === 'dark';

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
          href="/mock-test/index.html"
          className={`bottom-nav-item${isMock ? ' is-active' : ''}`}
          aria-current={isMock ? 'page' : undefined}
        >
          <ClipboardList className="bottom-nav-icon" />
          <span className="bottom-nav-label">Mock</span>
        </Link>
        <button className="bottom-nav-item" type="button">
          <Play className="bottom-nav-icon" />
          <span className="bottom-nav-label">Play</span>
        </button>
        <button
          className={`bottom-nav-item${isMenuOpen ? ' is-active' : ''}`}
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="bottom-nav-menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <Menu className="bottom-nav-icon" />
          <span className="bottom-nav-label">MENU</span>
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
        <div className="bottom-menu-title">Menu</div>
        <div className="bottom-menu-row">
          <div className="bottom-menu-text">
            <span className="bottom-menu-label">Appearance</span>
            <span className="bottom-menu-caption">{isDarkMode ? 'Dark' : 'Light'} mode</span>
          </div>
          <button
            type="button"
            className={`theme-toggle${isDarkMode ? ' is-dark' : ''}`}
            role="switch"
            aria-checked={isDarkMode}
            onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {isDarkMode ? <Moon size={14} /> : <Sun size={14} />}
            </span>
            <span className="theme-toggle-label">{isDarkMode ? 'Dark' : 'Light'}</span>
            <span className="theme-switch" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
