'use client';

import { useExamMode } from '@/context/ExamModeContext';
import ExamModeSwitch from '@/components/ExamModeSwitch';
import JamMockCatalog from '@/components/JamMockCatalog';
import ShinyPill from '@/components/ShinyPill';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { examLogos } from './_shared/exam-logos';
import { fetchCatalogSummary, type ExamPaperCounts } from './_shared/catalog-summary';
import { subscribeMockCatalog } from '@/lib/mock-catalog-revision';

type ExamType = 'ssc' | 'rrb' | 'banking' | 'upsc' | 'defence' | 'other';

type ExamCard = {
  id: string;
  name: string;
  subtitle?: string;
  type: ExamType;
  badge?: string;
  badgeTone?: 'hot' | 'free' | 'new' | 'premium';
  logoUrl?: string;
  logoText: string;
  logoBackground?: string;
  logoTextColor?: string;
  logoTextSize?: string;
};

const categories = [
  { id: 'all', label: 'All' },
  { id: 'ssc', label: 'SSC' },
  { id: 'rrb', label: 'Railway' },
  { id: 'banking', label: 'Banking' },
  { id: 'upsc', label: 'UPSC & State PSC' },
  { id: 'defence', label: 'Defence & Univ' },
  { id: 'other', label: 'Management' },
];

