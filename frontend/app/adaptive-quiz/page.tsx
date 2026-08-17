'use client';

import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import axios from '@/lib/axios';
import MathRenderer from '@/components/MathRenderer';
import RouteLoadingState from '@/components/RouteLoadingState';
import { useThemeMode } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { announceFeedback } from '@/lib/feedback';
import { SUBJECT_TOPICS as FALLBACK_SUBJECT_TOPICS } from '@/lib/subjectTopics';

// --- Types & Constants ---
type QuizMode = 'adaptive' | 'weak-only' | 'revision' | 'explore';
type Phase = 'config' | 'briefing' | 'quiz' | 'results';

interface Question {
  id: string;
  question?: string;
  options?: string[];
  subject?: string;
  topic?: string;
  difficulty?: string;
  _adaptiveReason?: string;
}

interface Answer {
  questionId: string;
  userAnswer: string;
  timeSpent: number;
  changedAnswer?: boolean;
}

interface Result {
  questionId: string;
  topic: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  solution?: string;
}

interface QuizState {
  phase: Phase;
  loading: boolean;
  error: string;
  // Config state
  subjects: string[];
  qCount: number;
  mode: QuizMode;
  excludeOwn: boolean;
  topicsSelected: string[];
  availableTopics: Record<string, any[]>;
  modalSubject: string | null;
  // Quiz state
  quizId: string;
  questions: Question[];
  meta: any;
  currentIdx: number;
  answers: Record<string, Answer>;
  selected: string | null;
  firstAnswer: string | null;
  questionStartTime: number;
  elapsed: number;
  // Results
  results: Result[];
}

const initialState: QuizState = {
  phase: 'config',
  loading: false,
  error: '',
  subjects: [],
  qCount: 15,
  mode: 'adaptive',
  excludeOwn: false,
  topicsSelected: [],
  availableTopics: FALLBACK_SUBJECT_TOPICS as any,
  modalSubject: null,
  quizId: '',
  questions: [],
  meta: null,
  currentIdx: 0,
  answers: {},
  selected: null,
  firstAnswer: null,
  questionStartTime: Date.now(),
  elapsed: 0,
  results: [],
};

type Action = 
  | { type: 'SET_PHASE'; payload: Phase }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'UPDATE_CONFIG'; payload: Partial<QuizState> }
  | { type: 'SET_AVAILABLE_TOPICS'; payload: Record<string, any[]> }
  | { type: 'SET_MODAL_SUBJECT'; payload: string | null }
  | { type: 'START_QUIZ'; payload: { quizId: string, questions: Question[], meta: any } }
  | { type: 'SELECT_ANSWER'; payload: string }
  | { type: 'CONFIRM_ANSWER'; payload: { answer: Answer } }
  | { type: 'TICK_TIMER' }
  | { type: 'FINISH_QUIZ'; payload: Result[] }
  | { type: 'RESET' };

function quizReducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case 'SET_PHASE': return { ...state, phase: action.payload, error: '' };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload, loading: false };
    case 'UPDATE_CONFIG': return { ...state, ...action.payload };
    case 'SET_AVAILABLE_TOPICS': return { ...state, availableTopics: action.payload };
    case 'SET_MODAL_SUBJECT': return { ...state, modalSubject: action.payload };
    case 'START_QUIZ':
      return { 
        ...state, 
        phase: 'briefing', 
        quizId: action.payload.quizId, 
        questions: action.payload.questions, 
        meta: action.payload.meta,
        currentIdx: 0,
        answers: {},
        elapsed: 0,
        loading: false,
        results: [],
        error: '',
      };
    case 'SELECT_ANSWER':
      return { 
        ...state, 
        selected: action.payload, 
        firstAnswer: state.firstAnswer || action.payload 
      };
    case 'CONFIRM_ANSWER': {
      const isLast = state.currentIdx === state.questions.length - 1;
      return {
        ...state,
        answers: { ...state.answers, [action.payload.answer.questionId]: action.payload.answer },
        currentIdx: isLast ? state.currentIdx : state.currentIdx + 1,
        selected: null,
        firstAnswer: null,
        questionStartTime: Date.now()
      };
    }
    case 'TICK_TIMER': return { ...state, elapsed: state.elapsed + 1 };
    case 'FINISH_QUIZ': return { ...state, phase: 'results', results: action.payload, loading: false, error: '' };
    case 'RESET': return { ...initialState, mode: state.mode, qCount: state.qCount, availableTopics: state.availableTopics };
    default: return state;
  }
}

