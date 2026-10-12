"use client";
import PhysicsArtwork from './PhysicsArtwork';
import Link from 'next/link';
import { Atom, BookOpen, ChevronRight, ClipboardList } from 'lucide-react';
import { JAM_SECTIONS, JAM_SUBJECT, jamSectionHref } from '@/lib/exam-mode';
import styles from './exam-mode.module.css';
export function JamSectionCards({ mock = false }: { mock?: boolean }) {
  return <div className={`${styles.grid} ${mock ? styles.mockGrid : ''}`}>{JAM_SECTIONS.map(section => <Link key={section.slug} href={mock ? `/mock-test/${JAM_SUBJECT}-${section.slug}` : jamSectionHref(section.slug)} className={styles.card}>
    <span className={styles.art} style={{ color: section.color }} aria-hidden="true"><PhysicsArtwork section={section.slug} /></span>
    <span><strong>{section.title}</strong>{mock && <small>Topic-wise & full mocks</small>}</span>
  </Link>)}</div>;
}
export default function ExamHomeContent() {
  return <div className={styles.home}>
    <section className={styles.hero} aria-label="IIT JAM Physics">
      <div><p className={styles.eyebrow}>IIT JAM PHYSICS</p><h1>Small steps.<br /><span>Big breakthroughs.</span></h1><p>Master the fundamentals,<br />solve more questions,<br />crack IIT JAM Physics.</p></div>
      <div className={styles.heroArt} aria-hidden="true"><span>E = mc²</span><Atom /><span>ψ · ∇ · ℏ</span></div>
    </section>
    <section><div className={styles.sectionHeading}><h2>IIT JAM Physics – 7 Sections</h2><Link href={`/subjects/${JAM_SUBJECT}`}>View all <ChevronRight size={16} /></Link></div><JamSectionCards /></section>
    <section><div className={styles.sectionHeading}><h2>Study and practice</h2></div>
      <Link className={styles.studyCard} href="/resource"><BookOpen /><span><strong>All books & notes</strong><small>Notes, PYQs, important topics, formulas & DPP</small></span><ChevronRight /></Link>
      <Link className={styles.studyCard} href="/mock-test"><ClipboardList /><span><strong>Mock test & previous years</strong><small>Section-wise, full length mocks & JAM PYQs</small></span><ChevronRight /></Link>
    </section>
  </div>;
}
