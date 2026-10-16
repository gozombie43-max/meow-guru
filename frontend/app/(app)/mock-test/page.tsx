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

type ExamType = 'ssc' | 'rrb' | 'banking' | 'upsc' | 'defence' | 'other';

type ExamCard = {
  id: string;
  name: string;
  subtitle?: string;
  type: ExamType;
  count: string;
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
    count: '142 Tests',
    logoUrl: examLogos['ssc-cgl'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-chsl',
    name: 'SSC CHSL',
    subtitle: 'Higher Secondary (10+2)',
    type: 'ssc',
    count: '84 Tests',
    logoUrl: examLogos['ssc-chsl'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-mts',
    name: 'SSC MTS',
    subtitle: 'Multi Tasking Staff',
    type: 'ssc',
    count: '48 Tests',
    logoUrl: examLogos['ssc-mts'],
    logoText: 'SSC',
  },
  {
    id: 'ssc-gd',
    name: 'SSC GD',
    subtitle: 'General Duty Constable',
    type: 'ssc',
    count: '52 Tests',
    logoUrl: examLogos['ssc-gd'],
    logoText: 'SSC',
  },

  // Railway
  {
    id: 'rrb-ntpc',
    name: 'RRB NTPC',
    subtitle: 'Non-Technical Categories',
    type: 'rrb',
    count: '70 Tests',
    logoUrl: examLogos['rrb-ntpc'],
    logoText: 'RRB',
  },
  {
    id: 'rrb-group-d',
    name: 'RRB Group D',
    subtitle: 'Level 1 Posts Exam',
    type: 'rrb',
    count: '58 Tests',
    logoUrl: examLogos['rrb-group-d'],
    logoText: 'RRB',
  },
  {
    id: 'rrb-je',
    name: 'RRB JE',
    subtitle: 'Junior Engineer Stage 1 & 2',
    type: 'rrb',
    count: '45 Tests',
    logoUrl: examLogos['rrb-je'],
    logoText: 'RRB',
  },

  // Banking
  {
    id: 'ibps-po',
    name: 'IBPS PO',
    subtitle: 'Probationary Officer',
    type: 'banking',
    count: '96 Tests',
    logoUrl: examLogos['ibps-po'],
    logoText: 'IBPS',
  },
  {
    id: 'ibps-clerk',
    name: 'IBPS Clerk',
    subtitle: 'Clerical Cadre Exam',
    type: 'banking',
    count: '80 Tests',
    logoUrl: examLogos['ibps-clerk'],
    logoText: 'IBPS',
  },
  {
    id: 'sbi-po',
    name: 'SBI PO',
    subtitle: 'State Bank Probationary Officer',
    type: 'banking',
    count: '110 Tests',
    logoUrl: examLogos['sbi-po'],
    logoText: 'SBI',
  },
  {
    id: 'sbi-clerk',
    name: 'SBI Clerk',
    subtitle: 'Junior Associate (Clerk)',
    type: 'banking',
    count: '80 Tests',
    logoUrl: examLogos['sbi-clerk'],
    logoText: 'SBI',
  },

  // UPSC & State PSC
  {
    id: 'upsc',
    name: 'UPSC CSE',
    subtitle: 'Civil Services (IAS / IPS)',
    type: 'upsc',
    count: '95 Tests',
    logoUrl: examLogos['upsc'],
    logoText: 'UPSC',
  },
  {
    id: 'uppsc',
    name: 'UPPSC PCS',
    subtitle: 'Combined State / Subordinate',
    type: 'upsc',
    count: '65 Tests',
    logoUrl: examLogos['uppsc'],
    logoText: 'UPPSC',
  },
  {
    id: 'wbcs',
    name: 'WBCS (Exe)',
    subtitle: 'Executive & Allied Services',
    type: 'upsc',
    count: '55 Tests',
    logoUrl: examLogos['wbcs'],
    logoText: 'WBCS',
  },

  // Defence & University
  {
    id: 'nda',
    name: 'NDA',
    subtitle: 'National Defence Academy',
    type: 'defence',
    count: '65 Tests',
    logoUrl: examLogos['nda'],
    logoText: 'NDA',
  },
  {
    id: 'cds',
    name: 'CDS',
    subtitle: 'Combined Defence Services',
    type: 'defence',
    count: '40 Tests',
    logoUrl: examLogos['cds'],
    logoText: 'CDS',
  },
  {
    id: 'cuet',
    name: 'CUET UG',
    subtitle: 'Common University Entrance',
    type: 'defence',
    count: '50 Tests',
    logoUrl: examLogos['cuet'],
    logoText: 'CUET',
  },

  // Management
  {
    id: 'cat',
    name: 'CAT',
    subtitle: 'Common Admission Test (IIMs)',
    type: 'other',
    count: '120 Tests',
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
                            <span>{card.count} Included</span>
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