// Data
const SUBJECT_OPTIONS = [
  { name: 'Reasoning', icon: '⚡', meta: 'Logic, patterns, and critical thinking', accent: 'linear-gradient(135deg, rgba(83, 74, 183, 0.20), rgba(83, 74, 183, 0.08))' },
  { name: 'Mathematics', icon: '📐', meta: 'Algebra, geometry, and calculations', accent: 'linear-gradient(135deg, rgba(24, 95, 165, 0.18), rgba(24, 95, 165, 0.08))' },
  { name: 'English', icon: '📖', meta: 'Grammar, vocabulary, and comprehension', accent: 'linear-gradient(135deg, rgba(15, 110, 86, 0.18), rgba(15, 110, 86, 0.08))' },
  { name: 'General Awareness', icon: '🌍', meta: 'Current affairs, static GK, and facts', accent: 'linear-gradient(135deg, rgba(133, 79, 11, 0.18), rgba(133, 79, 11, 0.08))' },
];

const QUESTION_COUNT_OPTIONS = [10, 15, 25];
const MODE_OPTIONS: Array<{ value: QuizMode; label: string; accent: string }> = [
  { value: 'adaptive', label: 'Adaptive', accent: '#534ab7' },
  { value: 'weak-only', label: 'Weak Topics', accent: '#ff4b6e' },
  { value: 'revision', label: 'Revision', accent: '#00e5c8' },
  { value: 'explore', label: 'Explore', accent: '#ffc94d' },
];

