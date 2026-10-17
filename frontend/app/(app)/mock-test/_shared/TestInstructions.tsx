'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import BackButton from '@/components/BackButton';
import { ChevronDown } from 'lucide-react';
import { seedStartResponse, startResponseEpoch } from '@/lib/start-response-cache';
import { getMockStartKey } from './startKey';
import { getSlotDetails,startTest } from './api';
import { getExamConfig,getSlotById,getTotalQuestions,type MockTestSlot } from './exam-config';
import styles from './TestInstructions.module.css';
import { ApiError } from '@/shared/api/error';

interface TestInstructionsProps {
  examSlug: string;
  testId: string;
  resumeAttemptId?: string;
}

export default function TestInstructions({ examSlug, testId, resumeAttemptId }: TestInstructionsProps) {
  const router = useRouter();
  const { token, user } = useAuth();
  const starting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [language, setLanguage] = useState('en');
  const [loadedSlot, setLoadedSlot] = useState<{ key: string; slot: MockTestSlot } | null>(null);
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
          if (!controller.signal.aborted && res.slot) setLoadedSlot({ key: slotKey, slot: res.slot });
        })
        .catch((err) => {
          if (!controller.signal.aborted) console.warn('Failed to load dynamic slot:', err);
        });
    return () => controller.abort();
  }, [testId, examSlug, slotKey]);

  const config = slot?.paperMetadata ? { ...slot.paperMetadata, name: slot.paperMetadata.examName } : slot ? getExamConfig(slot.configKey) : null;

  if (!slot || !config) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>Loading test instructions...</p>
        </div>
      </div>
    );
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
        router.push(`/mock-test/${examSlug}/${testId}/attempt?resume=${resumeAttemptId}&lang=${language}`);
      } else {
        const res = await startTest(examSlug, testId, token, getMockStartKey(user?.id, examSlug, testId));
        seedStartResponse(`mock:${examSlug}:${testId}`, user?.id, res.attemptId, res, epoch);
        router.push(`/mock-test/${examSlug}/${testId}/attempt?resume=${res.attemptId}&lang=${language}`);
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
            {startError.signIn && <button data-ui-button="secondary" onClick={() => router.push('/login')}>Sign in again</button>}
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
