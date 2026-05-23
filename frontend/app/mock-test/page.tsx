'use client';

import { useState, useMemo } from 'react';
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

const logos: Record<ExamType, string> = {
  ssc: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Staff_Selection_Commission_of_India.svg/240px-Staff_Selection_Commission_of_India.svg.png',
  rrb: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Railway_Recruitment_Board_logo.svg/240px-Railway_Recruitment_Board_logo.svg.png',
  upsc: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Emblem_of_the_Union_Public_Service_Commission.svg/240px-Emblem_of_the_Union_Public_Service_Commission.svg.png',
  banking: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/State_Bank_of_India_logo.svg/240px-State_Bank_of_India_logo.svg.png',
  other: '',
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
  { id: 'cat', name: 'CAT', type: 'other', count: '120 Tests', badge: 'Premium', badgeTone: 'premium', logoText: 'CAT' },
  { id: 'upsc', name: 'UPSC CSE', type: 'upsc', count: '200 Tests', badge: 'Premium', badgeTone: 'premium', logoUrl: logos.upsc, logoText: 'UPSC' },
  { id: 'nda', name: 'NDA', type: 'other', count: '65 Tests', badge: 'Free', badgeTone: 'free', logoText: 'NDA' },
  { id: 'cds', name: 'CDS', type: 'other', count: '40 Tests', badge: 'New', badgeTone: 'new', logoText: 'CDS' },
];

export default function MockTestPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [selectedExam, setSelectedExam] = useState<ExamCard>(examCards[0]);
  const [tab, setTab] = useState<'overview' | 'mock' | 'prev'>('mock');
  const [searchQuery, setSearchQuery] = useState('');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

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
      case 'completed': return <div className={styles.statusCompleted}><CheckCircle size={14} /> Score: {score}/200</div>;
      case 'paused': return <div className={styles.statusPaused}><Clock size={14} /> Resume</div>;
      case 'not_started': return <div className={styles.statusNotStarted}>Start Test</div>;
      case 'locked': return <div className={styles.statusLocked}><Lock size={14} /> Pro</div>;
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
                  {selectedExam.logoUrl ? <img src={selectedExam.logoUrl} alt="" /> : <span>{selectedExam.logoText}</span>}
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
                          {test.isFree && <span className={styles.freeBadge}>FREE</span>}
                          <h4 className={styles.testLineTitle}>{test.title}</h4>
                        </div>
                        <div className={styles.testLineMeta}>
                          <span>{test.questions} Qs</span> • <span>{test.marks} Marks</span> • <span>{test.minutes} Mins</span>
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
