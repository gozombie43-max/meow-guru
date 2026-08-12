'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import GradientWaves from '@/components/GradientWaves';
import heroImage from '@/public/hero-image.webp';
import Typewriter from '@/components/Typewriter';
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Bot,
  Brain,
  Calculator,
  ChevronRight,
  FileCheck2,
  Clock,
  GraduationCap,
  Home as HomeIcon,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  Settings,
  Smartphone,
  Sparkles,
  Globe,
  Swords,
  Sun,
  Trophy,
  Video,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useTheme';
import styles from './page.module.css';
import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';
import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';

const subjects = [
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
  { label: 'AI Chat', href: '/ai-chat', icon: Bot },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
] as const;

const features = [
  { title: 'Skill-Based Learning', copy: 'Personalized learning experience', icon: Zap },
  { title: 'Track Progress', copy: 'Monitor your growth in real time', icon: BarChart3 },
  { title: 'Practice Anytime', copy: 'Learn on your schedule, anywhere', icon: Play },
  { title: 'Win Rewards', copy: 'Compete and earn exciting rewards', icon: Trophy },
] as const;

function SkillLearnLogo() {
  return (
    <Link href="/" className={styles.logo} aria-label="Study Guru home">
      <span className={styles.logoMark} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className={styles.logoText}>
        <strong>STUDY</strong>
        <strong>GURU</strong>
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
  const { user, logout } = useAuth();
  const { theme, toggleThemeMode } = useThemeMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    document.body.classList.add('home-redesign');
    document.documentElement.classList.add('home-redesign');
    return () => {
      document.body.classList.remove('home-redesign');
      document.documentElement.classList.remove('home-redesign');
    };
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

  const renderHeaderActions = (className: string) => (
    <div className={className}>
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
              {user.name.charAt(0).toUpperCase()}
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
    <main className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      {/* GradientWaves — fixed full-page background */}
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
          horizonColor="#5227FF"
          waveColor="#a78bfa"
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
          opacity={0.92}
          mouseInteraction={true}
          parallaxStrength={0.45}
          grain={true}
          grainIntensity={0.04}
        />
      </div>
      <button
        type="button"
        className={`${styles.sidebarBackdrop} ${sidebarOpen ? styles.sidebarBackdropOpen : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close menu"
      />

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
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
        <nav className={styles.railNav} aria-label="Primary">
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

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <SkillLearnLogo />
          {renderHeaderActions(styles.headerActionsMobile)}
        </header>

        <section className={styles.hero}>
          {renderHeaderActions(styles.headerActionsDesktop)}
          <div className={styles.heroDotsTopRight} aria-hidden="true" />
          
          
          <div className={styles.heroCopy}>
            <div className={styles.heroBadge}>
              <div className={styles.heroBadgeIcon}>
                <GraduationCap size={16} strokeWidth={2.5} />
              </div>
              <span>Knowledge That Empowers</span>
            </div>

            <h1>
              Choose Your <br />
              Subject
            </h1>
            <div className={styles.heroLine} />
            
            <div style={{ minHeight: '45px', marginBottom: '16px' }}>
              <Typewriter 
                texts={['MATH', 'ENGLISH', 'REASONING', 'GK']} 
                showCursor={false} 
                hideCursorOnType={true}
                color="var(--purple)"
                typedColor="var(--purple)"
                font={{
                  fontFamily: 'inherit',
                  fontSize: 'clamp(26px, 3.2vw, 36px)',
                  fontWeight: '700',
                  letterSpacing: '-0.8px',
                  lineHeight: '1.05'
                }}
                style={{ justifyContent: 'flex-start' }}
              />
            </div>

            <p>
              Learn your way.
              <br />
              Anywhere, anytime.
            </p>
            
            <div className={styles.heroFeatures}>
              <div className={styles.heroFeature}>
                <BookOpen size={18} className={styles.featureIcon} />
                <span>Wide Range</span>
              </div>
              <div className={styles.featureDivider} />
              <div className={styles.heroFeature}>
                <Clock size={18} className={styles.featureIcon} />
                <span>Learn Anytime</span>
              </div>
              <div className={styles.featureDivider} />
              <div className={styles.heroFeature}>
                <Smartphone size={18} className={styles.featureIcon} />
                <span>Study Anywhere</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <Image
              src={heroImage}
              alt="Graduate student"
              fill
              priority
              placeholder="blur"
              sizes="(max-width: 768px) 50vw, 50vw"
              className={styles.heroImage}
            />
          </div>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.leftColumn}>
            <div id="subjects" className={styles.subjectGrid}>
              {subjects.map((subject) => (
                <Link key={subject.title} href={subject.href} className={styles.subjectCard}>
                  <span className={`${styles.subjectIcon} ${styles[subject.tone]}`}>
                    <subject.icon size={30} />
                  </span>
                  <span>{subject.title}</span>
                </Link>
              ))}
            </div>

            <Link href="/resource" className={styles.resourceCard}>
              <span className={styles.resourceIcon}>
                <BookOpen size={34} />
              </span>
              <span>
                <strong>ALL BOOKS & NOTES</strong>
                <small>Books, chapter notes, extras & DPP</small>
              </span>
            </Link>

            <Link href="/battle" className={styles.battleCard}>
              <span className={styles.battleIcon}>
                <Swords size={34} />
              </span>
              <span>
                <strong>BATTLE MODE</strong>
                <small>Challenge yourself & win rewards</small>
              </span>
            </Link>
          </div>

          <section className={styles.recentSection} aria-labelledby="recent-title">
            <div className={styles.sectionHeader}>
              <h2 id="recent-title">Recent Quizzes</h2>
              <Link href="/dashboard">
                View All
              </Link>
            </div>

            <Link href={continueHref} className={styles.quizCard}>
              <div className={styles.quizInfo}>
                <span className={styles.quizTag}>{recentSubject}</span>
                <h3>{recentTitle}</h3>
                <p>Continue from Q{Math.max(1, (recent?.currentIndex ?? 57) + 1)}</p>
                <span className={styles.progressTrack}>
                  <span className={styles.progressFill} />
                </span>
                <span className={styles.continueButton}>
                  Continue
                </span>
              </div>
              <span className={styles.quizCount}>{submittedCount}/{totalCount}</span>
              <StudyStackArt />
            </Link>
          </section>
        </section>

        <section className={styles.featureStrip} aria-label="Learning highlights">
          {features.map(({ title, copy, icon: Icon }) => (
            <article key={title} className={styles.featureItem}>
              <Icon size={38} />
              <span>
                <strong>{title}</strong>
                <small>{copy}</small>
              </span>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
