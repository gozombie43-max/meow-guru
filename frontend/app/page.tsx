'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import GradientWaves from '@/components/GradientWaves';
import heroImage from '@/public/hero-image.webp';
import Typewriter from '@/components/Typewriter';
import MacTrafficLights from '@/components/MacTrafficLights';
import QuizChartArt from '@/components/QuizChartArt';
import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';
import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';
import BooksIcon from '@/components/BooksIcon';
import BattleIcon from '@/components/BattleIcon';
import {
  MathSubjectIcon,
  ReasoningSubjectIcon,
  EnglishSubjectIcon,
  GkSubjectIcon,
} from '@/components/SubjectIconBadges';
import {
  Bell,
  BookOpen,
  ChevronRight,
  Clock,
  Crown,
  FileCheck2,
  GraduationCap,
  Home as HomeIcon,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  Search,
  Smartphone,
  Sun,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useTheme';
import styles from './page.module.css';
import { AiChatIcon } from '@/components/AiChatIcon';

/* Desktop macOS Subjects */
const desktopSubjects = [
  {
    title: 'MATH',
    subtitle: 'Practice & master mathematics',
    href: '/mathematics',
    Icon: MathSubjectIcon,
  },
  {
    title: 'REASONING',
    subtitle: 'Sharpen your logical reasoning',
    href: '/reasoning',
    Icon: ReasoningSubjectIcon,
  },
  {
    title: 'ENGLISH',
    subtitle: 'Improve grammar & vocabulary',
    href: '/english',
    Icon: EnglishSubjectIcon,
  },
  {
    title: 'GK',
    subtitle: 'Stay updated with general knowledge',
    href: '/general-awareness',
    Icon: GkSubjectIcon,
  },
] as const;

/* Mobile Subjects */
const mobileSubjects = [
  { title: 'MATH', href: '/mathematics', icon: MathIcon, tone: 'math' },
  { title: 'REASONING', href: '/reasoning', icon: ReasoningIcon, tone: 'reasoning' },
  { title: 'ENGLISH', href: '/english', icon: EnglishIcon, tone: 'english' },
  { title: 'GK', href: '/general-awareness', icon: GkIcon, tone: 'gk' },
] as const;

const railItems = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Mock', href: '/mock-test', icon: FileCheck2 },
  { label: 'Play', href: '/play', icon: Play },
  { label: 'Videos', href: '/videos', icon: Video },
  { label: 'AI Chat', href: '/ai-chat', icon: AiChatIcon },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
] as const;

const recentQuizzesData = [
  {
    tag: 'ENGLISH',
    tagTone: 'english',
    title: 'Synonyms & Antonyms',
    subtitle: 'Continue from Q17',
    progress: '0/970',
    progressPercent: 18,
    href: '/english',
  },
  {
    tag: 'REASONING',
    tagTone: 'reasoning',
    title: 'Coding – Decoding',
    subtitle: 'Continue from Q23',
    progress: '0/850',
    progressPercent: 24,
    href: '/reasoning',
  },
  {
    tag: 'GK',
    tagTone: 'gk',
    title: 'Indian Polity',
    subtitle: 'Continue from Q12',
    progress: '0/680',
    progressPercent: 14,
    href: '/general-awareness',
  },
];

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

function StudyStackArt() {
  return (
    <div className={styles.stackArt} aria-hidden="true">
      <span className={styles.bookOne} />
      <span className={styles.bookTwo} />
      <span className={styles.bookThree} />
      <span className={styles.cup} />
      <span className={styles.pencilOne} />
      <span className={styles.pencilTwo} />
      <span className={styles.pencilThree} />
    </div>
  );
}

