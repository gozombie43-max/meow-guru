'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import GradientWaves from '@/components/GradientWaves';
import MacTrafficLights from '@/components/MacTrafficLights';
import QuizChartArt from '@/components/QuizChartArt';
import GoogleAvatarRing from '@/components/GoogleAvatarRing';
import {
  Bell,
  BookOpen,
  Crown,
  FileCheck2,
  Home as HomeIcon,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  Search,
  Sun,
  Swords,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useTheme';
import styles from './page.module.css';
import { AiChatIcon } from '@/components/AiChatIcon';
import { desktopSubjects, recentQuizzesData } from './home-data';

const railItems = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Mock', href: '/mock-test', icon: FileCheck2 },
  { label: 'Play', href: '/play', icon: Play },
  { label: 'Battle Mode', href: '/battle', icon: Swords },
  { label: 'All Books & Notes', href: '/resource', icon: BookOpen },
  { label: 'Videos', href: '/videos', icon: Video },
  { label: 'AI Chat', href: '/ai-chat', icon: AiChatIcon },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
] as const;

function SkillLearnLogo() {
  return (
    <Link href="/" className={styles.logo} aria-label="Study Guru home">
      <span className={styles.logoMark} aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="36" height="36" fillRule="nonzero">
          <g fill="#2563eb" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10" strokeDasharray="" strokeDashoffset="0" style={{ mixBlendMode: 'normal' }}>
            <g transform="scale(4,4)">
              <path d="M56,41.7c0,0 -2.11,-0.54 -4,-0.7c0,0 1.22,1.92 1.5,4.5c0,0 -2.26,-0.55 -4.42,-0.5c0,0 1.62,1.91 1.92,4c0,0 -1.915,1.62 -6.315,4.12c0,0 -0.073,-2.17 -1.185,-6.12h-2c0,0 -0.068,4.899 -1.5,10.3c-3,3.7 -8,3.7 -8,3.7c0,0 -5,0 -8,-3.7c-1.432,-5.401 -1.5,-10.3 -1.5,-10.3h-2c-1.111,3.95 -1.185,6.12 -1.185,6.12c-4.4,-2.5 -6.315,-4.12 -6.315,-4.12c0.3,-2.09 1.92,-4 1.92,-4c-2.16,-0.05 -4.42,0.5 -4.42,0.5c0.28,-2.58 1.5,-4.5 1.5,-4.5c-1.89,0.16 -4,0.7 -4,0.7c0.36,-2.4 2,-4.7 2,-4.7c-2.41,0.27 -4,1 -4,1c3,-14 15,-21 15,-21c-4.02,-4.35 -7.4,-7 -7.4,-7c0,0 -1.17,4.47 -0.6,10.4l-4,4.1c-1,-9.5 1.8,-20.5 1.8,-20.5l1.5,-0.5l12.7,10.5c0,0 2.46,-0.48 7,-0.48c4.54,0 7,0.48 7,0.48l12.7,-10.5l1.5,0.5c0,0 2.8,11 1.8,20.5l-4,-4.1c0.57,-5.93 -0.6,-10.4 -0.6,-10.4c0,0 -3.38,2.65 -7.4,7c0,0 12,7 15,21c0,0 -1.59,-0.73 -4,-1c0,0 1.64,2.3 2,4.7zM26.799,38c-0.143,-2.57 -1.082,-3.92 -1.614,-4.38c-1.741,-0.59 -3.813,-0.58 -5.185,-0.43c2.15,4.75 6.297,4.81 6.348,4.81zM37.652,38c0.051,0 4.198,-0.06 6.348,-4.81c-1.372,-0.15 -3.444,-0.16 -5.185,0.43c-0.532,0.46 -1.471,1.81 -1.614,4.38zM32,52c-2,0 -4,1 -4,1c1,4 4,4 4,4c0,0 3,0 4,-4c0,0 -2,-1 -4,-1z"></path>
            </g>
          </g>
        </svg>
      </span>
      <span className={styles.logoText}>
        <strong>STUDY</strong>
        <span>GURU</span>
      </span>
    </Link>
  );
}

