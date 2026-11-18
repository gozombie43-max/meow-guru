'use client';

import { useAuth, type RecentQuizEntry } from '@/context/AuthContext';
import { useExamMode } from '@/context/ExamModeContext';
import { isJamContent, JAM_SUBJECT } from '@/lib/exam-mode';
import { ArrowRight, Atom, BookOpen, Brain, Globe, Sigma, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import d from './home-desktop.module.css';

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics',
  reasoning: 'Reasoning',
  english: 'English',
  'general-awareness': 'General Awareness',
  [JAM_SUBJECT]: 'IIT JAM Physics',
};

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  mathematics: Sigma,
  reasoning: Brain,
  english: BookOpen,
  [JAM_SUBJECT]: Atom,
};

function describe(quiz: RecentQuizEntry) {
  const total = quiz.totalQuestions && quiz.totalQuestions > 0 ? quiz.totalQuestions : null;
  const answered = quiz.submittedQuestions?.length ?? Object.keys(quiz.selectedAnswers ?? {}).length;
  const count = total ? Math.min(answered, total) : answered;
  const current = Math.max(1, (quiz.currentIndex ?? 0) + 1);
  const question = total ? Math.min(current, total) : current;
  const completed = quiz.status === 'completed';
  const url = new URL(quiz.href, 'https://local.invalid');
  if (url.pathname !== '/' && !url.pathname.endsWith('/quiz')) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/quiz`;
  }
  if (quiz.mode) url.searchParams.set('mode', quiz.mode);
  url.searchParams.set('resume', '1');
  const subject = url.pathname.includes('/arithmetic/') ? 'Arithmetic'
    : url.pathname.includes('/advance/') ? 'Advanced Mathematics'
    : SUBJECT_NAMES[quiz.subject] ?? quiz.subject.replace(/[-_]/g, ' ');
  return {
    title: quiz.title || subject || 'Quiz',
    subject,
    total,
    count,
    question,
    completed,
    percent: total ? Math.round((count / total) * 100) : 0,
    href: `${url.pathname}${url.search}${url.hash}`,
    Icon: SUBJECT_ICONS[quiz.subject] ?? Globe,
  };
}

export default function DesktopRecentQuizzes() {
  const { user, loading } = useAuth();
  const { isJam } = useExamMode();
  const recent = (user?.recentQuizzes ?? [])
    .filter(quiz => isJamContent(quiz.href || '') === isJam)
    .slice(0, 3)
    .map(describe);
  const [latest, ...rest] = recent;

  return (
    <section className={d.aside} aria-labelledby="recent-quizzes-title">
      <div className={d.sectionHead}>
        <h2 id="recent-quizzes-title" className={d.sectionTitle}>Recent quizzes</h2>
        {recent.length > 0 ? <Link href="/dashboard" className={d.textLink}>View all</Link> : null}
      </div>

      {loading && !user ? <div className={d.skeleton} aria-busy="true" aria-label="Loading recent quizzes" /> : null}

      {!loading && !latest ? (
        <div className={d.empty}>
          <strong>No quizzes yet</strong>
          <p>Quizzes you start appear here so you can pick up from the same question.</p>
          <Link href="/mathematics" className={d.btnPrimary}>Start with Math</Link>
        </div>
      ) : null}

      {latest ? (
        <article className={d.resume} aria-labelledby="resume-title">
          <p className={d.resumeLabel}>{latest.completed ? 'Last completed' : 'Continue where you left off'}</p>
          <div className={d.resumeHead}>
            <span className={d.tile} aria-hidden="true"><latest.Icon size={18} strokeWidth={1.75} /></span>
            <div>
              <h3 id="resume-title">{latest.title}</h3>
              <p>{latest.subject}</p>
            </div>
          </div>
          {latest.total ? (
            <>
              <div className={d.qcount}>
                <strong>{latest.count}<span> / {latest.total}</span></strong>
                <span>{latest.percent}% answered</span>
              </div>
              <span className={d.bar} role="progressbar" aria-label={`${latest.title} progress`} aria-valuemin={0} aria-valuemax={latest.total} aria-valuenow={latest.count}>
                <span style={{ width: `${latest.percent}%` }} />
              </span>
            </>
          ) : null}
          <div className={d.resumeFooter}>
            <p>{latest.completed ? 'Practice completed' : `Next up: Q${latest.question}`}</p>
            <Link href={latest.href} className={d.btnPrimary}>
              {latest.completed ? 'Review' : 'Resume'}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </article>
      ) : null}

      {rest.length > 0 ? (
        <div className={d.list}>
          {rest.map(quiz => (
            <Link key={quiz.href + quiz.title} href={quiz.href} className={d.listItem} aria-label={`${quiz.completed ? 'Review' : 'Resume'} ${quiz.title}`}>
              <span className={d.tile} aria-hidden="true"><quiz.Icon size={18} strokeWidth={1.75} /></span>
              <span>
                <strong>{quiz.title}</strong>
                <small>{quiz.subject} · {quiz.total ? `${quiz.count} / ${quiz.total}` : `${quiz.count} answered`}</small>
                {quiz.total ? <span className={d.listBar} aria-hidden="true"><span style={{ width: `${quiz.percent}%` }} /></span> : null}
              </span>
              <span className={d.listAction} aria-hidden="true">{quiz.completed ? 'Review' : `Q${quiz.question}`}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
