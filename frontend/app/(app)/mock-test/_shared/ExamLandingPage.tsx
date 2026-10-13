'use client';

import { JAM_SECTIONS, JAM_SUBJECT } from '@/lib/exam-mode';
import ExamModeSwitch from '@/components/ExamModeSwitch';
import { useAuth } from '@/context/AuthContext';
import {
Award,
CheckCircle,
ChevronDown,
ChevronLeft,
Clock,
Layers,
Lock
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect,useRef,useMemo,useState } from 'react';
import { getExamHistory,getExamSlots,type MockAttemptHistory } from './api';
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
import ExamLandingLoader from './ExamLandingLoader';

interface ExamLandingPageProps {
  examSlug: string;
  loadingOnly?: boolean;
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

export default function ExamLandingPage({ examSlug, loadingOnly = false }: ExamLandingPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading } = useAuth();
  const owner = user?.id;
  const ready = !authLoading && !!token && !!owner;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const jamSection = JAM_SECTIONS.find(section => `${JAM_SUBJECT}-${section.slug}` === examSlug);
  const meta = (examSlug === JAM_SUBJECT || jamSection ? { name: jamSection?.title || 'IIT JAM Physics', category: 'IIT JAM', subtitle: jamSection ? 'Physics section practice' : 'Physics mock tests and previous year papers', icon: '⚛️' } : EXAM_META[examSlug]) || {
    name: examSlug.toUpperCase(),
    category: 'Exam',
    subtitle: 'Comprehensive preparation series',
    icon: '📝',
  };

  const [activeTab, setActiveTab] = useState<'mock' | 'overview' | 'prev'>(searchParams.get('tab') === 'prev' ? 'prev' : 'mock');
  const [historyState, setHistory] = useState<{ owner: string | undefined; exam: string; attempts: MockAttemptHistory[] } | null>(null);
  const history = historyState && historyState.owner === owner && historyState.exam === examSlug && ready ? historyState.attempts : [];
  const [slotState, setSlotState] = useState<{ exam: string; slots: MockTestSlot[] } | null>(null);
  const allSlots = useMemo(() => slotState?.exam === examSlug ? slotState.slots.filter(s => !(s.isPyq || s.type === 'pyq')) : [], [slotState, examSlug]);
  const pyqSlots = useMemo(() => slotState?.exam === examSlug ? slotState.slots.filter(s => s.isPyq || s.type === 'pyq') : [], [slotState, examSlug]);
  const loadingSlots = slotState?.exam !== examSlug;
  const loadingHistory = ready && !(historyState?.owner === owner && historyState?.exam === examSlug);

  // Fetch slots from API (with fallback to static config)
  useEffect(() => {
    if (loadingOnly) return;
    let isMounted = true;
    const controller = new AbortController();
    getExamSlots(examSlug, controller.signal)
      .then((res) => {
        if (isMounted) {
          setSlotState({ exam: examSlug, slots: res.slots || [] });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('API slots fetch fallback to static:', err);
          setSlotState({ exam: examSlug, slots: [...getSlotsForExam(examSlug), ...getPyqSlotsForExam(examSlug)] });
        }
      });
    return () => { isMounted = false; controller.abort(); };
  }, [examSlug, loadingOnly]);

  // Compute dynamic tiers/stages from loaded mock and pyq slots
  const tiers = useMemo(() => {
    const allAvailable = [...allSlots, ...pyqSlots];
    const rawTiers = allAvailable.filter((s) => s.tier).map((s) => s.tier as string);
    return Array.from(new Set(rawTiers));
  }, [allSlots, pyqSlots]);

  const tierInfo = useMemo(() => getTierLabel(examSlug), [examSlug]);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const effectiveTier = tiers.includes(selectedTier) ? selectedTier : tiers[0] || '';

