'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { X, Search, ChevronRight, LayoutDashboard, Target, FileCheck2, Swords, Library, Wallet, Settings } from 'lucide-react';
import styles from './page.module.css';

type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type RecentQuizEntry = NonNullable<AuthUser['recentQuizzes']>[number];

// Helper to format time label
function formatTimeLabel(iso?: string) {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';

  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === today) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function appendQuery(
  base: string,
  params: Record<string, string | number | undefined>
) {
  const [path, rawQuery] = base.split('?');
  const query = new URLSearchParams(rawQuery || '');
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Mathematics' | 'Reasoning' | 'English' | 'General Awareness'>('Mathematics');

  const userRecentQuizzes = user?.recentQuizzes;
  
  const totalAttempted = Object.values(user?.progress || {}).reduce((acc, p) => acc + (p?.attempted || 0), 0);
  const totalCorrect = Object.values(user?.progress || {}).reduce((acc, p) => acc + (p?.correct || 0), 0);
  const accuracyNum = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const strokeDashoffset = 176 - (176 * accuracyNum) / 100;
  
  const studySecs = user?.studyTime || 0;
  const hours = Math.floor(studySecs / 3600);
  const minutes = Math.floor((studySecs % 3600) / 60);
  const formattedStudyTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const recentQuizzes = useMemo<RecentQuizEntry[]>(() => {
    if (!userRecentQuizzes) return [];
    return [...userRecentQuizzes]
      .filter((entry) => entry && entry.quizKey)
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      });
  }, [userRecentQuizzes]);

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  const initial = firstName.charAt(0).toUpperCase();

  const upgradeTileMarkup = (
    <div className={styles.upgradeTile}>
      <div className={styles.txt}>
        <h4>Unlock every mock test</h4>
        <p>Full Tier-2 papers &amp; unlimited battles.</p>
      </div>
      <button>Upgrade</button>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Desktop Navbar */}
      <div className={`${styles.navbar} ${styles.desktopOnly}`}>
        <div className={styles.navbarTitle}>Dashboard</div>
        <div className={styles.navbarSearch}>
          <Search size={14} />
          Search
        </div>
        <div className={styles.navbarAvatar}>{initial}</div>
        <button onClick={handleClose} className={styles.navbarClose} aria-label="Close dashboard">
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* Mobile Navbar */}
      <div className={`${styles.mobileNavbar} ${styles.mobileOnly}`}>
        <div className={styles.mobileNavbarRow}>
          <div className={styles.mobileNavbarEyebrow}>Dashboard</div>
          <div className={styles.navbarAvatar}>{initial}</div>
        </div>
        <div className={styles.mobileNavbarTitle}>Hello, {firstName} 👋</div>
      </div>

      <div className={styles.body}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div>
            <div className={styles.sideGroupLabel}>Prepare</div>
            <div className={styles.sideList}>
              <Link href="/dashboard" className={`${styles.sideRow} ${styles.active}`}>
                <span className={`${styles.ic} ${styles.icBlue}`}><LayoutDashboard size={15} color="#fff" /></span>
                Dashboard <span className={styles.chev}>›</span>
              </Link>
              <Link href="/practice" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icOrange}`}><Target size={15} color="#fff" /></span>
                Practice Zone <span className={styles.chev}>›</span>
              </Link>
              <Link href="/mock-test" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icGreen}`}><FileCheck2 size={15} color="#fff" /></span>
                Mock Tests <span className={styles.chev}>›</span>
              </Link>
              <Link href="/battle" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icPink}`}><Swords size={15} color="#fff" /></span>
                Battle Mode <span className={styles.chev}>›</span>
              </Link>
            </div>
          </div>

          <div>
            <div className={styles.sideGroupLabel}>Library</div>
            <div className={styles.sideList}>
              <Link href="/flashcards" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icIndigo}`}><Library size={15} color="#fff" /></span>
                Flashcards <span className={styles.chev}>›</span>
              </Link>
              <Link href="/wallet" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icTeal}`}><Wallet size={15} color="#fff" /></span>
                Wallet <span className={styles.chev}>›</span>
              </Link>
              <Link href="/settings" className={styles.sideRow}>
                <span className={`${styles.ic} ${styles.icPurple}`}><Settings size={15} color="#fff" /></span>
                Settings <span className={styles.chev}>›</span>
              </Link>
            </div>
          </div>

          <div className={`${styles.desktopOnly} ${styles.sidebarUpgrade}`}>
            {upgradeTileMarkup}
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.main}>
          <div className={styles.greeting}>
            <h1 className={styles.desktopOnly}>Hello, {firstName} 👋</h1>
            <p>Good evening to prepare — <b>Tier-2 is 74 days away</b></p>
          </div>

          <div className={styles.pills}>
            <button 
              className={`${styles.pill} ${activeTab === 'Mathematics' ? styles.active : ''}`}
              onClick={() => setActiveTab('Mathematics')}
            >
              <span className={styles.dot} style={{ background: activeTab === 'Mathematics' ? '#fff' : 'var(--ios-blue)' }}></span>
              Mathematics
            </button>
            <button 
              className={`${styles.pill} ${activeTab === 'Reasoning' ? styles.active : ''}`}
              onClick={() => setActiveTab('Reasoning')}
            >
              <span className={styles.dot} style={{ background: activeTab === 'Reasoning' ? '#fff' : 'var(--ios-teal)' }}></span>
              Reasoning
            </button>
            <button 
              className={`${styles.pill} ${activeTab === 'English' ? styles.active : ''}`}
              onClick={() => setActiveTab('English')}
            >
              <span className={styles.dot} style={{ background: activeTab === 'English' ? '#fff' : 'var(--ios-orange)' }}></span>
              English
            </button>
            <button 
              className={`${styles.pill} ${activeTab === 'General Awareness' ? styles.active : ''}`}
              onClick={() => setActiveTab('General Awareness')}
            >
              <span className={styles.dot} style={{ background: activeTab === 'General Awareness' ? '#fff' : 'var(--ios-purple)' }}></span>
              General Awareness
            </button>
          </div>
          
          <div>
            <div className={styles.sectionHead}>
              <h2>Continue practice</h2>
              <a href="#">See all</a>
            </div>

            <div className={styles.cardsBox}>
              <div className={styles.cards}>
                {authLoading ? (
              <div className={styles.emptyState}>Loading...</div>
            ) : recentQuizzes.length > 0 ? (
              recentQuizzes.map((entry, index) => {
                const colors = [
                  { grad: 'linear-gradient(155deg,#ff8a80,var(--ios-red))', track: 'linear-gradient(90deg, var(--ios-red), #ff8a80)' },
                  { grad: 'linear-gradient(155deg,#6ee0d0,var(--ios-teal))', track: 'linear-gradient(90deg, var(--ios-teal), #6ee0d0)' },
                  { grad: 'linear-gradient(155deg,#ffc861,var(--ios-orange))', track: 'linear-gradient(90deg, var(--ios-orange), #ffc861)' },
                ];
                const color = colors[index % colors.length];
                const icon = (entry.title || entry.subject || 'Q').trim().charAt(0).toUpperCase() || 'Q';
                
                const resumeHref = appendQuery(entry.href, {
                  mode: entry.mode,
                  resume: 1,
                });
                
                const total = entry.totalQuestions ?? 0;
                const current = entry.currentIndex ?? 0;
                const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
                const progressLabel = total > 0 ? `Q${Math.min(current + 1, total)} of ${total} · Last played ${formatTimeLabel(entry.updatedAt)}` : `Last played ${formatTimeLabel(entry.updatedAt)}`;

                return (
                  <Link key={entry.quizKey} href={resumeHref} className={styles.card}>
                    <div className={styles.cardIcon} style={{ background: color.grad }}>
                      {icon}
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTop}>
                        <h3>{entry.title || entry.subject || 'Quiz'}</h3>
                      </div>
                      <div className={styles.cardMeta}>{progressLabel}</div>
                      <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${percent}%`, background: color.track }}></div>
                      </div>
                    </div>
                    <div className={styles.cardChev}>›</div>
                  </Link>
                );
              })
            ) : (
              // Fallback to static cards if no real data
              <>
                <div className={styles.card}>
                  <div className={styles.cardIcon} style={{ background: 'linear-gradient(155deg,#ff8a80,var(--ios-red))' }}>📐</div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}><h3>Mensuration — 2D & 3D</h3></div>
                    <div className={styles.cardMeta}>28 concepts · 340 questions</div>
                    <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: '64%', background: 'linear-gradient(90deg, var(--ios-red), #ff8a80)' }}></div></div>
                  </div>
                  <div className={styles.cardChev}>›</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon} style={{ background: 'linear-gradient(155deg,#6ee0d0,var(--ios-teal))' }}>🧩</div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}><h3>Coding–Decoding</h3></div>
                    <div className={styles.cardMeta}>16 concepts · 210 questions</div>
                    <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: '41%', background: 'linear-gradient(90deg, var(--ios-teal), #6ee0d0)' }}></div></div>
                  </div>
                  <div className={styles.cardChev}>›</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon} style={{ background: 'linear-gradient(155deg,#ffc861,var(--ios-orange))' }}>📚</div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}><h3>Vocabulary — OWS & Idioms</h3></div>
                    <div className={styles.cardMeta}>34 concepts · 500 questions</div>
                    <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: '22%', background: 'linear-gradient(90deg, var(--ios-orange), #ffc861)' }}></div></div>
                  </div>
                  <div className={styles.cardChev}>›</div>
                </div>
              </>
            )}
              </div>
            </div>
          </div>
        </div>

        {/* Right / Statistics */}
        <div className={styles.right}>
          <div className={styles.sectionHead} style={{ marginBottom: '12px' }}>
            <h2>Statistics</h2>
          </div>

          <div className={styles.segment}>
            <button>Day</button><button className={styles.active}>Week</button><button>Month</button>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>MOCK TEST SCORE %</div>
            <div className={styles.bars}>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '38%' }}></div><div className={styles.barLabel}>Mo</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '55%' }}></div><div className={styles.barLabel}>Tu</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '47%' }}></div><div className={styles.barLabel}>We</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '70%' }}></div><div className={styles.barLabel}>Th</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '84%' }}></div><div className={styles.barLabel}>Fr</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '60%' }}></div><div className={styles.barLabel}>Sa</div></div>
              <div className={styles.barCol}><div className={styles.bar} style={{ height: '73%' }}></div><div className={styles.barLabel}>Su</div></div>
            </div>
          </div>

          <div className={styles.ringCard}>
            <div>
              <div className={styles.lbl}>ACCURACY</div>
              <div className={styles.accuracy}>Overall</div>
            </div>
            <div className={styles.ringWrap}>
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7"/>
                <circle cx="34" cy="34" r="28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray="176" strokeDashoffset={strokeDashoffset}/>
              </svg>
              <div className={styles.ringNum}>{accuracyNum}%</div>
            </div>
          </div>

          <div className={styles.miniRow}>
            <div className={styles.miniCard}><div className={styles.num}>{totalAttempted}</div><div className={styles.cap}>Questions solved</div></div>
            <div className={styles.miniCard}><div className={styles.num}>{formattedStudyTime}</div><div className={styles.cap}>Study time</div></div>
          </div>
        </div>
        
        <div className={styles.mobileOnly} style={{ padding: '0 18px 24px' }}>
          {upgradeTileMarkup}
        </div>

      </div>
    </div>
  );
}
