"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, ClipboardList, Plus, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { JamSectionCards } from './ExamHomeContent';
import { JAM_SUBJECT } from '@/lib/exam-mode';
import styles from './exam-mode.module.css';
const tabs = ['Section-wise', 'Mock Tests', 'Previous Years', 'Custom'] as const;
export default function JamMockCatalog() {
  const { user, loading } = useAuth();
  const canCreate = !loading && (user?.role === 'admin' || user?.role === 'superadmin');
  const [tab, setTab] = useState<typeof tabs[number]>('Section-wise');
  return <main className={styles.catalog}>
    <div className={styles.catalogToolbar}>
    <header data-ui-chrome="header" className={styles.catalogHeader}><Link href="/" data-ui-button="icon" aria-label="Back to Home"><ChevronLeft /></Link><div><h1 aria-label="IIT JAM Physics Mock Test">Mock Test</h1></div><a href="https://jam2026.iitb.ac.in/Syllabus.html" data-ui-button="icon" aria-label="Exam pattern and syllabus" target="_blank" rel="noreferrer"><Info /></a></header>

    <div className={styles.tabs} role="group" aria-label="Mock test categories">{tabs.map(item => <button data-ui-button="state" type="button" key={item} aria-pressed={item === tab} onClick={() => setTab(item)}>{item}</button>)}</div>
    </div>
    {tab === 'Section-wise' && <JamSectionCards mock />}
    {tab === 'Mock Tests' && <Link className={styles.studyCard} href={`/mock-test/${JAM_SUBJECT}`}><span><strong>Mock Tests</strong><small>Published IIT JAM Physics papers</small></span></Link>}
    {tab === 'Previous Years' && <Link className={styles.studyCard} href={`/mock-test/${JAM_SUBJECT}?tab=prev`}><span><strong>Previous year papers</strong><small>Browse published JAM Physics PYQs</small></span></Link>}
    {tab === 'Custom' && <section className={styles.customCard} aria-labelledby="custom-tests-title" aria-busy={loading}>
      <span className={styles.customIcon} aria-hidden="true"><ClipboardList size={24} /></span>
      <p className={styles.customEyebrow}>IIT JAM Physics</p>
      <h2 id="custom-tests-title">Custom tests</h2>
      <p className={styles.customDescription}>{loading ? 'Loading your access…' : canCreate ? 'Create a Physics paper, add your questions and publish it for students.' : 'Practice papers prepared by your admins. Only admins and super admins can create custom tests.'}</p>
      {!loading && (canCreate
        ? <Link className={styles.customAction} data-ui-button="primary" href="/admin/upload/mock-tests"><Plus size={18} aria-hidden="true" />Create custom test</Link>
        : <Link className={styles.customAction} data-ui-button="primary" href={`/mock-test/${JAM_SUBJECT}`}>Browse mock tests<ArrowUpRight size={18} aria-hidden="true" /></Link>)}
    </section>}
  </main>;
}
