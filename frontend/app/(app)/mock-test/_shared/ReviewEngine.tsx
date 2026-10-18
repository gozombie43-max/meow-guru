'use client';

import { mockAnswerCorrect, mockAnswerIndex, isUnanswered } from '@meow/contracts/mock-answer';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ChevronLeft, ChevronRight, Grid2X2, X } from 'lucide-react';
import QuestionImage from '@/components/QuestionImage';
import RichContent from '@/components/RichContent';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useMemo,useState } from 'react';
import {
getAttempt,
type MockAnswer,
type MockAnswerKey,
type MockAttempt,
type MockQuestion,
type MockSection,
} from './api';
import styles from './ReviewEngine.module.css';
import type { QuizLanguage } from '@meow/contracts/exam-paper';
import ReviewQuestionNavigator, { type ReviewFilter } from './ReviewQuestionNavigator';

interface ReviewEngineProps {
  examSlug: string;
  testId: string;
  attemptId: string;
}

type FilterType = ReviewFilter;
type ReviewStatus = Exclude<FilterType, 'all'>;

interface QuestionAnalysis {
  question: MockQuestion;
  index: number;
  userAns: MockAnswer | undefined;
  correctAns: MockAnswerKey | undefined;
  status: ReviewStatus;
}

const EMPTY_SECTIONS: MockSection[] = [];
const EMPTY_QUESTIONS: MockQuestion[] = [];
const EMPTY_ANSWERS: Record<string, MockAnswer> = {};

