'use client';

import Link from 'next/link';
import { hidesPrimaryNavigation } from '@/lib/shell-policy';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ClipboardList, Home as HomeIcon, Play, Video } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { AiChatIcon } from '@/components/AiChatIcon';

export default function BottomNav() {
  const pathname = usePathname() || '/';
  const shouldHideNav = hidesPrimaryNavigation(pathname);
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

  if (shouldHideNav) return null;

  const isHome = pathname === '/';
  const isMock = pathname.startsWith('/mock-test');
  const isPlay = pathname === '/play' || pathname.startsWith('/play/');
  const isVideos = pathname === '/videos' || pathname.startsWith('/videos/');

  return (
    <nav
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
        href="/videos"
        prefetch={false}
        className={`bottom-nav-item${isVideos ? ' is-active' : ''}`}
        aria-current={isVideos ? 'page' : undefined}
      >
        <Video className="bottom-nav-icon" />
        <span className="bottom-nav-label">Videos</span>
      </Link>
    </nav>
  );
}
