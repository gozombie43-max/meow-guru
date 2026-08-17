'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAttempt } from './api';
import { useAuth } from '@/context/AuthContext';
import styles from './ResultReport.module.css';

interface ResultReportProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

export default function ResultReport({ examSlug, testId, attemptId }: ResultReportProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getAttempt(attemptId, token)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load test results.');
        setLoading(false);
      });
  }, [attemptId, token]);

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
        <button className={styles.btnPrimary} onClick={() => router.push(`/mock-test/${examSlug}`)}>
          Back to Tests
        </button>
      </div>
    );
  }

  const result = data.result || {};
  const totalScore = result.totalScore !== undefined ? result.totalScore : (data.totalScore || 0);
  const maxScore = result.maxScore || data.maxScore || 100;
  const percentage = result.percentage !== undefined ? result.percentage : ((totalScore / maxScore) * 100);
  const percentile = result.percentile ?? 50;
  const sections = result.sections || data.sections || [];

  let scoreColorClass = styles.scoreRed;
  if (percentage >= 70) scoreColorClass = styles.scoreGreen;
  else if (percentage >= 40) scoreColorClass = styles.scoreYellow;

  const handleReview = () => {
    router.push(`/mock-test/${examSlug}/${testId}/review/${attemptId}`);
  };

  const handleRetake = () => {
    router.push(`/mock-test/${examSlug}/${testId}`);
  };

  const handleBack = () => {
    router.push(`/mock-test/${examSlug}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrap}>
        
        {/* Score Card Hero */}
        <div className={styles.scoreCard}>
          <div className={styles.scoreHeader}>Your Result Summary</div>
          <div className={`${styles.scoreNumber} ${scoreColorClass}`}>
            {totalScore} <span className={styles.scoreMax}>/ {maxScore}</span>
          </div>
          <div className={styles.scoreStats}>
            <div className={styles.statChip}>
              🎯 {percentage.toFixed(1)}% Score
            </div>
            <div className={styles.statChip}>
              ⚡ Better than {percentile.toFixed(0)}% of candidates
            </div>
          </div>
        </div>

        {/* Section-wise breakdown */}
        <div className={styles.sectionBreakdown}>
          <h2 className={styles.sectionTitle}>Section-wise Breakdown</h2>
          <div className={styles.barsWrap}>
            {sections.map((sec: any, idx: number) => {
              const total = sec.total || (sec.correct + sec.incorrect + sec.skipped) || 1;
              const pCorrect = ((sec.correct || 0) / total) * 100;
              const pIncorrect = ((sec.incorrect || 0) / total) * 100;
              const pSkipped = ((sec.skipped || 0) / total) * 100;

              return (
                <div key={idx} className={styles.barItem}>
                  <div className={styles.barHeader}>
                    <span className={styles.secName}>{sec.label || sec.key}</span>
                    <span className={styles.secScore}>
                      <strong>{sec.score}</strong> / {sec.maxScore} marks ({sec.accuracy || 0}% Acc)
                    </span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFillCorrect} style={{ width: `${pCorrect}%` }} title={`Correct: ${sec.correct}`} />
                    <div className={styles.barFillIncorrect} style={{ width: `${pIncorrect}%` }} title={`Incorrect: ${sec.incorrect}`} />
                    <div className={styles.barFillSkipped} style={{ width: `${pSkipped}%` }} title={`Skipped: ${sec.skipped}`} />
                  </div>
                  <div className={styles.barLegend}>
                    <span className={styles.legendCorrect}>● {sec.correct || 0} Correct</span>
                    <span className={styles.legendIncorrect}>● {sec.incorrect || 0} Incorrect</span>
                    <span className={styles.legendSkipped}>● {sec.skipped || 0} Skipped</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weak Areas */}
        {data.weakAreas && data.weakAreas.length > 0 && (
          <div className={styles.weakAreasSection}>
            <h2 className={styles.sectionTitle}>Focus Topics for Improvement</h2>
            <div className={styles.chipContainer}>
              {data.weakAreas.map((area: string, i: number) => (
                <a key={i} href={`/english/${area}`} className={styles.chip}>
                  {area.replace(/-/g, ' ')}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleReview}>Review Questions & Solutions</button>
          <button className={styles.btnOutline} onClick={handleRetake}>Retake Test</button>
          <button className={styles.btnOutline} onClick={handleBack}>All Tests</button>
        </div>

      </div>
    </div>
  );
}