export default function ReviewEngine({ examSlug, testId, attemptId }: ReviewEngineProps) {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const owner = user?.id;
  const ready = !authLoading && !!token && !!owner;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [attempt, setAttempt] = useState<MockAttempt | null>(null);
  const [pending, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState('');
  const scope = `${owner}:${attemptId}`;
  const loading = !ready || pending || loadedScope !== scope;
  const [error, setError] = useState<string | null>(null);

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [language, setLanguage] = useState<QuizLanguage>('en');
  const paletteRef = useRef<HTMLDialogElement>(null);
  const questionPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (questionPanelRef.current) questionPanelRef.current.scrollTop = 0;
  }, [currentQuestionIndex, currentSectionIndex, filter]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    getAttempt(attemptId, tokenRef.current!, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.assessmentMode === 'confidential') { setError('Answer review is disabled for this confidential assessment.'); setLoadedScope(scope); setLoading(false); return; }
        setError(null);
        setAttempt(res);
        setLanguage(res.language ?? 'en');
        setLoadedScope(scope);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load review:', err);
        setError('Failed to load attempt details.');
        setLoadedScope(scope);
        setLoading(false);
      });
    return () => controller.abort();
  }, [attemptId, owner, ready, scope]);

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
      const isSkipped = isUnanswered(userAns);
      const isCorrect = mockAnswerCorrect(q, userAns, correctAns);
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
        <button data-ui-button="primary" className={styles.btnPrimary} onClick={() => router.replace(`/mock-test/${examSlug}`)}>
          Back to Tests
        </button>
      </div>
    );
  }

  const currentItem = filteredAnalysis[currentQuestionIndex];
  const currentQ = currentItem?.question;
  const questionText = currentQ?.translations?.question[language] ?? currentQ?.question ?? currentQ?.text ?? '';
  const questionImage = currentQ?.questionImage || currentQ?.image;
  const solutionText = currentQ?.translations?.solution?.[language] ?? currentQ?.solution ?? '';

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
      <header data-ui-chrome="header" className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <button data-ui-button="icon" className={styles.backBtn} aria-label="Back to results"
              onClick={() => router.replace(`/mock-test/${examSlug}/${testId}/result/${attemptId}`)}>
              <ArrowLeft size={20} />
            </button>
            <div className={styles.examTitleWrap}>
              <h1 className={styles.examTitle}>{attempt.paper?.examName || 'Mock test'}</h1>
              <span className={styles.examSub}>Answer review</span>
            </div>
          </div>
          {attempt.paper?.schemaDriven && <div className={styles.languageSwitch} data-language={language} role="group" aria-label="Review language">
            <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>ENG</button>
            <button aria-pressed={language === 'bn'} onClick={() => setLanguage('bn')}>বাংলা</button>
          </div>}
        </div>
        <div className={styles.reviewControls}>
          <label>Section
            <select value={currentSectionIndex} onChange={event => selectSection(Number(event.target.value))}>
              {sections.map((section, index) => <option key={section.key || index} value={index}>{section.label || section.key || `Section ${index + 1}`}</option>)}
            </select>
          </label>
          <label>Show
            <select value={filter} onChange={event => selectFilter(event.target.value as FilterType)}>
              <option value="all">All ({questionAnalysis.length})</option>
              <option value="correct">Correct ({questionAnalysis.filter(item => item.status === 'correct').length})</option>
              <option value="incorrect">Wrong ({questionAnalysis.filter(item => item.status === 'incorrect').length})</option>
              <option value="skipped">Skipped ({questionAnalysis.filter(item => item.status === 'skipped').length})</option>
            </select>
          </label>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Review question navigator">
          <h2 className={styles.sidebarHeading}>Questions</h2>
          <ReviewQuestionNavigator questions={questionAnalysis} filteredQuestions={filteredAnalysis}
            filter={filter} selectedIndex={currentQuestionIndex} onFilter={selectFilter} onSelect={setCurrentQuestionIndex} />
        </aside>

        {/* Center: Question Details & Solution */}
        <main className={styles.questionPanel} ref={questionPanelRef} aria-label="Question and solution">
          {currentQ ? (
            <div className={styles.questionCard}>
              <div className={styles.questionMeta}>
                <span className={styles.qNumBadge} aria-live="polite">Question {currentItem.index + 1} of {questions.length}</span>
                <span className={`${styles.statusBadge} ${styles['status_' + currentItem.status]}`}>
                  {currentItem.status === 'correct' && `Correct (+${currentSection?.marking?.correct ?? 2} marks)`}
                  {currentItem.status === 'incorrect' && `Incorrect (-${currentSection?.marking?.incorrect ?? 0.5} marks)`}
                  {currentItem.status === 'skipped' && 'Skipped · 0 marks'}
                </span>
              </div>

              {/* Question Text */}
              <div className={styles.questionBody}>
                <div className={styles.questionText}>
                  <RichContent
                    text={questionText}
                    criticalImages
                    imageDimensions={{ width: currentQ.questionImageWidth, height: currentQ.questionImageHeight }}
                  />
                </div>
                {questionImage && !questionText.includes(questionImage) && (
                  <div className={styles.qImageWrap}>
                    <QuestionImage
                      src={questionImage}
                      alt="Question diagram"
                      width={currentQ.questionImageWidth}
                      height={currentQ.questionImageHeight}
                      critical
                    />
                  </div>
                )}
              </div>

              {currentQ.questionType === 'NAT' && <div className={styles.solutionBox}><p>Your answer: {String(currentItem.userAns ?? 'Not answered')}</p><p>Accepted answer: {currentItem.correctAns && typeof currentItem.correctAns === 'object' && !Array.isArray(currentItem.correctAns) ? `${currentItem.correctAns.min} to ${currentItem.correctAns.max}` : String(currentItem.correctAns ?? '')}</p></div>}
              {/* Options */}
              <div className={styles.optionsList}>
                {currentQ.options?.map((option, oIdx: number) => {
                  const opt = currentQ.translations?.options[language][oIdx] ?? (typeof option === 'string' ? option : option.text);
                  const letter = String.fromCharCode(65 + oIdx); // 'A', 'B', 'C', 'D'
                  const isUserPick = [currentItem.userAns].flat().some(value => mockAnswerIndex(value, currentQ.options, true) === oIdx);
                  const isCorrect = [currentItem.correctAns].flat().some(value => mockAnswerIndex(value, currentQ.options) === oIdx);
                  const optImage = (typeof option === 'object' && option?.image) || currentQ.optionImages?.[oIdx];

                  let optClass = styles.optionNormal;
                  if (isCorrect) optClass = styles.optionCorrect;
                  else if (isUserPick && !isCorrect) optClass = styles.optionUserWrong;

                  return (
                    <div key={oIdx} className={`${styles.optionItem} ${optClass}`}>
                      <span className={styles.optionLetter}>{letter}</span>
                      <div className={styles.optionText}>
                        <RichContent text={opt} as="span" />
                        {optImage && !opt.includes(optImage) && (
                          <div style={{ marginTop: '0.5rem', maxWidth: '240px' }}>
                            <QuestionImage src={optImage} alt={`Option ${letter} diagram`} enableZoom={false} isOption />
                          </div>
                        )}
                      </div>
                      {isCorrect && <span className={styles.correctLabel}>Correct answer</span>}
                      {isUserPick && !isCorrect && <span className={styles.userWrongLabel}>Your answer</span>}
                    </div>
                  );
                })}
              </div>

              {/* Solution / Explanation */}
              {(solutionText || currentQ.solutionImage) && (
                <div className={styles.solutionBox}>
                  <h3 className={styles.solutionHeading}>Explanation</h3>
                  {(solutionText) && (
                    <div className={styles.solutionText}>
                      <RichContent text={solutionText} />
                    </div>
                  )}
                  {currentQ.solutionImage && !solutionText.includes(currentQ.solutionImage) && (
                    <div className={styles.solImageWrap}>
                      <QuestionImage
                        src={currentQ.solutionImage}
                        alt="Detailed solution"
                        width={currentQ.solutionImageWidth}
                        height={currentQ.solutionImageHeight}
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className={styles.emptyQuestions}>
              <h2>No {filter === 'all' ? '' : filter} questions</h2>
              <p>{filter === 'all' ? 'This section has no questions to review.' : 'Try another status or review all questions in this section.'}</p>
              {filter !== 'all' && <button className={styles.navBtn} onClick={() => selectFilter('all')}>Show all questions</button>}
            </div>
          )}
        </main>
      </div>

      <footer className={styles.bottomNav} aria-label="Question navigation">
        <button className={styles.navBtn} onClick={handlePrev} disabled={!currentItem || currentQuestionIndex === 0}>
          <ChevronLeft size={18} />Previous
        </button>
        <button className={styles.questionJump} aria-haspopup="dialog" onClick={() => paletteRef.current?.showModal()}>
          <Grid2X2 size={17} />
          <span>Questions<small>{currentItem ? `${currentQuestionIndex + 1} / ${filteredAnalysis.length}` : '0 questions'}</small></span>
        </button>
        <button className={styles.navBtn} onClick={handleNext} disabled={!currentItem || currentQuestionIndex >= filteredAnalysis.length - 1}>
          Next<ChevronRight size={18} />
        </button>
      </footer>

      <dialog className={styles.paletteDialog} ref={paletteRef} aria-labelledby="review-palette-title" closedby="any">
        <div className={styles.sheetHeader}>
          <div><h2 id="review-palette-title">Jump to question</h2><p>{currentSection?.label || currentSection?.key}</p></div>
          <button className={styles.closeSheet} aria-label="Close question navigator" onClick={() => paletteRef.current?.close()}><X size={20} /></button>
        </div>
        <div className={styles.sheetContent}>
          <ReviewQuestionNavigator questions={questionAnalysis} filteredQuestions={filteredAnalysis}
            filter={filter} selectedIndex={currentQuestionIndex} onFilter={selectFilter}
            onSelect={index => { setCurrentQuestionIndex(index); paletteRef.current?.close(); }} />
        </div>
      </dialog>
    </div>
  );
}
