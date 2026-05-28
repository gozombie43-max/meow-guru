'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import axios from '@/lib/axios';
import { useThemeMode } from '@/hooks/useTheme';

interface Question {
  id: string;
  topic: string;
  subject: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  _adaptiveReason?: string;
}

interface QuizMeta {
  quizStrategy: string;
  overallInsight: string;
  focusArea: string;
  estimatedDuration: number;
  totalQuestions: number;
  topicBreakdown: { topic: string; count: number }[];
  source: string;
}

interface Answer {
  questionId: string;
  userAnswer: string;
  timeSpent: number;
  changedAnswer: boolean;
}

interface Result {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  solution: string;
  userAnswer: string;
  topic: string;
  subject: string;
}

type Phase = 'config' | 'briefing' | 'quiz' | 'results';

const SUBJECT_COLORS: Record<string, string> = {
  Reasoning: '#534AB7',
  Mathematics: '#185FA5',
  English: '#0F6E56',
  'General Awareness': '#854F0B',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const STRATEGY_LABEL: Record<string, string> = {
  struggling: 'Foundation Mode — building your base',
  developing: 'Growth Mode — pushing your limits',
  proficient: 'Challenge Mode — exam-level pressure',
};

function MathText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    if (typeof window !== 'undefined' && (window as any).katex) {
      try {
        const html = text
          .replace(/\\\[([\s\S]*?)\\\]/g, (_, value) => (window as any).katex.renderToString(value, { displayMode: true, throwOnError: false }))
          .replace(/\\\(([\s\S]*?)\\\)/g, (_, value) => (window as any).katex.renderToString(value, { displayMode: false, throwOnError: false }));
        ref.current.innerHTML = html;
        return;
      } catch {
        // Fall back to plain text below.
      }
    }

    ref.current.textContent = text;
  }, [text]);

  return <span ref={ref} />;
}

