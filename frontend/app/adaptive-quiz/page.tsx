'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import axios from '@/lib/axios';
import MathRenderer from '@/components/MathRenderer';
import RouteLoadingState from '@/components/RouteLoadingState';
import { SUBJECT_TOPICS as FALLBACK_SUBJECT_TOPICS } from '@/lib/subjectTopics';
import { useThemeMode } from '@/hooks/useTheme';
import { announceFeedback } from '@/lib/feedback';

interface Question {
  id: string;
  question?: string;
  options?: string[];
  subject?: string;
  topic?: string;
  difficulty?: string;
  exam?: string;
  year?: string | number;
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

interface TopicBreakdownItem {
  topic: string;
  count: number;
}

interface QuizMeta {
  source?: string;
  quizStrategy?: string;
  overallInsight?: string;
  totalQuestions?: number;
  estimatedDuration?: number; // seconds
  focusArea?: string;
  topicBreakdown?: TopicBreakdownItem[];
}

interface SavedQuizSession {
  version: 1;
  userId: string;
  quizId: string;
  questions: Question[];
  meta: QuizMeta | null;
  currentIdx: number;
  answers: Record<string, Answer>;
  selected: string | null;
  firstAnswer: string | null;
  questionStartTime: number;
  elapsed: number;
}

const QUIZ_SESSION_STORAGE_KEY = 'adaptive-quiz-session-v1';

const DIFFICULTY_LABEL = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const STRATEGY_LABEL: Record<string, string> = {
  struggling: 'Foundation Mode — building your base',
  developing: 'Growth Mode — pushing your limits',
  proficient: 'Challenge Mode — exam-level pressure',
};

type QuizMode = 'adaptive' | 'weak-only' | 'revision' | 'explore';

type Phase = 'config' | 'briefing' | 'quiz' | 'results';

const SUBJECT_OPTIONS = [
  {
    name: 'Reasoning',
    icon: '🧠',
    meta: 'Logic, patterns, and critical thinking',
    accent: 'linear-gradient(135deg, rgba(83, 74, 183, 0.20), rgba(83, 74, 183, 0.08))',
  },
  {
    name: 'Mathematics',
    icon: '📐',
    meta: 'Algebra, geometry, and calculations',
    accent: 'linear-gradient(135deg, rgba(24, 95, 165, 0.18), rgba(24, 95, 165, 0.08))',
  },
  {
    name: 'English',
    icon: '📖',
    meta: 'Grammar, vocabulary, and comprehension',
    accent: 'linear-gradient(135deg, rgba(15, 110, 86, 0.18), rgba(15, 110, 86, 0.08))',
  },
  {
    name: 'General Awareness',
    icon: '🌍',
    meta: 'Current affairs, static GK, and facts',
    accent: 'linear-gradient(135deg, rgba(133, 79, 11, 0.18), rgba(133, 79, 11, 0.08))',
  },
];

const SUBJECT_COLORS: Record<string, string> = {
  'Reasoning': '#534ab7',
  'Mathematics': '#165fA5',
  'English': '#0f6e56',
  'General Awareness': '#85500b',
};

const MODE_OPTIONS: Array<{
  value: QuizMode;
  label: string;
  accent: string;
}> = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    accent: 'rgba(83, 74, 183, 0.16)',
  },
  {
    value: 'weak-only',
    label: 'Weak Topics',
    accent: 'rgba(255, 75, 110, 0.16)',
  },
  {
    value: 'revision',
    label: 'Revision',
    accent: 'rgba(0, 229, 200, 0.16)',
  },
  {
    value: 'explore',
    label: 'Explore',
    accent: 'rgba(255, 201, 77, 0.16)',
  },
];

const QUESTION_COUNT_OPTIONS = [10, 15, 25] as const;
const QUESTION_DURATION_MINUTES: Record<number, number> = {
  10: 5,
  15: 10,
  25: 15,
};

const DIFFICULTY_STYLES: Record<string, { background: string; color: string; border: string }> = {
  easy: { background: 'rgba(34, 197, 94, 0.16)', color: '#166534', border: 'rgba(34, 197, 94, 0.25)' },
  medium: { background: 'rgba(245, 158, 11, 0.16)', color: '#92400e', border: 'rgba(245, 158, 11, 0.25)' },
  hard: { background: 'rgba(239, 68, 68, 0.16)', color: '#991b1b', border: 'rgba(239, 68, 68, 0.25)' },
};

function MathText({ text }: { text: string }) {
  return <MathRenderer text={text} />;
}

