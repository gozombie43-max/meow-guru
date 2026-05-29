'use client';

import { useEffect, useMemo, useState } from 'react';
import { DM_Sans, Nunito } from 'next/font/google';
import { Search, Bell, Clock, Award, ChevronLeft, Share2, Filter, ChevronRight, Play, CheckCircle, Lock } from 'lucide-react';
import styles from './page.module.css';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'] });

type ExamType = 'ssc' | 'rrb' | 'upsc' | 'banking' | 'other';

type ExamCard = {
  id: string;
  name: string;
  type: ExamType;
  count: string;
  badge: string;
  badgeTone: 'hot' | 'free' | 'new' | 'premium';
  logoUrl?: string;
  logoText: string;
  logoBackground?: string;
  logoTextColor?: string;
  logoTextSize?: string;
};

type TestStatus = 'completed' | 'paused' | 'not_started' | 'locked';

type MockTest = {
  id: string;
  title: string;
  questions: number;
  marks: number;
  minutes: number;
  status: TestStatus;
  score?: number;
  isFree?: boolean;
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

const logos: Record<ExamType, string> = {
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
  other: makeTextLogo('CAT', '#7c3aed', '#4338ca'),
};

const mockTestsData: MockTest[] = [
  { id: 'm1', title: 'SSC CGL Tier I 2026 – Full Mock Test 1', questions: 100, marks: 200, minutes: 60, status: 'completed', score: 145, isFree: true },
  { id: 'm2', title: 'SSC CGL Tier I 2026 – Full Mock Test 2', questions: 100, marks: 200, minutes: 60, status: 'paused', isFree: true },
  { id: 'm3', title: 'SSC CGL Tier I 2026 – Full Mock Test 3', questions: 100, marks: 200, minutes: 60, status: 'not_started', isFree: true },
  { id: 'm4', title: 'SSC CGL Tier I 2026 – Full Mock Test 4', questions: 100, marks: 200, minutes: 60, status: 'locked' },
  { id: 'm5', title: 'SSC CGL Tier I 2026 – Full Mock Test 5', questions: 100, marks: 200, minutes: 60, status: 'locked' },
];

const prevTestsData: MockTest[] = [
  { id: 'p1', title: 'SSC CGL Tier I 2025 – Previous Year Paper (Shift 1)', questions: 100, marks: 200, minutes: 60, status: 'not_started', isFree: true },
  { id: 'p2', title: 'SSC CGL Tier I 2025 – Previous Year Paper (Shift 2)', questions: 100, marks: 200, minutes: 60, status: 'not_started' },
  { id: 'p3', title: 'SSC CGL Tier I 2024 – Previous Year Paper (Shift 1)', questions: 100, marks: 200, minutes: 60, status: 'locked' },
];

const categories = [
  { id: 'all', label: 'All', emoji: '📚' },
  { id: 'ssc', label: 'SSC', emoji: '🏛️' },
  { id: 'rrb', label: 'RRB', emoji: '🚂' },
  { id: 'banking', label: 'Banking', emoji: '📊' },
  { id: 'upsc', label: 'UPSC', emoji: '🇮🇳' },
  { id: 'other', label: 'Other', emoji: '🎓' },
];

const examCards: ExamCard[] = [
  { id: 'ssc-cgl', name: 'SSC CGL', type: 'ssc', count: '142 Tests', badge: '🔥 Hot', badgeTone: 'hot', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-chsl', name: 'SSC CHSL', type: 'ssc', count: '84 Tests', badge: 'Free', badgeTone: 'free', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-mts', name: 'SSC MTS', type: 'ssc', count: '48 Tests', badge: 'Free', badgeTone: 'free', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-cpo', name: 'SSC CPO', type: 'ssc', count: '36 Tests', badge: 'New', badgeTone: 'new', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'ssc-gd', name: 'SSC GD', type: 'ssc', count: '52 Tests', badge: '🔥 Hot', badgeTone: 'hot', logoUrl: logos.ssc, logoText: 'SSC' },
  { id: 'rrb-ntpc', name: 'RRB NTPC', type: 'rrb', count: '70 Tests', badge: '🔥 Hot', badgeTone: 'hot', logoUrl: logos.rrb, logoText: 'RRB' },
  { id: 'rrb-alp', name: 'RRB ALP', type: 'rrb', count: '45 Tests', badge: 'Free', badgeTone: 'free', logoUrl: logos.rrb, logoText: 'RRB' },
  { id: 'rrb-grp-d', name: 'RRB Group D', type: 'rrb', count: '58 Tests', badge: 'New', badgeTone: 'new', logoUrl: logos.rrb, logoText: 'RRB' },
  { id: 'ibps-po', name: 'IBPS PO', type: 'banking', count: '96 Tests', badge: 'New', badgeTone: 'new', logoUrl: logos.banking, logoText: 'IBPS' },
  { id: 'sbi-po', name: 'SBI PO', type: 'banking', count: '110 Tests', badge: '🔥 Hot', badgeTone: 'hot', logoUrl: logos.banking, logoText: 'SBI' },
  { id: 'ibps-clerk', name: 'IBPS Clerk', type: 'banking', count: '80 Tests', badge: 'Free', badgeTone: 'free', logoUrl: logos.banking, logoText: 'IBPS' },
  { id: 'cat', name: 'CAT', type: 'other', count: '120 Tests', badge: 'Premium', badgeTone: 'premium', logoUrl: logos.other, logoText: 'CAT' },
  { id: 'upsc', name: 'UPSC CSE', type: 'upsc', count: '200 Tests', badge: 'Premium', badgeTone: 'premium', logoUrl: logos.upsc, logoText: 'UPSC' },
  { id: 'nda', name: 'NDA', type: 'other', count: '65 Tests', badge: 'Free', badgeTone: 'free', logoUrl: logos.other, logoText: 'NDA' },
  { id: 'cds', name: 'CDS', type: 'other', count: '40 Tests', badge: 'New', badgeTone: 'new', logoUrl: logos.other, logoText: 'CDS' },
];

export default function MockTestPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [selectedExam, setSelectedExam] = useState<ExamCard>(examCards[0]);
  const [tab, setTab] = useState<'overview' | 'mock' | 'prev'>('mock');
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
    setSelectedExam(exam);
    setView('detail');
    setTab('mock');
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setView('home');
    window.scrollTo(0, 0);
  };

  const renderTestStatus = (status: TestStatus, score?: number) => {
    switch (status) {
      case 'completed': 
        return (
          <div className={styles.statusCompleted}>
            <div className={styles.scoreWrap}>
              <Award size={16} />
              <span>Score: <strong>{score}</strong>/200</span>
            </div>
            <button className={styles.viewBtn}>View Analysis</button>
          </div>
        );
      case 'paused': 
        return (
          <button className={styles.statusPaused}>
            <Clock size={16} /> Resume
          </button>
        );
      case 'not_started': 
        return (
          <button className={styles.statusNotStarted}>
            <Play size={16} fill="currentColor" /> Start Test
          </button>
        );
      case 'locked': 
        return (
          <button className={styles.statusLocked}>
            <Lock size={16} /> Unlock Pro
          </button>
        );
    }
  };

  return (
    <main className={`${styles.page} ${dmSans.className}`}>
      <div className={styles.app}>
        {view === 'home' ? (
          <div className={styles.homeContainer}>
            {/* Header Area */}
            <header className={styles.header}>
              <div className={styles.headerTop}>
                <div>
                  <h1 className={`${styles.greeting} ${nunito.className}`}>Hi, Student 👋</h1>
                  <p className={styles.subtitle}>Ready to practice today?</p>
                </div>
                <div className={styles.headerActions}>
                  <button className={styles.iconBtn}><Bell size={20} /></button>
                  <div className={styles.avatar}>ST</div>
                </div>
              </div>

              <div className={styles.searchWrap}>
                <Search size={18} className={styles.searchIcon} />
                <input 
                  type="text" 
                  placeholder="Search exams, test series..." 
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className={styles.filterBtn}><Filter size={18} /></button>
              </div>
            </header>

            {/* Content Body */}
            <div className={styles.contentBody}>
              {/* Continue Learning */}
              {searchQuery === '' && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Continue Preparation</h2>
                  </div>
                  <div className={styles.continueCard}>
                    <div className={styles.continueIconWrap}>
                      <Clock size={20} className={styles.continueIcon} />
                    </div>
                    <div className={styles.continueInfo}>
                      <h3>SSC CGL Tier 1 - Mock 2</h3>
                      <p>Time remaining: 45:20</p>
                      <div className={styles.progressBar}><div className={styles.progressFill} style={{width: '35%'}}></div></div>
                    </div>
                    <button className={styles.resumeBtn}><Play size={16} fill="currentColor" /></button>
                  </div>
                </section>
              )}

              {/* Categories */}
              <section className={styles.section}>
                <div className={styles.categoryScroll}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`${styles.catChip} ${activeCategory === cat.id ? styles.activeChip : ''} ${nunito.className}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      <span>{cat.emoji}</span> {cat.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Exam Grid */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Explore Test Series</h2>
                </div>
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
                        <span className={`${styles.badge} ${styles['badge' + card.badgeTone]}`}>{card.badge}</span>
                      </div>
                      <h3 className={`${styles.examName} ${nunito.className}`}>{card.name}</h3>
                      <p className={styles.examCount}>{card.count} included</p>
                    </div>
                  ))}
                </div>
                {filteredExams.length === 0 && (
                  <div className={styles.emptyState}>No exams found for "{searchQuery}"</div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className={styles.detailContainer}>
            <header className={styles.detailHeader}>
              <div className={styles.detailTopNav}>
                <button onClick={goBack} className={styles.backBtn}><ChevronLeft size={24} /></button>
                <button className={styles.iconBtn}><Share2 size={20} /></button>
              </div>
              <div className={styles.detailHero}>
                <div className={styles.detailHeroLogo}>
                  {selectedExam.logoUrl && !logoErrors[selectedExam.id] ? (
                    <img
                      src={selectedExam.logoUrl}
                      alt={selectedExam.name}
                      onError={() => setLogoErrors(p => ({ ...p, [selectedExam.id]: true }))}
                    />
                  ) : (
                    <span>{selectedExam.logoText}</span>
                  )}
                </div>
                <div>
                  <h1 className={`${styles.detailTitle} ${nunito.className}`}>{selectedExam.name} Test Series</h1>
                  <p className={styles.detailSubtitle}>Comprehensive preparation package</p>
                </div>
              </div>
            </header>

            <div className={styles.detailBody}>
              <div className={styles.tabsNav}>
                {['overview', 'mock', 'prev'].map((t) => (
                  <button 
                    key={t} 
                    className={`${styles.tabBtn} ${tab === t ? styles.activeTabBtn : ''} ${nunito.className}`}
                    onClick={() => setTab(t as any)}
                  >
                    {t === 'overview' ? 'Overview' : t === 'mock' ? 'Mock Tests' : 'Previous Year'}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div className={styles.overviewTab}>
                  <div className={styles.statBoxGrid}>
                    <div className={styles.statBox}>
                      <Award size={24} className={styles.statBoxIcon} />
                      <div className={styles.statBoxNum}>142</div>
                      <div className={styles.statBoxLbl}>Total Tests</div>
                    </div>
                    <div className={styles.statBox}>
                      <CheckCircle size={24} className={styles.statBoxIcon} />
                      <div className={styles.statBoxNum}>12.5k+</div>
                      <div className={styles.statBoxLbl}>Enrolled</div>
                    </div>
                  </div>
                  <div className={styles.cardSection}>
                    <h3 className={styles.cardSectionTitle}>About Package</h3>
                    <ul className={styles.featureList}>
                      <li><CheckCircle size={16}/> Latest exact exam pattern</li>
                      <li><CheckCircle size={16}/> Detailed step-by-step solutions</li>
                      <li><CheckCircle size={16}/> Compete with All-India ranking</li>
                      <li><CheckCircle size={16}/> Performance analysis & weak area detection</li>
                    </ul>
                  </div>
                </div>
              )}

              {(tab === 'mock' || tab === 'prev') && (
                <div className={styles.testList}>
                  {(tab === 'mock' ? mockTestsData : prevTestsData).map((test) => (
                    <div key={test.id} className={`${styles.testLineCard} ${test.status === 'locked' ? styles.lockedCard : ''}`}>
                      <div className={styles.testLineInfo}>
                        <div className={styles.testLineHeader}>
                          <h4 className={styles.testLineTitle}>{test.title}</h4>
                        </div>
                        <div className={styles.testLineMeta}>
                          <span>{test.questions} Qs</span><span>{test.marks} Marks</span><span>{test.minutes} Mins</span>
                        </div>
                      </div>
                      <div className={styles.testLineAction}>
                        {renderTestStatus(test.status, test.score)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
