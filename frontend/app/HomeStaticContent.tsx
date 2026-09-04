import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, GraduationCap } from 'lucide-react';
import BattleIcon from '@/components/BattleIcon';
import BooksIcon from '@/components/BooksIcon';
import QuizChartArt from '@/components/QuizChartArt';
import Typewriter from '@/components/Typewriter';
import MobileRecentQuiz from './MobileRecentQuiz.client';
import {
  desktopSubjects,
  HERO_BLUR_DATA_URL,
  mobileSubjects,
  recentQuizzesData,
} from './home-data';
import styles from './page.module.css';

export function DesktopHomeContent() {
  return (
    <div className={styles.mainGrid}>
      <div className={styles.contentColumn}>
        <section className={styles.heroCard} aria-labelledby="hero-title">
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <div className={styles.heroBadgeIcon}>
                <GraduationCap size={15} strokeWidth={2.4} />
              </div>
              <span>Knowledge That Empowers</span>
            </div>
            <h1 id="hero-title" className={styles.heroTitle}>
              Choose Your <br /> Subject
            </h1>
            <div className={styles.heroUnderline} />
            <div className={styles.typewriterWrapper}>
              <Typewriter
                texts={['GK', 'MATH', 'REASONING', 'ENGLISH']}
                showCursor={false}
                hideCursorOnType
                color="var(--mac-primary)"
                typedColor="var(--mac-primary)"
                font={{
                  fontFamily: 'inherit',
                  fontSize: 'clamp(20px, 2.2vw, 24px)',
                  fontWeight: '800',
                  letterSpacing: '-0.5px',
                  lineHeight: '1.2',
                }}
                style={{ justifyContent: 'flex-start' }}
              />
            </div>
            <p className={styles.heroSubtitle}>
              Learn your way. <br /> Anywhere, anytime.
            </p>
          </div>

          <div className={styles.heroVisualWrapper}>
            <div className={styles.heroArchFrame}>
              <Image
                src="/hero-image.webp"
                alt="Student with graduation cap and notebook"
                fill
                priority
                placeholder="blur"
                blurDataURL={HERO_BLUR_DATA_URL}
                sizes="(max-width: 768px) 100vw, 420px"
                quality={85}
                className={styles.heroStudentImage}
              />
            </div>
          </div>
        </section>

        <section className={styles.exploreSection} aria-labelledby="explore-title">
          <div className={styles.sectionHeaderRow}>
            <h2 id="explore-title" className={styles.sectionTitle}>Explore Subjects</h2>
          </div>
          <div className={styles.subjectGrid}>
            {desktopSubjects.map((subject) => {
              const SubjectIcon = subject.Icon;
              return (
                <Link
                  key={subject.title}
                  href={subject.href}
                  className={styles.subjectCard}
                  title={`Explore ${subject.title}`}
                >
                  <SubjectIcon size={46} />
                  <div className={styles.subjectCardInfo}>
                    <h3 className={styles.subjectCardTitle}>{subject.title}</h3>
                    <p className={styles.subjectCardSubtitle}>{subject.subtitle}</p>
                  </div>
                  <ChevronRight size={18} className={styles.subjectCardChevron} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <aside className={styles.recentQuizzesColumn} aria-labelledby="recent-quizzes-title">
        <div className={styles.recentQuizzesHeader}>
          <h2 id="recent-quizzes-title" className={styles.recentQuizzesTitle}>Recent Quizzes</h2>
          <Link href="/dashboard" className={styles.viewAllLink}>View All</Link>
        </div>
        <div className={styles.recentQuizList}>
          {recentQuizzesData.map((quiz) => (
            <Link key={quiz.title} href={quiz.href} className={styles.recentQuizCard}>
              <div className={styles.quizCardMain}>
                <div className={styles.quizCardMeta}>
                  <span className={`${styles.quizTag} ${styles[quiz.tagTone]}`}>{quiz.tag}</span>
                  <span className={styles.quizProgressRatio}>{quiz.progress}</span>
                </div>
                <h3 className={styles.quizCardTitle}>{quiz.title}</h3>
                <p className={styles.quizCardSubtitle}>{quiz.subtitle}</p>
                <div className={styles.quizProgressBar}>
                  <div className={styles.quizProgressFill} style={{ width: `${quiz.progressPercent}%` }} />
                </div>
              </div>
              <div className={styles.quizCardArt}><QuizChartArt size={42} /></div>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function MobileHomeContent() {
  return (
    <>
      <section className={styles.mobileHero}>
        <div className={styles.heroDotsTopRight} aria-hidden="true" />
        <div className={styles.mobileHeroCopy}>
          <div className={styles.mobileHeroBadge}>
            <div className={styles.mobileHeroBadgeIcon}>
              <GraduationCap size={16} strokeWidth={2.5} />
            </div>
            <span>Knowledge That Empowers</span>
          </div>
          <h1>Choose Your <br /> Subject</h1>
          <div className={styles.heroLine} />
          <div style={{ minHeight: '40px', marginBottom: '12px' }}>
            <Typewriter
              texts={['MATH', 'ENGLISH', 'REASONING', 'GK']}
              showCursor={false}
              hideCursorOnType
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
          <p className={styles.mobileHeroDesc}>Learn your way.<br />Anywhere, anytime.</p>
        </div>
        <div className={styles.mobileHeroVisual}>
          <Image
            src="/hero-image.webp"
            alt="Graduate student"
            fill
            priority
            placeholder="blur"
            blurDataURL={HERO_BLUR_DATA_URL}
            sizes="(max-width: 768px) 50vw, 240px"
            quality={85}
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
            <span className={styles.resourceIcon}><BooksIcon size={48} /></span>
            <span><strong>ALL BOOKS & NOTES</strong><small>Books, chapter notes, extras & DPP</small></span>
          </Link>
          <Link href="/battle" className={styles.battleCard}>
            <span className={styles.battleIcon}><BattleIcon size={48} /></span>
            <span><strong>BATTLE MODE</strong><small>Challenge yourself & win rewards</small></span>
          </Link>
        </div>
        <MobileRecentQuiz />
      </section>
    </>
  );
}
