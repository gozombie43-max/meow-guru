'use client';

import { useState } from 'react';
import { DM_Sans, Nunito } from 'next/font/google';
import styles from './page.module.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
});

type ExamType = 'ssc' | 'rrb' | 'upsc' | 'other';

type ExamCard = {
  id: string;
  name: string;
  type: ExamType;
  count: string;
  badge: string;
  badgeTone: 'hot' | 'free' | 'new';
  logoUrl?: string;
  logoText: string;
  logoBackground?: string;
  logoTextColor?: string;
  logoTextSize?: string;
};

const logos: Record<ExamType, string> = {
  ssc: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Staff_Selection_Commission_of_India.svg/240px-Staff_Selection_Commission_of_India.svg.png',
  rrb: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Railway_Recruitment_Board_logo.svg/240px-Railway_Recruitment_Board_logo.svg.png',
  upsc: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Emblem_of_the_Union_Public_Service_Commission.svg/240px-Emblem_of_the_Union_Public_Service_Commission.svg.png',
  other: '',
};

const heroStats = [
  { icon: '🔥', value: '12', label: 'Day Streak' },
  { icon: '✅', value: '248', label: 'Tests Done' },
  { icon: '⭐', value: '82%', label: 'Accuracy' },
];

const categories = [
  { id: 'all', label: 'All', emoji: '📚' },
  { id: 'ssc', label: 'SSC', emoji: '🏛️' },
  { id: 'rrb', label: 'RRB', emoji: '🚂' },
  { id: 'upsc', label: 'UPSC', emoji: '🇮🇳' },
  { id: 'cat', label: 'CAT', emoji: '🎓' },
  { id: 'banking', label: 'Banking', emoji: '📊' },
];

const examCards: ExamCard[] = [
  {
    id: 'ssc-cgl',
    name: 'SSC CGL',
    type: 'ssc',
    count: '82 Tests',
    badge: '🔥 Hot',
    badgeTone: 'hot',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-chsl',
    name: 'SSC CHSL',
    type: 'ssc',
    count: '64 Tests',
    badge: 'Free',
    badgeTone: 'free',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-mts',
    name: 'SSC MTS',
    type: 'ssc',
    count: '48 Tests',
    badge: 'Free',
    badgeTone: 'free',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-cpo',
    name: 'SSC CPO',
    type: 'ssc',
    count: '36 Tests',
    badge: 'New',
    badgeTone: 'new',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'ssc-gd',
    name: 'SSC GD',
    type: 'ssc',
    count: '52 Tests',
    badge: '🔥 Hot',
    badgeTone: 'hot',
    logoUrl: logos.ssc,
    logoText: 'SSC',
  },
  {
    id: 'rrb-ntpc',
    name: 'RRB NTPC',
    type: 'rrb',
    count: '70 Tests',
    badge: '🔥 Hot',
    badgeTone: 'hot',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },
  {
    id: 'rrb-alp',
    name: 'RRB ALP',
    type: 'rrb',
    count: '45 Tests',
    badge: 'Free',
    badgeTone: 'free',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },
  {
    id: 'rrb-grp-d',
    name: 'RRB GRP D',
    type: 'rrb',
    count: '58 Tests',
    badge: 'New',
    badgeTone: 'new',
    logoUrl: logos.rrb,
    logoText: 'RRB',
  },
  {
    id: 'cat',
    name: 'CAT',
    type: 'other',
    count: '120 Tests',
    badge: '🔥 Hot',
    badgeTone: 'hot',
    logoText: 'CAT',
    logoBackground: 'linear-gradient(135deg,#1565c0,#42a5f5)',
    logoTextColor: '#fff',
    logoTextSize: '13px',
  },
  {
    id: 'upsc',
    name: 'UPSC',
    type: 'upsc',
    count: '200 Tests',
    badge: '🔥 Hot',
    badgeTone: 'hot',
    logoUrl: logos.upsc,
    logoText: 'UPSC',
  },
];

const mockTests = [
  'SSC CGL Tier I 2026 – Free Mock Test',
  'SSC CGL Tier I 2026 – Full Mock Test 1',
  'SSC CGL Tier I 2026 – Full Mock Test 2',
  'SSC CGL Tier I 2026 – Full Mock Test 3',
  'SSC CGL Tier I 2026 – Full Mock Test 4',
  'SSC CGL Tier I 2026 – Full Mock Test 5',
  'SSC CGL Tier I 2026 – Full Mock Test 6',
  'SSC CGL Tier I 2026 – Full Mock Test 7',
];

const prevTests = [
  'SSC CGL Tier I 2025 – Previous Year Paper',
  'SSC CGL Tier I 2024 – Previous Year Paper',
  'SSC CGL Tier I 2023 – Previous Year Paper',
  'SSC CGL Tier I 2022 – Previous Year Paper',
  'SSC CGL Tier I 2021 – Previous Year Paper',
];

