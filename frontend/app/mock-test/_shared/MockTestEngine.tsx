'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIsDesktop } from './useIsDesktop';
import { startTest, getAttempt, autosaveAttempt, submitAttempt } from './api';
import { useAuth } from '@/context/AuthContext';
import MathRenderer from '@/components/MathRenderer';
import styles from './MockTestEngine.module.css';
// import { getExamConfig, getSlotById } from './exam-config';

// Mock types until exam-config is provided
export type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';

export default function MockTestEngine({ examSlug, testId }: { examSlug: string; testId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth() as any;
  const isDesktop = useIsDesktop(1024);
  const resumeAttemptId = searchParams?.get('resume');

  const [paper, setPaper] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string>(resumeAttemptId || '');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({});
  const [sectionTimers, setSectionTimers] = useState<Record<string, number>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  
  const [globalTimeLeft, setGlobalTimeLeft] = useState<number>(0);
  
  const autosaveTimerRef = useRef<any>(null);

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
      let data;
      if (resumeAttemptId) {
        data = await getAttempt(resumeAttemptId, token);
      } else {
        data = await startTest(examSlug, testId, token);
        setAttemptId(data.attemptId);
      }
      // Assuming data returns paper structure and attempt state
      // This part will need mapping to actual API structure
      setPaper(data.paper || {
        sections: [
          {
            id: 's1',
            title: 'General Awareness',
            questions: [
              { id: 'q1', text: 'Sample Question 1?', options: [{id:'A', text:'Opt A'}, {id:'B', text:'Opt B'}, {id:'C', text:'Opt C'}, {id:'D', text:'Opt D'}] },
              { id: 'q2', text: 'Sample Math $x^2 + y^2 = r^2$?', options: [{id:'A', text:'Opt A'}, {id:'B', text:'Opt B'}, {id:'C', text:'Opt C'}, {id:'D', text:'Opt D'}] }
            ]
          }
        ]
      });
      setGlobalTimeLeft(data.timeLeft || 3600); // 1 hour default
      if (data.answers) setAnswers(data.answers);
      if (data.questionStatuses) setQuestionStatuses(data.questionStatuses);
    } catch (e) {
      console.error('Failed to load test', e);
    }
  }, [examSlug, testId, token, resumeAttemptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Autosave setup
  useEffect(() => {
    if (!attemptId || !token) return;
    autosaveTimerRef.current = setInterval(() => {
      autosaveAttempt(attemptId, { answers, questionStatuses, currentSection, currentQuestion }, token)
        .catch(console.error);
    }, 20000);
    return () => clearInterval(autosaveTimerRef.current);
  }, [attemptId, answers, questionStatuses, currentSection, currentQuestion, token]);

  // visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && attemptId && token) {
        autosaveAttempt(attemptId, { answers, questionStatuses, currentSection, currentQuestion }, token).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [attemptId, answers, questionStatuses, currentSection, currentQuestion, token]);

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

  // Main countdown timer
  useEffect(() => {
    if (globalTimeLeft <= 0 || !paper) {
      if (paper && globalTimeLeft <= 0 && !isSubmitting && !showSubmitModal) {
        handleFinalSubmit(); // auto submit at 0
      }
      return;
    }
    const timer = setInterval(() => {
      setGlobalTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [globalTimeLeft, paper, isSubmitting, showSubmitModal]);

  const handleFinalSubmit = async () => {
    if (isSubmitting || !attemptId || !token) return;
    setIsSubmitting(true);
    try {
      await autosaveAttempt(attemptId, { answers, questionStatuses, currentSection, currentQuestion }, token);
      await submitAttempt(attemptId, token);
      router.push(`/mock-test/${examSlug}/${testId}/result?attempt=${attemptId}`);
    } catch (e) {
      console.error(e);
      alert('Failed to submit. Please try again.');
      setIsSubmitting(false);
    }
  };

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

  if (!paper) return <div className={styles.container} style={{justifyContent: 'center', alignItems: 'center'}}>Loading...</div>;

  const currentSec = paper.sections[currentSection];
  const currentQ = currentSec.questions[currentQuestion];

  const totalQuestions = paper.sections.reduce((acc: number, sec: any) => acc + sec.questions.length, 0);
  const currentQGlobalIndex = paper.sections.slice(0, currentSection).reduce((acc: number, sec: any) => acc + sec.questions.length, 0) + currentQuestion + 1;

  const counts = { answered: 0, notAnswered: 0, marked: 0, answeredMarked: 0, notVisited: totalQuestions };
  Object.values(questionStatuses).forEach(s => {
    if (s === 'answered') { counts.answered++; counts.notVisited--; }
    else if (s === 'not_answered') { counts.notAnswered++; counts.notVisited--; }
    else if (s === 'marked') { counts.marked++; counts.notVisited--; }
    else if (s === 'answered_marked') { counts.answeredMarked++; counts.notVisited--; }
  });

  return (
    <div className={`${styles.container} theme-light`}>
      {/* Top Bar */}
      {isDesktop ? (
        <div className={styles.topBar}>
          <div className={styles.examName}>{examSlug.toUpperCase()}</div>
          <div className={styles.timer}>{formatTime(globalTimeLeft)}</div>
          <button className={styles.submitBtn} onClick={() => setShowSubmitModal(true)}>Submit Test</button>
        </div>
      ) : (
        <div className={styles.mobileHeader}>
          <div className={styles.examName} style={{fontSize: '1rem'}}>{examSlug.toUpperCase()}</div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <div className={styles.timer} style={{fontSize: '1rem'}}>{formatTime(globalTimeLeft)}</div>
            <button className={styles.mobilePill} onClick={() => setShowPalette(true)}>Q {currentQGlobalIndex}/{totalQuestions}</button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className={styles.mainLayout}>
        
        {/* Desktop Left Panel */}
        {isDesktop && (
          <div className={styles.leftPanel}>
            <div className={styles.tabs}>
              {paper.sections.map((sec: any, idx: number) => (
                <div key={sec.id} className={`${styles.tab} ${currentSection === idx ? styles.active : ''}`} onClick={() => setCurrentSection(idx)}>
                  {sec.title}
                </div>
              ))}
            </div>
            <div className={styles.questionGrid}>
              {paper.sections[currentSection].questions.map((q: any, idx: number) => {
                const status = questionStatuses[q.id];
                const isCurrent = currentQuestion === idx;
                return (
                  <div 
                    key={q.id} 
                    className={`${styles.qBubble} ${getStatusClass(status)} ${isCurrent ? styles.current : ''}`}
                    onClick={() => jumpToQuestion(currentSection, idx)}
                  >
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
              {paper.sections.map((sec: any, idx: number) => (
                <div key={sec.id} className={`${styles.mobileTab} ${currentSection === idx ? styles.active : ''}`} onClick={() => setCurrentSection(idx)}>
                  {sec.title}
                </div>
              ))}
            </div>
          )}

          <div className={styles.questionContent}>
            <div className={styles.qNumber}>Question {currentQuestion + 1}</div>
            <div className={styles.qText}>{renderMath(currentQ.text)}</div>
            {currentQ.image && <img src={currentQ.image} alt="Question figure" className={styles.qImage} />}
            
            <div className={styles.options}>
              {currentQ.options.map((opt: any) => {
                const isSelected = answers[currentQ.id] === opt.id;
                return (
                  <label key={opt.id} className={`${styles.optionLabel} ${isSelected ? styles.selected : ''}`}>
                    <input 
                      type="radio" 
                      name={`q-${currentQ.id}`} 
                      checked={isSelected}
                      onChange={() => handleSelectOption(currentQ.id, opt.id)}
                    />
                    <span>{renderMath(opt.text)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Desktop Actions */}
          {isDesktop && (
            <div className={styles.actionsBar}>
              <div className={styles.btnGroup}>
                <button className={styles.btnOutline} onClick={() => clearResponse(currentQ.id)}>Clear Response</button>
                <button className={styles.btnOutline} onClick={handleMarkForReview}>Mark for Review</button>
              </div>
              <button className={styles.btnPrimary} onClick={handleSaveAndNext}>Save & Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Actions */}
      {!isDesktop && (
        <div className={styles.mobileBottomBar}>
          <button className={styles.btnOutline} onClick={goToPreviousQuestion} disabled={currentQuestion === 0 && currentSection === 0}>Previous</button>
          <button className={styles.btnOutline} onClick={handleMarkForReview}>Mark</button>
          <button className={styles.btnPrimary} onClick={handleSaveAndNext}>Save & Next</button>
        </div>
      )}

      {/* Mobile Bottom Sheet Palette */}
      {!isDesktop && (
        <>
          <div className={`${styles.backdrop} ${showPalette ? styles.show : ''}`} onClick={() => setShowPalette(false)}></div>
          <div className={`${styles.bottomSheet} ${showPalette ? styles.show : ''}`}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
              <h3 style={{margin: 0}}>Questions Palette</h3>
              <button onClick={() => setShowPalette(false)} style={{background:'transparent', border:'none', fontSize:'1.25rem'}}>&times;</button>
            </div>
            <div className={styles.questionGrid}>
              {paper.sections[currentSection].questions.map((q: any, idx: number) => {
                const status = questionStatuses[q.id];
                const isCurrent = currentQuestion === idx;
                return (
                  <div 
                    key={q.id} 
                    className={`${styles.qBubble} ${getStatusClass(status)} ${isCurrent ? styles.current : ''}`}
                    onClick={() => jumpToQuestion(currentSection, idx)}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)'}}>
               <button className={styles.submitBtn} style={{width: '100%'}} onClick={() => {setShowPalette(false); setShowSubmitModal(true);}}>Submit Test</button>
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
              <button className={styles.btnOutline} onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleFinalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
