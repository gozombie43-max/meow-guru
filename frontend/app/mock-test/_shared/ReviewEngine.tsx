'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getAttempt,
  type MockAnswer,
  type MockAttempt,
  type MockQuestion,
  type MockSection,
} from './api';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import styles from './ReviewEngine.module.css';

interface ReviewEngineProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

type FilterType = 'all' | 'correct' | 'incorrect' | 'skipped';
type ReviewStatus = Exclude<FilterType, 'all'>;

interface QuestionAnalysis {
  question: MockQuestion;
  index: number;
  userAns: MockAnswer | undefined;
  correctAns: MockAnswer | undefined;
  status: ReviewStatus;
}

const EMPTY_SECTIONS: MockSection[] = [];
const EMPTY_QUESTIONS: MockQuestion[] = [];
const EMPTY_ANSWERS: Record<string, MockAnswer> = {};

export default function ReviewEngine({ examSlug, testId, attemptId }: ReviewEngineProps) {
  const router = useRouter();
  const { token } = useAuth();

  const [attempt, setAttempt] = useState<MockAttempt | null>(null);
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

  const sections = attempt?.paper?.sections ?? EMPTY_SECTIONS;
  const currentSection = sections[currentSectionIndex];
  const questions = currentSection?.questions ?? EMPTY_QUESTIONS;
  const answers = attempt?.answers ?? EMPTY_ANSWERS;
  const answerKey = attempt?.answerKey ?? EMPTY_ANSWERS;

  // Classify each question in the current section
  const questionAnalysis = useMemo(() => {
    return questions.map((q: MockQuestion, index: number): QuestionAnalysis => {
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
    return questionAnalysis.filter((question) => question.status === filter);
  }, [questionAnalysis, filter]);

  const selectSection = (index: number) => {
    setCurrentSectionIndex(index);
    setCurrentQuestionIndex(0);
  };

  const selectFilter = (nextFilter: FilterType) => {
    setFilter(nextFilter);
    setCurrentQuestionIndex(0);
  };

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
          {sections.map((sec: MockSection, idx: number) => (
            <button
              key={sec.key || idx}
              className={`${styles.sectionTab} ${currentSectionIndex === idx ? styles.activeSectionTab : ''}`}
              onClick={() => selectSection(idx)}
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
                onClick={() => selectFilter('all')}
              >
                All Questions ({questionAnalysis.length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterCorrect} ${filter === 'correct' ? styles.activeFilter : ''}`}
                onClick={() => selectFilter('correct')}
              >
                <CheckCircle2 size={16} /> Correct ({questionAnalysis.filter((question) => question.status === 'correct').length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterIncorrect} ${filter === 'incorrect' ? styles.activeFilter : ''}`}
                onClick={() => selectFilter('incorrect')}
              >
                <XCircle size={16} /> Incorrect ({questionAnalysis.filter((question) => question.status === 'incorrect').length})
              </button>
              <button
                className={`${styles.filterBtn} ${styles.filterSkipped} ${filter === 'skipped' ? styles.activeFilter : ''}`}
                onClick={() => selectFilter('skipped')}
              >
                Skipped ({questionAnalysis.filter((question) => question.status === 'skipped').length})
              </button>
            </div>
          </div>

          <div className={styles.paletteSection}>
            <span className={styles.sidebarHeading}>Question Palette</span>
            <div className={styles.paletteGrid}>
              {filteredAnalysis.map((item: QuestionAnalysis, idx: number) => {
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
                <p className={styles.questionText}>{currentQ.question ?? currentQ.text}</p>
                {currentQ.questionImage && (
                  <div className={styles.qImageWrap}>
                    <Image
                      src={currentQ.questionImage}
                      alt="Question diagram"
                      width={800}
                      height={450}
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className={styles.optionsList}>
                {currentQ.options?.map((option, oIdx: number) => {
                  const opt = typeof option === 'string' ? option : option.text;
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
                      <Image
                        src={currentQ.solutionImage}
                        alt="Detailed solution"
                        width={800}
                        height={450}
                        unoptimized
                      />
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