export default function MockTestPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [selectedExam, setSelectedExam] = useState<ExamCard>(examCards[0]);
  const [tier, setTier] = useState<'tier1' | 'tier2'>('tier1');
  const [tab, setTab] = useState<'mock' | 'prev'>('mock');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [detailLogoError, setDetailLogoError] = useState(false);

  const openDetail = (exam: ExamCard) => {
    setSelectedExam(exam);
    setView('detail');
    setTier('tier1');
    setTab('mock');
    setDetailLogoError(false);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setView('home');
    window.scrollTo(0, 0);
  };

  const detailLogoUrl = logos[selectedExam.type];
  const detailSubtitle = 'Combined Graduate Level Exam';
  const detailFallback = selectedExam.logoText || selectedExam.name.split(' ')[0];

  return (
    <main className={`${styles.page} ${dmSans.className}`}>
      <div className={styles.app}>
        {view === 'home' ? (
          <div className={styles.homePage}>
            <section className={styles.hero}>
              <div className={styles.heroTop}>
                <div className={`${styles.heroGreeting} ${nunito.className}`}>
                  <div className={styles.wave}>👋 Welcome back</div>
                </div>
              </div>

              <div className={styles.heroStats}>
                {heroStats.map((stat) => (
                  <div key={stat.label} className={styles.statPill}>
                    <span className={styles.sIcon}>{stat.icon}</span>
                    <div>
                      <div className={`${styles.sVal} ${nunito.className}`}>{stat.value}</div>
                      <div className={styles.sLbl}>{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.heroCurve} />

            <section className={styles.homeBody}>
              <div className={`${styles.sectionLabel} ${nunito.className}`}>Browse Exams</div>
              <div className={styles.categoryRow}>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.catChip} ${activeCategory === cat.id ? styles.activeChip : ''} ${nunito.className}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className={styles.chipEmoji}>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className={styles.examGrid}>
                {examCards.map((card) => {
                  const hasLogo = Boolean(card.logoUrl);
                  const logoError = logoErrors[card.id];
                  const showImage = hasLogo && !logoError;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${styles.examCard} ${styles[card.type]}`}
                      onClick={() => openDetail(card)}
                    >
                      <div className={styles.cardTop}>
                        <div className={`${styles.examName} ${nunito.className}`}>{card.name}</div>
                        <div
                          className={styles.examLogoWrap}
                          style={card.logoBackground ? { background: card.logoBackground } : undefined}
                        >
                          {showImage ? (
                            <img
                              src={card.logoUrl}
                              alt={`${card.name} logo`}
                              onError={() =>
                                setLogoErrors((prev) => ({
                                  ...prev,
                                  [card.id]: true,
                                }))
                              }
                            />
                          ) : (
                            <div
                              className={`${styles.examLogoText} ${nunito.className}`}
                              style={{
                                color: card.logoTextColor,
                                fontSize: card.logoTextSize,
                              }}
                            >
                              {card.logoText}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.cardMeta}>
                        <div className={styles.cardCount}>{card.count}</div>
                        <div
                          className={`${styles.cardBadge} ${
                            card.badgeTone === 'hot'
                              ? styles.badgeHot
                              : card.badgeTone === 'free'
                              ? styles.badgeFree
                              : styles.badgeNew
                          }`}
                        >
                          {card.badge}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className={styles.streakBanner}>
                <span className={styles.streakIconBig}>🔥</span>
                <div className={styles.streakInfo}>
                  <div className={`${styles.streakTitle} ${nunito.className}`}>12 Day Streak! Keep it up!</div>
                  <div className={styles.streakSub}>Practice daily to climb the leaderboard</div>
                </div>
                <button className={`${styles.streakBtn} ${nunito.className}`} type="button">
                  Practice →
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.detailPage}>
            <section className={styles.detailHero}>
              <button className={`${styles.detailBack} ${nunito.className}`} type="button" onClick={goBack}>
                ← Back
              </button>

              <div className={styles.detailTitleRow}>
                <div className={styles.detailLogoWrap}>
                  {detailLogoUrl && !detailLogoError ? (
                    <img
                      className={styles.detailLogo}
                      src={detailLogoUrl}
                      alt={`${selectedExam.name} logo`}
                      onError={() => setDetailLogoError(true)}
                    />
                  ) : (
                    <div className={`${styles.detailLogoText} ${nunito.className}`}>
                      {detailFallback.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.detailTitleInfo}>
                  <h2 className={`${styles.detailTitle} ${nunito.className}`}>{selectedExam.name}</h2>
                  <div className={styles.detailSub}>{detailSubtitle}</div>
                </div>
              </div>

              <div className={styles.tierToggle}>
                <button
                  type="button"
                  className={`${styles.tierBtn} ${tier === 'tier1' ? styles.tierBtnActive : ''} ${nunito.className}`}
                  onClick={() => setTier('tier1')}
                >
                  <svg className={styles.tierIcon} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  TIER I
                </button>
                <button
                  type="button"
                  className={`${styles.tierBtn} ${tier === 'tier2' ? styles.tierBtnActive : ''} ${nunito.className}`}
                  onClick={() => setTier('tier2')}
                >
                  <svg className={styles.tierIcon} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  TIER II
                </button>
              </div>
            </section>

            <div className={styles.detailCurve} />

            <section className={styles.detailBody}>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${tab === 'mock' ? styles.tabBtnActive : ''} ${nunito.className}`}
                  onClick={() => setTab('mock')}
                >
                  📋 Mocks (82)
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${tab === 'prev' ? styles.tabBtnActive : ''} ${nunito.className}`}
                  onClick={() => setTab('prev')}
                >
                  📅 Prev Years (853)
                </button>
              </div>

              <div className={styles.testList}>
                {(tab === 'mock' ? mockTests : prevTests).map((title) => (
                  <div key={title} className={styles.testCard}>
                    <div className={styles.testIcon}>{tab === 'mock' ? '📋' : '📅'}</div>
                    <div className={styles.testInfo}>
                      <div className={`${styles.testTitle} ${nunito.className}`}>{title}</div>
                      <div className={styles.testMeta}>
                        <span className={styles.metaItem}>❓ 100 Qs</span>
                        <span className={styles.metaItem}>✅ 200 Marks</span>
                        <span className={styles.metaItem}>⏱ 60 Min</span>
                      </div>
                    </div>
                    <button className={`${styles.startBtn} ${nunito.className}`} type="button">
                      Start
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
