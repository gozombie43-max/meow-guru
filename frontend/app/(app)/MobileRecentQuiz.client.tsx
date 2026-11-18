'use client';

import { useExamMode } from '@/context/ExamModeContext';
import { isJamContent, JAM_SUBJECT } from '@/lib/exam-mode';
import { useAuth } from '@/context/AuthContext';
import { Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import cardStyles from './recent-quiz.module.css';

function RecentQuizClipboardIcon() {
  const gradientId = useId().replace(/:/g, '_');
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="16" y1="6" x2="16" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8ad4ff" />
          <stop offset="55%" stopColor="#2b8aff" />
          <stop offset="100%" stopColor="#0d63e6" />
        </linearGradient>
      </defs>
      <rect x="9.5" y="3.5" width="3" height="5" rx="1.5" fill="#bae6ff" />
      <rect x="19.5" y="3.5" width="3" height="5" rx="1.5" fill="#bae6ff" />
      <rect x="5" y="6" width="22" height="23" rx="5" fill={`url(#${gradientId})`} />
      <rect x="9.5" y="12" width="13" height="2.4" rx="1.2" fill="#0b1933" />
      <rect x="9.5" y="16.5" width="9" height="2.4" rx="1.2" fill="#0b1933" />
      <rect x="9.5" y="21" width="11" height="2.4" rx="1.2" fill="#0b1933" />
    </svg>
  );
}

type QuizCardData = {
  quizKey: string;
  title: string;
  subject: string;
  resumeHref: string;
  total: number | null;
  count: number;
  fillPercent: number;
  completed: boolean;
  subtitle: string;
};

