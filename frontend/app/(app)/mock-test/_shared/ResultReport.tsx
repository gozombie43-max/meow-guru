'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { getAttempt, type MockAttempt } from './api';
import ResultReportView from './ResultReportView';
import styles from './ResultReport.module.css';

interface ResultReportProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

export default function ResultReport({ examSlug, testId, attemptId }: ResultReportProps) {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const owner = user?.id;
  const ready = !authLoading && !!token && !!owner;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const [data, setData] = useState<MockAttempt | null>(null);
  const [pending, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState('');
  const scope = `${owner}:${attemptId}`;
  const loading = !ready || pending || loadedScope !== scope;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    getAttempt(attemptId, tokenRef.current!, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setError(null);
        setData(res);
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
  }, [attemptId, owner, ready, scope]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading result report...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.loadingContainer}>
        <p>{error || 'No result data found.'}</p>
        <button data-ui-button="primary" className={styles.btnPrimary} onClick={() => router.replace(`/mock-test/${examSlug}`)}>
          Back to Tests
        </button>
      </div>
    );
  }

  return (
    <ResultReportView
      key={scope}
      data={data}
      onReview={() => router.push(`/mock-test/${examSlug}/${testId}/review/${attemptId}`)}
      onRetake={() => router.push(`/mock-test/${examSlug}/${testId}`)}
      onBack={() => router.replace(`/mock-test/${examSlug}`)}
    />
  );
}
