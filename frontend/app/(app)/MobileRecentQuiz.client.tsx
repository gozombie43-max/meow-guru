'use client';

import { useExamMode } from '@/context/ExamModeContext';
import { isJamContent, JAM_SUBJECT } from '@/lib/exam-mode';
import { useAuth } from '@/context/AuthContext';
import { Atom, Globe, Play } from 'lucide-react';
import Link from 'next/link';
import { getMobileSubjectVisual } from './home-data';
import HomeCardArtwork from './HomeCardArtwork';
import styles from './page.module.css';
import cardStyles from './recent-quiz.module.css';

export default function MobileRecentQuiz() {
  const { user, loading } = useAuth();
  const { isJam } = useExamMode();
  const recent = user?.recentQuizzes?.filter(quiz => isJamContent(quiz.href || '') === isJam).slice(0, 5) ?? [];

  return (
    <section className={`${styles.recentSection} ${cardStyles.section}`} aria-labelledby="mobile-recent-title">
      <div className={styles.sectionHeader}>
        <h2 id="mobile-recent-title">Recent Quizzes</h2>
        <Link href="/dashboard" className={styles.viewAllLink}>View All</Link>
      </div>
      <div
        className={`${cardStyles.list} ${cardStyles.carousel}`}
        role="region"
        aria-roledescription="carousel"
        aria-label="Recent quizzes"
        tabIndex={recent.length > 1 ? 0 : undefined}
      >
        {recent.map((quiz, index) => {
          const total = quiz.totalQuestions && quiz.totalQuestions > 0 ? quiz.totalQuestions : null;
          const answered = quiz.submittedQuestions?.length ?? Object.keys(quiz.selectedAnswers ?? {}).length;
          const count = total ? Math.min(answered, total) : answered;
          const current = Math.max(1, (quiz.currentIndex ?? 0) + 1);
          const completed = quiz.status === 'completed';
          const url = new URL(quiz.href, 'https://local.invalid');
          if (quiz.mode) url.searchParams.set('mode', quiz.mode);
          url.searchParams.set('resume', '1');
          const subject = url.pathname.includes('/arithmetic/') ? 'Arithmetic'
            : url.pathname.includes('/advance/') ? 'Advanced Mathematics'
            : ({ mathematics: 'Mathematics', reasoning: 'Reasoning', english: 'English', 'general-awareness': 'General Awareness', [JAM_SUBJECT]: 'IIT JAM Physics' }[quiz.subject]
              ?? quiz.subject.replace(/[-_]/g, ' '));
          const visual = quiz.subject === JAM_SUBJECT ? null : getMobileSubjectVisual(quiz.subject, url.pathname);
          const FallbackIcon = quiz.subject === JAM_SUBJECT ? Atom : Globe;

          return (
            <article key={quiz.quizKey} className={cardStyles.card} aria-roledescription="slide" aria-label={`${index + 1} of ${recent.length}: ${quiz.title || 'Quiz'}`}>
              <HomeCardArtwork kind="recent" />
              <div className={cardStyles.header}>
                <span className={visual ? `${cardStyles.icon} ${styles.subjectIcon} ${styles[visual.tone]}` : `${cardStyles.icon} ${cardStyles.iconFallback}`}>
                  {visual ? (
                    <visual.icon size={30} aria-hidden="true" />
                  ) : (
                    <FallbackIcon size={22} strokeWidth={2} aria-hidden="true" />
                  )}
                </span>
                <div className={cardStyles.copy}>
                  <div className={cardStyles.titleRow}>
                    <h3>{quiz.title || quiz.subject || 'Quiz'}</h3>
                    <span className={cardStyles.count}>{total ? `${count}/${total}` : `${count} answered`}</span>
                  </div>
                  <p>{subject}</p>
                </div>
              </div>
              {total ? <progress className={cardStyles.progress} value={count} max={total} aria-label={`${quiz.title || 'Quiz'} progress`} /> : null}
              <div className={cardStyles.footer}>
                <p className={cardStyles.detail}>{completed ? 'Practice completed' : `Continue from Q${total ? Math.min(current, total) : current}`}</p>
                <Link href={`${url.pathname}${url.search}${url.hash}`} className={cardStyles.resume}>
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                  {completed ? 'Review' : 'Resume'}
                </Link>
              </div>
            </article>
          );
        })}
        {recent.length === 0 ? (
          <div className={cardStyles.card}>
            <HomeCardArtwork kind="recent" />
            <div className={cardStyles.emptyRow}>
              <p className={cardStyles.detail}>{loading ? 'Loading recent quizzes…' : 'Your recent quizzes will appear here.'}</p>
              {!loading ? <Link href="/mathematics" className={cardStyles.resume}><Play size={12} fill="currentColor" aria-hidden="true" />Start Practice</Link> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