const examCards: ExamCard[] = [
  // SSC
  {
    id: 'ssc-cgl',
    name: 'SSC CGL',
    subtitle: 'Combined Graduate Level',
    type: 'ssc',
    logoUrl: examLogos['ssc-cgl'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-chsl',
    name: 'SSC CHSL',
    subtitle: 'Higher Secondary (10+2)',
    type: 'ssc',
    logoUrl: examLogos['ssc-chsl'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-mts',
    name: 'SSC MTS',
    subtitle: 'Multi Tasking Staff',
    type: 'ssc',
    logoUrl: examLogos['ssc-mts'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-gd',
    name: 'SSC GD',
    subtitle: 'General Duty Constable',
    type: 'ssc',
    logoUrl: examLogos['ssc-gd'],
    logoText: 'SSC',
  },

  // Railway
  {
    id: 'rrb-ntpc',
    name: 'RRB NTPC',
    subtitle: 'Non-Technical Categories',
    type: 'rrb',
    logoUrl: examLogos['rrb-ntpc'],
    logoText: 'RRB',
  },
  {
    id: 'rrb-group-d',
    name: 'RRB Group D',
    subtitle: 'Level 1 Posts Exam',
    type: 'rrb',
    logoUrl: examLogos['rrb-group-d'],
    logoText: 'RRB',
  },
  {
    id: 'rrb-je',
    name: 'RRB JE',
    subtitle: 'Junior Engineer Stage 1 & 2',
    type: 'rrb',
    logoUrl: examLogos['rrb-je'],
    logoText: 'RRB',
  },

  // Banking
  {
    id: 'ibps-po',
    name: 'IBPS PO',
    subtitle: 'Probationary Officer',
    type: 'banking',
    logoUrl: examLogos['ibps-po'],
    logoText: 'IBPS',
  },
  {
    id: 'ibps-clerk',
    name: 'IBPS Clerk',
    subtitle: 'Clerical Cadre Exam',
    type: 'banking',
    logoUrl: examLogos['ibps-clerk'],
    logoText: 'IBPS',
  },
  {
    id: 'sbi-po',
    name: 'SBI PO',
    subtitle: 'State Bank Probationary Officer',
    type: 'banking',
    logoUrl: examLogos['sbi-po'],
    logoText: 'SBI',
  },
  {
    id: 'sbi-clerk',
    name: 'SBI Clerk',
    subtitle: 'Junior Associate (Clerk)',
    type: 'banking',
    logoUrl: examLogos['sbi-clerk'],
    logoText: 'SBI',
  },

  // UPSC & State PSC
  {
    id: 'upsc',
    name: 'UPSC CSE',
    subtitle: 'Civil Services (IAS / IPS)',
    type: 'upsc',
    logoUrl: examLogos['upsc'],
    logoText: 'UPSC',
  },
  {
    id: 'uppsc',
    name: 'UPPSC PCS',
    subtitle: 'Combined State / Subordinate',
    type: 'upsc',
    logoUrl: examLogos['uppsc'],
    logoText: 'UPPSC',
  },
  {
    id: 'wbcs',
    name: 'WBCS (Exe)',
    subtitle: 'Executive & Allied Services',
    type: 'upsc',
    logoUrl: examLogos['wbcs'],
    logoText: 'WBCS',
  },

  // Defence & University
  {
    id: 'nda',
    name: 'NDA',
    subtitle: 'National Defence Academy',
    type: 'defence',
    logoUrl: examLogos['nda'],
    logoText: 'NDA',
  },
  {
    id: 'cds',
    name: 'CDS',
    subtitle: 'Combined Defence Services',
    type: 'defence',
    logoUrl: examLogos['cds'],
    logoText: 'CDS',
  },
  {
    id: 'cuet',
    name: 'CUET UG',
    subtitle: 'Common University Entrance',
    type: 'defence',
    logoUrl: examLogos['cuet'],
    logoText: 'CUET',
  },

  // Management
  {
    id: 'cat',
    name: 'CAT',
    subtitle: 'Common Admission Test (IIMs)',
    type: 'other',
    logoUrl: examLogos['cat'],
    logoText: 'CAT',
  },
];

export default function MockTestPage() {
  const { isJam } = useExamMode();
  return isJam ? <JamMockCatalog /> : <StandardMockTestPage />;
}

function StandardMockTestPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, ExamPaperCounts> | null>(null);
  const [countError, setCountError] = useState('');
  const [countRevision, setCountRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const exams = examCards.map(card => card.id);
    const load = () => {
      void fetchCatalogSummary(exams).then(saved => {
        if (active) { setCounts(Object.fromEntries(saved.map(exam => [exam.examSlug, exam]))); setCountError(''); }
      }).catch(() => { if (active) setCountError('Paper counts unavailable.'); });
    };
    load();
    const unsubscribe = exams.map(exam => subscribeMockCatalog(exam, load));
    return () => { active = false; unsubscribe.forEach(stop => stop()); };
  }, [countRevision]);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.add('mock-test-surface');
    root.classList.add('mock-test-surface');
    return () => {
      body.classList.remove('mock-test-surface');
      root.classList.remove('mock-test-surface');
    };
  }, []);

  const filteredExams = useMemo(() => {
    return examCards.filter((exam) => {
      return activeCategory === 'all' || exam.type === activeCategory;
    });
  }, [activeCategory]);

  return (
    <main className={styles.page}>
      <div className={styles.macosWindow}>
        {/* Desktop Sidebar */}
        <aside className={styles.macosSidebar}>
          <div className={styles.macosTrafficLights}>
            <div className={`${styles.trafficLight} ${styles.close}`}></div>
            <div className={`${styles.trafficLight} ${styles.minimize}`}></div>
            <div className={`${styles.trafficLight} ${styles.maximize}`}></div>
          </div>

          <ExamModeSwitch />

          <h2 className={styles.sidebarTitle}>Categories</h2>
          <div className={styles.sidebarNav}>
            {categories.map((cat) => (
              <button
                data-ui-button="state"
                key={cat.id}
                className={`${styles.sidebarTab} ${activeCategory === cat.id ? styles.activeSidebarTab : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className={styles.macosContent}>
          <div className={styles.app}>
            <div className={styles.homeContainer}>
              {/* Header Area */}
              <header data-ui-chrome="header" className={styles.header}>
                <div className={styles.headerTitleRow}>
                  <h1 className={styles.headerTitle}>
                    <ShinyPill text="MOCK & PYQ" />
                  </h1>
                </div>

                {/* Categories Scroll */}
                <div className={styles.categoryScroll}>
                  {categories.map((cat) => (
                    <button
                      data-ui-button="state"
                      key={cat.id}
                      className={`${styles.catChip} ${activeCategory === cat.id ? styles.activeChip : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </header>

              {/* Content Body */}
              <div className={styles.contentBody}>
                {/* Exam Grid */}
                <section className={styles.section}>
                  {countError && <p role="status">{countError} <button type="button" data-ui-button="secondary" onClick={() => setCountRevision(value => value + 1)}>Retry counts</button></p>}
                  <div className={styles.examGrid}>
                    {filteredExams.map((card) => (
                      <Link
                        data-ui-button="state"
                        key={card.id}
                        className={styles.examCard}
                        href={`/mock-test/${card.id}`}
                        prefetch={true}
                      >
                        <div className={styles.examTop}>
                          <div className={styles.examLogoBox}>
                            {card.logoUrl && !logoErrors[card.id] ? (
                              <img
                                src={card.logoUrl}
                                alt={card.name}
                                loading="eager"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src.endsWith('.webp')) {
                                    target.src = target.src.replace('.webp', '.png');
                                  } else {
                                    setLogoErrors((p) => ({ ...p, [card.id]: true }));
                                  }
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: card.logoTextSize || '12px' }}>{card.logoText}</span>
                            )}
                          </div>

                        </div>

                        <div className={styles.examCardBody}>
                          <h3 className={styles.examName}>{card.name}</h3>
                          {card.subtitle && <p className={styles.examSubtitle}>{card.subtitle}</p>}
                        </div>

                        <div className={styles.examFooter}>
                          <div className={styles.examCountPill}>
                            <Layers size={11} className={styles.countIcon} />
                            <span title={counts ? `${counts[card.id]?.mockCount || 0} mocks · ${counts[card.id]?.pyqCount || 0} PYQs` : undefined}>{counts ? `${counts[card.id]?.total || 0} Test${counts[card.id]?.total === 1 ? '' : 's'} Included` : countError ? 'Counts unavailable' : 'Loading counts…'}</span>
                          </div>
                          
                        </div>
                      </Link>
                    ))}
                  </div>
                  {filteredExams.length === 0 && (
                    <div className={styles.emptyState}>No exams found in this category</div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