export default function HomeClient({
  desktopContent,
  mobileContent,
}: {
  desktopContent: ReactNode;
  mobileContent: ReactNode;
}) {
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const { theme, toggleThemeMode } = useThemeMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    document.body.classList.add('home-redesign');
    document.documentElement.classList.add('home-redesign');
    return () => {
      document.body.classList.remove('home-redesign');
      document.documentElement.classList.remove('home-redesign');
    };
  }, []);

  // Prevent background scrolling when mobile sidebar is open
  useEffect(() => {
    if (!sidebarOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [sidebarOpen]);

  // Keyboard shortcut ⌘K / Ctrl+K for search & ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderMobileHeaderActions = () => (
    <div className={styles.headerActionsMobile}>
      {user ? (
        <button
          type="button"
          className={styles.profileButton}
          aria-label="User Profile"
          title="User Profile"
        >
          <GoogleAvatarRing
            initial={user.name ? user.name.charAt(0).toUpperCase() : 'G'}
            avatarUrl={user.avatar || undefined}
            size={34}
          />
        </button>
      ) : (
        <Link href="/login" className={styles.loginButton}>
          Log in
        </Link>
      )}
      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
        aria-expanded={sidebarOpen}
      >
        <Menu size={30} />
      </button>
    </div>
  );

  return (
    <main className={`${styles.pageWrapper} ${isDark ? styles.dark : ''}`}>
      {/* Ambient background waves (OGL WebGL2 Shader) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <GradientWaves
          horizonColor={isDark ? "#0062cc" : "#0071e3"}
          waveColor={isDark ? "#38bdf8" : "#60a5fa"}
          crestColor="#ffffff"
          speed={0.35}
          amplitude={3.15}
          waveScale={0.8}
          waveRatio={0.9}
          swell={30}
          turbulence={18}
          tilt={1.15}
          zoom={1.0}
          height={5.5}
          fogDepth={14}
          detail="medium"
          brightness={1.0}
          opacity={isDark ? 0.88 : 0.92}
          mouseInteraction={true}
          parallaxStrength={0.45}
          grain={true}
          grainIntensity={0.04}
        />
      </div>

      {/* =========================================================================
          DESKTOP PC VIEW (macOS Application Window Frame)
          ========================================================================= */}
      <div className={styles.desktopOnly}>
        <div className={styles.macWindow}>
          {/* Left Sidebar */}
          <aside className={styles.desktopSidebar}>
            {/* Traffic Lights */}
            <div className={styles.sidebarHeader}>
              <MacTrafficLights />
            </div>

            {/* Logo */}
            <div className={styles.sidebarBrand}>
              <SkillLearnLogo />
            </div>

            {/* Navigation Items */}
            <nav className={styles.railNav} aria-label="Primary Desktop">
              {railItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`${styles.railLink} ${active ? styles.railActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 1.8} className={styles.railIcon} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Go Premium Card */}
            <div className={styles.premiumCard}>
              <div className={styles.premiumHeader}>
                <div className={styles.crownIcon}>
                  <Crown size={16} strokeWidth={2.4} fill="currentColor" />
                </div>
                <h3>Go Premium</h3>
              </div>
              <p>Unlock all features and learn without limits.</p>
              <Link href="/resource" className={styles.premiumButton}>
                Upgrade Now
              </Link>
            </div>
          </aside>

          {/* Main Desktop Workspace */}
          <div className={styles.desktopWorkspace}>
            {/* Top Bar across Center and Right */}
            <header className={styles.topbar}>
              {/* macOS Search Pill */}
              <div className={styles.searchContainer}>
                <Search size={18} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search anything..."
                  className={styles.searchInput}
                  aria-label="Search anything"
                />
                <kbd className={styles.searchShortcut} onClick={() => searchInputRef.current?.focus()}>
                  ⌘ K
                </kbd>

                {/* Spotlight-style Quick Results */}
                {searchOpen && searchQuery.trim().length > 0 && (
                  <div className={styles.searchDropdown}>
                    <div className={styles.searchDropdownHeader}>
                      <span>Quick Search Results</span>
                      <button
                        type="button"
                        className={styles.searchCloseBtn}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchOpen(false);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className={styles.searchDropdownList}>
                      {desktopSubjects
                        .filter(
                          (s) =>
                            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((s) => (
                          <Link
                            key={s.title}
                            href={s.href}
                            className={styles.searchDropdownItem}
                            onClick={() => setSearchOpen(false)}
                          >
                            <s.Icon size={24} />
                            <div>
                              <strong>{s.title}</strong>
                              <small>{s.subtitle}</small>
                            </div>
                          </Link>
                        ))}
                      {recentQuizzesData
                        .filter((q) => q.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((q) => (
                          <Link
                            key={q.title}
                            href={q.href}
                            className={styles.searchDropdownItem}
                            onClick={() => setSearchOpen(false)}
                          >
                            <QuizChartArt size={24} />
                            <div>
                              <strong>{q.title}</strong>
                              <small>{q.tag} Quiz • {q.progress}</small>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Right User & System Controls */}
              <div className={styles.topActions}>
                {/* User Avatar */}
                <Link href="/dashboard" className={styles.profileAvatar} aria-label="User Profile">
                  <GoogleAvatarRing
                    initial={user?.name && user.name !== 'Test User' ? user.name.charAt(0).toUpperCase() : 'G'}
                    avatarUrl={user?.avatar || undefined}
                    size={34}
                  />
                </Link>

                {/* Theme Toggle */}
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={toggleThemeMode}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                {/* Notifications */}
                <button
                  type="button"
                  className={styles.actionButton}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell size={17} />
                  <span className={styles.notificationDot} />
                </button>
              </div>
            </header>

            {desktopContent}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (Previous Mobile Design)
          ========================================================================= */}
      <div className={styles.mobileOnly}>
        {/* Backdrop for mobile drawer */}
        <button
          type="button"
          className={`${styles.sidebarBackdrop} ${sidebarOpen ? styles.sidebarBackdropOpen : ''}`}
          onClick={() => setSidebarOpen(false)}
          onTouchMove={(e) => e.preventDefault()}
          aria-label="Close menu"
        />

        {/* Mobile Slide-out Sidebar */}
        <aside className={`${styles.mobileSidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.mobileSidebarHeader}>
            <SkillLearnLogo />
            <button
              type="button"
              className={styles.sidebarCloseButton}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
          </div>

          <button
            type="button"
            className={styles.sidebarThemeToggle}
            onClick={toggleThemeMode}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={isDark}
          >
            <span className={styles.sidebarThemeIcon} aria-hidden="true">
              {isDark ? <Moon size={16} /> : <Sun size={16} />}
            </span>
            <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
            <span className={styles.sidebarThemeSwitch} aria-hidden="true">
              <span />
            </span>
          </button>
          <nav className={styles.railNav} aria-label="Primary Mobile">
            {railItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${styles.railLink} ${active ? styles.railActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} strokeWidth={active ? 2.6 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <section className={styles.premium}>
            <div className={styles.premiumHeader}>
              <div className={styles.crownIcon}>
                <Crown size={16} strokeWidth={2.4} fill="currentColor" />
              </div>
              <h2>Go Premium</h2>
            </div>
            <p>Unlock all features and learn without limits.</p>
            <Link href="/resource" onClick={() => setSidebarOpen(false)}>Upgrade Now</Link>
          </section>
        </aside>

        {/* Mobile Page Content */}
        <div className={styles.mobileWorkspace}>
          <header className={styles.mobileTopbar}>
            <SkillLearnLogo />
            {renderMobileHeaderActions()}
          </header>

          {mobileContent}
        </div>
      </div>
    </main>
  );
}
