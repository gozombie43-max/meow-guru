'use client';

import { useAuth } from '@/context/AuthContext';
import {
Award,
CheckCircle,
ChevronDown,
ChevronLeft,
Clock,
Layers,
Lock,
Play
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect,useMemo,useState } from 'react';
import { getExamHistory,getExamSlots } from './api';
import {
getExamConfig,
getMaxMarks,
getPyqSlotsForExam,
getSlotsForExam,
getTierLabel,
getTotalQuestions,
type MockTestSlot,
} from './exam-config';
import styles from './ExamLandingPage.module.css';

interface ExamLandingPageProps {
  examSlug: string;
}

const EXAM_META: Record<string, { name: string; category: string; subtitle: string; icon: string }> = {
  'ssc-cgl': { name: 'SSC CGL', category: 'SSC', subtitle: 'Combined Graduate Level Examination', icon: '🏛️' },
  'ssc-chsl': { name: 'SSC CHSL', category: 'SSC', subtitle: 'Combined Higher Secondary Level', icon: '📋' },
  'ssc-mts': { name: 'SSC MTS', category: 'SSC', subtitle: 'Multi Tasking Staff', icon: '🔧' },
  'ssc-gd': { name: 'SSC GD', category: 'SSC', subtitle: 'General Duty Constable', icon: '🛡️' },
  'rrb-ntpc': { name: 'RRB NTPC', category: 'Railway', subtitle: 'Non-Technical Popular Categories', icon: '🚂' },
  'rrb-group-d': { name: 'RRB Group D', category: 'Railway', subtitle: 'Level 1 Posts Examination', icon: '⚙️' },
  'rrb-je': { name: 'RRB JE', category: 'Railway', subtitle: 'Junior Engineer Examination', icon: '🔌' },
  'ibps-po': { name: 'IBPS PO', category: 'Banking', subtitle: 'Probationary Officer Examination', icon: '🏦' },
  'ibps-clerk': { name: 'IBPS Clerk', category: 'Banking', subtitle: 'Clerk Cadre Examination', icon: '📊' },
  'sbi-po': { name: 'SBI PO', category: 'Banking', subtitle: 'State Bank Probationary Officer', icon: '🏛️' },
  'sbi-clerk': { name: 'SBI Clerk', category: 'Banking', subtitle: 'Junior Associate Examination', icon: '📑' },
  'cat': { name: 'CAT', category: 'Management', subtitle: 'Common Admission Test (IIMs & Top B-Schools)', icon: '🎓' },
  'nda': { name: 'NDA', category: 'Defence', subtitle: 'National Defence Academy & Naval Academy', icon: '⭐' },
  'cds': { name: 'CDS', category: 'Defence', subtitle: 'Combined Defence Services Examination', icon: '🎖️' },
  'cuet': { name: 'CUET', category: 'University', subtitle: 'Common University Entrance Test (UG)', icon: '📚' },
  'upsc': { name: 'UPSC CSE', category: 'UPSC & State PSC', subtitle: 'Civil Services Examination (IAS / IPS / IFS)', icon: '🏛️' },
  'uppsc': { name: 'UPPSC PCS', category: 'UPSC & State PSC', subtitle: 'Uttar Pradesh Public Service Commission (Combined State / Upper Subordinate)', icon: '🏛️' },
  'wbcs': { name: 'WBCS (Exe)', category: 'UPSC & State PSC', subtitle: 'West Bengal Civil Service (Executive) & Allied Services', icon: '🏛️' },
};

