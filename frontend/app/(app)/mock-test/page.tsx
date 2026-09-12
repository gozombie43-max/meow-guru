'use client';

import ShinyPill from '@/components/ShinyPill';
import { Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

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

const svgToDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const makeTextLogo = (label: string, background: string, accent: string) => svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${label} logo">
    <defs>
      <linearGradient id="${label.toLowerCase()}Bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${background}" />
        <stop offset="100%" stop-color="${accent}" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="28" fill="url(#${label.toLowerCase()}Bg)" />
    <circle cx="80" cy="62" r="34" fill="#ffffff" opacity="0.12" />
    <path d="M40 112h80" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.9" />
    <text x="80" y="84" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#ffffff" letter-spacing="1.5">${label}</text>
  </svg>
`);

const logos: Record<string, string> = {
  ssc: '/images/ssc-logo.webp',
  rrb: '/images/rrb-logo.webp',
  sbi: '/images/sbi-logo.webp',
  ibps: '/images/ibps-logo.webp',
  cat: '/images/cat-logo.webp',
  banking: '/images/sbi-logo.webp',
  upsc: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="UPSC logo">
      <defs>
        <linearGradient id="upscBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#9a3412" />
          <stop offset="100%" stop-color="#c2410c" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#upscBg)" />
      <circle cx="80" cy="58" r="24" fill="#fde68a" opacity="0.9" />
      <path d="M80 34l7 20h21l-17 12 7 20-18-12-18 12 7-20-17-12h21z" fill="#fff7ed" opacity="0.95" />
      <text x="80" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="#fff7ed" letter-spacing="1.5">UPSC</text>
    </svg>
  `),
  uppsc: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="UPPSC logo">
      <defs>
        <linearGradient id="uppscBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#047857" />
          <stop offset="100%" stop-color="#064e3b" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#uppscBg)" />
      <circle cx="80" cy="58" r="30" fill="#34d399" opacity="0.2" />
      <path d="M52 58h56M80 36v44" stroke="#a7f3d0" stroke-width="7" stroke-linecap="round" />
      <circle cx="80" cy="58" r="8" fill="#fef3c7" />
      <text x="80" y="124" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="1.5">UPPSC</text>
    </svg>
  `),
  wbcs: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="WBCS logo">
      <defs>
        <linearGradient id="wbcsBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#wbcsBg)" />
      <circle cx="80" cy="56" r="28" fill="#38bdf8" opacity="0.2" />
      <path d="M54 44l26 24 26-24M54 68l26 24 26-24" stroke="#e0f2fe" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <text x="80" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="1.5">WBCS</text>
    </svg>
  `),
  defence: makeTextLogo('DEFENCE', '#4b5563', '#1f2937'),
  other: makeTextLogo('CAT', '#7c3aed', '#4338ca'),
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
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-chsl',
    name: 'SSC CHSL',
    subtitle: 'Higher Secondary (10+2)',
    type: 'ssc',
    count: '84 Tests',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-mts',
    name: 'SSC MTS',
    subtitle: 'Multi Tasking Staff',
    type: 'ssc',
    count: '48 Tests',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-gd',
    name: 'SSC GD',
    subtitle: 'General Duty Constable',
    type: 'ssc',
    count: '52 Tests',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },

  // Railway
  {
    id: 'rrb-ntpc',
    name: 'RRB NTPC',
    subtitle: 'Non-Technical Categories',
    type: 'rrb',
    count: '70 Tests',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },
  {
    id: 'rrb-group-d',
    name: 'RRB Group D',
    subtitle: 'Level 1 Posts Exam',
    type: 'rrb',
    count: '58 Tests',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },
  {
    id: 'rrb-je',
    name: 'RRB JE',
    subtitle: 'Junior Engineer Stage 1 & 2',
    type: 'rrb',
    count: '45 Tests',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },

  // Banking
  {
    id: 'ibps-po',
    name: 'IBPS PO',
    subtitle: 'Probationary Officer',
    type: 'banking',
    count: '96 Tests',
    logoUrl: logos.ibps,
    logoText: 'IBPS',
  },
  {
    id: 'ibps-clerk',
    name: 'IBPS Clerk',
    subtitle: 'Clerical Cadre Exam',
    type: 'banking',
    count: '80 Tests',
    logoUrl: logos.ibps,
    logoText: 'IBPS',
  },
  {
    id: 'sbi-po',
    name: 'SBI PO',
    subtitle: 'State Bank Probationary Officer',
    type: 'banking',
    count: '110 Tests',
    logoUrl: logos.sbi,
    logoText: 'SBI',
  },
  {
    id: 'sbi-clerk',
    name: 'SBI Clerk',
    subtitle: 'Junior Associate (Clerk)',
    type: 'banking',
    count: '80 Tests',
    logoUrl: logos.sbi,
    logoText: 'SBI',
  },

  // UPSC & State PSC
  {
    id: 'upsc',
    name: 'UPSC CSE',
    subtitle: 'Civil Services (IAS / IPS)',
    type: 'upsc',
    count: '95 Tests',
    logoUrl: logos.upsc,
    logoText: 'UPSC',
  },
  {
    id: 'uppsc',
    name: 'UPPSC PCS',
    subtitle: 'Combined State / Subordinate',
    type: 'upsc',
    count: '65 Tests',
    logoUrl: logos.uppsc,
    logoText: 'UPPSC',
  },
  {
    id: 'wbcs',
    name: 'WBCS (Exe)',
    subtitle: 'Executive & Allied Services',
    type: 'upsc',
    count: '55 Tests',
    logoUrl: logos.wbcs,
    logoText: 'WBCS',
  },

  // Defence & University
  {
    id: 'nda',
    name: 'NDA',
    subtitle: 'National Defence Academy',
    type: 'defence',
    count: '65 Tests',
    logoUrl: logos.defence,
    logoText: 'NDA',
  },
  {
    id: 'cds',
    name: 'CDS',
    subtitle: 'Combined Defence Services',
    type: 'defence',
    count: '40 Tests',
    logoUrl: logos.defence,
    logoText: 'CDS',
  },
  {
    id: 'cuet',
    name: 'CUET UG',
    subtitle: 'Common University Entrance',
    type: 'defence',
    count: '50 Tests',
    logoUrl: logos.other,
    logoText: 'CUET',
  },

  // Management
  {
    id: 'cat',
    name: 'CAT',
    subtitle: 'Common Admission Test (IIMs)',
    type: 'other',
    count: '120 Tests',
    logoUrl: logos.cat,
    logoText: 'CAT',
  },
];

export default function MockTestPage() {
  const router = useRouter();
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

  const openDetail = (exam: ExamCard) => {
    router.push(`/mock-test/${exam.id}`);
  };

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
                      <button
                        data-ui-button="state"
                        type="button"
                        key={card.id}
                        className={styles.examCard}
                        onClick={() => openDetail(card)}
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
                      </button>
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