  // Fetch attempt history for this exam
  useEffect(() => {
    if (!ready || loadingOnly) return;
    const controller = new AbortController();
    getExamHistory(examSlug, tokenRef.current!, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setHistory({ owner, exam: examSlug, attempts: res.attempts || [] });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('History fetch error:', err);
          setHistory({ owner, exam: examSlug, attempts: [] });
        }
      });
    return () => controller.abort();
  }, [examSlug, owner, ready, loadingOnly]);

  // Filtered by selected tier (if exam has tiers)
  const displayMockSlots = useMemo(() => {
    if (tiers.length === 0) return allSlots;
    return allSlots.filter((slot) => !slot.tier || slot.tier === effectiveTier);
  }, [allSlots, effectiveTier, tiers]);

  const displayPyqSlots = useMemo(() => {
    if (tiers.length === 0) return pyqSlots;
    return pyqSlots.filter((slot) => !slot.tier || slot.tier === effectiveTier);
  }, [pyqSlots, effectiveTier, tiers]);

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

  const isLoading = loadingOnly || loadingSlots || authLoading || loadingHistory;

  return (
    <main className={`${styles.page} ${styles.loadedPage}`}>
      <div className={styles.macosWindow}>
        {/* Desktop macOS Sidebar */}
        <aside className={styles.macosSidebar}>
          <div className={styles.macosTrafficLights}>
            <div className={`${styles.trafficLight} ${styles.close}`}></div>
            <div className={`${styles.trafficLight} ${styles.minimize}`}></div>
            <div className={`${styles.trafficLight} ${styles.maximize}`}></div>
          </div>

          <button data-ui-button="icon" onClick={() => router.replace('/mock-test')} className={styles.sidebarBackBtn}>
            <ChevronLeft size={15} />
            <span>All Exams</span>
          </button>

          <ExamModeSwitch />

          <div className={styles.sidebarExamCard}>
            <div className={styles.sidebarExamIcon}>{meta.icon}</div>
            <div className={styles.sidebarExamDetails}>
              <span className={styles.sidebarExamName}>{meta.name}</span>
              <span className={styles.sidebarExamCategory}>{meta.category}</span>
            </div>
          </div>

          <h2 className={styles.sidebarTitle}>Navigation</h2>
          <div className={styles.sidebarNav}>
            <button data-ui-button="state"
              className={`${styles.sidebarTab} ${activeTab === 'mock' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('mock')}
            >
              <Layers size={14} />
              <span>Mock Tests{!loadingSlots && ` (${allSlots.length})`}</span>
            </button>
            <button data-ui-button="state"
              className={`${styles.sidebarTab} ${activeTab === 'overview' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <CheckCircle size={14} />
              <span>Overview</span>
            </button>
            <button data-ui-button="state"
              className={`${styles.sidebarTab} ${activeTab === 'prev' ? styles.activeSidebarTab : ''}`}
              onClick={() => setActiveTab('prev')}
            >
              <Award size={14} />
              <span>Previous Papers{!loadingSlots && ` (${pyqSlots.length})`}</span>
            </button>
          </div>

          {/* Sidebar Tiers / Stages for desktop */}
          {tiers.length > 1 && (
            <div className={styles.sidebarTiersSection}>
              <h2 className={styles.sidebarTitle}>{tierInfo.singular || 'Stage'}</h2>
              <div className={styles.sidebarNav}>
                {tiers.map((t) => (
                  <button data-ui-button="state"
                    key={t}
                    className={`${styles.sidebarTierTab} ${effectiveTier === t ? styles.activeSidebarTierTab : ''}`}
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
                    <button data-ui-button="icon" onClick={() => router.replace('/mock-test')} className={styles.mobileBackBtn} aria-label="Back to all exams">
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
                          value={effectiveTier}
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

                    <button data-ui-button="state" onClick={() => router.replace('/mock-test')} className={styles.allExamsTopBtn}>
                      All Exams
                    </button>
                  </div>
                </div>

                {/* Mobile Navigation Tabs integrated inside the Card */}
                <div className={styles.mobileTabsNav}>
                  <button data-ui-button="state"
                    className={`${styles.mobileTabBtn} ${activeTab === 'mock' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('mock')}
                  >
                    Mocks{!loadingSlots && ` (${allSlots.length})`}
                  </button>
                  <button data-ui-button="state"
                    className={`${styles.mobileTabBtn} ${activeTab === 'overview' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button data-ui-button="state"
                    className={`${styles.mobileTabBtn} ${activeTab === 'prev' ? styles.activeMobileTabBtn : ''}`}
                    onClick={() => setActiveTab('prev')}
                  >
                    PYQs{!loadingSlots && ` (${pyqSlots.length})`}
                  </button>
                </div>
              </header>

              {/* Content Body */}
              <div className={styles.contentBody}>
                {/* Tab 1: Mock Tests List */}
                {activeTab === 'mock' && (
                  isLoading ? <ExamLandingLoader /> : <div className={styles.testList}>
                    {displayMockSlots.length === 0 && <div className={styles.placeholderTab}><h3>No tests published yet</h3><p>Published papers will appear here when available.</p></div>}
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
                                <button data-ui-button="state"
                                  className={styles.analysisBtn}
                                  onClick={() => handleViewAnalysis(slot.id, state.attemptId!)}
                                >
                                  Analysis
                                </button>
                              </div>
                            )}

                            {state.status === 'in_progress' && (
                              <button data-ui-button="state"
                                className={styles.statusPaused}
                                onClick={() => handleResume(slot.id, state.attemptId!)}
                              >
                                <Clock size={14} /> Resume
                              </button>
                            )}

                            {state.status === 'not_started' && (
                              <button data-ui-button="secondary"
                                className={styles.statusNotStarted}
                                onClick={() => handleStart(slot.id)}
                              >
                                Start
                              </button>
                            )}

                            {state.status === 'locked' && (
                              <button data-ui-button="state" className={styles.statusLocked} onClick={handleUnlock}>
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
                  isLoading ? <ExamLandingLoader /> : <div className={styles.testList}>
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
                                  <button data-ui-button="state"
                                    className={styles.analysisBtn}
                                    onClick={() => handleViewAnalysis(slot.id, state.attemptId!)}
                                  >
                                    Analysis
                                  </button>
                                </div>
                              )}

                              {state.status === 'in_progress' && (
                                <button data-ui-button="state"
                                  className={styles.statusPaused}
                                  onClick={() => handleResume(slot.id, state.attemptId!)}
                                >
                                  <Clock size={14} /> Resume
                                </button>
                              )}

                              {state.status === 'not_started' && (
                                <button data-ui-button="secondary"
                                  className={styles.statusNotStarted}
                                  onClick={() => handleStart(slot.id)}
                                >
                                  Start
                                </button>
                              )}

                              {state.status === 'locked' && (
                                <button data-ui-button="state" className={styles.statusLocked} onClick={handleUnlock}>
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

