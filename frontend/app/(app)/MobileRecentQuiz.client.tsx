'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import styles from './page.module.css';

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

export default function MobileRecentQuiz() {
  const { user } = useAuth();
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
        <span className={styles.quizCount}>{submittedCount}/{totalCount}</span>
        <StudyStackArt />
      </Link>
    </section>
  );
}
