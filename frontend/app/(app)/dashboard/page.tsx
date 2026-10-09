"use client";

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, BookOpen, Calculator, ChevronRight, ClipboardList, Globe2, Puzzle, Target } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

type RecentQuiz = NonNullable<NonNullable<ReturnType<typeof useAuth>['user']>['recentQuizzes']>[number];
const subjects = [
  { name: 'Mathematics', detail: 'Numbers, formulas & problem solving', href: '/mathematics', icon: Calculator },
  { name: 'Reasoning', detail: 'Patterns, logic & analytical thinking', href: '/reasoning', icon: Puzzle },
  { name: 'English', detail: 'Vocabulary, grammar & comprehension', href: '/english', icon: BookOpen },
  { name: 'General Awareness', detail: 'History, science & the world around you', href: '/general-awareness', icon: Globe2 },
];
function practiceHref(entry: RecentQuiz) {
  const [path, query] = entry.href.split('?');
  const params = new URLSearchParams(query);
  if (entry.mode) params.set('mode', entry.mode);
  params.set('resume', '1');
  return `${path}?${params}`;
}
function dateLabel(value?: string) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? 'Practice session' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>;
}
function DashboardContent() {
  const { user } = useAuth();
  if (!user) return null;
  const progress = Object.values(user.progress || {});
  const attempted = progress.reduce((sum, item) => sum + (item.attempted || 0), 0);
  const correct = progress.reduce((sum, item) => sum + (item.correct || 0), 0);
  const accuracy = attempted ? `${Math.round(correct / attempted * 100)}%` : '—';
  const minutes = Math.floor(Math.max(0, user.studyTime || 0) / 60);
  const studyTime = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  const recent = [...(user.recentQuizzes || [])]
    .filter(entry => entry?.quizKey && entry.href?.startsWith('/') && !entry.href.startsWith('//'))
    .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0));
  const resume = recent.find(entry => entry.status !== 'completed');
  const total = Math.max(0, resume?.totalQuestions || 0);
  const current = Math.min(total, Math.max(0, resume?.currentIndex || 0) + 1);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to home" data-ui-button="icon"><ArrowLeft size={20} /></Link>
        <span className={styles.headerTitle}>Dashboard</span>
        <Link href="/profile" className={styles.profile}>My profile <ChevronRight size={16} /></Link>
      </header>
      <main className={styles.content}>
        <section className={styles.intro}>
          <div><p className={styles.eyebrow}>YOUR STUDY SPACE</p><h1>Keep moving, {user.name?.trim().split(' ')[0] || 'learner'}.</h1><p>A little practice. A little progress. Every day.</p></div>
          <Link href="/mock-test" className={styles.mockLink} data-ui-button="secondary"><ClipboardList size={18} /> Take a mock test <ArrowUpRight size={17} /></Link>
        </section>
        <dl className={styles.stats} aria-label="Study totals">
          <div><dt>Questions attempted</dt><dd>{attempted.toLocaleString('en-IN')}</dd></div>
          <div><dt>Accuracy</dt><dd>{accuracy}</dd></div>
          <div><dt>Study time</dt><dd>{studyTime}</dd></div>
          <div><dt>Saved questions</dt><dd>{(user.bookmarks?.length || 0).toLocaleString('en-IN')}</dd></div>
        </dl>
        <div className={styles.columns}>
          <div className={styles.mainColumn}>
            <section className={styles.resume} aria-labelledby="continue-heading">
              <div className={styles.resumeLabel}><Target size={18} /><span>{resume ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR NEXT STEP'}</span></div>
              <h2 id="continue-heading">{resume ? resume.title || resume.subject || 'Continue your practice' : 'Make time for a little practice'}</h2>
              <p>{resume ? `${resume.subject || 'Practice'}${total ? ` · Question ${current} of ${total}` : ''}` : 'Choose a subject below, or build momentum with a short training session.'}</p>
              <Link data-ui-button="primary" className={styles.primary} href={resume ? practiceHref(resume) : '/play'}>{resume ? 'Resume practice' : 'Start practicing'}<ArrowUpRight size={18} /></Link>
            </section>
            <section className={styles.section} aria-labelledby="subjects-heading">
              <div className={styles.sectionHead}><h2 id="subjects-heading">Choose a subject</h2><span>Build your basics</span></div>
              <div className={styles.subjects}>{subjects.map(({ name, detail, href, icon: Icon }) => (
                <Link href={href} key={href} className={styles.subject}><span className={styles.subjectIcon}><Icon size={21} /></span><span><strong>{name}</strong><small>{detail}</small></span><ChevronRight size={17} className={styles.chevron} /></Link>
              ))}</div>
            </section>
          </div>
          <section className={styles.section} aria-labelledby="recent-heading">
            <div className={styles.sectionHead}><h2 id="recent-heading">Recent practice</h2><span>Latest sessions</span></div>
            <div className={styles.activity}>
              {recent.length ? recent.slice(0, 5).map(entry => (
                <Link key={entry.quizKey} href={practiceHref(entry)} className={styles.activityRow}>
                  <div><strong>{entry.title || entry.subject || 'Practice session'}</strong><small>{entry.subject || 'Practice'} · {dateLabel(entry.updatedAt)}</small><span className={entry.status === 'completed' ? styles.completed : styles.inProgress}>{entry.status === 'completed' ? 'Completed' : 'In progress'}</span></div><ChevronRight size={17} />
                </Link>
              )) : <div className={styles.empty}><BookOpen size={26} /><h3>Your progress starts here</h3><p>Your recent sessions will appear here after you start practicing.</p></div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
