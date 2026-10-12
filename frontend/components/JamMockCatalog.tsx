"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info } from 'lucide-react';
import { JamSectionCards } from './ExamHomeContent';
import { JAM_SUBJECT } from '@/lib/exam-mode';
import styles from './exam-mode.module.css';
const tabs = ['All', 'Section-wise', 'Full Syllabus', 'Previous Years', 'Custom'] as const;
export default function JamMockCatalog() {
  const [tab, setTab] = useState<typeof tabs[number]>('All');
  return <main className={styles.catalog}>
    <div className={styles.catalogToolbar}>
    <header data-ui-chrome="header" className={styles.catalogHeader}><Link href="/" data-ui-button="icon" aria-label="Back to Home"><ChevronLeft /></Link><div><h1 aria-label="IIT JAM Physics Mock Test">Mock Test</h1></div><a href="https://jam2026.iitb.ac.in/Syllabus.html" data-ui-button="icon" aria-label="Exam pattern and syllabus" target="_blank" rel="noreferrer"><Info /></a></header>

    <div className={styles.tabs} role="group" aria-label="Mock test categories">{tabs.map(item => <button data-ui-button="state" type="button" key={item} aria-pressed={item === tab} onClick={() => setTab(item)}>{item}</button>)}</div>
    </div>
    {(tab === 'All' || tab === 'Section-wise') && <JamSectionCards mock />}
    {(tab === 'All' || tab === 'Full Syllabus') && <Link className={styles.studyCard} href={`/mock-test/${JAM_SUBJECT}`}><span><strong>Full syllabus mocks</strong><small>Published IIT JAM Physics papers</small></span></Link>}
    {(tab === 'All' || tab === 'Previous Years') && <Link className={styles.studyCard} href={`/mock-test/${JAM_SUBJECT}?tab=prev`}><span><strong>Previous year papers</strong><small>Browse published JAM Physics PYQs</small></span></Link>}
    {tab === 'Custom' && <div className={styles.empty}><h2>Build your Physics practice</h2><p>Choose a section, topic and question count in Play. Practice uses the available IIT JAM question bank.</p><Link data-ui-button="primary" href={`/play/setup/section?exam=${JAM_SUBJECT}`}>Create practice session</Link></div>}
  </main>;
}
