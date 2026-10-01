'use client';

import { useAuth } from '@/context/AuthContext';
import { BookOpen, Brain, Globe, Play, Sigma } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import styles from './page.module.css';
import cardStyles from './recent-quiz.module.css';

export default function MobileRecentQuiz({ desktop = false }: { desktop?: boolean }) {
  const { user, loading } = useAuth();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const recent = user?.recentQuizzes?.slice(0, desktop ? 4 : 5) ?? [];
  const headingId = desktop ? 'recent-quizzes-title' : 'mobile-recent-title';

  return (
    <section className={`${desktop ? styles.recentQuizzesColumn : styles.recentSection} ${cardStyles.section}`} aria-labelledby={headingId}>
      <div className={desktop ? styles.recentQuizzesHeader : styles.sectionHeader}>
        <h2 id={headingId} className={desktop ? styles.recentQuizzesTitle : undefined}>Recent Quizzes</h2>
        <Link href="/dashboard" className={styles.viewAllLink}>View All</Link>
      </div>
      <div
        ref={carouselRef}
        className={`${cardStyles.list} ${!desktop ? cardStyles.carousel : ''}`}
        onScroll={!desktop ? (event) => {
          const carousel = event.currentTarget;
          const cards = Array.from(carousel.children) as HTMLElement[];
          const left = carousel.getBoundingClientRect().left;
          let nearest = 0;
          let distance = Infinity;
          cards.forEach((card, index) => {
            const delta = Math.abs(card.getBoundingClientRect().left - left);
            if (delta < distance) { distance = delta; nearest = index; }
          });
          setActiveSlide(nearest);
        } : undefined}
        role={!desktop ? 'region' : undefined}
        aria-roledescription={!desktop ? 'carousel' : undefined}
        aria-label={!desktop ? 'Recent quizzes' : undefined}
        tabIndex={!desktop && recent.length > 1 ? 0 : undefined}
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
          const Icon = quiz.subject === 'mathematics' ? Sigma : quiz.subject === 'reasoning' ? Brain : quiz.subject === 'english' ? BookOpen : Globe;
          return (
            <article key={quiz.quizKey} className={cardStyles.card} aria-roledescription={!desktop ? 'slide' : undefined} aria-label={!desktop ? `${index + 1} of ${recent.length}: ${quiz.title || 'Quiz'}` : undefined}>
              <div className={cardStyles.header}>
                <span className={cardStyles.icon}><Icon size={32} strokeWidth={2.2} aria-hidden="true" /></span>
                <div className={cardStyles.copy}>
                  <h3>{quiz.title || quiz.subject || 'Quiz'}</h3>
                  <p>{total ? `${count}/${total} questions` : `${count} answered`}</p>
                </div>
              </div>
              {total ? <progress className={cardStyles.progress} value={count} max={total} aria-label={`${quiz.title || 'Quiz'} progress`} /> : null}
              <p className={cardStyles.detail}>{completed ? 'Practice completed' : `Continue from question ${total ? Math.min(current, total) : current}`}</p>
              <Link href={`${url.pathname}${url.search}${url.hash}`} data-ui-button="primary" className={cardStyles.resume}>
                <Play size={18} fill="currentColor" aria-hidden="true" />
                {completed ? 'Review Practice' : 'Resume Practice'}
              </Link>
            </article>
          );
        })}
        {recent.length === 0 ? (
          <div className={cardStyles.card}>
            <p className={cardStyles.detail}>{loading ? 'Loading recent quizzes…' : 'Your recent quizzes will appear here.'}</p>
            {!loading ? <Link href="/mathematics" data-ui-button="primary" className={cardStyles.resume}><Play size={18} fill="currentColor" aria-hidden="true" />Start Practice</Link> : null}
          </div>
        ) : null}
      </div>
      {!desktop && recent.length > 1 ? (
        <div className={cardStyles.dots} role="group" aria-label="Choose recent quiz">
          {recent.map((quiz, index) => (
            <button
              key={quiz.quizKey}
              type="button"
              data-ui-button="state"
              className={cardStyles.dot}
              aria-label={`Show quiz ${index + 1}`}
              aria-current={index === Math.min(activeSlide, recent.length - 1) ? 'true' : undefined}
              onClick={() => {
                const carousel = carouselRef.current;
                const card = carousel?.children[index] as HTMLElement | undefined;
                if (carousel && card) {
                  carousel.scrollBy({ left: card.getBoundingClientRect().left - carousel.getBoundingClientRect().left, behavior: 'instant' });
                  setActiveSlide(index);
                }
              }}
            ><span aria-hidden="true" /></button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
