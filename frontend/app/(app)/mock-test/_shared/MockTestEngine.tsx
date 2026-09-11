'use client';
import { X } from "lucide-react";
import MathRenderer from '@/components/MathRenderer';
import { useAuth } from '@/context/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Image from 'next/image';
import { useRouter,useSearchParams } from 'next/navigation';
import { useCallback,useEffect,useEffectEvent,useRef,useState } from 'react';
import {
autosaveAttempt,
getAttempt,
startTest,
submitAttempt,
type MockAnswer,
type MockOption,
type MockPaper,
type MockQuestion,
type MockSection,
type QuestionStatus,
type AttemptProgress,
} from './api';
import styles from './MockTestEngine.module.css';
// import { getExamConfig, getSlotById } from './exam-config';

function normalizeOption(option: string | MockOption, index: number): MockOption {
  return typeof option === 'string' ? { id: String(index), text: option } : option;
}

export default function MockTestEngine({ examSlug, testId }: { examSlug: string; testId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const resumeAttemptId = searchParams?.get('resume');

  const [paper, setPaper] = useState<MockPaper | null>(null);
  const [attemptId, setAttemptId] = useState<string>(resumeAttemptId || '');
  const [answers, setAnswers] = useState<Record<string, MockAnswer>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  
  const [globalTimeLeft, setGlobalTimeLeft] = useState<number>(0);
  
  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRevisionRef = useRef(0);
  const deadlineRef = useRef(0);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const conflictRef = useRef(false);
  const autoSubmitAttemptedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confidential, setConfidential] = useState(false);

  useEffect(() => {
    // Add Google Font for space mono dynamically
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoadError(null);
      let data;
      if (resumeAttemptId) {
        data = await getAttempt(resumeAttemptId, token);
      } else {
        const storageKey = `mock-start:${examSlug}:${testId}`;
        let startKey = sessionStorage.getItem(storageKey);
        if (!startKey) { startKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, startKey); }
        data = await startTest(examSlug, testId, token, startKey);
        setAttemptId(data.attemptId);
      }
      if (data.status === 'completed') {
        sessionStorage.removeItem(`mock-start:${examSlug}:${testId}`);
        router.push(`/mock-test/${examSlug}/${testId}/result/${data.id || data.attemptId}`);
        return;
      }
      const nextPaper = data.paper;
      setConfidential(data.assessmentMode === 'confidential');
      if (!nextPaper?.sections?.length) throw new Error('Attempt did not include a valid paper');
      setPaper(nextPaper);
      const remaining = data.timeLeft ?? (nextPaper.totalDurationMin ?? 60) * 60;
      deadlineRef.current = Date.now() + remaining * 1000;
      setGlobalTimeLeft(remaining);
      if (data.answers) setAnswers(data.answers);
      if (data.questionStatuses) setQuestionStatuses(data.questionStatuses);
      setCurrentSection(data.currentSection ?? 0);
      setCurrentQuestion(data.currentQuestion ?? 0);
      saveRevisionRef.current = data.revision ?? 0;
      conflictRef.current = false;
      setHasConflict(false);
      autoSubmitAttemptedRef.current = false;
    } catch (e) {
      console.error('Failed to load test', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load test');
    }
  }, [examSlug, testId, token, resumeAttemptId]);

  const saveProgress = useCallback((progress: Omit<AttemptProgress, 'revision'>) => {
    const save = saveChainRef.current.catch(() => {}).then(async () => {
      if (conflictRef.current) throw new Error('Reload this attempt to resolve the save conflict.');
      const baseRevision = saveRevisionRef.current;
      setSaveStatus('Saving…');
      try {
        const result = await autosaveAttempt(attemptId, { ...progress, baseRevision, revision: baseRevision + 1 }, token!);
        saveRevisionRef.current = result.revision ?? baseRevision + 1;
        setSaveStatus('Progress saved');
      } catch (error) {
        if (error instanceof Error && 'conflict' in error && error.conflict) { conflictRef.current = true; setHasConflict(true); }
        setSaveStatus(error instanceof Error ? error.message : 'Progress could not be saved.');
        throw error;
      }
    });
    saveChainRef.current = save;
    return save;
  }, [attemptId, token]);

  useEffect(() => {
    // Fetching the attempt is the external synchronization boundary for this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the route-bound attempt must load immediately for timer and recovery correctness.
    void loadData();
  }, [loadData]);

  const saveLatestProgress = useEffectEvent(() => {
    if (!attemptId || !token || isSubmitting) return;
    void saveProgress({ answers, questionStatuses, currentSection, currentQuestion }).catch(console.error);
  });

  // Keep a stable interval while reading the latest committed answers.
  useEffect(() => {
    if (!attemptId || !token) return;
    autosaveTimerRef.current = setInterval(() => {
      saveLatestProgress();
    }, 20000);
    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [attemptId, token]);

  // visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveLatestProgress();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (globalTimeLeft > 0 && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [globalTimeLeft, isSubmitting]);

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting || !attemptId || !token) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      try {
        await saveProgress({ answers, questionStatuses, currentSection, currentQuestion });
      } catch (error) {
        // Expired attempts must still submit their last server-saved answers.
        // A retry after a lost submit response must also reach the idempotent endpoint.
        if (!(error instanceof Error && 'submissionAllowed' in error && error.submissionAllowed)) throw error;
      }
      await submitAttempt(attemptId, token);
      sessionStorage.removeItem(`mock-start:${examSlug}:${testId}`);
      router.push(`/mock-test/${examSlug}/${testId}/result/${attemptId}`);
    } catch (error) {
      console.error(error);
      setSubmitError('Submission failed. Your saved progress is retained. Please retry.');
      setIsSubmitting(false);
    }
  }, [
    answers,
    attemptId,
    currentQuestion,
    currentSection,
    examSlug,
    isSubmitting,
    questionStatuses,
    router,
    testId,
    token,
    saveProgress,
  ]);

  useEffect(() => {
    if (!paper) return;
    const timer = window.setInterval(() => {
      setGlobalTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paper]);

  useEffect(() => {
    if (!paper || globalTimeLeft > 0 || isSubmitting || autoSubmitAttemptedRef.current) return;
    autoSubmitAttemptedRef.current = true;
    // The exam timer reaching zero is an external event that must submit immediately.
    void handleFinalSubmit();
  }, [globalTimeLeft, handleFinalSubmit, isSubmitting, paper, showSubmitModal]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateStatus = (qId: string, status: QuestionStatus) => {
    setQuestionStatuses(prev => ({ ...prev, [qId]: status }));
  };

  const handleSelectOption = (qId: string, optId: string) => {
    setAnswers(prev => ({ ...prev, [qId]: optId }));
    // Just answering doesn't change status to 'answered' yet until 'Save & Next' according to common engine patterns, 
    // but we can mark it immediately if preferred. Let's wait for Save & Next for strict SSC/banking pattern.
  };

  const clearResponse = (qId: string) => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleSaveAndNext = () => {
    if (!paper) return;
    const qId = paper.sections[currentSection].questions[currentQuestion].id;
    if (answers[qId]) {
      updateStatus(qId, 'answered');
    } else {
      updateStatus(qId, 'not_answered');
    }
    goToNextQuestion();
  };

  const handleMarkForReview = () => {
    if (!paper) return;
    const qId = paper.sections[currentSection].questions[currentQuestion].id;
    if (answers[qId]) {
      updateStatus(qId, 'answered_marked');
    } else {
      updateStatus(qId, 'marked');
    }
    goToNextQuestion();
  };

  const goToNextQuestion = () => {
    if (!paper) return;
    const currentSec = paper.sections[currentSection];
    if (currentQuestion < currentSec.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentSection < paper.sections.length - 1) {
      setCurrentSection(currentSection + 1);
      setCurrentQuestion(0);
    } else {
      setShowSubmitModal(true);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const jumpToQuestion = (secIdx: number, qIdx: number) => {
    // mark current as not_answered if not answered
    if (paper) {
      const qId = paper.sections[currentSection].questions[currentQuestion].id;
      if (!questionStatuses[qId]) updateStatus(qId, 'not_answered');
    }
    setCurrentSection(secIdx);
    setCurrentQuestion(qIdx);
    setShowPalette(false);
  };

  const renderMath = (text: string) => {
    if (!text) return null;
    return <MathRenderer text={text} inline />;
  };

  const getStatusClass = (status?: QuestionStatus) => {
    switch (status) {
      case 'answered': return styles.answered;
      case 'marked': return styles.marked;
      case 'answered_marked': return styles.answeredMarked;
      case 'not_answered': return styles.notAnswered;
      default: return styles.notVisited;
    }
  };

  if (loadError) return <div className={styles.container}><p role="alert">{loadError}</p><button data-ui-button="state" onClick={() => void loadData()}>Retry loading test</button></div>;

  if (!paper) return <div className={styles.container} style={{justifyContent: 'center', alignItems: 'center'}}>Loading...</div>;

  const currentSec = paper.sections[currentSection];
  const currentQ = currentSec.questions[currentQuestion];

  const totalQuestions = paper.sections.reduce((acc: number, sec: MockSection) => acc + sec.questions.length, 0);
  const currentQGlobalIndex = paper.sections.slice(0, currentSection).reduce((acc: number, sec: MockSection) => acc + sec.questions.length, 0) + currentQuestion + 1;

  const counts = { answered: 0, notAnswered: 0, marked: 0, answeredMarked: 0, notVisited: totalQuestions };
  Object.values(questionStatuses).forEach(s => {
    if (s === 'answered') { counts.answered++; counts.notVisited--; }
    else if (s === 'not_answered') { counts.notAnswered++; counts.notVisited--; }
    else if (s === 'marked') { counts.marked++; counts.notVisited--; }
    else if (s === 'answered_marked') { counts.answeredMarked++; counts.notVisited--; }
  });

  return (
    <div className={`${styles.container} theme-light`}>
      {confidential && <div role="note" style={{ padding: '8px 16px', fontSize: 12 }}>Confidential assessment · One attempt · Total exam time applies · No answer review</div>}
      {saveStatus && <div role="status">{saveStatus}{hasConflict && <button data-ui-button="state" onClick={() => window.location.reload()}>Reload saved attempt</button>}</div>}
      {submitError && <div role="alert">{submitError}<button data-ui-button="state" disabled={isSubmitting} onClick={() => void handleFinalSubmit()}>Retry submission</button></div>}
      {/* Top Bar */}
      {isDesktop ? (
        <div data-ui-chrome="header" className={styles.topBar}>
          <div className={styles.examName}>{examSlug.toUpperCase()}</div>
          <div className={styles.timer}>{formatTime(globalTimeLeft)}</div>
          <button data-ui-button="primary" className={styles.submitBtn} onClick={() => setShowSubmitModal(true)}>Submit Test</button>
        </div>
      ) : (
        <div data-ui-chrome="header" className={styles.mobileHeader}>
          <div className={styles.examName} style={{fontSize: '1rem'}}>{examSlug.toUpperCase()}</div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <div className={styles.timer} style={{fontSize: '1rem'}}>{formatTime(globalTimeLeft)}</div>
            <button data-ui-button="state" className={styles.mobilePill} onClick={() => setShowPalette(true)}>Q {currentQGlobalIndex}/{totalQuestions}</button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className={styles.mainLayout}>
        
        {/* Desktop Left Panel */}
        {isDesktop && (
          <div className={styles.leftPanel}>
            <div className={styles.tabs}>
              {paper.sections.map((sec: MockSection, idx: number) => (
                <div key={sec.id ?? sec.key ?? idx} className={`${styles.tab} ${currentSection === idx ? styles.active : ''}`} onClick={() => setCurrentSection(idx)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                  {sec.title ?? sec.label}
                </div>
              ))}
            </div>
            <div className={styles.questionGrid}>
              {paper.sections[currentSection].questions.map((q: MockQuestion, idx: number) => {
                const status = questionStatuses[q.id];
                const isCurrent = currentQuestion === idx;
                return (
                  <div 
                    key={q.id} 
                    className={`${styles.qBubble} ${getStatusClass(status)} ${isCurrent ? styles.current : ''}`}
                    onClick={() => jumpToQuestion(currentSection, idx)}
                   role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <div className={styles.legend}>
              <div className={styles.legendItem}><div className={`${styles.legendCircle} ${styles.answered}`}></div> Answered ({counts.answered})</div>
              <div className={styles.legendItem}><div className={`${styles.legendCircle} ${styles.marked}`}></div> Marked for Review ({counts.marked})</div>
              <div className={styles.legendItem}><div className={`${styles.legendCircle} ${styles.answeredMarked}`}></div> Answered & Marked ({counts.answeredMarked})</div>
              <div className={styles.legendItem}><div className={`${styles.legendCircle} ${styles.notAnswered}`}></div> Not Answered ({counts.notAnswered})</div>
              <div className={styles.legendItem}><div className={`${styles.legendCircle} ${styles.notVisited}`} style={{border: '1px solid #cbd5e1'}}></div> Not Visited ({counts.notVisited})</div>
            </div>
          </div>
        )}

        {/* Right / Main Panel */}
        <div className={`${styles.rightPanel} ${!isDesktop ? styles.mobileMain : ''}`}>
          
          {!isDesktop && (
            <div className={styles.mobileSectionControl}>
              {paper.sections.map((sec: MockSection, idx: number) => (
                <div key={sec.id ?? sec.key ?? idx} className={`${styles.mobileTab} ${currentSection === idx ? styles.active : ''}`} onClick={() => setCurrentSection(idx)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                  {sec.title ?? sec.label}
                </div>
              ))}
            </div>
          )}

          <div className={styles.questionContent}>
            <div className={styles.qNumber}>Question {currentQuestion + 1}</div>
            <div className={styles.qText}>{renderMath(currentQ.text ?? currentQ.question ?? '')}</div>
            {currentQ.image && (
              <Image
                src={currentQ.image}
                alt="Question figure"
                className={styles.qImage}
                width={800}
                height={450}
                unoptimized
              />
            )}
            
            <div className={styles.options}>
              {(currentQ.options ?? []).map((rawOption, optionIndex) => {
                const opt = normalizeOption(rawOption, optionIndex);
                const isSelected = answers[currentQ.id] === opt.id;
                return (
                  <label key={opt.id} className={`${styles.optionLabel} ${isSelected ? styles.selected : ''}`}>
                    <input 
                      type="radio" 
                      name={`q-${currentQ.id}`} 
                      checked={isSelected}
                      onChange={() => handleSelectOption(currentQ.id, opt.id)}
                      aria-label={`Answer ${opt.text}`}
                    />
                    <span>{renderMath(opt.text)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Desktop Actions */}
          {isDesktop && (
            <div data-ui-chrome="footer" className={styles.actionsBar}>
              <div className={styles.btnGroup}>
                <button data-ui-button="secondary" className={styles.btnOutline} onClick={() => clearResponse(currentQ.id)}>Clear Response</button>
                <button data-ui-button="secondary" className={styles.btnOutline} onClick={handleMarkForReview}>Mark for Review</button>
              </div>
              <button data-ui-button="primary" className={styles.btnPrimary} onClick={handleSaveAndNext}>Save & Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Actions */}
      {!isDesktop && (
        <div data-ui-chrome="footer" className={styles.mobileBottomBar}>
          <button data-ui-button="secondary" className={styles.btnOutline} onClick={goToPreviousQuestion} disabled={currentQuestion === 0 && currentSection === 0}>Previous</button>
          <button data-ui-button="secondary" className={styles.btnOutline} onClick={handleMarkForReview}>Mark</button>
          <button data-ui-button="primary" className={styles.btnPrimary} onClick={handleSaveAndNext}>Save & Next</button>
        </div>
      )}

      {/* Mobile Bottom Sheet Palette */}
      {!isDesktop && (
        <>
          <button type="button" className={`${styles.backdrop} ${showPalette ? styles.show : ''}`} onClick={() => setShowPalette(false)} aria-label="Close question palette" />
          <div className={`${styles.bottomSheet} ${showPalette ? styles.show : ''}`}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
              <h3 style={{margin: 0}}>Questions Palette</h3>
              <button data-ui-button="state" data-ui-shape="icon" aria-label="Close" onClick={() => setShowPalette(false)} style={{background:'transparent', border:'none', fontSize:'1.25rem'}}><X aria-hidden="true" /></button>
            </div>
            <div className={styles.questionGrid}>
              {paper.sections[currentSection].questions.map((q: MockQuestion, idx: number) => {
                const status = questionStatuses[q.id];
                const isCurrent = currentQuestion === idx;
                return (
                  <div 
                    key={q.id} 
                    className={`${styles.qBubble} ${getStatusClass(status)} ${isCurrent ? styles.current : ''}`}
                    onClick={() => jumpToQuestion(currentSection, idx)}
                   role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)'}}>
               <button data-ui-button="primary" className={styles.submitBtn} style={{width: '100%'}} onClick={() => {setShowPalette(false); setShowSubmitModal(true);}}>Submit Test</button>
            </div>
          </div>
        </>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Submit Test?</h2>
            <p><span>Answered:</span> <strong>{counts.answered}</strong></p>
            <p><span>Marked for Review:</span> <strong>{counts.marked}</strong></p>
            <p><span>Not Answered:</span> <strong>{counts.notAnswered}</strong></p>
            <p><span>Not Visited:</span> <strong>{counts.notVisited}</strong></p>
            <div className={styles.modalActions}>
              <button data-ui-button="secondary" className={styles.btnOutline} onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button data-ui-button="primary" className={styles.btnPrimary} onClick={handleFinalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
