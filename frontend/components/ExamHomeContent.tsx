"use client";
import PhysicsArtwork from './PhysicsArtwork';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, ChevronRight, ClipboardList } from 'lucide-react';
import { JAM_SECTIONS, jamSectionHref } from '@/lib/exam-mode';
import styles from './exam-mode.module.css';
import JamMockSectionCards from './JamMockSectionCards';
export function JamSectionCards({ mock = false }: { mock?: boolean }) {
  if (mock) return <JamMockSectionCards />;
  return <div className={styles.grid}>{JAM_SECTIONS.map(section => <Link key={section.slug} href={jamSectionHref(section.slug)} className={styles.card}>
    <span className={styles.art} style={{ color: section.color }} aria-hidden="true"><PhysicsArtwork section={section.slug} /></span>
    <span><strong>{section.title}</strong></span>
  </Link>)}</div>;
}
export default function ExamHomeContent() {
  return <div className={styles.home}>
    <section className={styles.hero} aria-label="IIT JAM Physics">
      <Image className={styles.heroImage} src="/images/iit-jam-physics-hero.webp" alt="" fill sizes="(max-width: 600px) 100vw, (max-width: 1023px) 720px, 800px" loading="eager" />
      <div className={styles.heroCopy}><p className={styles.eyebrow}>IIT JAM PHYSICS</p><h1>Small steps.<br /><span>Big breakthroughs.</span></h1><p>Master the fundamentals,<br />solve more questions,<br />crack IIT JAM Physics.</p></div>
    </section>
    <section><div className={styles.sectionHeading}><h2>IIT JAM Physics – 7 Sections</h2></div><JamSectionCards /></section>
    <section><div className={styles.sectionHeading}><h2>Study and practice</h2></div>
      <Link className={styles.studyCard} href="/resource"><BookOpen /><span><strong>All books & notes</strong><small>Notes, PYQs, important topics, formulas & DPP</small></span><ChevronRight /></Link>
      <Link className={styles.studyCard} href="/mock-test"><ClipboardList /><span><strong>Mock test & previous years</strong><small>Section-wise, full length mocks & JAM PYQs</small></span><ChevronRight /></Link>
    </section>
  </div>;
}
