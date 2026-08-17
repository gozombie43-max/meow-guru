'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Filter } from 'lucide-react';
import styles from './page.module.css';

type ExamType = 'ssc' | 'rrb' | 'banking' | 'upsc' | 'defence' | 'other';

type ExamCard = {
  id: string;
  name: string;
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
  ssc: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="SSC logo">
      <defs>
        <linearGradient id="sscBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f4c81" />
          <stop offset="100%" stop-color="#143a66" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#sscBg)" />
      <circle cx="80" cy="62" r="34" fill="#f59e0b" opacity="0.18" />
      <path d="M34 118h92" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" opacity="0.9" />
      <path d="M46 104h68" stroke="#f59e0b" stroke-width="8" stroke-linecap="round" opacity="0.95" />
      <text x="80" y="76" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="2">SSC</text>
    </svg>
  `),
  rrb: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="RRB logo">
      <defs>
        <linearGradient id="rrbBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b4f8a" />
          <stop offset="100%" stop-color="#1d3f72" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#rrbBg)" />
      <path d="M35 108h90" stroke="#e0f2fe" stroke-width="8" stroke-linecap="round" opacity="0.95" />
      <path d="M42 94h74" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" opacity="0.9" />
      <path d="M54 50h52c10 0 18 8 18 18v18H36V68c0-10 8-18 18-18Z" fill="#f8fafc" opacity="0.95" />
      <circle cx="58" cy="82" r="6" fill="#1d4ed8" />
      <circle cx="102" cy="82" r="6" fill="#1d4ed8" />
      <text x="80" y="74" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#0f4c81" letter-spacing="1.5">RRB</text>
    </svg>
  `),
  banking: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="SBI logo">
      <defs>
        <linearGradient id="sbiBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1d4ed8" />
          <stop offset="100%" stop-color="#1e40af" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#sbiBg)" />
      <circle cx="80" cy="64" r="34" fill="#ffffff" opacity="0.18" />
      <circle cx="80" cy="64" r="20" fill="none" stroke="#ffffff" stroke-width="12" stroke-dasharray="88 28" stroke-linecap="round" transform="rotate(120 80 64)" />
      <path d="M80 52v24" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.9" />
      <text x="80" y="116" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#ffffff" letter-spacing="1.5">SBI</text>
    </svg>
  `),
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
  { id: 'all', label: 'All', emoji: '📚' },
  { id: 'ssc', label: 'SSC', emoji: '🏛️' },
  { id: 'rrb', label: 'Railway', emoji: '🚂' },
  { id: 'banking', label: 'Banking', emoji: '📊' },
  { id: 'upsc', label: 'UPSC & State PSC', emoji: '🏛️' },
  { id: 'defence', label: 'Defence & Univ', emoji: '🎖️' },
  { id: 'other', label: 'Management', emoji: '🎓' },
];

const examCards: ExamCard[] = [
  // SSC
  { id: 'ssc-cgl', name: 'SSC CGL', type: 'ssc', count: '142 Tests', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-chsl', name: 'SSC CHSL', type: 'ssc', count: '84 Tests', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-mts', name: 'SSC MTS', type: 'ssc', count: '48 Tests', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-gd', name: 'SSC GD', type: 'ssc', count: '52 Tests', logoUrl: logos.ssc, logoText: 'SSC' },

  // Railway
  { id: 'rrb-ntpc', name: 'RRB NTPC', type: 'rrb', count: '70 Tests', logoUrl: logos.rrb, logoText: 'RRB' },
  { id: 'rrb-group-d', name: 'RRB Group D', type: 'rrb', count: '58 Tests', logoUrl: logos.rrb, logoText: 'RRB' },
  { id: 'rrb-je', name: 'RRB JE', type: 'rrb', count: '45 Tests', logoUrl: logos.rrb, logoText: 'RRB' },

  // Banking
  { id: 'ibps-po', name: 'IBPS PO', type: 'banking', count: '96 Tests', logoUrl: logos.banking, logoText: 'IBPS' },
  { id: 'ibps-clerk', name: 'IBPS Clerk', type: 'banking', count: '80 Tests', logoUrl: logos.banking, logoText: 'IBPS' },
  { id: 'sbi-po', name: 'SBI PO', type: 'banking', count: '110 Tests', logoUrl: logos.banking, logoText: 'SBI' },
  { id: 'sbi-clerk', name: 'SBI Clerk', type: 'banking', count: '80 Tests', logoUrl: logos.banking, logoText: 'SBI' },

  // UPSC & State PSC
  { id: 'upsc', name: 'UPSC CSE (IAS / IPS)', type: 'upsc', count: '95 Tests', logoUrl: logos.upsc, logoText: 'UPSC' },
  { id: 'uppsc', name: 'UPPSC (Uttar Pradesh)', type: 'upsc', count: '65 Tests', logoUrl: logos.uppsc, logoText: 'UPPSC' },
  { id: 'wbcs', name: 'WBCS / WBPSC (West Bengal)', type: 'upsc', count: '55 Tests', logoUrl: logos.wbcs, logoText: 'WBCS' },

  // Defence & University
  { id: 'nda', name: 'NDA', type: 'defence', count: '65 Tests', logoUrl: logos.defence, logoText: 'NDA' },
  { id: 'cds', name: 'CDS', type: 'defence', count: '40 Tests', logoUrl: logos.defence, logoText: 'CDS' },
  { id: 'cuet', name: 'CUET', type: 'defence', count: '50 Tests', logoUrl: logos.other, logoText: 'CUET' },

  // Management
  { id: 'cat', name: 'CAT', type: 'other', count: '120 Tests', logoUrl: logos.other, logoText: 'CAT' },
];

export default function MockTestPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    return examCards.filter(exam => {
      const matchCat = activeCategory === 'all' || exam.type === activeCategory;
      const matchSearch = exam.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

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
                key={cat.id}
                className={`${styles.sidebarTab} ${activeCategory === cat.id ? styles.activeSidebarTab : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.emoji}</span> {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className={styles.macosContent}>
          <div className={styles.app}>
            <div className={styles.homeContainer}>
              {/* Header Area */}
              <header className={styles.header}>
                <div className={styles.headerLeft}>
                  <h1 className={styles.greeting}>Hi, Aspirant 👋</h1>
                  <p className={styles.subtitle}>Choose your target exam to begin mock test series</p>
                </div>

                <div className={styles.headerRight}>
                  <div className={styles.searchWrap}>
                    <Search size={15} className={styles.searchIcon} />
                    <input 
                      type="text" 
                      placeholder="Search exams, test series..." 
                      className={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button className={styles.filterBtn} aria-label="Filter"><Filter size={14} /></button>
                  </div>
                  <div className={styles.headerActions}>
                    <button className={styles.iconBtn} aria-label="Notifications"><Bell size={15} /></button>
                    <div className={styles.avatar}>ST</div>
                  </div>
                </div>

                {/* Categories Scroll for Mobile */}
                <div className={styles.categoryScroll}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`${styles.catChip} ${activeCategory === cat.id ? styles.activeChip : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      <span>{cat.emoji}</span> {cat.label}
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
                      <div key={card.id} className={styles.examCard} onClick={() => openDetail(card)}>
                        <div className={styles.examTop}>
                          <div className={styles.examLogoBox}>
                            {card.logoUrl && !logoErrors[card.id] ? (
                              <img src={card.logoUrl} alt={card.name} onError={() => setLogoErrors(p => ({...p, [card.id]: true}))} />
                            ) : (
                              <span style={{ fontSize: card.logoTextSize || '12px' }}>{card.logoText}</span>
                            )}
                          </div>
                        </div>
                        <h3 className={styles.examName}>{card.name}</h3>
                        <p className={styles.examCount}>{card.count} included</p>
                      </div>
                    ))}
                  </div>
                  {filteredExams.length === 0 && (
                    <div className={styles.emptyState}>No exams found for &quot;{searchQuery}&quot;</div>
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