const formatTime = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Main Engine Component ---
export default function AdaptiveQuizEngine() {
  const { theme } = useThemeMode();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubmittingRef = useRef(false);
  const userId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('userId') || 'demo-user' : 'demo-user');

  // Fetch Topics on Mount
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const { data } = await axios.get(`/api/adaptive-quiz/topics?userId=${encodeURIComponent(userId)}`);
        if (canceled) return;
        dispatch({ type: 'SET_AVAILABLE_TOPICS', payload: data.subjects || {} });
      } catch (err: unknown) {
        console.warn('Failed to fetch topics, using fallback');
        if (!canceled) dispatch({ type: 'SET_AVAILABLE_TOPICS', payload: FALLBACK_SUBJECT_TOPICS as any });
      }
    })();
    return () => { canceled = true; };
  }, [userId]);

  // Timer Logic
  useEffect(() => {
    if (state.phase === 'quiz') {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
      dispatch({ type: 'UPDATE_CONFIG', payload: { questionStartTime: Date.now() } });
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase]);

  // Actions
  const handleGenerate = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await axios.post('/api/adaptive-quiz/generate', {
        userId, subjects: state.subjects, questionCount: state.qCount,
        mode: state.mode, excludeOwn: state.excludeOwn, topics: state.topicsSelected
      });
      dispatch({ type: 'START_QUIZ', payload: { quizId: data.quizId, questions: data.questions, meta: data.meta } });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || 'Failed to generate quiz.' });
    }
  };

  const handleConfirm = () => {
    const q = state.questions[state.currentIdx];
    if (!state.selected || !q) return;
    const timeSpent = Math.round((Date.now() - state.questionStartTime) / 1000);
    dispatch({
      type: 'CONFIRM_ANSWER',
      payload: { answer: { questionId: q.id, userAnswer: state.selected, timeSpent, changedAnswer: state.firstAnswer !== state.selected } }
    });
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });

    try {
      const answersArray = Object.values(state.answers);
      const { data } = await axios.post('/api/adaptive-quiz/submit', {
        quizId: state.quizId,
        userId,
        answers: answersArray,
      });
      dispatch({ type: 'FINISH_QUIZ', payload: data.results || [] });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Submission failed. Please retry.';
      dispatch({ type: 'SET_ERROR', payload: errMsg });
    } finally {
      isSubmittingRef.current = false;
    }
  }, [state.quizId, userId, state.answers]);

  // Check if we need to submit after the last question
  useEffect(() => {
    if (
      state.phase === 'quiz' &&
      !state.loading &&
      state.questions.length > 0 &&
      Object.keys(state.answers).length === state.questions.length &&
      state.results.length === 0
    ) {
      handleSubmit();
    }
  }, [state.answers, state.phase, state.loading, state.questions.length, state.results.length, handleSubmit]);

  const sidebarTitles: Record<Phase, string> = {
    config: 'Adaptive Setup',
    briefing: 'Mission Briefing',
    quiz: 'Live Assessment',
    results: 'Analysis Report'
  };

  return (
    <main className="adaptive-quiz-page">
      <div className="macos-window">
        {/* Unified macOS Sidebar */}
        <aside className={`macos-sidebar phase-${state.phase}`}>
          <div className="macos-traffic-lights">
            <div className="traffic-light close"></div>
            <div className="traffic-light minimize"></div>
            <div className="traffic-light maximize"></div>
          </div>
          
          <div className="sidebar-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {(state.phase === 'config' || state.phase === 'results') && (
              <button type="button" onClick={() => window.history.back()} className="action-btn back-btn" style={{ background: 'transparent', padding: '0 8px 0 0', color: '#0a84ff', fontWeight: 600 }}>
                <span style={{ fontSize: 22, marginRight: 4, position: 'relative', top: 1 }}>&larr;</span> <span className="back-text">Back</span>
              </button>
            )}
            {state.phase !== 'config' && (
              <h2 className="macos-sidebar-title">{sidebarTitles[state.phase]}</h2>
            )}
            {state.phase === 'results' && (
              <div className="ai-badge" style={{ padding: '4px 10px', background: 'rgba(52, 199, 89, 0.15)', color: '#34c759', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                AI ADAPTIVE
              </div>
            )}
          </div>
          
          {/* Dynamic Sidebar Content */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.phase === 'quiz' && (
              <div className="macos-form-group" style={{ margin: 0, background: 'var(--card-bg)' }}>
                <div className="macos-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>Progress</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{state.currentIdx + 1} <span style={{fontSize: 16, color: 'var(--color-text-secondary)'}}>/ {state.questions.length}</span></div>
                </div>
                <div className="macos-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>Elapsed</div>
                  <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{formatTime(state.elapsed)}</div>
                </div>
              </div>
            )}
            {state.phase === 'results' && (
              <div className="macos-form-group" style={{ margin: 0 }}>
                <div className="macos-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>Final Score</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#34c759' }}>
                    {state.results.length > 0
                      ? Math.round((state.results.filter(r => r.isCorrect).length / state.results.length) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="macos-content">
          <div className="phase-container">
            
            {/* ERROR ALERT */}
            {state.error && (
              <div className="macos-form-group" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: '#ef4444', fontWeight: 600 }}>{state.error}</div>
                {state.phase === 'quiz' && Object.keys(state.answers).length === state.questions.length && (
                  <button
                    onClick={() => handleSubmit()}
                    disabled={state.loading}
                    className="action-btn"
                    style={{ padding: '8px 18px', background: '#0a84ff', color: '#fff', fontSize: 14, borderRadius: 8 }}
                  >
                    {state.loading ? 'Submitting...' : 'Retry Submission'}
                  </button>
                )}
              </div>
            )}

            {/* CONFIG PHASE */}
            {state.phase === 'config' && (
              <div className="config-grid">
                
                {/* LEFT COLUMN: SUBJECTS & TOPICS */}
                <div className="config-left-col" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <section className="section-card">
                    <div className="heading-title">Subjects & Topics</div>
                    <div className="subtext">Select subjects and optionally drill down into specific topics.</div>
                    
                    <div className="macos-form-group">
                      {SUBJECT_OPTIONS.map((subject) => {
                        const active = state.subjects.includes(subject.name);
                        const topics = state.availableTopics[subject.name] || [];
                        
                        return (
                          <div key={subject.name} className="macos-list-item" style={{ cursor: 'pointer' }} onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.topics-badge')) return;
                            const newSubjects = active ? state.subjects.filter(s => s !== subject.name) : [...state.subjects, subject.name];
                            dispatch({ type: 'UPDATE_CONFIG', payload: { subjects: newSubjects } });
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, background: subject.accent }}>{subject.icon}</div>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 600 }}>{subject.name}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {active && topics.length > 0 && (
                                <div className="topics-badge" onClick={(e) => {
                                  e.stopPropagation();
                                  dispatch({ type: 'SET_MODAL_SUBJECT', payload: subject.name });
                                }} style={{ padding: '4px 10px', background: 'rgba(10, 132, 255, 0.1)', color: '#0a84ff', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  Topics &rsaquo;
                                </div>
                              )}
                              <div className={`macos-toggle ${active ? 'active' : ''}`}>
                                <div className="macos-toggle-thumb" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* RIGHT COLUMN: SETTINGS */}
                <div className="config-right-col" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <section className="section-card">
                    <div className="heading-title">Questions</div>
                    <div className="macos-segmented-control">
                      {QUESTION_COUNT_OPTIONS.map((count) => {
                        const active = state.qCount === count;
                        return (
                          <div key={count} className={`macos-segmented-option ${active ? 'active' : ''}`} onClick={() => dispatch({ type: 'UPDATE_CONFIG', payload: { qCount: count } })}>
                            {active && <div className="macos-segmented-highlight" />}
                            <span style={{ position: 'relative', zIndex: 2 }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="section-card">
                    <div className="heading-title">Mode</div>
                    <div className="macos-segmented-control" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', display: 'grid' }}>
                      {MODE_OPTIONS.map((item) => {
                        const active = state.mode === item.value;
                        return (
                          <div key={item.value} className={`macos-segmented-option ${active ? 'active' : ''}`} onClick={() => dispatch({ type: 'UPDATE_CONFIG', payload: { mode: item.value } })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            {active && <div className="macos-segmented-highlight" />}
                            <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 999, background: item.accent }} />
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  
                  {/* COMPACT ACTION BUTTON */}
                  <div style={{ marginTop: 'auto' }}>
                    <button onClick={handleGenerate} disabled={state.loading || state.subjects.length === 0} className="action-btn" style={{ width: '100%', padding: '16px', borderRadius: 12, background: 'linear-gradient(135deg, #0a84ff 0%, #0056b3 100%)', color: '#fff', fontSize: 16, fontWeight: 700, boxShadow: '0 8px 24px rgba(10,132,255,0.2)' }}>
                      {state.loading ? 'Generating Assessment...' : 'Start Assessment'}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* BRIEFING PHASE */}
            {state.phase === 'briefing' && state.meta && (
              <section className="section-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 16 }}>Mission Briefing</h1>
                <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 30 }}>{state.meta.overallInsight || 'Your personalized adaptive quiz is ready.'}</p>
                <div className="macos-form-group" style={{ textAlign: 'left', marginBottom: 30 }}>
                  <div className="macos-list-item">
                    <span style={{ fontWeight: 600 }}>Target Focus</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{state.meta.focusArea || 'Balanced'}</span>
                  </div>
                  <div className="macos-list-item">
                    <span style={{ fontWeight: 600 }}>Questions</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{state.questions.length}</span>
                  </div>
                </div>
                <button onClick={() => dispatch({ type: 'SET_PHASE', payload: 'quiz' })} className="action-btn" style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0a84ff 0%, #0056b3 100%)', color: '#fff', fontSize: 16 }}>
                  Begin
                </button>
              </section>
            )}

            {/* QUIZ PHASE */}
            {state.phase === 'quiz' && state.questions[state.currentIdx] && (
              <>
                <div className="mobile-timer-bar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 16, border: '1px solid var(--card-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Progress</span>
                    <span style={{ fontSize: 16, fontWeight: 900 }}>{state.currentIdx + 1} <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>/ {state.questions.length}</span></span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Elapsed</span>
                    <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{formatTime(state.elapsed)}</span>
                  </div>
                </div>
                <section className="section-card">
                  <div style={{ fontSize: 18, lineHeight: 1.6, fontWeight: 500, marginBottom: 24 }}>
                    <MathRenderer text={state.questions[state.currentIdx].question || ''} />
                  </div>
                  <div className="macos-form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                    {state.questions[state.currentIdx].options?.map((opt, i) => {
                      const active = state.selected === opt;
                      return (
                        <div key={i} className={`macos-list-item ${active ? 'active' : ''}`} onClick={() => dispatch({ type: 'SELECT_ANSWER', payload: opt })} style={{ background: active ? 'rgba(10, 132, 255, 0.1)' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${active ? '#0a84ff' : 'var(--form-border)'}`, display: 'grid', placeItems: 'center' }}>
                              {active && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0a84ff' }} />}
                            </div>
                            <div style={{ paddingTop: 2 }}><MathRenderer text={opt} /></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                    <button onClick={handleConfirm} disabled={!state.selected} className="action-btn" style={{ padding: '12px 24px', background: state.selected ? '#0a84ff' : 'var(--form-border)', color: '#fff' }}>
                      Confirm & Next
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* RESULTS PHASE */}
            {state.phase === 'results' && (
              <section className="section-card">
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 20 }}>Analysis Report</h1>
                <div className="macos-form-group">
                  {state.results.map((r, i) => {
                    const matchingQuestion = state.questions.find(q => q.id === r.questionId) || state.questions[i];
                    return (
                      <div key={r.questionId || i} className="macos-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: r.isCorrect ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)', color: r.isCorrect ? '#34c759' : '#ff3b30', fontWeight: 700 }}>
                              {r.isCorrect ? '✓' : '✗'}
                            </span>
                            <span style={{ fontWeight: 600 }}>Q{i + 1} - {r.topic || matchingQuestion?.topic || 'Topic'}</span>
                          </div>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: r.isCorrect ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)', color: r.isCorrect ? '#34c759' : '#ff3b30', fontWeight: 700 }}>
                            {r.isCorrect ? 'CORRECT' : 'INCORRECT'}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: 15, color: 'var(--color-text-primary)', marginTop: 4 }}>
                          <MathRenderer text={matchingQuestion?.question || ''} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', fontSize: 13, marginTop: 4, background: 'var(--subtle-bg, rgba(0,0,0,0.02))', padding: '10px 14px', borderRadius: 8 }}>
                          <div><strong style={{ color: 'var(--color-text-secondary)' }}>Your Answer:</strong> <span style={{ color: r.isCorrect ? '#34c759' : '#ff3b30' }}>{r.userAnswer || 'Skipped'}</span></div>
                          {!r.isCorrect && r.correctAnswer && (
                            <div><strong style={{ color: 'var(--color-text-secondary)' }}>Correct Answer:</strong> <span style={{ color: '#34c759' }}>{r.correctAnswer}</span></div>
                          )}
                          {r.solution && (
                            <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--form-border)' }}>
                              <strong style={{ color: 'var(--color-text-secondary)' }}>Solution:</strong>
                              <div style={{ marginTop: 2 }}><MathRenderer text={r.solution} /></div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => dispatch({ type: 'RESET' })} className="action-btn" style={{ width: '100%', padding: '14px', marginTop: 24, background: 'var(--form-bg)', border: '1px solid var(--form-border)' }}>
                  Take Another Quiz
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
      
      {/* TOPICS MODAL */}
      {state.modalSubject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 20
        }} onClick={() => dispatch({ type: 'SET_MODAL_SUBJECT', payload: null })}>
          <div className="section-card" style={{
            backdropFilter: 'blur(40px) saturate(150%)',
            borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: 20, margin: 0
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{state.modalSubject} Topics</h2>
              <button onClick={() => dispatch({ type: 'SET_MODAL_SUBJECT', payload: null })} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
              {(state.availableTopics[state.modalSubject] || []).map(t => {
                const tName = typeof t === 'string' ? t : (t.name || t.topic || '');
                const tActive = state.topicsSelected.includes(tName);
                return (
                  <div 
                    key={tName}
                    onClick={() => {
                      const next = tActive ? state.topicsSelected.filter(x => x !== tName) : [...state.topicsSelected, tName];
                      dispatch({ type: 'UPDATE_CONFIG', payload: { topicsSelected: next } });
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 999, fontSize: 14, cursor: 'pointer',
                      background: tActive ? '#0a84ff' : 'var(--form-bg)',
                      color: tActive ? '#fff' : 'inherit',
                      border: `1px solid ${tActive ? '#0a84ff' : 'var(--form-border)'}`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tName}
                  </div>
                )
              })}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={() => dispatch({ type: 'SET_MODAL_SUBJECT', payload: null })} className="action-btn" style={{ padding: '10px 24px', background: '#0a84ff', color: '#fff', borderRadius: 8 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
