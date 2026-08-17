'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSlotById, getExamConfig, getTotalQuestions, type MockTestSlot } from './exam-config';
import { startTest, getSlotDetails } from './api';
import { useAuth } from '@/context/AuthContext';
import styles from './TestInstructions.module.css';

interface TestInstructionsProps {
  examSlug: string;
  testId: string;
}

export default function TestInstructions({ examSlug, testId }: TestInstructionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [slot, setSlot] = useState<MockTestSlot | null>(() => getSlotById(testId) || null);

  const resumeAttemptId = searchParams?.get('resume');
  const isResume = Boolean(resumeAttemptId);

  useEffect(() => {
    // If not found in static config, fetch from API
    if (!slot) {
      getSlotDetails(testId, examSlug)
        .then((res) => {
          if (res.slot) setSlot(res.slot);
        })
        .catch((err) => {
          console.warn('Failed to load dynamic slot:', err);
        });
    }
  }, [testId, examSlug, slot]);

  const config = slot ? getExamConfig(slot.configKey) : null;

  if (!slot || !config) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>Loading test instructions...</p>
        </div>
      </div>
    );
  }

  const totalQuestions = getTotalQuestions(slot.configKey);

  const handleStart = async () => {
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      if (isResume && resumeAttemptId) {
        router.push(`/mock-test/${examSlug}/${testId}/attempt?resume=${resumeAttemptId}`);
      } else {
        const res = await startTest(examSlug, testId, token);
        router.push(`/mock-test/${examSlug}/${testId}/attempt?resume=${res.attemptId}`);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to start test. Please check your network and login status.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>{config.name}</h1>
          <h2 className={styles.subtitle}>{slot.title}</h2>
          
          <div className={styles.metaInfo}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Duration</span>
              <span className={styles.metaValue}>{config.totalDurationMin} mins</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Questions</span>
              <span className={styles.metaValue}>{totalQuestions}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Timer Type</span>
              <span className={styles.metaValue}>{config.compositeTimer ? 'Full Test Timer' : 'Per-Section Timers'}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>Section Breakdown & Marking Scheme</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Section</th>
                <th>Questions</th>
                <th>Correct Mark</th>
                <th>Negative Mark</th>
                <th>Time Limit</th>
              </tr>
            </thead>
            <tbody>
              {config.sections.map((sec, idx) => (
                <tr key={idx}>
                  <td><strong>{sec.label}</strong></td>
                  <td>{sec.questionCount}</td>
                  <td className={styles.markCorrect}>+{sec.marking.correct}</td>
                  <td className={styles.markIncorrect}>-{sec.marking.incorrect}</td>
                  <td>{sec.timeLimitMin > 0 ? `${sec.timeLimitMin}m` : 'Shared'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>General Instructions</h3>
          <ul className={styles.rulesList}>
            <li>The clock will be set at the server. The countdown timer at the top right of screen will display the remaining time available for you to complete the examination.</li>
            {config.compositeTimer ? (
              <li>You can navigate freely between sections at any time during the {config.totalDurationMin} minutes.</li>
            ) : (
              <li><strong>Sectional Timing:</strong> Each section has a dedicated time limit. Once a section timer reaches 0:00, that section will be locked automatically.</li>
            )}
            <li>Your answers are automatically saved to the cloud every 20 seconds and whenever you switch sections.</li>
            <li>You can mark questions for review and return to them before final submission.</li>
            <li>Do not close or refresh the browser tab during the test.</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.startBtn} 
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? 'Preparing Test Paper...' : isResume ? 'Resume Test' : 'I am Ready — Start Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
