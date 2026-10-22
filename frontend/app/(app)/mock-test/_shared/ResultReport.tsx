'use client';

import { useAuth } from '@/context/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { getAttempt, getSlotDetails, type MockAttempt } from './api';
import type { MockTestSlot } from './exam-config';
import ResultReportView from './ResultReportView';
import styles from './ResultReport.module.css';
import PaperInfoDialog from './PaperInfoDialog';
import { paperDisplayTitle } from './paper-date';

interface ResultReportProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

function ResultState({ title, description, onBack, children, busy = false }: { title: string; description?: string; onBack: () => void; children?: ReactNode; busy?: boolean }) {
  return <main className={styles.container}>
    <div className={styles.contentWrap}>
      <header className={styles.header}><button type="button" data-ui-button="icon" className={styles.backButton} aria-label="Back to tests" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button><div><p className={styles.examLabel}>Assessment report</p><h1>Test result</h1></div></header>
      <section className={styles.stateCard} aria-busy={busy}>
        {busy ? <span className={styles.spinner} aria-hidden="true" /> : <ChartNoAxesColumnIncreasing size={32} aria-hidden="true" />}
        <h2 role={busy ? 'status' : undefined}>{title}</h2>
        {description && <p>{description}</p>}
        {children && <div className={styles.stateActions}>{children}</div>}
      </section>
    </div>
  </main>;
}

export default function ResultReport({ examSlug, testId, attemptId }: ResultReportProps) {
  const router = useAppNavigation();
  const { token, user, loading: authLoading } = useAuth();
  const owner = user?.id;
  const ready = !authLoading && !!token && !!owner;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const [data, setData] = useState<MockAttempt | null>(null);
  const [paperTitle, setPaperTitle] = useState<string | undefined>();
  const [pending, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState('');
  const scope = `${owner}:${attemptId}`;
  const loading = !ready || pending || loadedScope !== scope;
  const [error, setError] = useState<string | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const [retakeState, setRetakeState] = useState<{ scope: string; pending: boolean; error: string | null; slot: MockTestSlot | null } | null>(null);
  const retakeController = useRef<AbortController | null>(null);
  const currentRetake = retakeState?.scope === scope ? retakeState : null;
  const backToTests = () => router.back(`/mock-test/${examSlug}`);

  useEffect(() => () => { retakeController.current?.abort(); retakeController.current = null; }, [scope]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    Promise.all([
      getAttempt(attemptId, tokenRef.current!, controller.signal),
      getSlotDetails(testId, examSlug, controller.signal).catch(() => null),
    ])
      .then(([res, details]) => {
        if (controller.signal.aborted) return;
        setError(null);
        setData(res);
        setPaperTitle(details?.slot ? paperDisplayTitle(details.slot) : undefined);
        setLoadedScope(scope);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Failed to load test results.');
        setLoadedScope(scope);
        setLoading(false);
      });
    return () => controller.abort();
  }, [attemptId, examSlug, testId, owner, ready, scope, retryRevision]);

  async function prepareRetake() {
    if (!ready || !data || data.assessmentMode === 'confidential' || retakeController.current) return;
    const controller = new AbortController();
    retakeController.current = controller;
    setRetakeState({ scope, pending: true, error: null, slot: null });
    try {
      const { slot } = await getSlotDetails(testId, examSlug, controller.signal);
      if (controller.signal.aborted) return;
      if (slot.assessmentMode === 'confidential') throw new Error('Retakes are unavailable for this assessment.');
      setRetakeState({ scope, pending: false, error: null, slot });
    } catch (reason) {
      if (!controller.signal.aborted) setRetakeState({ scope, pending: false, error: reason instanceof Error ? reason.message : 'Could not prepare a retake. Please try again.', slot: null });
    } finally {
      if (retakeController.current === controller) retakeController.current = null;
    }
  }

  if (!authLoading && !ready) return (
    <ResultState title="Sign in to view your results" onBack={backToTests}>
      <button type="button" data-ui-button="primary" className={styles.btnPrimary} onClick={() => router.replace('/login')}>Sign in</button>
      <button type="button" data-ui-button="secondary" className={styles.btnOutline} onClick={backToTests}>All tests</button>
    </ResultState>
  );

  if (loading) {
    return <ResultState title="Loading results…" description="Preparing your score and section analysis." onBack={backToTests} busy />;
  }

  if (error || !data) {
    return (
      <ResultState title="Your result could not be loaded" description={error || 'No result data found.'} onBack={backToTests}>
        <button type="button" data-ui-button="primary" className={styles.btnPrimary} onClick={() => { setLoading(true); setError(null); setRetryRevision(value => value + 1); }}>Try again</button>
        <button type="button" data-ui-button="secondary" className={styles.btnOutline} onClick={backToTests}>All tests</button>
      </ResultState>
    );
  }

  return (
    <>
    <ResultReportView
      key={scope}
      data={data}
      paperTitle={paperTitle}
      onReview={sectionKey => {
        if (data.assessmentMode !== 'confidential') router.push(`/mock-test/${examSlug}/${testId}/review/${attemptId}${sectionKey ? `?section=${encodeURIComponent(sectionKey)}` : ''}`);
      }}
      onRetake={prepareRetake}
      retakePending={currentRetake?.pending}
      actionError={currentRetake?.error}
      onBack={backToTests}
    />
    {currentRetake?.slot && <PaperInfoDialog slot={currentRetake.slot} canRestart onClose={() => setRetakeState(null)} />}
    </>
  );
}
