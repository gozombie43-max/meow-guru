'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  Calculator,
  ChevronRight,
  FileCheck2,
  Home as HomeIcon,
  LogOut,
  Menu,
  Moon,
  Play,
  Settings,
  Sparkles,
  Swords,
  Sun,
  Trophy,
  Video,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useTheme';
import styles from './page.module.css';

const subjects = [
  { title: 'Mathematics', href: '/mathematics', icon: Calculator, tone: 'math' },
  { title: 'Reasoning', href: '/reasoning', icon: Brain, tone: 'reasoning' },
  { title: 'English', href: '/english', icon: Bookmark, tone: 'english' },
  { title: 'General Awareness', href: '/general-awareness', icon: Sparkles, tone: 'gk' },
] as const;

const railItems = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Mock', href: '/mock-test', icon: FileCheck2 },
  { label: 'Play', href: '/play', icon: Play },
  { label: 'Videos', href: '/videos', icon: Video },
  { label: 'Progress', href: '/dashboard', icon: BarChart3 },
  { label: 'Bookmarks', href: '/dashboard', icon: Bookmark },
  { label: 'Settings', href: '/dashboard', icon: Settings },
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

  return (
    <main className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <aside className={styles.sidebar}>
        <SkillLearnLogo />
        <nav className={styles.railNav} aria-label="Primary">
          {railItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`${styles.railLink} ${active ? styles.railActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon size={20} strokeWidth={active ? 2.6 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <section className={styles.premium}>
          <span className={styles.premiumIcon}>
            <Sparkles size={22} />
          </span>
          <h2>Go Premium</h2>
          <p>Unlock all features and learn without limits.</p>
          <Link href="/resource">Upgrade Now</Link>
        </section>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <SkillLearnLogo />
          <div className={styles.headerActions}>
            {user ? (
              <button type="button" className={styles.loginButton} onClick={logout}>
                <LogOut size={18} />
                <span>Log out</span>
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
            <button type="button" className={styles.menuButton} aria-label="Menu">
              <Menu size={30} />
            </button>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.badge}>
              <Zap size={22} fill="currentColor" />
              Skill-Based Learning
            </span>
            <h1>
              Choose Your
              <span>Subject</span>
            </h1>
            <p>
              Learn your way.
              <br />
              Anywhere, anytime.
            </p>
            <Link href="#subjects" className={styles.primaryCta}>
              Explore Subjects
              <ChevronRight size={26} />
            </Link>
          </div>

          <div className={styles.heroVisual}>
            <span className={styles.wave} aria-hidden="true" />
            <span className={`${styles.floatIcon} ${styles.floatBook}`} aria-hidden="true">
              ▱
            </span>
            <span className={`${styles.floatIcon} ${styles.floatBrain}`} aria-hidden="true">
              ◌
            </span>
            <span className={`${styles.floatIcon} ${styles.floatDots}`} aria-hidden="true" />
            <Image
              src="/hero-image.png"
              alt="Graduate student holding study notes"
              width={740}
              height={820}
              priority
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
                  <ChevronRight className={styles.chevron} size={26} />
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
              <ChevronRight size={30} />
            </Link>

            <Link href="/battle" className={styles.battleCard}>
              <span className={styles.battleIcon}>
                <Swords size={34} />
              </span>
              <span>
                <strong>BATTLE MODE</strong>
                <small>Challenge yourself & win rewards</small>
              </span>
              <ChevronRight size={30} />
            </Link>
          </div>

          <section className={styles.recentSection} aria-labelledby="recent-title">
            <div className={styles.sectionHeader}>
              <h2 id="recent-title">Recent Quizzes</h2>
              <Link href="/dashboard">
                View All
                <ChevronRight size={21} />
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
                  <ChevronRight size={27} />
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
