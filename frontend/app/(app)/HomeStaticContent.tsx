import HomeCardArtwork from './HomeCardArtwork';
import BattleIcon from '@/components/BattleIcon';
import BooksIcon from '@/components/BooksIcon';
import { ArrowRight, BookOpen, Brain, Globe, Library, Sigma, Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import MobileRecentQuiz from './MobileRecentQuiz.client';
import MobileHeroCarousel from './MobileHeroCarousel.client';
import DesktopRecentQuizzes from './DesktopRecentQuizzes.client';
import { mobileSubjects } from './home-data';
import d from './home-desktop.module.css';
import styles from './page.module.css';

export function DesktopHomeContent() {
  return (
    <div className={d.main}>
      <div className={d.column}>
        <section className={d.hero} aria-labelledby="hero-title">
          <div className={d.heroCopy}>
            <p className={d.eyebrow}>Math, Reasoning, English and GK</p>
            <h1 id="hero-title" className={d.heroTitle}>Choose a subject and practise one topic at a time</h1>
            <p className={d.heroText}>
              Topic-wise quizzes, chapter notes and mock tests in one place, resumed from the question you left.
            </p>
            <div className={d.heroActions}>
              <Link href="/mock-test" className={d.btnPrimary}>
                Take a mock test
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link href="/resource" className={d.btnSecondary}>Browse notes</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="explore-title">
          <div className={d.sectionHead}>
            <h2 id="explore-title" className={d.sectionTitle}>Subjects</h2>
          </div>
          <div className={d.subjectGrid}>
            {desktopSubjectRows.map(({ title, subtitle, href, Icon }) => (
              <Link key={title} href={href} className={d.subject}>
                <span className={d.subjectTop}>
                  <span className={d.tile} aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
                  <ArrowRight size={16} strokeWidth={1.75} className={d.subjectArrow} aria-hidden="true" />
                </span>
                <span>
                  <h3>{title}</h3>
                  <p>{subtitle}</p>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="more-title">
          <div className={d.sectionHead}>
            <h2 id="more-title" className={d.sectionTitle}>More ways to study</h2>
          </div>
          <div className={d.moreGrid}>
            <Link href="/resource" className={d.row}>
              <span className={d.tile} aria-hidden="true"><Library size={18} strokeWidth={1.75} /></span>
              <span className={d.rowCopy}>
                <strong>Books and notes</strong>
                <small>Textbooks, chapter notes and DPP</small>
              </span>
              <ArrowRight size={16} strokeWidth={1.75} className={d.subjectArrow} aria-hidden="true" />
            </Link>
            <Link href="/battle" className={d.row}>
              <span className={d.tile} aria-hidden="true"><Swords size={18} strokeWidth={1.75} /></span>
              <span className={d.rowCopy}>
                <strong>Battle mode</strong>
                <small>Challenge yourself and win rewards</small>
              </span>
              <ArrowRight size={16} strokeWidth={1.75} className={d.subjectArrow} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <DesktopRecentQuizzes />
    </div>
  );
}

const desktopSubjectRows = [
  { title: 'Math', subtitle: 'Arithmetic, algebra and geometry', href: '/mathematics', Icon: Sigma },
  { title: 'Reasoning', subtitle: 'Coding, series and syllogism', href: '/reasoning', Icon: Brain },
  { title: 'English', subtitle: 'Grammar, reading and vocabulary', href: '/english', Icon: BookOpen },
  { title: 'GK', subtitle: 'History, polity and science', href: '/general-awareness', Icon: Globe },
] as const;

export function MobileHomeContent() {
  return (
    <>
      <MobileHeroCarousel>
        <section className={styles.mobileHero} aria-label="Study header">
          <Image
            src="/images/home-carousel/study-hero-light.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 640px"
            quality={75}
            className={`${styles.mobileHeroStudyBackdrop} ${styles.mobileHeroBackdropLight}`}
          />
          <Image
            src="/images/home-carousel/study-hero-dark-v2.webp"
            alt=""
            fill
            loading="lazy"
            sizes="(max-width: 1023px) 100vw, 640px"
            quality={75}
            className={`${styles.mobileHeroStudyBackdrop} ${styles.mobileHeroBackdropDark}`}
          />
          <div className={styles.mobileHeroStudyOverlay} aria-hidden="true" />
          <div className={styles.mobileHeroRecentSlot}>
            <MobileRecentQuiz />
          </div>
        </section>
      </MobileHeroCarousel>

      <section className={styles.mobileContentGrid}>
        <div className={styles.mobileLeftColumn}>
          <div className={styles.sectionHeader}><h2>Subjects</h2></div>
          <div id="subjects" className={styles.mobileSubjectGrid}>
            {mobileSubjects.map((subject) => (
              <Link key={subject.title} href={subject.href} className={styles.mobileSubjectCard}>
                <HomeCardArtwork kind={subject.tone} />
                <span className={`${styles.subjectIcon} ${styles[subject.tone]}`}>
                  <subject.icon size={26} />
                </span>
                <span className={styles.subjectCopy}>
                  <strong>{subject.title === 'GK' ? 'GK' : subject.title.charAt(0) + subject.title.slice(1).toLowerCase()}</strong>
                  <small>15k+ Qs</small>
                </span>
              </Link>
            ))}
          </div>
          <div className={styles.sectionHeader}><h2>Study and compete</h2></div>
          <Link href="/resource" className={styles.resourceCard}>
            <HomeCardArtwork kind="books" />
            <span className={styles.resourceIcon}><BooksIcon size={28} /></span>
            <span><strong>All books & notes</strong><small>Books, chapter notes, extras & DPP</small></span>
          </Link>
          <Link href="/battle" className={styles.battleCard}>
            <HomeCardArtwork kind="battle" />
            <span className={styles.battleIcon}><BattleIcon size={28} /></span>
            <span><strong>Battle mode</strong><small>Challenge yourself & win rewards</small></span>
          </Link>
        </div>
      </section>
    </>
  );
}