function toQuizCardData(quiz: NonNullable<NonNullable<ReturnType<typeof useAuth>['user']>['recentQuizzes']>[number]): QuizCardData {
  const total = quiz.totalQuestions && quiz.totalQuestions > 0 ? quiz.totalQuestions : null;
  const answered = quiz.submittedQuestions?.length ?? Object.keys(quiz.selectedAnswers ?? {}).length;
  const count = total ? Math.min(answered, total) : answered;
  const percent = total ? Math.round((count / total) * 100) : 0;
  const fillPercent = total ? Math.max(12, Math.min(100, percent)) : 12;
  const completed = quiz.status === 'completed';
  const url = new URL(quiz.href, 'https://local.invalid');
  if (url.pathname !== '/' && !url.pathname.endsWith('/quiz')) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/quiz`;
  }
  if (quiz.mode) url.searchParams.set('mode', quiz.mode);
  url.searchParams.set('resume', '1');
  const subject = url.pathname.includes('/arithmetic/') ? 'Arithmetic'
    : url.pathname.includes('/advance/') ? 'Advanced Mathematics'
    : ({ mathematics: 'Mathematics', reasoning: 'Reasoning', english: 'English', 'general-awareness': 'General Awareness', [JAM_SUBJECT]: 'IIT JAM Physics' }[quiz.subject]
      ?? quiz.subject.replace(/[-_]/g, ' '));
  const title = quiz.title || subject || 'Quiz';
  const subtitle = quiz.title && quiz.title.toLowerCase() !== subject.toLowerCase()
    ? `${quiz.title} • ${subject}`
    : subject;

  return {
    quizKey: quiz.quizKey,
    title,
    subject,
    resumeHref: `${url.pathname}${url.search}${url.hash}`,
    total,
    count,
    fillPercent,
    completed,
    subtitle,
  };
}

function RecentQuizCardContent({
  card,
  headingTag,
  titleId,
  decorative = false,
}: {
  card: QuizCardData;
  headingTag: 'h2' | 'h3' | 'p';
  titleId?: string;
  decorative?: boolean;
}) {
  const Heading = headingTag;
  return (
    <>
      <div className={cardStyles.mainCol}>
        <div className={cardStyles.header}>
          <span className={cardStyles.icon} aria-hidden="true">
            <RecentQuizClipboardIcon />
          </span>
          <div className={cardStyles.copy}>
            <Heading id={titleId} className={cardStyles.title}>
              Recent Quizzes
            </Heading>
            <p className={cardStyles.subtitle}>{card.subtitle}</p>
          </div>
        </div>
        <div
          className={cardStyles.progressTrack}
          role={decorative ? undefined : 'progressbar'}
          aria-label={decorative ? undefined : `${card.title} progress`}
          aria-valuemin={decorative ? undefined : 0}
          aria-valuemax={decorative ? undefined : (card.total ?? 100)}
          aria-valuenow={decorative ? undefined : card.count}
        >
          <span className={cardStyles.progressFill} style={{ width: `${card.fillPercent}%` }} />
        </div>
      </div>
      <div className={cardStyles.sideCol}>
        <span className={cardStyles.count}>{card.total ? `${card.count}/${card.total}` : `${card.count}`}</span>
        {decorative ? (
          <span className={cardStyles.resume} aria-hidden="true">
            <Play size={15} fill="currentColor" aria-hidden="true" />
          </span>
        ) : (
          <Link
            href={card.resumeHref}
            className={cardStyles.resume}
            aria-label={`${card.completed ? 'Review' : 'Resume'} ${card.title}: ${card.subject}`}
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}

export default function MobileRecentQuiz() {
  const { user, loading } = useAuth();
  const { isJam } = useExamMode();
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  const recent = user?.recentQuizzes?.filter(quiz => isJamContent(quiz.href || '') === isJam).slice(0, 3) ?? [];
  const cards = recent.map(toQuizCardData);
  const carouselRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const pausedRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || recent.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const cancelAnimation = () => {
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isAutoScrollingRef.current = false;
      el.style.scrollSnapType = '';
    };

    const animateCarouselScroll = (targetLeft: number, nextLogicalIndex: number, resetToZeroAfter: boolean) => {
      cancelAnimation();
      const startLeft = el.scrollLeft;
      const distance = targetLeft - startLeft;
      if (Math.abs(distance) < 1) {
        el.scrollLeft = resetToZeroAfter ? 0 : targetLeft;
        activeIndexRef.current = nextLogicalIndex;
        return;
      }

      const durationMs = 850;
      const startTime = performance.now();
      isAutoScrollingRef.current = true;
      el.style.scrollSnapType = 'none';

      const step = (now: number) => {
        const elapsed = Math.max(0, now - startTime);
        const t = Math.min(1, elapsed / durationMs);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        el.scrollLeft = startLeft + distance * eased;

        if (t < 1) {
          animFrameRef.current = window.requestAnimationFrame(step);
        } else {
          if (resetToZeroAfter) {
            el.scrollLeft = 0;
          }
          activeIndexRef.current = nextLogicalIndex;
          animFrameRef.current = null;
          isAutoScrollingRef.current = false;
          el.style.scrollSnapType = '';
        }
      };

      animFrameRef.current = window.requestAnimationFrame(step);
    };

    const handleInteractStart = () => {
      pausedRef.current = true;
      cancelAnimation();
    };
    const pause = () => { pausedRef.current = true; };
    const resume = () => { pausedRef.current = false; };
    const handleFocusOut = (event: FocusEvent) => {
      if (!el.contains(event.relatedTarget as Node | null)) {
        pausedRef.current = false;
      }
    };

    const passiveInteractEvents: Array<keyof HTMLElementEventMap> = ['pointerdown', 'touchstart'];
    const pauseEvents: Array<keyof HTMLElementEventMap> = ['mouseenter', 'focusin'];
    const resumeEvents: Array<keyof HTMLElementEventMap> = ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseleave'];

    for (const event of passiveInteractEvents) el.addEventListener(event, handleInteractStart, { passive: true });
    for (const event of pauseEvents) el.addEventListener(event, pause);
    for (const event of resumeEvents) el.addEventListener(event, resume);
    el.addEventListener('focusout', handleFocusOut);

    const timer = window.setInterval(() => {
      if (pausedRef.current || document.visibilityState === 'hidden') return;
      const current = activeIndexRef.current >= recent.length ? 0 : activeIndexRef.current;
      const isWrappingToClone = current >= recent.length - 1;
      const targetDomIndex = isWrappingToClone ? recent.length : current + 1;
      const nextLogicalIndex = isWrappingToClone ? 0 : current + 1;
      const items = el.querySelectorAll<HTMLElement>('[data-carousel-item="true"]');
      const firstOffset = items[0]?.offsetLeft ?? 0;
      const targetOffset = items[targetDomIndex]?.offsetLeft ?? 0;
      const targetLeft = targetOffset > firstOffset ? targetOffset - firstOffset : targetDomIndex * el.clientWidth;

      animateCarouselScroll(targetLeft, nextLogicalIndex, isWrappingToClone);
    }, 4500);

    return () => {
      window.clearInterval(timer);
      cancelAnimation();
      for (const event of passiveInteractEvents) el.removeEventListener(event, handleInteractStart);
      for (const event of pauseEvents) el.removeEventListener(event, pause);
      for (const event of resumeEvents) el.removeEventListener(event, resume);
      el.removeEventListener('focusout', handleFocusOut);
    };
  }, [recent.length]);

  return (
    <section className={cardStyles.section} aria-labelledby="mobile-recent-title">
      <p className={cardStyles.greeting}>
        Welcome back{firstName ? <>, <span>{firstName}</span></> : ''}
      </p>
      <div
        ref={carouselRef}
        className={`${cardStyles.list} ${cardStyles.carousel}`}
        role={recent.length > 1 ? 'region' : undefined}
        aria-roledescription={recent.length > 1 ? 'carousel' : undefined}
        aria-label={recent.length > 1 ? 'Recent quizzes' : undefined}
        tabIndex={recent.length > 1 ? 0 : undefined}
        onScroll={(event) => {
          if (isAutoScrollingRef.current) return;
          const el = event.currentTarget;
          if (el.clientWidth > 0) {
            const index = Math.round(el.scrollLeft / el.clientWidth);
            activeIndexRef.current = index >= recent.length ? 0 : index;
          }
        }}
      >
        {cards.map((card, index) => (
          <article
            key={card.quizKey}
            data-carousel-item="true"
            className={cardStyles.card}
            aria-roledescription={cards.length > 1 ? 'slide' : undefined}
            aria-label={cards.length > 1 ? `${index + 1} of ${cards.length}: ${card.title}` : undefined}
          >
            <RecentQuizCardContent
              card={card}
              headingTag={index === 0 ? 'h2' : 'h3'}
              titleId={index === 0 ? 'mobile-recent-title' : undefined}
            />
          </article>
        ))}
        {cards.length > 1 ? (
          <div
            aria-hidden="true"
            data-carousel-item="true"
            data-carousel-clone="true"
            className={cardStyles.card}
          >
            <RecentQuizCardContent card={cards[0]} headingTag="p" decorative />
          </div>
        ) : null}
        {recent.length === 0 ? (
          <article className={cardStyles.card}>
            <div className={cardStyles.mainCol}>
              <div className={cardStyles.header}>
                <span className={cardStyles.icon} aria-hidden="true">
                  <RecentQuizClipboardIcon />
                </span>
                <div className={cardStyles.copy}>
                  <h2 id="mobile-recent-title" className={cardStyles.title}>Recent Quizzes</h2>
                  <p className={cardStyles.subtitle}>
                    {loading ? 'Loading recent quizzes…' : 'No recent quizzes • Start Practice'}
                  </p>
                </div>
              </div>
              <div
                className={cardStyles.progressTrack}
                role="progressbar"
                aria-label="Recent quiz progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={0}
              >
                <span className={cardStyles.progressFill} style={{ width: '12%' }} />
              </div>
            </div>
            <div className={cardStyles.sideCol}>
              <span className={cardStyles.count}>0/0</span>
              <Link href="/mathematics" className={cardStyles.resume} aria-label="Start Practice">
                <Play size={15} fill="currentColor" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