export default function Home() {
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

  // Keyboard shortcut ⌘K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const recent = user?.recentQuizzes?.[0];
  const recentTitle = recent?.title || 'Percentages';
  const recentSubject = recent?.subject
    ? recent.subject.replace(/-/g, ' ').toUpperCase()
    : 'MATHEMATICS';
  const submittedCount = recent?.submittedQuestions?.length ?? Math.max(recent?.currentIndex ?? 2, 2);
  const totalCount = recent?.totalQuestions ?? 386;
  const continueHref = recent
    ? `${recent.href}${recent.mode ? `?mode=${recent.mode}&resume=1` : '?resume=1'}`
    : '/mathematics/arithmetic/percentages';

  const renderMobileHeaderActions = () => (
    <div className={styles.headerActionsMobile}>
      {user ? (
        <button
          type="button"
          className={styles.profileButton}
          aria-label="User Profile"
          title="User Profile"
        >
          {user.avatar ? (
            <span
              aria-hidden="true"
              className={styles.profileImage}
              style={{ backgroundImage: `url("${user.avatar}")` }}
            />
          ) : (
            <span aria-hidden="true" className={styles.profileInitial}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'G'}
            </span>
          )}
        </button>
      ) : (
        <Link href="/login" className={styles.loginButton}>
          Log in
        </Link>
      )}
      <button
        type="button"
        className={styles.iconButton}
        onClick={toggleThemeMode}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={23} /> : <Moon size={23} />}
      </button>
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
    <main className={`${styles.pageWrapper} ${isDark ? styles.dark : styles.light}`}>
      {/* Ambient background waves */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <GradientWaves
          horizonColor="#2563EB"
          waveColor="#93c5fd"
          crestColor="#ffffff"
          speed={0.25}
          amplitude={2.5}
          waveScale={0.85}
          waveRatio={0.9}
          swell={25}
          turbulence={14}
          tilt={1.1}
          zoom={1.0}
          height={5.0}
          fogDepth={16}
          detail="medium"
          brightness={1.0}
          opacity={0.85}
          mouseInteraction={true}
          parallaxStrength={0.4}
          grain={true}
          grainIntensity={0.03}
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
                  {user?.avatar ? (
                    <span
                      className={styles.avatarImage}
                      style={{ backgroundImage: `url("${user.avatar}")` }}
                    />
                  ) : (
                    <span className={styles.avatarInitial}>
                      {user?.name && user.name !== 'Test User' ? user.name.charAt(0).toUpperCase() : 'G'}
                    </span>
                  )}
                </Link>

                {/* Theme Toggle */}
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={toggleThemeMode}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun size={19} /> : <Sun size={19} />}
                </button>

                {/* Notifications */}
                <button
                  type="button"
                  className={styles.actionButton}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell size={19} />
                  <span className={styles.notificationDot} />
                </button>
              </div>
            </header>

            {/* Main Grid: Content Area + Right Column */}
            <div className={styles.mainGrid}>
              {/* Center Main Content Area */}
              <div className={styles.contentColumn}>
                {/* Hero Banner ("Choose Your Subject") */}
                <section className={styles.heroCard} aria-labelledby="hero-title">
                  <div className={styles.heroContent}>
                    {/* Badge */}
                    <div className={styles.heroBadge}>
                      <div className={styles.heroBadgeIcon}>
                        <GraduationCap size={15} strokeWidth={2.4} />
                      </div>
                      <span>Knowledge That Empowers</span>
                    </div>

                    {/* Title */}
                    <h1 id="hero-title" className={styles.heroTitle}>
                      Choose Your <br />
                      Subject
                    </h1>

                    {/* Underline Bar */}
                    <div className={styles.heroUnderline} />

                    {/* Typewriter Highlight */}
                    <div className={styles.typewriterWrapper}>
                      <Typewriter
                        texts={['GK', 'MATH', 'REASONING', 'ENGLISH']}
                        showCursor={false}
                        hideCursorOnType={true}
                        color="var(--mac-primary)"
                        typedColor="var(--mac-primary)"
                        font={{
                          fontFamily: 'inherit',
                          fontSize: 'clamp(20px, 2.2vw, 26px)',
                          fontWeight: '800',
                          letterSpacing: '-0.5px',
                          lineHeight: '1.05',
                        }}
                        style={{ justifyContent: 'flex-start' }}
                      />
                    </div>

                    {/* Subtitle */}
                    <p className={styles.heroSubtitle}>
                      Learn your way. <br />
                      Anywhere, anytime.
                    </p>

                    {/* Highlights Row */}
                    <div className={styles.heroHighlights}>
                      <div className={styles.highlightItem}>
                        <BookOpen size={14} className={styles.highlightIcon} />
                        <span>Wide Range</span>
                      </div>
                      <span className={styles.highlightDivider} />
                      <div className={styles.highlightItem}>
                        <Clock size={14} className={styles.highlightIcon} />
                        <span>Learn Anytime</span>
                      </div>
                      <span className={styles.highlightDivider} />
                      <div className={styles.highlightItem}>
                        <Smartphone size={14} className={styles.highlightIcon} />
                        <span>Study Anywhere</span>
                      </div>
                    </div>
                  </div>

                  {/* Arched Student Visual */}
                  <div className={styles.heroVisualWrapper}>
                    <div className={styles.heroArchFrame}>
                      <Image
                        src={heroImage}
                        alt="Student with graduation cap and notebook"
                        fill
                        priority
                        placeholder="blur"
                        sizes="(max-width: 768px) 100vw, 40vw"
                        className={styles.heroStudentImage}
                      />
                    </div>
                  </div>
                </section>

                {/* Explore Subjects Section */}
                <section className={styles.exploreSection} aria-labelledby="explore-title">
                  <div className={styles.sectionHeaderRow}>
                    <h2 id="explore-title" className={styles.sectionTitle}>
                      Explore Subjects
                    </h2>
                  </div>

                  {/* 2x2 Subjects Grid */}
                  <div className={styles.subjectGrid}>
                    {desktopSubjects.map((subj) => {
                      const SubjectIcon = subj.Icon;
                      return (
                        <Link
                          key={subj.title}
                          href={subj.href}
                          className={styles.subjectCard}
                          title={`Explore ${subj.title}`}
                        >
                          <SubjectIcon size={46} />
                          <div className={styles.subjectCardInfo}>
                            <h3 className={styles.subjectCardTitle}>{subj.title}</h3>
                            <p className={styles.subjectCardSubtitle}>{subj.subtitle}</p>
                          </div>
                          <ChevronRight size={18} className={styles.subjectCardChevron} />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Right Column: Recent Quizzes */}
              <aside className={styles.recentQuizzesColumn} aria-labelledby="recent-quizzes-title">
                <div className={styles.recentQuizzesHeader}>
                  <h2 id="recent-quizzes-title" className={styles.recentQuizzesTitle}>
                    Recent Quizzes
                  </h2>
                  <Link href="/dashboard" className={styles.viewAllLink}>
                    View All
                  </Link>
                </div>

                {/* Quiz Cards List */}
                <div className={styles.recentQuizList}>
                  {recentQuizzesData.map((quiz) => (
                    <Link
                      key={quiz.title}
                      href={quiz.href}
                      className={styles.recentQuizCard}
                    >
                      <div className={styles.quizCardMain}>
                        {/* Top Header of Card */}
                        <div className={styles.quizCardMeta}>
                          <span className={`${styles.quizTag} ${styles[quiz.tagTone]}`}>
                            {quiz.tag}
                          </span>
                          <span className={styles.quizProgressRatio}>
                            {quiz.progress}
                          </span>
                        </div>

                        {/* Title & Subtitle */}
                        <h3 className={styles.quizCardTitle}>{quiz.title}</h3>
                        <p className={styles.quizCardSubtitle}>{quiz.subtitle}</p>

                        {/* Progress Bar */}
                        <div className={styles.quizProgressBar}>
                          <div
                            className={styles.quizProgressFill}
                            style={{ width: `${quiz.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Right Art Graphic */}
                      <div className={styles.quizCardArt}>
                        <QuizChartArt size={42} />
                      </div>
                    </Link>
                  ))}
                </div>

                {/* View All Quizzes Action Button */}
                <Link href="/dashboard" className={styles.viewAllQuizzesButton}>
                  <span>View All Quizzes</span>
                  <ChevronRight size={16} />
                </Link>
              </aside>
            </div>
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
          aria-label="Close menu"
        />

        {/* Mobile Slide-out Sidebar */}
        <aside className={`${styles.mobileSidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <SkillLearnLogo />
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
            <h2>Go Premium</h2>
            <p>Unlock all features and learn without limits.</p>
            <Link href="/resource">Upgrade Now</Link>
          </section>
        </aside>

        {/* Mobile Page Content */}
        <div className={styles.mobileWorkspace}>
          <header className={styles.mobileTopbar}>
            <SkillLearnLogo />
            {renderMobileHeaderActions()}
          </header>

          <section className={styles.mobileHero}>
            <div className={styles.heroDotsTopRight} aria-hidden="true" />

            <div className={styles.mobileHeroCopy}>
              <div className={styles.mobileHeroBadge}>
                <div className={styles.mobileHeroBadgeIcon}>
                  <GraduationCap size={16} strokeWidth={2.5} />
                </div>
                <span>Knowledge That Empowers</span>
              </div>

              <h1>
                Choose Your <br />
                Subject
              </h1>
              <div className={styles.heroLine} />

              <div style={{ minHeight: '40px', marginBottom: '12px' }}>
                <Typewriter
                  texts={['MATH', 'ENGLISH', 'REASONING', 'GK']}
                  showCursor={false}
                  hideCursorOnType={true}
                  color="var(--purple)"
                  typedColor="var(--purple)"
                  font={{
                    fontFamily: 'inherit',
                    fontSize: 'clamp(24px, 5.5vw, 32px)',
                    fontWeight: '700',
                    letterSpacing: '-0.8px',
                    lineHeight: '1.05',
                  }}
                  style={{ justifyContent: 'flex-start' }}
                />
              </div>

              <p className={styles.mobileHeroDesc}>
                Learn your way.
                <br />
                Anywhere, anytime.
              </p>

              <div className={styles.mobileHeroFeatures}>
                <div className={styles.heroFeature}>
                  <BookOpen size={16} className={styles.featureIcon} />
                  <span>Wide Range</span>
                </div>
                <div className={styles.featureDivider} />
                <div className={styles.heroFeature}>
                  <Clock size={16} className={styles.featureIcon} />
                  <span>Learn Anytime</span>
                </div>
                <div className={styles.featureDivider} />
                <div className={styles.heroFeature}>
                  <Smartphone size={16} className={styles.featureIcon} />
                  <span>Study Anywhere</span>
                </div>
              </div>
            </div>

            <div className={styles.mobileHeroVisual}>
              <Image
                src={heroImage}
                alt="Graduate student"
                fill
                priority
                placeholder="blur"
                sizes="(max-width: 768px) 50vw, 50vw"
                className={styles.mobileHeroImage}
              />
            </div>
          </section>

          <section className={styles.mobileContentGrid}>
            <div className={styles.mobileLeftColumn}>
              <div id="subjects" className={styles.mobileSubjectGrid}>
                {mobileSubjects.map((subject) => (
                  <Link key={subject.title} href={subject.href} className={styles.mobileSubjectCard}>
                    <span className={`${styles.subjectIcon} ${styles[subject.tone]}`}>
                      <subject.icon size={30} />
                    </span>
                    <span>{subject.title}</span>
                  </Link>
                ))}
              </div>

              <Link href="/resource" className={styles.resourceCard}>
                <span className={styles.resourceIcon}>
                  <BooksIcon size={48} />
                </span>
                <span>
                  <strong>ALL BOOKS & NOTES</strong>
                  <small>Books, chapter notes, extras & DPP</small>
                </span>
              </Link>

              <Link href="/battle" className={styles.battleCard}>
                <span className={styles.battleIcon}>
                  <BattleIcon size={48} />
                </span>
                <span>
                  <strong>BATTLE MODE</strong>
                  <small>Challenge yourself & win rewards</small>
                </span>
              </Link>
            </div>

            <section className={styles.recentSection} aria-labelledby="mobile-recent-title">
              <div className={styles.sectionHeader}>
                <h2 id="mobile-recent-title">Recent Quizzes</h2>
                <Link href="/dashboard">View All</Link>
              </div>

              <Link href={continueHref} className={styles.quizCard}>
                <div className={styles.quizInfo}>
                  <span className={styles.quizTag}>{recentSubject}</span>
                  <h3>{recentTitle}</h3>
                  <p>Continue from Q{Math.max(1, (recent?.currentIndex ?? 57) + 1)}</p>
                  <span className={styles.progressTrack}>
                    <span className={styles.progressFill} />
                  </span>
                  <span className={styles.continueButton}>Continue</span>
                </div>
                <span className={styles.quizCount}>
                  {submittedCount}/{totalCount}
                </span>
                <StudyStackArt />
              </Link>
            </section>
          </section>

        </div>
      </div>
    </main>
  );
}
