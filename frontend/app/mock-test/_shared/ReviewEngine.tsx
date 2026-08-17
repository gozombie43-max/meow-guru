'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAttempt } from './api';
import { useAuth } from '@/context/AuthContext';
import { useIsDesktop } from './useIsDesktop';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import styles from './ReviewEngine.module.css';

interface ReviewEngineProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

type FilterType = 'all' | 'correct' | 'incorrect' | 'skipped';

export default function ReviewEngine({ examSlug, testId, attemptId }: ReviewEngineProps) {
  const router = useRouter();
  const { token } = useAuth();
  const isDesktop = useIsDesktop(1024);

  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (!token) return;
    getAttempt(attemptId, token)
      .then((res) => {
        setAttempt(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load review:', err);
        setError('Failed to load attempt details.');
        setLoading(false);
      });
  }, [attemptId, token]);

  const sections = attempt?.paper?.sections || [];
  const currentSection = sections[currentSectionIndex];
  const questions = currentSection?.questions || [];
  const answers = attempt?.answers || {};
  const answerKey = attempt?.answerKey || {};

  // Classify each question in the current section
  const questionAnalysis = useMemo(() => {
    return questions.map((q: any, index: number) => {
      const userAns = answers[q.id];
      const correctAns = answerKey[q.id];
      const isSkipped = !userAns || userAns === '';
      const isCorrect = !isSkipped && String(userAns) === String(correctAns);
      const isIncorrect = !isSkipped && !isCorrect;

      return {
        question: q,
        index,
        userAns,
        correctAns,
        status: isCorrect ? 'correct' : isIncorrect ? 'incorrect' : 'skipped',
      };
    });
  }, [questions, answers, answerKey]);

  // Filtered question indices
  const filteredAnalysis = useMemo(() => {
    if (filter === 'all') return questionAnalysis;
    return questionAnalysis.filter((q: any) => q.status === filter);
  }, [questionAnalysis, filter]);

  // Keep question index in bounds when switching filters/sections
  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [currentSectionIndex, filter]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading solutions and review...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className={styles.loadingContainer}>
        <p>{error || 'Attempt not found.'}</p>
        <button className={styles.btnPrimary} onClick={() => router.push(`/mock-test/${examSlug}`)}>
          Back to Tests
        </button>
      </div>
    );
  }

  const currentItem = filteredAnalysis[currentQuestionIndex] || questionAnalysis[0];
  const currentQ = currentItem?.question;

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < filteredAnalysis.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  return (
    <div className={styles.page}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => router.push(`/mock-test/${examSlug}/${testId}/result/${attemptId}`)}
          >
            <ArrowLeft size={18} />
            <span>Results</span>
          </button>
          <div className={styles.examTitleWrap}>
            <h1 className={styles.examTitle}>{attempt?.paper?.examName || 'Mock Test Review'}</h1>
            <span className={styles.examSub}>Solution & Analysis Mode</span>
          </div>
        </div>

        {/* Section Tabs in Header */}
        <div className={styles.sectionTabs}>
          {sections.map((sec: any, idx: number) => (
            <button
              key={sec.key || idx}
              className={`${styles.sectionTab} ${currentSectionIndex === idx ? styles.activeSectionTab : ''}`}
              onClick={() => setCurrentSectionIndex(idx)}
            >
              {sec.label || sec.key}
            </button>
          ))}
        </div>
      </header>

      {/* Main Layout */}
      <div className={styles.layout}>
        {/* Left Side: Filter Chips & Palette on Desktop */}
        <aside className={styles.sidebar}>
          <div className={styles.filterSection}>
            <span className={styles.sidebarHeading}>Filter by Status</span>
            <div className={styles.filterList}>
              <button
                className={`${styles.filterBtn} ${filter === 'all' ? styles.activeFilter : ''}`}
                onClick={() => setFilter('all')}
              >
                All Questions ({questionAnalysis.length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterCorrect} ${filter === 'correct' ? styles.activeFilter : ''}`}
                onClick={() => setFilter('correct')}
              >
                <CheckCircle2 size={16} /> Correct ({questionAnalysis.filter((q: any) => q.status === 'correct').length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterIncorrect} ${filter === 'incorrect' ? styles.activeFilter : ''}`}
                onClick={() => setFilter('incorrect')}
              >
                <XCircle size={16} /> Incorrect ({questionAnalysis.filter((q: any) => q.status === 'incorrect').length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterSkipped} ${filter === 'skipped' ? styles.activeFilter : ''}`}
                onClick={() => setFilter('skipped')}
              >
                Skipped ({questionAnalysis.filter((q: any) => q.status === 'skipped').length})
              </button>
            </div>
          </div>

          <div className={styles.paletteSection}>
            <span className={styles.sidebarHeading}>Question Palette</span>
            <div className={styles.paletteGrid}>
              {filteredAnalysis.map((item: any, idx: number) => {
                let statusClass = styles.itemSkipped;
                if (item.status === 'correct') statusClass = styles.itemCorrect;
                if (item.status === 'incorrect') statusClass = styles.itemIncorrect;
                const isSelected = idx === currentQuestionIndex;

                return (
                  <button
                    key={item.question.id || idx}
                    className={`${styles.paletteBtn} ${statusClass} ${isSelected ? styles.selectedPaletteBtn : ''}`}
                    onClick={() => setCurrentQuestionIndex(idx)}
                  >
                    {item.index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center: Question Details & Solution */}
        <main className={styles.questionPanel}>
          {currentQ ? (
            <div className={styles.questionCard}>
              <div className={styles.questionMeta}>
                <span className={styles.qNumBadge}>Question {currentItem.index + 1} of {questions.length}</span>
                <span className={`${styles.statusBadge} ${styles['status_' + currentItem.status]}`}>
                  {currentItem.status === 'correct' && '✅ Correct (+2 marks)'}
                  {currentItem.status === 'incorrect' && '❌ Incorrect (-0.5 marks)'}
                  {currentItem.status === 'skipped' && '⚪ Skipped (0 marks)'}
                </span>
              </div>

              {/* Question Text */}
              <div className={styles.questionBody}>
                <p className={styles.questionText}>{currentQ.question}</p>
                {currentQ.questionImage && (
                  <div className={styles.qImageWrap}>
                    <img src={currentQ.questionImage} alt="Question diagram" />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className={styles.optionsList}>
                {currentQ.options?.map((opt: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx); // 'A', 'B', 'C', 'D'
                  const isUserPick = String(currentItem.userAns) === String(letter) || String(currentItem.userAns) === String(oIdx) || currentItem.userAns === opt;
                  const isCorrect = String(currentItem.correctAns) === String(letter) || String(currentItem.correctAns) === String(oIdx) || currentItem.correctAns === opt;

                  let optClass = styles.optionNormal;
                  if (isCorrect) optClass = styles.optionCorrect;
                  else if (isUserPick && !isCorrect) optClass = styles.optionUserWrong;

                  return (
                    <div key={oIdx} className={`${styles.optionItem} ${optClass}`}>
                      <span className={styles.optionLetter}>{letter}</span>
                      <span className={styles.optionText}>{opt}</span>
                      {isCorrect && <span className={styles.correctLabel}>Correct Answer</span>}
                      {isUserPick && !isCorrect && <span className={styles.userWrongLabel}>Your Answer</span>}
                    </div>
                  );
                })}
              </div>

              {/* Solution / Explanation */}
              {(currentQ.solution || currentQ.solutionImage) && (
                <div className={styles.solutionBox}>
                  <h3 className={styles.solutionHeading}>💡 Solution & Explanation</h3>
                  {currentQ.solution && <p className={styles.solutionText}>{currentQ.solution}</p>}
                  {currentQ.solutionImage && (
                    <div className={styles.solImageWrap}>
                      <img src={currentQ.solutionImage} alt="Detailed solution" />
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Navigation */}
              <div className={styles.bottomNav}>
                <button
                  className={styles.navBtn}
                  onClick={handlePrev}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft size={18} /> Previous
                </button>
                <button
                  className={styles.navBtn}
                  onClick={handleNext}
                  disabled={currentQuestionIndex >= filteredAnalysis.length - 1}
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyQuestions}>
              No questions found for the selected filter &quot;{filter}&quot;.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
