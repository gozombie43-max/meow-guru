'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useEffect,useRef,useState } from 'react';
import BackButton from '@/components/BackButton';
import { ChevronDown } from 'lucide-react';
import { seedStartResponse, startResponseEpoch } from '@/lib/start-response-cache';
import { getMockStartKey } from './startKey';
import { getSlotDetails,startTest } from './api';
import { getExamConfig,getSlotById,getTotalQuestions,type MockTestSlot } from './exam-config';
import styles from './TestInstructions.module.css';
import MockTestLoading from './MockTestLoading';
import { ApiError } from '@/shared/api/error';

interface TestInstructionsProps {
  examSlug: string;
  testId: string;
  resumeAttemptId?: string;
}

export default function TestInstructions({ examSlug, testId, resumeAttemptId }: TestInstructionsProps) {
  const router = useAppNavigation();
  const { token, user } = useAuth();
  const starting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [language, setLanguage] = useState('en');
  const [loadedSlot, setLoadedSlot] = useState<{ key: string; slot: MockTestSlot } | null>(null);
  const [slotError, setSlotError] = useState<{ key: string; message: string } | null>(null);
  const [loadVersion, retryLoad] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const slotKey = `${examSlug}:${testId}`;
  const slot = (loadedSlot?.key === slotKey ? loadedSlot.slot : null) ?? getSlotById(testId);

  const isResume = Boolean(resumeAttemptId);

  useEffect(() => {
    if (startError) errorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [startError]);

  useEffect(() => {
    // Uploaded papers can replace a static slot with their own sections and marks.
    const controller = new AbortController();
    getSlotDetails(testId, examSlug, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          if (!res.slot) throw new Error('This test is no longer available.');
          setLoadedSlot({ key: slotKey, slot: res.slot });
          setSlotError(null);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setSlotError({ key: slotKey, message: err instanceof Error ? err.message : 'Could not load test instructions.' });
        });
    return () => controller.abort();
  }, [testId, examSlug, slotKey, loadVersion]);

  const config = slot?.paperMetadata ? { ...slot.paperMetadata, name: slot.paperMetadata.examName } : slot ? getExamConfig(slot.configKey) : null;

  if (!slot || !config) {
    if (slotError?.key === slotKey || loadedSlot?.key === slotKey) return (
      <div className={styles.container}>
        <div className={styles.card}>
          <BackButton href={`/mock-test/${examSlug}`} label="Back to mock tests" />
          <p role="alert">{slotError?.key === slotKey ? slotError.message : 'This test has no valid instructions.'}</p>
          <button data-ui-button="primary" onClick={() => { setSlotError(null); retryLoad(value => value + 1); }}>Retry loading instructions</button>
        </div>
      </div>
    );
    return <MockTestLoading label="Loading test instructions…" />;
  }

  const totalQuestions = slot.paperMetadata ? config.sections.reduce((sum, section) => sum + section.questionCount, 0) : getTotalQuestions(slot.configKey);

  const handleStart = async () => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (starting.current) return;
    starting.current = true;
    setLoading(true);
    setStartError(null);
    const epoch = startResponseEpoch();
    try {
      if (isResume && resumeAttemptId) {
        router.replace(`/mock-test/${examSlug}/${testId}/attempt?resume=${resumeAttemptId}&lang=${language}`);
      } else {
        const res = await startTest(examSlug, testId, token, getMockStartKey(user?.id, examSlug, testId));
        if (!mounted.current) return;
        if (res.status === 'completed') {
          router.replace(`/mock-test/${examSlug}/${testId}/result/${res.attemptId}`);
          return;
        }
        seedStartResponse(`mock:${examSlug}:${testId}`, user?.id, res.attemptId, res, epoch);
        router.replace(`/mock-test/${examSlug}/${testId}/attempt?resume=${res.attemptId}&lang=${language}`);
      }
    } catch (error) {
      console.error(error);
      starting.current = false;
      setLoading(false);
      const signIn = error instanceof ApiError && error.status === 401;
      setStartError({ signIn, message: signIn ? 'Your session has expired. Sign in again to start this test.'
        : error instanceof Error ? error.message : 'Could not start this test. Please try again.' });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.topbar} data-ui-chrome="header">
          <BackButton href={`/mock-test/${examSlug}`} label="Back to mock tests" />
          <span>Test details</span>
          <div className={styles.languagePicker}>
            <select aria-label="Test language" value={language} onChange={event => setLanguage(event.target.value)} disabled={loading}>
              <option value="en">English</option>
              {!slot.paperMetadata && <option value="hi">हिन्दी</option>}
              <option value="bn">বাংলা</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
        </div>
        <div className={styles.header}>
          <h1 className={styles.title}>{config.name}</h1>
          <h2 className={styles.subtitle}>{slot.title}</h2>
          
          <div className={styles.metaInfo}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Duration</span>
              <span className={styles.metaValue}>{config.totalDurationMin ? `${config.totalDurationMin} mins` : 'No total time limit'}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Questions</span>
              <span className={styles.metaValue}>{totalQuestions}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Timer</span>
              <span className={styles.metaValue}>{config.compositeTimer ? config.totalDurationMin ? 'Full test' : 'Untimed' : 'Per section'}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>Sections <span>{config.sections.length}</span></h3>
          <ul className={styles.sectionList}>
              {config.sections.map((sec, idx) => (
                <li className={styles.sectionRow} key={idx}>
                  <div className={styles.sectionInfo}>
                    <strong>{sec.label}</strong>
                    <span>{sec.questionCount} questions{sec.timeLimitMin > 0 ? ` · ${sec.timeLimitMin} min` : ''}</span>
                  </div>
                  <div className={styles.marks}>
                    <span>+{sec.marking.correct} <small>correct</small></span>
                    <span>−{sec.marking.incorrect} <small>wrong</small></span>
                  </div>
                </li>
              ))}
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>Before you start</h3>
          <ul className={styles.rulesList}>
            {config.compositeTimer ? (
              <li>{config.totalDurationMin ? 'One timer. Switch sections anytime.' : 'No time limit. Switch sections anytime.'}</li>
            ) : (
              <li>Each section locks when its timer ends.</li>
            )}
            <li>Answers save automatically. Flag questions to review.</li>
            <li>Refresh to resume saved progress. Timed sections continue while you are away.</li>
          </ul>
        </div>

          {startError && <div ref={errorRef} id="mock-start-error" className={styles.startError} role="alert">
            <p>{startError.message}</p>
            {startError.signIn && <Link data-ui-button="secondary" href="/login">Sign in again</Link>}
          </div>}
        <div className={styles.footer} data-ui-chrome="footer">
          <button data-ui-button="primary"
            className={styles.startBtn} 
            onClick={handleStart}
            disabled={loading}
            aria-describedby={startError ? 'mock-start-error' : undefined}
          >
            {loading ? 'Preparing…' : startError && !startError.signIn ? 'Retry Start Mock Test' : isResume ? 'Resume Mock Test' : 'Start Mock Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