export default function AdaptiveQuizPage() {
  const { theme } = useThemeMode();
  const isDark = theme === 'dark';
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileView(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const shellStyle: CSSProperties = {
    minHeight: '100vh',
    padding: isMobileView ? '12px 10px 28px' : '24px 16px 56px',
    background: isDark
      ? 'radial-gradient(circle at top left, rgba(99, 102, 241, 0.18), transparent 26%), radial-gradient(circle at top right, rgba(20, 184, 166, 0.10), transparent 22%), linear-gradient(180deg, #040816 0%, #08111f 100%)'
      : 'linear-gradient(180deg, #f2f2f7 0%, #edf1f6 100%)',
    color: isDark ? '#ecf3ff' : '#1c1c1e',
    fontFamily: "'Satoshi', 'General Sans', 'Outfit', sans-serif",
    '--color-text-primary': isDark ? '#ecf3ff' : '#1c1c1e',
    '--color-text-secondary': isDark ? '#9fb1cf' : '#636366',
    '--color-text-tertiary': isDark ? '#6b7c97' : '#8e8e93',
    '--color-border-tertiary': isDark ? 'rgba(148, 163, 184, 0.18)' : '#d1d1d6',
    '--color-background-secondary': isDark ? 'rgba(15, 23, 42, 0.78)' : '#ffffff',
    '--color-background-danger': isDark ? 'rgba(127, 29, 29, 0.24)' : '#fee2e2',
    '--color-text-danger': isDark ? '#fecaca' : '#991b1b',
  } as CSSProperties;

  const [phase, setPhase] = useState<Phase>('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  const [subjects, setSubjects] = useState<string[]>([]);
  const [qCount, setQCount] = useState(15);
  const [mode, setMode] = useState<QuizMode>('adaptive');
  const [excludeOwn, setExcludeOwn] = useState(false);
  const [topicsModalOpen, setTopicsModalOpen] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<Record<string, string[]>>(FALLBACK_SUBJECT_TOPICS as any);
  const [topicsSelected, setTopicsSelected] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [topicsCategory, setTopicsCategory] = useState<Record<string, string>>({});

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || 'demo-user' : 'demo-user';

  useEffect(() => {
    if (!topicsModalOpen) return;
    let canceled = false;
    (async () => {
      try {
        const { data } = await axios.get(`/api/adaptive-quiz/topics?userId=${encodeURIComponent(userId)}`);
        if (canceled) return;
        setAvailableTopics(data.subjects || {});
      } catch (err: unknown) {
        console.warn('Failed to fetch topics from backend, using fallback subjects', err instanceof Error ? err.message : err);
        if (!canceled) setAvailableTopics(FALLBACK_SUBJECT_TOPICS as any);
      }
    })();
    return () => { canceled = true; };
  }, [topicsModalOpen, userId]);

  useEffect(() => {
    // Build mapping topic -> category from availableTopics. availableTopics may be
    // either arrays of strings (legacy) or arrays of { name, category } objects.
    const mapping: Record<string, string> = {};
    Object.values(availableTopics).flat().forEach((item: any) => {
      if (!item) return;
      if (typeof item === 'string') {
        mapping[item] = mapping[item] || 'Least';
      } else if (typeof item === 'object') {
        const name = item.name || item.topic || null;
        const cat = item.category || item.weight || 'Least';
        if (name) mapping[name] = cat;
      }
    });
    setTopicsCategory(mapping);
  }, [availableTopics]);

  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState<QuizMeta | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [firstAnswer, setFirstAnswer] = useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [topicAccuracy, setTopicAccuracy] = useState<any[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<SavedQuizSession | null>(null);
  const [submissionError, setSubmissionError] = useState('');

  const frameStyle: CSSProperties = {
    maxWidth: isMobileView ? '100%' : 1120,
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  };

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
  };

  const orbStyle: CSSProperties = {
    position: 'absolute',
    borderRadius: '999px',
    filter: 'blur(18px)',
    opacity: 0.9,
  };

  const shellCardStyle: CSSProperties = {
    background: isDark
      ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.03))'
      : '#ffffff',
    border: isDark ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${'#e5e5ea'}`,
    boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)' : '0 10px 26px rgba(15, 23, 42, 0.08)',
    backdropFilter: isDark ? 'none' : 'none',
    WebkitBackdropFilter: isDark ? 'none' : 'none',
  };

  const roundedCardStyle: CSSProperties = {
    ...shellCardStyle,
    borderRadius: isMobileView ? 12 : 28,
  };

  const topicsModalCardStyle: CSSProperties = {
    ...roundedCardStyle,
    background: isDark ? '#0b1120' : roundedCardStyle.background,
    boxShadow: isDark ? '0 28px 70px rgba(0,0,0,0.72)' : roundedCardStyle.boxShadow,
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  };

  const sectionCardStyle: CSSProperties = {
    ...shellCardStyle,
    borderRadius: isMobileView ? 10 : 22,
    padding: isMobileView ? 10 : 18,
  };

  const headingStyle: CSSProperties = {
    fontSize: isMobileView ? 13 : 15,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--color-text-primary)',
  };

  const subtextStyle: CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: isMobileView ? 12 : 13,
    lineHeight: 1.5,
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: isMobileView ? '6px 8px' : '8px 12px',
    fontSize: isMobileView ? 11 : 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: isDark ? 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' : 'rgba(83, 74, 183, 0.10)',
    color: isDark ? '#e6eefc' : '#534ab7',
    border: isDark ? '1px solid rgba(255,255,255,0.06)' : 'rgba(83, 74, 183, 0.18)',
  };

  const actionButtonStyle: CSSProperties = {
    border: 'none',
    borderRadius: 14,
    padding: isMobileView ? '10px 12px' : '16px 18px',
    fontSize: isMobileView ? 14 : 15,
    fontWeight: 800,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
  };

  const scoreColor = (pct: number) => (pct >= 70 ? '#166534' : pct >= 50 ? '#92400e' : '#991b1b');

  const renderBackdrop = (
    <div aria-hidden="true" style={backdropStyle}>
      <div style={{ ...orbStyle, width: 420, height: 420, top: -110, right: -140, background: 'radial-gradient(circle, rgba(83, 74, 183, 0.24) 0%, rgba(83, 74, 183, 0) 68%)' }} />
      <div style={{ ...orbStyle, width: 340, height: 340, bottom: -100, left: -100, background: 'radial-gradient(circle, rgba(0, 229, 200, 0.16) 0%, rgba(0, 229, 200, 0) 68%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: isDark ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)' : 'linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px', maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.35), transparent 72%)' }} />
    </div>
  );

  const selectedMode = MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0];
  const estimatedMinutes = QUESTION_DURATION_MINUTES[qCount] ?? 10;
  const selectedSubjectMeta = SUBJECT_OPTIONS.filter((subject) => subjects.includes(subject.name));
  const insightSourceLabel = meta?.source === 'azure-openai'
    ? 'AI generated'
    : meta?.source === 'rule-based'
      ? 'Rule-based'
      : meta?.source || 'Unknown';
  const questionBankSourceLabel = 'Cosmos DB';
  // If no subjects are selected, show topics for all subjects in the picker.
  const visibleTopics = subjects.length === 0
    ? Object.entries(availableTopics)
    : Object.entries(availableTopics).filter(([subject]) => subjects.includes(subject));

  const visibleTopicNames = new Set(
    visibleTopics.flatMap(([, topics]) => (topics || []).map((t: any) => (typeof t === 'string' ? t : t?.name)))
  );

  const topicsForSelectedSubjects = topicsSelected.filter((topic) => visibleTopicNames.has(topic));

  useEffect(() => {
    if (phase === 'quiz') {
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as SavedQuizSession;
      if (parsed.version !== 1 || parsed.userId !== userId || !parsed.quizId || parsed.questions.length === 0) {
        window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
        return;
      }

      setSavedSession(parsed);
    } catch {
      window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
    }
  }, [userId]);

  useEffect(() => {
    if (phase !== 'quiz') return;

    const session: SavedQuizSession = {
      version: 1,
      userId,
      quizId,
      questions,
      meta,
      currentIdx,
      answers,
      selected,
      firstAnswer,
      questionStartTime,
      elapsed,
    };
    window.localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(session));
    setSavedSession(session);
  }, [answers, currentIdx, elapsed, firstAnswer, meta, phase, questionStartTime, questions, quizId, selected, userId]);

  useEffect(() => {
    if (phase !== 'quiz') return;

    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', confirmLeave);
    return () => window.removeEventListener('beforeunload', confirmLeave);
  }, [phase]);

  const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

  const generateQuiz = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post('/api/adaptive-quiz/generate', {
        userId,
        subjects,
        questionCount: qCount,
        mode,
        excludeOwn,
        topics: topicsForSelectedSubjects.length > 0 ? topicsForSelectedSubjects : undefined,
      }, {
        // Adaptive generation can take longer when Cosmos is sparse and
        // Azure OpenAI fallback is used.
        timeout: 90000,
      });

      setQuizId(data.quizId);
      setQuestions(data.questions);
      setMeta(data.meta);
      setPhase('briefing');
    } catch (requestError: any) {
      if (requestError?.code === 'ECONNABORTED') {
        setError('Quiz generation is taking longer than expected. Please try again in a few seconds.');
      } else if (requestError?.message === 'canceled') {
        setError('Request was canceled. Please generate the quiz again.');
      } else {
        setError(requestError.response?.data?.error || 'Failed to generate quiz. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }, [mode, qCount, subjects, userId, excludeOwn, topicsSelected]);

  const selectAnswer = (option: string) => {
    if (answers[questions[currentIdx]?.id]) return;
    if (!firstAnswer) setFirstAnswer(option);
    setSelected(option);
  };

  const confirmAnswer = () => {
    const question = questions[currentIdx];
    if (!selected || !question) return;

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    setAnswers((previous) => ({
      ...previous,
      [question.id]: {
        questionId: question.id,
        userAnswer: selected,
        timeSpent,
        changedAnswer: firstAnswer !== null && firstAnswer !== selected,
      },
    }));
    announceFeedback('Answer saved');
  };

  const submitQuiz = async () => {
    setLoading(true);
    setSubmissionError('');

    try {
      const answersArr = Object.values(answers);
      const { data } = await axios.post('/api/adaptive-quiz/submit', {
        quizId,
        userId,
        answers: answersArr,
      });

      setResults(data.results);
      setScore(data.score);
      setTopicAccuracy(data.topicAccuracy);
      setPhase('results');
      window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
      setSavedSession(null);
      if (timerRef.current) clearInterval(timerRef.current);
      announceFeedback('Quiz submitted');
    } catch (requestError: any) {
      setSubmissionError(requestError.response?.data?.error || 'Submission failed. Your answers are saved locally.');
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((value) => value + 1);
      setSelected(null);
      setFirstAnswer(null);
      setQuestionStartTime(Date.now());
      return;
    }

    submitQuiz();
  };

  const resetQuiz = () => {
    window.localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
    setSavedSession(null);
    setPhase('config');
    setQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setElapsed(0);
    setSelected(null);
    setFirstAnswer(null);
    setResults([]);
    setExpandedResult(null);
    setScore(0);
    setTopicAccuracy([]);
    setSubmissionError('');
  };

  const resumeSavedQuiz = () => {
    if (!savedSession) return;

    setQuizId(savedSession.quizId);
    setQuestions(savedSession.questions);
    setMeta(savedSession.meta);
    setCurrentIdx(savedSession.currentIdx);
    setAnswers(savedSession.answers);
    setSelected(savedSession.selected);
    setFirstAnswer(savedSession.firstAnswer);
    setQuestionStartTime(Date.now());
    setElapsed(savedSession.elapsed);
    setSubmissionError('');
    setPhase('quiz');
  };

  const saveAndExit = () => {
    if (!window.confirm('Save this quiz and exit? You can resume it from the quiz setup page.')) return;
    setPhase('config');
  };

  if (phase === 'config' && loading) {
    return <RouteLoadingState label="your adaptive quiz" />;
  }

  if (phase === 'config') {
    return (
      <div style={shellStyle}>
        {renderBackdrop}
        <div style={frameStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
              Back
            </button>
            <div style={badgeStyle}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: '#00b4a0', boxShadow: '0 0 10px rgba(0,180,160,0.45)' }} />
              AI Adaptive
            </div>
          </div>

          {savedSession && (
            <section style={{ ...sectionCardStyle, marginBottom: 16, borderColor: isDark ? 'rgba(0, 180, 160, 0.36)' : 'rgba(0, 180, 160, 0.32)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={headingStyle}>Unfinished quiz saved</div>
                  <div style={subtextStyle}>Question {savedSession.currentIdx + 1} of {savedSession.questions.length} · {formatTime(savedSession.elapsed)} elapsed</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" onClick={resetQuiz} style={{ ...actionButtonStyle, padding: '9px 12px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-tertiary)' }}>Discard</button>
                  <button type="button" onClick={resumeSavedQuiz} style={{ ...actionButtonStyle, padding: '9px 12px', background: 'linear-gradient(135deg, #185FA5 0%, #00b4a0 120%)', color: '#fff' }}>Resume test</button>
                </div>
              </div>
            </section>
          )}

          {error && (
            <div style={{ ...sectionCardStyle, marginBottom: 18, background: isDark ? 'rgba(127, 29, 29, 0.20)' : 'rgba(254, 226, 226, 0.88)', borderColor: isDark ? 'rgba(248, 113, 113, 0.28)' : 'rgba(248, 113, 113, 0.40)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, color: 'var(--color-text-danger)' }}>Generation issue</div>
              <div style={{ color: 'var(--color-text-danger)', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
            </div>
          )}

          <div style={{ display: 'grid', gap: isMobileView ? 12 : 16 }}>
            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={headingStyle}>Subjects</div>
                  <div style={subtextStyle}>Pick the mix you want the generator to optimize.</div>
                </div>
                <button onClick={() => setTopicsModalOpen(true)} style={{ ...actionButtonStyle, padding: isMobileView ? '10px 12px' : '12px 14px', background: isDark ? 'rgba(99, 102, 241, 0.18)' : '#eef2f7', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-tertiary)' }}>
                  Choose topics
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobileView ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
                {SUBJECT_OPTIONS.map((subject) => {
                  const active = subjects.includes(subject.name);
                  return (
                    <button
                      key={subject.name}
                      type="button"
                      onClick={() => setSubjects((previous) => (active ? previous.filter((value) => value !== subject.name) : [...previous, subject.name]))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobileView ? 10 : 12,
                        width: '100%',
                        padding: isMobileView ? 10 : 12,
                        borderRadius: isMobileView ? 12 : 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1px solid ${active ? (isDark ? 'rgba(83, 74, 183, 0.35)' : '#0a84ff') : 'var(--color-border-tertiary)'}`,
                        background: active ? (isDark ? 'rgba(83, 74, 183, 0.18)' : '#f2f8ff') : (isDark ? 'rgba(15, 23, 42, 0.40)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        boxShadow: active ? (isDark ? '0 12px 28px rgba(83, 74, 183, 0.12)' : '0 8px 18px rgba(10, 132, 255, 0.16)') : 'none',
                      }}
                    >
                      <div style={{ width: isMobileView ? 32 : 36, height: isMobileView ? 32 : 36, borderRadius: isMobileView ? 10 : 12, display: 'grid', placeItems: 'center', fontSize: isMobileView ? 14 : 16, background: subject.accent, flexShrink: 0 }}>{subject.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: isMobileView ? 14 : 15, fontWeight: 800 }}>{subject.name}</div>
                          <div style={{ width: 44, height: 26, borderRadius: 999, background: active ? '#34c759' : '#d1d1d6', border: '1px solid rgba(0,0,0,0.06)', position: 'relative', flexShrink: 0, transition: 'background 160ms ease' }}>
                            <div style={{ width: 22, height: 22, borderRadius: 999, background: '#ffffff', position: 'absolute', top: 1, left: active ? 21 : 1, transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.24)' }} />
                          </div>
                        </div>
                        {!isMobileView && <div style={{ ...subtextStyle, marginTop: 4, fontSize: 12 }}>{subject.meta}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={headingStyle}>Questions</div>
                  {!isMobileView && <div style={subtextStyle}>Control depth, pace, and runtime.</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: isMobileView ? 32 : 42, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.08em', color: 'var(--color-text-primary)' }}>{qCount}</div>
                  <div style={{ fontSize: isMobileView ? 11 : 12, fontWeight: 700, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{estimatedMinutes} min</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? 'repeat(3, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: isMobileView ? 8 : 10 }}>
                {QUESTION_COUNT_OPTIONS.map((count) => {
                  const active = qCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQCount(count)}
                      style={{
                        ...actionButtonStyle,
                        padding: '10px 12px',
                        borderRadius: 14,
                        border: `1px solid ${active ? (isDark ? 'rgba(83, 74, 183, 0.35)' : '#0a84ff') : 'var(--color-border-tertiary)'}`,
                        background: active
                          ? (isDark ? 'rgba(83, 74, 183, 0.24)' : '#f2f8ff')
                          : (isDark ? 'rgba(15, 23, 42, 0.44)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        boxShadow: active ? (isDark ? '0 12px 22px rgba(83, 74, 183, 0.14)' : '0 8px 16px rgba(10, 132, 255, 0.14)') : 'none',
                      }}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ marginBottom: 12 }}>
                <div style={headingStyle}>Mode</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobileView ? 8 : 10 }}>
                {MODE_OPTIONS.map((item) => {
                  const active = mode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMode(item.value)}
                      style={{
                        ...actionButtonStyle,
                        textAlign: 'left',
                        padding: isMobileView ? '10px 12px' : '12px 14px',
                        background: active ? (isDark ? 'rgba(83, 74, 183, 0.20)' : '#f2f8ff') : (isDark ? 'rgba(15, 23, 42, 0.42)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        border: `1px solid ${active ? (isDark ? 'rgba(83, 74, 183, 0.30)' : '#0a84ff') : 'var(--color-border-tertiary)'}`,
                        boxShadow: active ? (isDark ? '0 18px 34px rgba(83, 74, 183, 0.12)' : '0 10px 20px rgba(10, 132, 255, 0.15)') : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent, boxShadow: `0 0 0 4px ${item.accent}` }} />
                        <div style={{ fontSize: isMobileView ? 14 : 15, fontWeight: 800 }}>{item.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', flexDirection: isMobileView ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 700 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 26,
                      borderRadius: 999,
                      background: excludeOwn ? '#34c759' : '#d1d1d6',
                      border: '1px solid rgba(0,0,0,0.06)',
                      position: 'relative',
                      transition: 'background 160ms ease',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: '#ffffff', position: 'absolute', top: 1, left: excludeOwn ? 21 : 1, transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.24)' }} />
                  </div>
                  <input type="checkbox" checked={excludeOwn} onChange={(e) => setExcludeOwn(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
                  Exclude my own questions
                </label>

                <div style={{ width: isMobileView ? '100%' : 'auto' }}>
                  <button
                    onClick={generateQuiz}
                    disabled={loading || subjects.length === 0}
                    style={{
                      ...actionButtonStyle,
                      width: '100%',
                      padding: isMobileView ? '12px 14px' : undefined,
                      background: loading || subjects.length === 0 ? 'rgba(148, 163, 184, 0.55)' : 'linear-gradient(135deg, #534ab7 0%, #5b40ff 48%, #00b4a0 120%)',
                      color: '#fff',
                      boxShadow: loading || subjects.length === 0 ? 'none' : '0 18px 40px rgba(83, 74, 183, 0.30)',
                      cursor: loading || subjects.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Analyzing your pattern…' : 'Generate Adaptive Quiz →'}
                  </button>
                </div>

              </div>

              </section>
          </div>

                {topicsModalOpen && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.55)' }}>
                    <div style={{ width: isMobileView ? '95%' : 'min(520px, 100%)', maxHeight: isMobileView ? '86vh' : '90vh', overflow: 'hidden', padding: isMobileView ? 10 : 20, ...topicsModalCardStyle, border: isDark ? '1px solid rgba(255,255,255,0.08)' : roundedCardStyle.border }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={badgeStyle}>Focus topics</div>
                        <button type="button" onClick={() => setTopicsModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>✕</button>
                      </div>

                      <div style={{ display: 'grid', gap: 10, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Questions source</div>
                          <div style={{ fontWeight: 800 }}>{questionBankSourceLabel}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Insight source</div>
                          <div style={{ fontWeight: 800 }}>{insightSourceLabel}</div>
                        </div>

                        <div>
                          {visibleTopics.length === 0 ? (
                            <div style={{ color: 'var(--color-text-secondary)' }}>Select one or more subjects first to see their topics here.</div>
                          ) : visibleTopics.map(([subject, topics]) => {
                            const topicNames = (topics || []).map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
                            const selectAllForSubject = () => setTopicsSelected((prev) => Array.from(new Set([...prev, ...topicNames])));
                            return (
                              <div key={subject} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ fontWeight: 800 }}>{subject} · {topicNames.length} topic{topicNames.length === 1 ? '' : 's'}</div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={selectAllForSubject} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}>Select all</button>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                                  {topicNames.map((name: string) => {
                                    const checked = topicsSelected.includes(name);
                                    return (
                                      <label key={name} onClick={(e) => { e.preventDefault(); setTopicsSelected((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name])); }} style={{ display: 'block', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={checked} readOnly style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
                                        <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${checked ? 'rgba(83, 74, 183, 0.9)' : 'var(--color-border-tertiary)'}`, background: checked ? 'linear-gradient(90deg, rgba(83, 74, 183, 0.14), rgba(0, 180, 160, 0.06))' : 'transparent', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{name}</div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 12, borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--color-border-tertiary)', flexShrink: 0 }}>
                        <button type="button" onClick={() => setTopicsSelected([])} style={{ ...actionButtonStyle, padding: '8px 10px', background: 'transparent', border: '1px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' }}>Clear</button>
                        <button type="button" onClick={() => setTopicsModalOpen(false)} style={{ ...actionButtonStyle, padding: '8px 10px', background: 'transparent', border: '1px solid var(--color-border-tertiary)' }}>Close</button>
                        <button type="button" onClick={() => setTopicsModalOpen(false)} style={{ ...actionButtonStyle, padding: '8px 10px', background: 'linear-gradient(135deg, #534ab7 0%, #00b4a0 120%)', color: '#fff' }}>Apply topics</button>
                      </div>
                    </div>
                  </div>
                )}
        </div>
      </div>
    );
  }

  if (phase === 'briefing' && meta) {
    return (
      <div style={shellStyle}>
        {renderBackdrop}
        <div style={frameStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <button type="button" onClick={resetQuiz} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
              Edit setup
            </button>
            <div style={badgeStyle}>{meta.source === 'azure-openai' ? 'AI insight' : 'Adaptive summary'}</div>
          </div>

          <section style={{ ...roundedCardStyle, padding: isMobileView ? 12 : 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobileView ? 10 : 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ maxWidth: isMobileView ? '100%' : 680 }}>
                  <div style={{ ...badgeStyle, padding: '6px 10px', fontSize: 11 }}>{(meta.quizStrategy && STRATEGY_LABEL[meta.quizStrategy]) || 'Adaptive Mode'}</div>
                  <h1 style={{ margin: '8px 0 6px', fontSize: isMobileView ? '1.4rem' : 'clamp(1.4rem, 2.6vw, 2.2rem)', lineHeight: 1.04, letterSpacing: '-0.04em' }}>
                    Your quiz is tuned and ready.
                  </h1>
                  {!isMobileView && <p style={{ ...subtextStyle, fontSize: 13, maxWidth: 720, margin: 0 }}>{meta.overallInsight}</p>}
                </div>

                <div style={{ minWidth: 140, display: 'grid', gap: 8 }}>
                  <div style={{ borderRadius: 12, padding: '8px 10px', background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Questions</div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{meta.totalQuestions}</div>
                  </div>
                  <div style={{ borderRadius: 12, padding: '8px 10px', background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Estimated</div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{Math.ceil(((meta.estimatedDuration ?? (estimatedMinutes * 60)) as number) / 60)} min</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <div style={{ borderRadius: 12, padding: '8px 10px', background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.015))' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Focus area</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>{meta.focusArea}</div>
                </div>
                <div style={{ borderRadius: 12, padding: '8px 10px', background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.015))' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Source</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>{questionBankSourceLabel}</div>
                </div>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gap: 16 }}>
            <section style={sectionCardStyle}>
              <div style={{ marginBottom: 14 }}>
                <div style={headingStyle}>Today’s focus</div>
                <div style={subtextStyle}>The quiz will lean harder into the topics below.</div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {(meta.topicBreakdown || []).map((topic, index) => {
                  const subject = SUBJECT_OPTIONS[index % SUBJECT_OPTIONS.length];
                  return (
                    <div key={topic.topic} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, background: isDark ? 'rgba(15, 23, 42, 0.56)' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 18, background: subject.accent, flexShrink: 0 }}>{subject.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>{topic.topic}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-secondary)' }}>{topic.count}Q</div>
                        </div>
                        <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, topic.count * 16)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #534ab7 0%, #00b4a0 100%)' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <button
                  onClick={() => {
                    setPhase('quiz');
                    setQuestionStartTime(Date.now());
                  }}
                  aria-label="Start Quiz"
                  style={{
                    ...actionButtonStyle,
                    minWidth: 210,
                    background: 'linear-gradient(135deg, #534ab7 0%, #5b40ff 45%, #00b4a0 120%)',
                    color: '#fff',
                    boxShadow: '0 18px 40px rgba(83, 74, 183, 0.30)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  Start Quiz
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    const question = questions[currentIdx];
    const answered = answers[question?.id];
    const progress = Math.round(((currentIdx + (answered ? 1 : 0)) / questions.length) * 100);

    return (
      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 920 }}>
          <div style={{ ...roundedCardStyle, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={badgeStyle}>Question {currentIdx + 1} of {questions.length}</div>
              <div style={{ marginTop: 10, fontSize: 14, color: 'var(--color-text-secondary)' }}>{question?.subject} · {question?.topic}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Elapsed</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: elapsed > (meta?.estimatedDuration || 9999) ? '#ef4444' : 'var(--color-text-primary)' }}>{formatTime(elapsed)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button type="button" onClick={saveAndExit} style={{ ...actionButtonStyle, padding: '9px 12px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-tertiary)' }}>
              Save and exit
            </button>
          </div>

          <section style={{ ...roundedCardStyle, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: `${SUBJECT_COLORS[(question?.subject ?? '')] || '#534ab7'}14`, color: SUBJECT_COLORS[(question?.subject ?? '')] || '#534ab7', border: `1px solid ${SUBJECT_COLORS[(question?.subject ?? '')] || '#534ab7'}20` }}>{question?.subject}</span>
                <span style={{ ...badgeStyle, textTransform: 'none', letterSpacing: 0, padding: '8px 10px', background: DIFFICULTY_STYLES[(question?.difficulty ?? 'medium') as keyof typeof DIFFICULTY_STYLES]?.background || 'rgba(148, 163, 184, 0.16)', color: DIFFICULTY_STYLES[(question?.difficulty ?? 'medium') as keyof typeof DIFFICULTY_STYLES]?.color || 'inherit', borderColor: DIFFICULTY_STYLES[(question?.difficulty ?? 'medium') as keyof typeof DIFFICULTY_STYLES]?.border || 'transparent' }}>{DIFFICULTY_LABEL[(question?.difficulty ?? 'medium') as keyof typeof DIFFICULTY_LABEL] || 'Question'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{Math.max(0, progress)}% complete</div>
            </div>

            <div style={{ height: 10, borderRadius: 999, background: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.20)', overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: 'linear-gradient(90deg, #534ab7 0%, #00b4a0 100%)', transition: 'width .3s ease' }} />
            </div>

            {question?.exam && (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 16, background: isDark ? 'rgba(15, 23, 42, 0.56)' : 'rgba(248, 250, 252, 0.92)', border: '1px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>Exam:</strong> {question.exam}{question.year ? ` · ${question.year}` : ''}
              </div>
            )}

            <div style={{ marginBottom: 18, padding: 18, borderRadius: 22, background: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(248, 250, 252, 0.96)', border: '1px solid var(--color-border-tertiary)', fontSize: 16, lineHeight: 1.8 }}>
              <MathText text={question?.question || ''} />
            </div>

            <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
              {(question?.options || []).map((option, index) => {
                const letter = String.fromCharCode(65 + index);
                const isSelected = selected === option || selected === letter;
                const isAnswered = !!answered;
                const activeBorder = isSelected && !isAnswered ? '#534ab7' : 'var(--color-border-tertiary)';
                const activeBackground = isSelected && !isAnswered ? (isDark ? 'rgba(83, 74, 183, 0.22)' : 'rgba(83, 74, 183, 0.10)') : (isDark ? 'rgba(15, 23, 42, 0.54)' : 'rgba(255, 255, 255, 0.88)');

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !isAnswered && selectAnswer(option)}
                    style={{
                      width: '100%',
                      border: `1px solid ${activeBorder}`,
                      background: activeBackground,
                      color: 'var(--color-text-primary)',
                      borderRadius: 18,
                      padding: '14px 15px',
                      cursor: isAnswered ? 'default' : 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      boxShadow: isSelected && !isAnswered ? '0 14px 30px rgba(83, 74, 183, 0.12)' : 'none',
                    }}
                  >
                    <span style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0, background: isSelected && !isAnswered ? 'linear-gradient(135deg, #534ab7 0%, #00b4a0 120%)' : (isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.18)'), color: isSelected && !isAnswered ? '#ffffff' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 800 }}>{letter}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.65, flex: 1, paddingTop: 3 }}><MathText text={option} /></span>
                  </button>
                );
              })}
            </div>

            {!answered ? (
              <button
                onClick={confirmAnswer}
                disabled={!selected}
                style={{
                  ...actionButtonStyle,
                  width: '100%',
                  background: selected ? 'linear-gradient(135deg, #534ab7 0%, #00b4a0 120%)' : 'rgba(148, 163, 184, 0.55)',
                  color: '#fff',
                  boxShadow: selected ? '0 18px 34px rgba(83, 74, 183, 0.22)' : 'none',
                  cursor: selected ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm answer
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                style={{
                  ...actionButtonStyle,
                  width: '100%',
                  background: currentIdx === questions.length - 1 ? 'linear-gradient(135deg, #185FA5 0%, #00b4a0 120%)' : 'linear-gradient(135deg, #534ab7 0%, #00b4a0 120%)',
                  color: '#fff',
                  boxShadow: '0 18px 34px rgba(24, 95, 165, 0.18)',
                }}
              >
                {currentIdx === questions.length - 1 ? 'Submit quiz →' : 'Next question →'}
              </button>
            )}

            {submissionError && (
              <div role="alert" style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', border: '1px solid rgba(239, 68, 68, 0.28)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{submissionError}</span>
                <button type="button" onClick={submitQuiz} disabled={loading} style={{ ...actionButtonStyle, padding: '9px 12px', background: '#991b1b', color: '#fff', opacity: loading ? 0.65 : 1 }}>
                  {loading ? 'Retrying…' : 'Retry submission'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    const correct = results.filter((result) => result.isCorrect).length;
    const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;

    return (
      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 960 }}>
          <section style={{ ...roundedCardStyle, padding: isMobileView ? 14 : 22, marginBottom: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: isMobileView ? 12 : 16 }}>
              <div style={{ maxWidth: 640 }}>
                <div style={badgeStyle}>Results</div>
                <h1 style={{ margin: '14px 0 10px', fontSize: isMobileView ? '1.7rem' : 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 0.98, letterSpacing: '-0.06em' }}>
                  Your session has a clear profile now.
                </h1>
                {!isMobileView && (
                  <p style={{ ...subtextStyle, fontSize: 15 }}>The score below is paired with topic-level signals so you can see what to keep, what to review, and what to attack next.</p>
                )}
              </div>

              <div style={{ width: isMobileView ? '100%' : 240, borderRadius: isMobileView ? 20 : 28, padding: isMobileView ? 14 : 18, background: pct >= 70 ? 'rgba(34, 197, 94, 0.14)' : pct >= 50 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(239, 68, 68, 0.16)', border: `1px solid ${pct >= 70 ? 'rgba(34, 197, 94, 0.24)' : pct >= 50 ? 'rgba(245, 158, 11, 0.26)' : 'rgba(239, 68, 68, 0.26)'}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: scoreColor(pct) }}>Score</div>
                <div style={{ marginTop: 4, fontSize: isMobileView ? 52 : 64, lineHeight: 0.95, fontWeight: 900, letterSpacing: '-0.08em', color: scoreColor(pct) }}>{pct}%</div>
                <div style={{ marginTop: 8, fontSize: isMobileView ? 13 : 14, fontWeight: 700, color: scoreColor(pct) }}>{correct} / {results.length} correct</div>
                {!isMobileView && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatTime(elapsed)} elapsed · raw score {score}</div>
                )}
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gap: 16 }}>
            {topicAccuracy.length > 0 && (
              <section style={sectionCardStyle}>
                <div style={{ marginBottom: 14 }}>
                  <div style={headingStyle}>By topic</div>
                  <div style={subtextStyle}>Lower bars are your next revision targets.</div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {topicAccuracy.slice().sort((left, right) => left.accuracy - right.accuracy).map((topic) => (
                    <div key={topic.topic} style={{ padding: 14, borderRadius: 18, background: isDark ? 'rgba(15, 23, 42, 0.56)' : 'rgba(248, 250, 252, 0.94)', border: '1px solid var(--color-border-tertiary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{topic.topic}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor(topic.accuracy) }}>{topic.accuracy}% ({topic.correct}/{topic.total})</div>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${topic.accuracy}%`, borderRadius: 999, background: topic.accuracy >= 70 ? 'linear-gradient(90deg, #22c55e 0%, #00b4a0 100%)' : topic.accuracy >= 50 ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' : 'linear-gradient(90deg, #ef4444 0%, #fb7185 100%)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={sectionCardStyle}>
              <div style={{ marginBottom: 14 }}>
                <div style={headingStyle}>Review</div>
                <div style={subtextStyle}>{results.filter((result) => !result.isCorrect).length} question{results.filter((result) => !result.isCorrect).length === 1 ? '' : 's'} still need attention.</div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {results.filter((result) => !result.isCorrect).map((result, index) => {
                  const expanded = expandedResult === result.questionId;
                  return (
                    <div key={result.questionId} style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(239, 68, 68, 0.22)', background: isDark ? 'rgba(127, 29, 29, 0.16)' : 'rgba(254, 242, 242, 0.96)' }}>
                      <button type="button" onClick={() => setExpandedResult(expanded ? null : result.questionId)} style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', color: 'var(--color-text-primary)' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ef4444' }}>Q{index + 1}</div>
                          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800 }}>{result.topic}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>{expanded ? 'Collapse' : 'See solution'}</div>
                      </button>

                      {expanded && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(239, 68, 68, 0.18)' }}>
                          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                              You answered <strong style={{ color: 'var(--color-text-primary)' }}><MathText text={result.userAnswer} /></strong>
                            </div>
                            <div style={{ fontSize: 13, color: '#16a34a' }}>
                              Correct answer <strong><MathText text={result.correctAnswer} /></strong>
                            </div>
                            {result.solution && (
                              <div style={{ padding: 14, borderRadius: 16, background: isDark ? 'rgba(15, 23, 42, 0.56)' : '#ffffff', border: '1px solid var(--color-border-tertiary)', fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
                                <MathText text={result.solution} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button onClick={resetQuiz} style={{ ...actionButtonStyle, flex: '1 1 220px', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-tertiary)' }}>
                  New quiz
                </button>
                <button onClick={generateQuiz} style={{ ...actionButtonStyle, flex: '1 1 220px', background: 'linear-gradient(135deg, #534ab7 0%, #00b4a0 120%)', color: '#fff', boxShadow: '0 18px 34px rgba(83, 74, 183, 0.24)' }}>
                  Retry same topics
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
