'use client';

import { JAM_SECTIONS, JAM_SUBJECT } from '@/lib/exam-mode';
import ExamModeSwitch from '@/components/ExamModeSwitch';
import BackButton from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import {
Award,
CheckCircle,
ChevronDown,
ChevronLeft,
Clock3,
Eye,
FileText,
Layers,
Lock,
Play,
RotateCcw
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { examLogos } from './exam-logos';
import { contextualTitle } from './contextual-title';
import { paperDate } from './paper-date';
import { useEffect,useRef,useMemo,useState } from 'react';
import { getExamHistory,type MockAttemptHistory } from './api';
import {
getExamConfig,
getMaxMarks,
getTierLabel,
getTotalQuestions,
type MockTestSlot,
} from './exam-config';
import styles from './ExamLandingPage.module.css';
import ExamLandingLoader from './ExamLandingLoader';
import { useExamCatalog } from './useExamCatalog';
import PaperInfoDialog from './PaperInfoDialog';

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

  const examLogo = examLogos[examSlug];

  const [activeTab, setActiveTab] = useState<'mock' | 'overview' | 'prev'>(searchParams.get('tab') === 'prev' ? 'prev' : 'mock');
  const [historyState, setHistory] = useState<{ owner: string | undefined; exam: string; attempts: MockAttemptHistory[] } | null>(null);
  const history = historyState && historyState.owner === owner && historyState.exam === examSlug && ready ? historyState.attempts : [];
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);
  const [infoPaper, setInfoPaper] = useState<MockTestSlot | null>(null);
  const catalog = useExamCatalog(examSlug, activeTab, selectedTier, loadingOnly, selectedYear);
  const { metadata, effectiveTier, effectiveYear } = catalog;
  const tiers = metadata?.tiers || [];
  const tierInfo = useMemo(() => getTierLabel(examSlug), [examSlug]);
  const loadingHistory = ready && !(historyState?.owner === owner && historyState?.exam === examSlug);
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [examSlug, activeTab, effectiveTier, effectiveYear]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !catalog.hasMore || catalog.loadingMore || catalog.error) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) catalog.loadMore();
    }, { root: contentRef.current, rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [catalog]);

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

  // Merge slot status with user history
  const getSlotState = (slot: MockTestSlot) => {
    const slotAttempts = history.filter((h) => h.testId === slot.id);
    const completed = slotAttempts.find((h) => h.status === 'completed');
    const inProgress = slotAttempts.find((h) => h.status === 'in_progress');

    if (inProgress) {
      return {
        status: 'in_progress' as const,
        attemptId: inProgress.id,
      };
    }
    if (completed) {
      return {
        status: 'completed' as const,
        score: completed.result?.totalScore ?? 0,
        maxScore: completed.result?.maxScore ?? 100,
        attemptId: completed.id,
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

  const handleViewResult = (slotId: string, attemptId: string) => {
    router.push(`/mock-test/${examSlug}/${slotId}/result/${attemptId}`);
  };

  const handleUnlock = () => {
    router.push('/access-code');
  };

  const isLoading = loadingOnly || catalog.loading;
  const actionsLoading = authLoading || loadingHistory;

  const renderPaperCard = (slot: MockTestSlot) => {
    const state = getSlotState(slot);
    const config = getExamConfig(slot.configKey);
    const date = paperDate(slot);
    const completed = state.status === 'completed';
    const inProgress = state.status === 'in_progress';
    const locked = state.status === 'locked';
    const StatusIcon = completed ? CheckCircle : inProgress ? Play : locked ? Lock : Clock3;
    const ActionIcon = completed ? Eye : inProgress ? RotateCcw : locked ? Lock : Play;
    const actionLabel = completed ? 'View Result' : inProgress ? 'Resume Mock' : locked ? 'Unlock Pro' : 'Start Mock';
    const actionText = completed ? 'Result' : inProgress ? 'Resume' : locked ? 'Unlock' : 'Start';
    const metadata = slot.paperMetadata;
    const totalQ = metadata?.sections.reduce((sum, section) => sum + section.questionCount, 0) ?? getTotalQuestions(slot.configKey);
    const maxMarks = metadata?.sections.reduce((sum, section) => sum + section.questionCount * section.marking.correct, 0) ?? getMaxMarks(slot.configKey);

    return (
      <article key={slot.id} className={styles.testLineCard}>
        <div className={styles.paperHeading}>
          {date ? (
            <time className={styles.dateTile} dateTime={date.iso} aria-label={`${date.day} ${date.month} ${date.year}`} title={`${date.day} ${date.month} ${date.year}`}>
              <span>{date.month}</span><strong>{date.day}</strong>
            </time>
          ) : (
            <div className={styles.paperTile} aria-hidden="true"><FileText size={24} /></div>
          )}
          <div className={styles.testLineInfo}>
            <h3 className={styles.testLineTitle}>{contextualTitle(slot.title, meta.name, effectiveTier)}</h3>
            <div className={styles.testLineMeta}>
              <span>{totalQ} Q</span><span>{maxMarks} Marks</span><span>{metadata?.totalDurationMin ?? config?.totalDurationMin ?? 60} min</span>
              {!actionsLoading && completed && <span>Score: {state.score}/{state.maxScore}</span>}
            </div>
          </div>
        </div>
        <div className={styles.paperFooter} aria-busy={actionsLoading}>
          {actionsLoading ? <span className={styles.progressLoading} role="status">Loading progress…</span> : (
            <>
              <div className={styles.paperStatus}>
              <span className={`${styles.statusBadge} ${completed ? styles.badgeCompleted : inProgress ? styles.badgeProgress : locked ? styles.badgeLocked : styles.badgeNew}`}>
                <StatusIcon size={15} aria-hidden="true" />
                {completed ? 'Completed' : inProgress ? 'In progress' : locked ? 'Pro' : 'Not attempted'}
              </span>
              </div>
              <div className={styles.testLineAction}>
                {completed && slot.assessmentMode !== 'confidential' && (
                  <button type="button" data-ui-button="secondary" aria-label="Retake" className={`${styles.paperAction} ${styles.actionOutline}`} onClick={() => setInfoPaper(slot)}>
                    <span className={styles.actionFace}><RotateCcw size={14} aria-hidden="true" /><span>Retake</span></span>
                  </button>
                )}
                <button data-ui-button={locked ? 'secondary' : 'primary'} aria-label={actionLabel} className={`${styles.paperAction} ${locked ? styles.actionOutline : styles.actionFilled}`}
                  onClick={() => completed ? handleViewResult(slot.id, state.attemptId!) : inProgress ? handleResume(slot.id, state.attemptId!) : locked ? handleUnlock() : handleStart(slot.id)}>
                  <span className={styles.actionFace}><ActionIcon size={14} aria-hidden="true" /><span>{actionText}</span></span>
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <main className={`${styles.page} ${styles.loadedPage}`}>
      {infoPaper && <PaperInfoDialog key={`${examSlug}:${infoPaper.id}`} slot={infoPaper} canRestart={['in_progress', 'completed'].includes(getSlotState(infoPaper).status)} onClose={() => setInfoPaper(null)} />}
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
            <div className={styles.sidebarExamIcon}>{examLogo ? <Image src={examLogo} alt={`${meta.name} logo`} width={28} height={28} loading="eager" className={styles.examLogo} /> : meta.icon}</div>
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
              <span>Mock Tests{metadata && ` ${metadata.mockCount}`}</span>
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
              <span>Previous Papers{metadata && ` ${metadata.pyqCount}`}</span>
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
                    <BackButton href="/mock-test" className={styles.mobileBackBtn} label="Back to all exams" />
                    <div className={styles.headerIconBox}>{examLogo ? <Image src={examLogo} alt={`${meta.name} logo`} width={28} height={28} loading="eager" className={styles.examLogo} /> : meta.icon}</div>
                    <div className={styles.headerTextGroup}>
                      <div className={styles.headerTitleRow}>
                        <h1 className={styles.greeting}>{meta.name}</h1>
                      </div>
                      <p className={styles.desktopSubtitle}>{meta.subtitle}</p>
                    </div>
                  </div>

                  <div className={styles.headerControls}>
                    {activeTab === 'prev' && (
                      <div className={styles.tierDropdownWrap}>
                        <select
                          className={styles.tierDropdown}
                          value={effectiveYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          aria-label="Select year"
                        >
                          <option value="">Year</option>
                          {(metadata?.years || []).map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        <ChevronDown size={12} className={styles.dropdownChevron} />
                      </div>
                    )}
                    {/* Stage / Tier Dropdown */}
                    {activeTab !== 'overview' && (
                      <div className={styles.tierDropdownWrap}>
                        <select
                          className={styles.tierDropdown}
                          value={effectiveTier}
                          onChange={(e) => setSelectedTier(e.target.value)}
                          aria-label={`Select ${tierInfo.singular || 'Stage'}`}
                        >
                          {tiers.length === 0 && <option value="">Tier</option>}
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
                    aria-pressed={activeTab === 'mock'}
                    onClick={() => setActiveTab('mock')}
                  >
                    Mocks{metadata && ` ${metadata.mockCount}`}
                  </button>
                  <button data-ui-button="state"
                    className={`${styles.mobileTabBtn} ${activeTab === 'overview' ? styles.activeMobileTabBtn : ''}`}
                    aria-pressed={activeTab === 'overview'}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button data-ui-button="state"
                    className={`${styles.mobileTabBtn} ${activeTab === 'prev' ? styles.activeMobileTabBtn : ''}`}
                    aria-pressed={activeTab === 'prev'}
                    onClick={() => setActiveTab('prev')}
                  >
                    PYQs{metadata && ` ${metadata.pyqCount}`}
                  </button>
                </div>
              </header>

              {/* Content Body */}
              <div className={styles.contentBody} ref={contentRef}>
                {catalog.error && <div className={styles.placeholderTab} role="status"><p>Could not load papers.</p><button onClick={catalog.retry}>Try again</button></div>}
                {/* Tab 1: Mock Tests List */}
                {activeTab === 'mock' && (
                  isLoading ? <ExamLandingLoader /> : <div className={styles.testList}>
                    {!catalog.error && catalog.slots.length === 0 && <div className={styles.placeholderTab}><h3>No tests published yet</h3><p>Published papers will appear here when available.</p></div>}
                    {catalog.slots.map(renderPaperCard)}
                  </div>
                )}

                {/* Tab 2: Overview */}
                {activeTab === 'overview' && (
                  <div className={styles.overviewTab}>
                    <div className={styles.statBoxGrid}>
                      <div className={styles.statBox}>
                        <Award size={24} className={styles.statBoxIcon} />
                        <div className={styles.statBoxNum}>{metadata?.mockCount ?? '—'}</div>
                        <div className={styles.statBoxLbl}>Total Mock Tests</div>
                      </div>
                      <div className={styles.statBox}>
                        <CheckCircle size={24} className={styles.statBoxIcon} />
                        <div className={styles.statBoxNum}>{metadata?.pyqCount ?? '—'}</div>
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
                    {!catalog.error && catalog.slots.length === 0 ? (
                      <div className={styles.placeholderTab}>
                        <div className={styles.placeholderIcon}>📚</div>
                        <h3>No Papers Found</h3>
                        <p>No papers match the selected filters.</p>
                      </div>
                    ) : (
                      catalog.slots.map(renderPaperCard)
                    )}
                  </div>
                )}
                {activeTab !== 'overview' && !isLoading && catalog.hasMore && (
                  <div ref={sentinelRef} className={styles.loadMore}>
                    <button data-ui-button="secondary" disabled={catalog.loadingMore} onClick={catalog.loadMore}>
                      {catalog.loadingMore ? 'Loading papers…' : 'Load more papers'}
                    </button>
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