export default function AdaptiveQuizPage() {
  const { theme } = useThemeMode();
  const isDark = theme === 'dark';

  const shellStyle: CSSProperties = {
    minHeight: 'calc(100vh - 84px)',
    paddingBottom: '6rem',
    background: isDark
      ? 'radial-gradient(circle at top, rgba(99, 102, 241, 0.12), transparent 34%), linear-gradient(180deg, #060816 0%, #090d18 100%)'
      : 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
    color: isDark ? '#e5eefc' : '#0f172a',
    '--color-text-primary': isDark ? '#e5eefc' : '#0f172a',
    '--color-text-secondary': isDark ? '#94a3b8' : '#475569',
    '--color-text-tertiary': isDark ? '#64748b' : '#94a3b8',
    '--color-border-tertiary': isDark ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0',
    '--color-background-secondary': isDark ? 'rgba(15, 23, 42, 0.78)' : '#ffffff',
    '--color-background-danger': isDark ? 'rgba(127, 29, 29, 0.24)' : '#fee2e2',
    '--color-text-danger': isDark ? '#fecaca' : '#991b1b',
  } as CSSProperties;

  const [phase, setPhase] = useState<Phase>('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [subjects, setSubjects] = useState(['Reasoning', 'Mathematics', 'English', 'General Awareness']);
  const [qCount, setQCount] = useState(20);
  const [mode, setMode] = useState('adaptive');
  const [excludeOwn, setExcludeOwn] = useState(false);
  const [topicsModalOpen, setTopicsModalOpen] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<Record<string, string[]>>({});
  const [topicsSelected, setTopicsSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!topicsModalOpen) return;
    let canceled = false;
    (async () => {
      try {
        const { data } = await axios.get('/api/adaptive-quiz/topics');
        if (canceled) return;
        setAvailableTopics(data.subjects || {});
      } catch {
        // ignore
      }
    })();
    return () => { canceled = true; };
  }, [topicsModalOpen]);

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

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || 'demo-user' : 'demo-user';

  useEffect(() => {
    if (phase === 'quiz') {
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
        topics: topicsSelected.length > 0 ? topicsSelected : undefined,
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
  };

  const submitQuiz = async () => {
    setLoading(true);

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
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Submission failed.');
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
  };

  if (phase === 'config') {
    return (
      <div style={{ ...shellStyle, maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '.25rem' }}>Adaptive Quiz</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '.9rem', marginBottom: '2rem' }}>
          AI analyzes your pattern and builds a personalized quiz from your weak areas.
        </p>

        {error && (
          <div style={{ background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', padding: '.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '.5rem' }}>
            Subjects
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Reasoning', 'Mathematics', 'English', 'General Awareness'].map((subject) => {
              const active = subjects.includes(subject);
              return (
                <button
                  key={subject}
                  onClick={() => setSubjects((previous) => (active ? previous.filter((value) => value !== subject) : [...previous, subject]))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: '.85rem',
                    cursor: 'pointer',
                    border: `1.5px solid ${active ? SUBJECT_COLORS[subject] : 'var(--color-border-tertiary)'}`,
                    background: active ? `${SUBJECT_COLORS[subject]}18` : 'transparent',
                    color: active ? SUBJECT_COLORS[subject] : 'var(--color-text-secondary)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {subject}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '.5rem' }}>
            Questions — {qCount}
          </label>
          <input type="range" min={10} max={40} step={5} value={qCount} onChange={(event) => setQCount(+event.target.value)} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            <span>10 (~7 min)</span><span>25 (~19 min)</span><span>40 (~30 min)</span>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '.5rem' }}>
            Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { value: 'adaptive', label: 'Adaptive', desc: 'AI chooses based on your pattern' },
              { value: 'weak-only', label: 'Weak Topics', desc: 'Only topics below 60% accuracy' },
              { value: 'revision', label: 'Revision', desc: 'Topics not practiced in 7+ days' },
              { value: 'explore', label: 'Explore', desc: '50% new topics you haven\'t tried' },
            ].map((item) => (
              <div
                key={item.value}
                onClick={() => setMode(item.value)}
                style={{
                  padding: '.75rem',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1.5px solid ${mode === item.value ? '#534AB7' : 'var(--color-border-tertiary)'}`,
                  background: mode === item.value ? '#EEEDFE' : 'transparent',
                }}
              >
                <div style={{ fontSize: '.875rem', fontWeight: 500, color: mode === item.value ? '#3C3489' : 'var(--color-text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: '.75rem', color: mode === item.value ? '#534AB7' : 'var(--color-text-secondary)', marginTop: 2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={generateQuiz}
          disabled={loading || subjects.length === 0}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            background: subjects.length === 0 ? 'var(--color-border-tertiary)' : '#534AB7',
            color: '#fff',
            border: 'none',
          }}
        >
          {loading ? 'Analyzing your pattern…' : 'Generate Adaptive Quiz →'}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <label style={{ fontSize: '.9rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={excludeOwn} onChange={(e) => setExcludeOwn(e.target.checked)} /> Exclude my own questions
        </label>
        <button onClick={() => setTopicsModalOpen(true)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'transparent', cursor: 'pointer' }}>Choose topics…</button>
      </div>

      {topicsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ width: 720, maxHeight: '80vh', overflow: 'auto', background: 'var(--color-background-secondary)', padding: 16, borderRadius: 12 }}>
            <h3 style={{ margin: 0, marginBottom: 8 }}>Choose topics to focus</h3>
            <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-secondary)' }}>Select one or more topics across subjects. Max 6 topics will be used.</p>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: 8 }}>Subjects</div>
                {Object.keys(availableTopics).map((sub) => (
                  <div key={sub} style={{ marginBottom: 6 }}>
                    <button onClick={() => { /* noop - subject selector could be added */ }} style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'left', background: 'transparent', border: '1px solid var(--color-border-tertiary)' }}>{sub}</button>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1 }}>
                {Object.entries(availableTopics).map(([sub, topics]) => (
                  <div key={sub} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: 6 }}>{sub}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {topics.map((t) => {
                        const active = topicsSelected.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              setTopicsSelected((prev) => {
                                if (prev.includes(t)) return prev.filter(x => x !== t);
                                if (prev.length >= 6) return prev; // limit
                                return [...prev, t];
                              });
                            }}
                            style={{
                              padding: '6px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${active ? '#534AB7' : 'var(--color-border-tertiary)'}`,
                              background: active ? '#EEF2FF' : 'transparent', color: active ? '#382B8A' : 'var(--color-text-primary)'
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setTopicsModalOpen(false)} style={{ padding: '8px 12px', borderRadius: 8 }}>Close</button>
              <button onClick={() => setTopicsModalOpen(false)} style={{ padding: '8px 12px', borderRadius: 8, background: '#534AB7', color: '#fff' }}>Apply</button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  if (phase === 'briefing' && meta) {
    return (
      <div style={{ ...shellStyle, maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderRadius: 12, marginBottom: '1.25rem', background: '#EEEDFE', border: '1px solid #AFA9EC' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#534AB7', marginBottom: '.5rem' }}>
            {STRATEGY_LABEL[meta.quizStrategy] || 'Adaptive Mode'}
            {meta.source === 'azure-openai' && (
              <span style={{ marginLeft: 8, background: '#534AB7', color: '#fff', fontSize: '.65rem', padding: '1px 6px', borderRadius: 10 }}>AI</span>
            )}
          </div>
          <p style={{ fontSize: '.9rem', color: '#3C3489', lineHeight: 1.6, margin: 0 }}>{meta.overallInsight}</p>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--color-text-secondary)', marginBottom: '.75rem' }}>
            Today\'s focus
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meta.topicBreakdown.map((topic) => (
              <div key={topic.topic} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.625rem .875rem', borderRadius: 8, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: SUBJECT_COLORS[Object.keys(SUBJECT_COLORS).find((subject) => subject.toLowerCase().includes(topic.topic.toLowerCase().split(' ')[0])) || 'Reasoning'] || '#534AB7' }} />
                <span style={{ flex: 1, fontSize: '.875rem' }}>{topic.topic}</span>
                <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{topic.count}Q</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', padding: '.875rem', borderRadius: 10, background: 'var(--color-background-secondary)' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{meta.totalQuestions}</div>
            <div style={{ fontSize: '.75rem', color: 'var(--color-text-secondary)' }}>questions</div>
          </div>
          <div style={{ width: 1, background: 'var(--color-border-tertiary)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{Math.ceil(meta.estimatedDuration / 60)} min</div>
            <div style={{ fontSize: '.75rem', color: 'var(--color-text-secondary)' }}>estimated</div>
          </div>
          <div style={{ width: 1, background: 'var(--color-border-tertiary)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{meta.focusArea}</div>
            <div style={{ fontSize: '.75rem', color: 'var(--color-text-secondary)' }}>focus area</div>
          </div>
        </div>

        <button
          onClick={() => {
            setPhase('quiz');
            setQuestionStartTime(Date.now());
          }}
          style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: '1rem', fontWeight: 600, cursor: 'pointer', background: '#534AB7', color: '#fff', border: 'none' }}
        >
          Start Quiz →
        </button>
      </div>
    );
  }

  if (phase === 'quiz') {
    const question = questions[currentIdx];
    const answered = answers[question?.id];
    const progress = Math.round(((currentIdx + (answered ? 1 : 0)) / questions.length) * 100);

    return (
      <div style={{ ...shellStyle, maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
          <span style={{ fontSize: '.85rem', color: 'var(--color-text-secondary)' }}>{currentIdx + 1} / {questions.length}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.9rem', fontWeight: 500, color: elapsed > (meta?.estimatedDuration || 9999) ? '#A32D2D' : 'inherit' }}>{formatTime(elapsed)}</span>
          <span style={{ fontSize: '.75rem', padding: '3px 8px', borderRadius: 10, background: { easy: '#EAF3DE', medium: '#FAEEDA', hard: '#FCEBEB' }[question?.difficulty] || '#F1EFE8', color: { easy: '#3B6D11', medium: '#854F0B', hard: '#A32D2D' }[question?.difficulty] || '#888' }}>{DIFFICULTY_LABEL[question?.difficulty] || ''}</span>
        </div>

        <div style={{ height: 4, background: 'var(--color-border-tertiary)', borderRadius: 2, marginBottom: '1.25rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#534AB7', width: `${progress}%`, borderRadius: 2, transition: 'width .3s ease' }} />
        </div>

        <div style={{ fontSize: '.75rem', marginBottom: '.75rem', color: SUBJECT_COLORS[question?.subject] || '#534AB7', fontWeight: 500 }}>
          {question?.subject} · {question?.topic}
          {question?._adaptiveReason && <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>— {question._adaptiveReason}</span>}
        </div>

        <div style={{ fontSize: '1rem', lineHeight: 1.7, marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)' }}>
          <MathText text={question?.question || ''} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
          {(question?.options || []).map((option, index) => {
            const letter = String.fromCharCode(65 + index);
            const isSelected = selected === option || selected === letter;
            const isAnswered = !!answered;

            let borderColor = 'var(--color-border-tertiary)';
            let bgColor = 'transparent';

            if (isSelected && !isAnswered) {
              borderColor = '#534AB7';
              bgColor = '#EEEDFE';
            }

            return (
              <div
                key={index}
                onClick={() => !isAnswered && selectAnswer(option)}
                style={{
                  padding: '.875rem 1rem',
                  borderRadius: 10,
                  cursor: isAnswered ? 'default' : 'pointer',
                  border: `1.5px solid ${borderColor}`,
                  background: bgColor,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <span style={{ fontSize: '.8rem', fontWeight: 600, flexShrink: 0, paddingTop: 2, color: isSelected && !isAnswered ? '#534AB7' : 'var(--color-text-secondary)' }}>{letter}</span>
                <span style={{ fontSize: '.9rem', lineHeight: 1.5 }}><MathText text={option} /></span>
              </div>
            );
          })}
        </div>

        {!answered ? (
          <button
            onClick={confirmAnswer}
            disabled={!selected}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              fontSize: '.95rem',
              fontWeight: 600,
              cursor: selected ? 'pointer' : 'not-allowed',
              background: selected ? '#534AB7' : 'var(--color-border-tertiary)',
              color: selected ? '#fff' : 'var(--color-text-tertiary)',
              border: 'none',
            }}
          >
            Confirm Answer
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              fontSize: '.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: currentIdx === questions.length - 1 ? '#185FA5' : '#534AB7',
              color: '#fff',
              border: 'none',
            }}
          >
            {currentIdx === questions.length - 1 ? 'Submit Quiz →' : 'Next Question →'}
          </button>
        )}
      </div>
    );
  }

  if (phase === 'results') {
    const correct = results.filter((result) => result.isCorrect).length;
    const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;

    return (
      <div style={{ ...shellStyle, maxWidth: 600, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem', padding: '1.5rem', borderRadius: 16, background: pct >= 70 ? '#EAF3DE' : pct >= 50 ? '#FAEEDA' : '#FCEBEB', border: `1px solid ${pct >= 70 ? '#97C459' : pct >= 50 ? '#EF9F27' : '#F09595'}` }}>
          <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: pct >= 70 ? '#27500A' : pct >= 50 ? '#633806' : '#791F1F' }}>{pct}%</div>
          <div style={{ fontSize: '1rem', color: pct >= 70 ? '#3B6D11' : pct >= 50 ? '#854F0B' : '#A32D2D', marginTop: '.25rem' }}>
            {correct} / {results.length} correct · {formatTime(elapsed)}
          </div>
          <div style={{ fontSize: '.8rem', color: 'rgba(0,0,0,0.45)', marginTop: '.45rem' }}>Raw score: {score}</div>
        </div>

        {topicAccuracy.length > 0 && (
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--color-text-secondary)', marginBottom: '.75rem' }}>
              By topic
            </div>
            {topicAccuracy.slice().sort((left, right) => left.accuracy - right.accuracy).map((topic) => (
              <div key={topic.topic} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 4 }}>
                  <span>{topic.topic}</span>
                  <span style={{ fontWeight: 600, color: topic.accuracy >= 70 ? '#27500A' : topic.accuracy >= 50 ? '#633806' : '#A32D2D' }}>{topic.accuracy}% ({topic.correct}/{topic.total})</span>
                </div>
                <div style={{ height: 6, background: 'var(--color-border-tertiary)', borderRadius: 3 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${topic.accuracy}%`, background: topic.accuracy >= 70 ? '#639922' : topic.accuracy >= 50 ? '#BA7517' : '#E24B4A', transition: 'width .5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--color-text-secondary)', marginBottom: '.75rem' }}>
            Review ({results.filter((result) => !result.isCorrect).length} wrong)
          </div>
          {results.filter((result) => !result.isCorrect).map((result, index) => (
            <div key={result.questionId} style={{ marginBottom: 10, borderRadius: 10, border: '0.5px solid #F09595', background: '#FCEBEB', overflow: 'hidden' }}>
              <div onClick={() => setExpandedResult(expandedResult === result.questionId ? null : result.questionId)} style={{ padding: '.75rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.85rem', color: '#791F1F' }}>Q{index + 1} · {result.topic}</span>
                <span style={{ fontSize: '.75rem', color: '#A32D2D' }}>{expandedResult === result.questionId ? '▲' : '▼'} See solution</span>
              </div>
              {expandedResult === result.questionId && (
                <div style={{ padding: '.75rem 1rem', borderTop: '0.5px solid #F09595', background: '#fff' }}>
                  <div style={{ fontSize: '.8rem', color: '#A32D2D', marginBottom: '.5rem' }}>
                    You answered: <strong>{result.userAnswer}</strong>
                  </div>
                  <div style={{ fontSize: '.8rem', color: '#27500A', marginBottom: '.75rem' }}>
                    Correct: <strong>{result.correctAnswer}</strong>
                  </div>
                  {result.solution && (
                    <div style={{ fontSize: '.82rem', color: '#444', lineHeight: 1.6, padding: '.625rem .75rem', background: '#f8f8f8', borderRadius: 8 }}>
                      <MathText text={result.solution} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={resetQuiz} style={{ flex: 1, padding: '13px', borderRadius: 12, fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid #534AB7', background: 'transparent', color: '#534AB7' }}>
            New Quiz
          </button>
          <button onClick={generateQuiz} style={{ flex: 1, padding: '13px', borderRadius: 12, fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', background: '#534AB7', color: '#fff', border: 'none' }}>
            Retry Same Topics
          </button>
        </div>
      </div>
    );
  }

  return null;
}