export default function ExamLandingPage({ examSlug }: ExamLandingPageProps) {
  const router = useRouter();
  const { token } = useAuth();

  const meta = EXAM_META[examSlug] || {
    name: examSlug.toUpperCase(),
    category: 'Exam',
    subtitle: 'Comprehensive preparation series',
    icon: '📝',
  };

  const [activeTab, setActiveTab] = useState<'mock' | 'overview' | 'prev'>('mock');
  const [history, setHistory] = useState<any[]>([]);
  const [allSlots, setAllSlots] = useState<MockTestSlot[]>(() => getSlotsForExam(examSlug));
  const [pyqSlots, setPyqSlots] = useState<MockTestSlot[]>(() => getPyqSlotsForExam(examSlug));
  const [loadingSlots, setLoadingSlots] = useState(true);

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

  // Fetch slots from API (with fallback to static config)
  useEffect(() => {
    let isMounted = true;
    setLoadingSlots(true);
    getExamSlots(examSlug)
      .then((res) => {
        if (isMounted && res.slots && res.slots.length > 0) {
          const apiMocks = res.slots.filter((s: MockTestSlot) => !s.isPyq);
          const apiPyqs = res.slots.filter((s: MockTestSlot) => s.isPyq);
          if (apiMocks.length > 0) setAllSlots(apiMocks);
          if (apiPyqs.length > 0) setPyqSlots(apiPyqs);
        }
      })
      .catch((err) => {
        console.warn('API slots fetch fallback to static:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });
    return () => { isMounted = false; };
  }, [examSlug]);

  // Compute dynamic tiers/stages from loaded mock and pyq slots
  const tiers = useMemo(() => {
    const allAvailable = [...allSlots, ...pyqSlots];
    const rawTiers = allAvailable.filter((s) => s.tier).map((s) => s.tier as string);
    return Array.from(new Set(rawTiers));
  }, [allSlots, pyqSlots]);

  const tierInfo = useMemo(() => getTierLabel(examSlug), [examSlug]);
  const [selectedTier, setSelectedTier] = useState<string>('');

  // Update selected tier when tiers list is populated or changes
  useEffect(() => {
    if (tiers.length > 0 && (!selectedTier || !tiers.includes(selectedTier))) {
      setSelectedTier(tiers[0]);
    }
  }, [tiers, selectedTier]);

  // Fetch attempt history for this exam
  useEffect(() => {
    if (!token) return;
    getExamHistory(examSlug, token)
      .then((res) => {
        setHistory(res.attempts || []);
      })
      .catch((err) => {
        console.warn('History fetch error:', err);
      });
  }, [examSlug, token]);

  // Filtered by selected tier (if exam has tiers)
  const displayMockSlots = useMemo(() => {
    if (tiers.length === 0) return allSlots;
    return allSlots.filter((slot) => !slot.tier || slot.tier === selectedTier);
  }, [allSlots, selectedTier, tiers]);

  const displayPyqSlots = useMemo(() => {
    if (tiers.length === 0) return pyqSlots;
    return pyqSlots.filter((slot) => !slot.tier || slot.tier === selectedTier);
  }, [pyqSlots, selectedTier, tiers]);

  // Merge slot status with user history
  const getSlotState = (slot: MockTestSlot) => {
    const slotAttempts = history.filter((h) => h.testId === slot.id);
    const completed = slotAttempts.find((h) => h.status === 'completed');
    const inProgress = slotAttempts.find((h) => h.status === 'in_progress');

    if (completed) {
      return {
        status: 'completed' as const,
        score: completed.result?.totalScore ?? 0,
        maxScore: completed.result?.maxScore ?? 100,
        attemptId: completed.id,
      };
    }
    if (inProgress) {
      return {
        status: 'in_progress' as const,
        attemptId: inProgress.id,
      };
    }
    if (!slot.isFree) {
      return { status: 'locked' as const };
    }
    return { status: 'not_started' as const };
  };

  const handleStart = (slotId: string) => {
    router.push(`/mock-test/${examSlug}/${slotId}`);
  };

  const handleResume = (slotId: string, attemptId: string) => {
    router.push(`/mock-test/${examSlug}/${slotId}/attempt?resume=${attemptId}`);
  };

  const handleViewAnalysis = (slotId: string, attemptId: string) => {
    router.push(`/mock-test/${examSlug}/${slotId}/result/${attemptId}`);
  };

  const handleUnlock = () => {
    router.push('/access-code');
  };

  return (
    <main className={styles.page}>
      <div className={styles.macosWindow}>
        {/* Desktop macOS Sidebar */}
        <aside className={styles.macosSidebar}>
          <div className={styles.macosTrafficLights}>
            <div className={`${styles.trafficLight} ${styles.close}`}></div>
            <div className={`${styles.trafficLight} ${styles.minimize}`}></div>
            <div className={`${styles.trafficLight} ${styles.maximize}`}></div>
          </div>

          <button onClick={() => router.push('/mock-test')} className={styles.sidebarBackBtn}>
            <ChevronLeft size={15} />
            <span>All Exams</span>
          </button>

          <div className={styles.sidebarExamCard}>
            <div className={styles.sidebarExamIcon}>{meta.icon}</div>
            <div className={styles.sidebarExamDetails}>
              <span className={styles.sidebarExamName}>{meta.name}</span>
              <span className={styles.sidebarExamCategory}>{meta.category}</span>
            </div>
          </div>

          <h2 className={styles.sidebarTitle}>Navigation</h2>
          <div className={styles.sidebarNav}>
            <button
              className={`${styles.sidebarTab} ${activeTab === 'mock' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('mock')}
            >
              <Layers size={14} />
              <span>Mock Tests ({allSlots.length})</span>
            </button>
            <button
              className={`${styles.sidebarTab} ${activeTab === 'overview' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <CheckCircle size={14} />
              <span>Overview</span>
            </button>
            <button
              className={`${styles.sidebarTab} ${activeTab === 'prev' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('prev')}
            >
              <Award size={14} />
              <span>Previous Papers ({pyqSlots.length})</span>
            </button>
          </div>

          {/* Sidebar Tiers / Stages for desktop */}
          {tiers.length > 1 && (
            <div className={styles.sidebarTiersSection}>
              <h2 className={styles.sidebarTitle}>{tierInfo.singular || 'Stage'}</h2>
              <div className={styles.sidebarNav}>
                {tiers.map((t) => (
                  <button
                    key={t}
                    className={`${styles.sidebarTierTab} ${selectedTier === t ? styles.activeSidebarTierTab : ''}`}
                    onClick={() => setSelectedTier(t)}
                  >
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* macOS Content Area */}
        <div className={styles.macosContent}>
          <div className={styles.app}>
            <div className={styles.homeContainer}>
              {/* Single Unified Header Card */}
              <header className={styles.headerCard}>
                <div className={styles.headerTopRow}>
                  <div className={styles.headerTitleGroup}>
                    <button onClick={() => router.push('/mock-test')} className={styles.mobileBackBtn} aria-label="Back to all exams">
                      <ChevronLeft size={16} />
                    </button>
                    <div className={styles.headerIconBox}>{meta.icon}</div>
                    <div className={styles.headerTextGroup}>
                      <div className={styles.headerTitleRow}>
                        <h1 className={styles.greeting}>{meta.name}</h1>
                      </div>
                      <p className={styles.desktopSubtitle}>{meta.subtitle}</p>
                    </div>
                  </div>

                  <div className={styles.headerControls}>
                    {/* Stage / Tier Dropdown */}
                    {tiers.length > 1 && (
                      <div className={styles.tierDropdownWrap}>
                        <select
                          className={styles.tierDropdown}
                          value={selectedTier}
                          onChange={(e) => setSelectedTier(e.target.value)}
                          aria-label={`Select ${tierInfo.singular || 'Stage'}`}
                        >
                          {tiers.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} className={styles.dropdownChevron} />
                      </div>
                    )}

                    <button onClick={() => router.push('/mock-test')} className={styles.allExamsTopBtn}>
                      All Exams
                    </button>
                  </div>
                </div>

                {/* Mobile Navigation Tabs integrated inside the Card */}
                <div className={styles.mobileTabsNav}>
                  <button
                    className={`${styles.mobileTabBtn} ${activeTab === 'mock' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('mock')}
                  >
                    Mocks ({allSlots.length})
                  </button>
                  <button
                    className={`${styles.mobileTabBtn} ${activeTab === 'overview' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`${styles.mobileTabBtn} ${activeTab === 'prev' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('prev')}
                  >
                    PYQs ({pyqSlots.length})
                  </button>
                </div>
              </header>

              {/* Content Body */}
              <div className={styles.contentBody}>
                {/* Tab 1: Mock Tests List */}
                {activeTab === 'mock' && (
                  <div className={styles.testList}>
                    {displayMockSlots.map((slot) => {
                      const state = getSlotState(slot);
                      const config = getExamConfig(slot.configKey);
                      const totalQ = getTotalQuestions(slot.configKey);
                      const maxM = getMaxMarks(slot.configKey);
                      const duration = config?.totalDurationMin || 60;

                      return (
                        <div
                          key={slot.id}
                          className={`${styles.testLineCard} ${state.status === 'locked' ? styles.lockedCard : ''}`}
                        >
                          <div className={styles.testLineInfo}>
                            <div className={styles.testLineHeader}>
                              {slot.isFree && <span className={styles.freeBadge}>FREE</span>}
                              {slot.tier && <span className={styles.tierBadge}>{slot.tier}</span>}
                              <h3 className={styles.testLineTitle}>{slot.title}</h3>
                            </div>
                            <div className={styles.testLineMeta}>
                              <span>{totalQ} Questions</span>
                              <span>{maxM} Marks</span>
                              <span>{duration} Mins</span>
                              <span>{config?.compositeTimer ? 'Full Timer' : 'Sectional Timers'}</span>
                            </div>
                          </div>

                          <div className={styles.testLineAction}>
                            {state.status === 'completed' && (
                              <div className={styles.completedStatus}>
                                <div className={styles.scoreWrap}>
                                  <Award size={14} />
                                  <span>Score: <strong>{state.score}</strong>/{state.maxScore}</span>
                                </div>
                                <button
                                  className={styles.analysisBtn}
                                  onClick={() => handleViewAnalysis(slot.id, state.attemptId!)}
                                >
                                  Analysis
                                </button>
                              </div>
                            )}

                            {state.status === 'in_progress' && (
                              <button
                                className={styles.statusPaused}
                                onClick={() => handleResume(slot.id, state.attemptId!)}
                              >
                                <Clock size={14} /> Resume
                              </button>
                            )}

                            {state.status === 'not_started' && (
                              <button
                                className={styles.statusNotStarted}
                                onClick={() => handleStart(slot.id)}
                              >
                                <Play size={13} fill="currentColor" /> Start Test
                              </button>
                            )}

                            {state.status === 'locked' && (
                              <button className={styles.statusLocked} onClick={handleUnlock}>
                                <Lock size={14} /> Unlock Pro
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Overview */}
                {activeTab === 'overview' && (
                  <div className={styles.overviewTab}>
                    <div className={styles.statBoxGrid}>
                      <div className={styles.statBox}>
                        <Award size={24} className={styles.statBoxIcon} />
                        <div className={styles.statBoxNum}>{allSlots.length}</div>
                        <div className={styles.statBoxLbl}>Total Mock Tests</div>
                      </div>
                      <div className={styles.statBox}>
                        <CheckCircle size={24} className={styles.statBoxIcon} />
                        <div className={styles.statBoxNum}>{pyqSlots.length}</div>
                        <div className={styles.statBoxLbl}>Previous Year Papers</div>
                      </div>
                    </div>

                    <div className={styles.cardSection}>
                      <h3 className={styles.cardSectionTitle}>Why Practice With Us?</h3>
                      <ul className={styles.featureList}>
                        <li>
                          <CheckCircle size={15} />
                          <span><strong>Exact Exam Interface:</strong> Real timer, question palette, and navigation matching official portals.</span>
                        </li>
                        <li>
                          <CheckCircle size={15} />
                          <span><strong>AI Weakness Detection:</strong> Automatically flags concepts where you lose accuracy or spend excessive time.</span>
                        </li>
                        <li>
                          <CheckCircle size={15} />
                          <span><strong>Detailed Step-by-Step Solutions:</strong> Clear explanations for every question immediately available post-test.</span>
                        </li>
                        <li>
                          <CheckCircle size={15} />
                          <span><strong>Sectional & Composite Timers:</strong> Accurately simulates single-timer vs locked sectional exam formats.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 3: Previous Year Papers */}
                {activeTab === 'prev' && (
                  <div className={styles.testList}>
                    {displayPyqSlots.length === 0 ? (
                      <div className={styles.placeholderTab}>
                        <div className={styles.placeholderIcon}>📚</div>
                        <h3>No Papers Found</h3>
                        <p>No previous year papers available for the selected stage.</p>
                      </div>
                    ) : (
                      displayPyqSlots.map((slot) => {
                        const state = getSlotState(slot);
                        const config = getExamConfig(slot.configKey);
                        const totalQ = getTotalQuestions(slot.configKey);
                        const maxM = getMaxMarks(slot.configKey);
                        const duration = config?.totalDurationMin || 60;

                        return (
                          <div
                            key={slot.id}
                            className={`${styles.testLineCard} ${state.status === 'locked' ? styles.lockedCard : ''}`}
                          >
                            <div className={styles.testLineInfo}>
                              <div className={styles.testLineHeader}>
                                {slot.isFree && <span className={styles.freeBadge}>FREE</span>}
                                {slot.tier && <span className={styles.tierBadge}>{slot.tier}</span>}
                                <span className={styles.pyqBadge}>PYQ</span>
                                <h3 className={styles.testLineTitle}>{slot.title}</h3>
                              </div>
                              <div className={styles.testLineMeta}>
                                <span>{totalQ} Questions</span>
                                <span>{maxM} Marks</span>
                                <span>{duration} Mins</span>
                                <span>{config?.compositeTimer ? 'Full Timer' : 'Sectional Timers'}</span>
                              </div>
                            </div>

                            <div className={styles.testLineAction}>
                              {state.status === 'completed' && (
                                <div className={styles.completedStatus}>
                                  <div className={styles.scoreWrap}>
                                    <Award size={14} />
                                    <span>Score: <strong>{state.score}</strong>/{state.maxScore}</span>
                                  </div>
                                  <button
                                    className={styles.analysisBtn}
                                    onClick={() => handleViewAnalysis(slot.id, state.attemptId!)}
                                  >
                                    Analysis
                                  </button>
                                </div>
                              )}

                              {state.status === 'in_progress' && (
                                <button
                                  className={styles.statusPaused}
                                  onClick={() => handleResume(slot.id, state.attemptId!)}
                                >
                                  <Clock size={14} /> Resume
                                </button>
                              )}

                              {state.status === 'not_started' && (
                                <button
                                  className={styles.statusNotStarted}
                                  onClick={() => handleStart(slot.id)}
                                >
                                  <Play size={13} fill="currentColor" /> Start Test
                                </button>
                              )}

                              {state.status === 'locked' && (
                                <button className={styles.statusLocked} onClick={handleUnlock}>
                                  <Lock size={14} /> Unlock Pro
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

