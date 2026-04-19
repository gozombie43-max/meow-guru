'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ClipboardList, Home as HomeIcon, Menu, Play } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const isQuizRoute = pathname.split('/').includes('quiz');
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
  const isLightSurface = lightSurfacePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  useEffect(() => {
    const body = document.body;
    if (isQuizRoute) {
      body.classList.remove('has-bottom-nav');
      return;
    }
    body.classList.add('has-bottom-nav');
    return () => body.classList.remove('has-bottom-nav');
  }, [isQuizRoute]);

  if (isQuizRoute) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');

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
      <button className="bottom-nav-item" type="button">
        <Menu className="bottom-nav-icon" />
        <span className="bottom-nav-label">MENU</span>
      </button>
    </nav>
  );
}
