'use client';
import { X } from "lucide-react";
import MathRenderer from '@/components/MathRenderer';
import { isUnanswered } from '@meow/contracts/mock-answer';
import { useAuth } from '@/context/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import QuestionImage from '@/components/QuestionImage';
import MockCountdown from './MockCountdown';
import { createCoalescedSave } from '@/lib/coalesced-save';
import { abortError } from '@/shared/api/policy';
import BackButton from "@/components/BackButton";
import { useQuizLeaveGuard } from "@/hooks/useAppNavigation";
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
import { readStartResponse, clearStartResponse } from '@/lib/start-response-cache';
import { getMockStartKey, mockStartStorageKey } from './startKey';
import type { MockAttempt } from './api';
import styles from './MockTestEngine.module.css';
import { useMockTranslation } from './useMockTranslation';
import type { QuizLanguage } from '@meow/contracts/exam-paper';
// import { getExamConfig, getSlotById } from './exam-config';

function normalizeOption(option: string | MockOption, index: number): MockOption {
  return typeof option === 'string' ? { id: String(index), text: option } : option;
}

export default function MockTestEngine({ examSlug, testId }: { examSlug: string; testId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const ready = !authLoading && !!token && !!userId;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const saveScope = `${userId}:${examSlug}:${testId}`;
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const resumeAttemptId = searchParams?.get('resume');
  const requestedLanguage = searchParams?.get('lang') === 'bn' ? 'bn' : 'en';
  const scope = `${saveScope}:${resumeAttemptId ?? "start"}`;
  const resourceRef = useRef(scope);
  useEffect(() => { resourceRef.current = scope; }, [scope]);
  const loadController = useRef<AbortController | null>(null);
  const [loadedScope, setLoadedScope] = useState('');

  const [paper, setPaper] = useState<MockPaper | null>(null);
  const paperRef = useRef<MockPaper | null>(null);
  const [language, setLanguage] = useState<QuizLanguage>(searchParams?.get('lang') === 'bn' ? 'bn' : 'en');
  const [lockedSections, setLockedSections] = useState<string[]>([]);
  const [sectionsExhausted, setSectionsExhausted] = useState(false);
  const sectionTransitionRef = useRef(false);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string>(resumeAttemptId || '');
  const [answers, setAnswers] = useState<Record<string, MockAnswer>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const translationSection = paper?.sections[currentSection];
  const translated = useMockTranslation(translationSection?.questions[currentQuestion], translationSection?.label ?? translationSection?.title ?? '', paper?.schemaDriven ? language : searchParams?.get('lang') ?? null);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const [deadline, setDeadline] = useState(0);

  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRevisionRef = useRef(0);
  const attemptIdRef = useRef(resumeAttemptId || '');

  const conflictRef = useRef(false);
  const autoSubmitAttemptedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confidential, setConfidential] = useState(false);


  const writeProgress = useCallback(async (progress: Omit<AttemptProgress, 'revision'>, expectedScope: string) => {
    if (resourceRef.current !== expectedScope) throw abortError();
    if (conflictRef.current) throw new Error('Reload this attempt to resolve the save conflict.');
    const baseRevision = saveRevisionRef.current;
    setSaveStatus('Saving…');
    try {
      const result = await autosaveAttempt(attemptIdRef.current, { ...progress, baseRevision, revision: baseRevision + 1 }, tokenRef.current!);
      if (resourceRef.current !== expectedScope) return;
      saveRevisionRef.current = result.revision ?? baseRevision + 1;
      if (result.sectionRemainingTimes) {
        const nextSection = paperRef.current?.sections[result.currentSection];
        const remaining = nextSection?.key ? result.sectionRemainingTimes[nextSection.key] : null;
        setDeadline(remaining == null ? 0 : Date.now() + remaining * 1000);
        setLockedSections(result.lockedSections ?? []);
        setSectionsExhausted(result.sectionsExhausted === true);
        if (result.currentSection !== progress.currentSection) {
          setCurrentSection(result.currentSection);
          setCurrentQuestion(result.currentQuestion ?? 0);
          setShowSubmitModal(false);
        }
      }
      if (paperRef.current?.schemaDriven) {
        try {
          const key = `mock-attempt:${expectedScope}:${attemptIdRef.current}`;
          const draft = JSON.parse(localStorage.getItem(key) || 'null');
          if (draft) localStorage.setItem(key, JSON.stringify({ ...draft, revision: saveRevisionRef.current }));
        } catch { /* Server persistence remains available when browser storage is disabled. */ }
      }
      setSaveStatus('Progress saved');
    } catch (error) {
      if (resourceRef.current !== expectedScope) throw error;
      if (error instanceof Error && 'conflict' in error && error.conflict) { conflictRef.current = true; setHasConflict(true); }
      setSaveStatus(error instanceof Error ? error.message : 'Progress could not be saved.');
      throw error;
    }
  }, []);
  const saverRef = useRef<{ scope: string; value: ReturnType<typeof createCoalescedSave<Omit<AttemptProgress, 'revision'>>> } | null>(null);
  const getSaver = useCallback(() => {
    if (!saverRef.current || saverRef.current.scope !== scope) {
      saverRef.current = { scope, value: createCoalescedSave(progress => writeProgress(progress, scope),
        (a, b) => a.answers === b.answers && a.questionStatuses === b.questionStatuses
          && a.currentSection === b.currentSection && a.currentQuestion === b.currentQuestion
          && a.language === b.language && a.advanceSection === b.advanceSection) };
    }
    return saverRef.current.value;
  }, [scope, writeProgress]);
  const saveProgress = useCallback((progress: Omit<AttemptProgress, 'revision'>) => getSaver().save(progress), [getSaver]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const currentToken = tokenRef.current;
    if (!ready || !currentToken) return;
    try {
      setLoadError(null);
      let data;
      const created = resumeAttemptId ? readStartResponse<MockAttempt>(`mock:${examSlug}:${testId}`, userId, resumeAttemptId) : undefined;
      if (resumeAttemptId) {
        data = created ? await Promise.resolve(created.data) : await getAttempt(resumeAttemptId, currentToken, signal);
      } else {
        const startKey = getMockStartKey(userId, examSlug, testId);
        data = await startTest(examSlug, testId, currentToken, startKey);
        if (signal?.aborted) return;
        attemptIdRef.current = data.attemptId;
        setAttemptId(data.attemptId);
      }
      if (signal?.aborted) return;
      if (resumeAttemptId) { attemptIdRef.current = resumeAttemptId; setAttemptId(resumeAttemptId); }
      if (data.status === 'completed') {
        sessionStorage.removeItem(mockStartStorageKey(userId, examSlug, testId));
        router.replace(`/mock-test/${examSlug}/${testId}/result/${data.id || data.attemptId}`);
        return;
      }
      const nextPaper = data.paper;
      setConfidential(data.assessmentMode === 'confidential');
      if (!nextPaper?.sections?.length) throw new Error('Attempt did not include a valid paper');
      setPaper(nextPaper);
      paperRef.current = nextPaper;
      setLoadedScope(scope);
      const sectionKey = nextPaper.sections[data.currentSection ?? 0]?.key;
      const remaining = nextPaper.schemaDriven ? (sectionKey ? data.sectionRemainingTimes?.[sectionKey] : null) : data.timeLeft ?? (nextPaper.totalDurationMin ?? 60) * 60;
      setDeadline(remaining == null ? 0 : (created?.receivedAt ?? Date.now()) + remaining * 1000);
      setLockedSections(data.lockedSections ?? []);
      setSectionsExhausted(data.sectionsExhausted === true);
      sectionTransitionRef.current = false;
      setSectionSaving(false);
      setSectionError(null);
      let loadedAnswers = data.answers ?? {};
      let loadedStatuses = data.questionStatuses ?? {};
      let loadedLanguage = data.language ?? requestedLanguage;
      let loadedQuestion = data.currentQuestion ?? 0;
      if (nextPaper.schemaDriven) {
        try {
          const draft = JSON.parse(localStorage.getItem(`mock-attempt:${scope}:${data.attemptId || data.id || resumeAttemptId}`) || 'null');
          if (draft && draft.revision === (data.revision ?? 0)) {
            const openIds = new Set(nextPaper.sections.filter(section => !data.lockedSections?.includes(section.key!)).flatMap(section => section.questions.map(question => question.id)));
            const recover = (saved: Record<string, unknown>, local: Record<string, unknown>) => ({ ...Object.fromEntries(Object.entries(saved).filter(([id]) => !openIds.has(id))), ...Object.fromEntries(Object.entries(local || {}).filter(([id]) => openIds.has(id))) });
            loadedAnswers = recover(loadedAnswers, draft.answers) as typeof loadedAnswers;
            loadedStatuses = recover(loadedStatuses, draft.questionStatuses) as typeof loadedStatuses;
            loadedLanguage = draft.language === 'bn' ? 'bn' : 'en';
            if (draft.currentSection === data.currentSection) loadedQuestion = Math.max(0, Math.min(nextPaper.sections[data.currentSection ?? 0].questions.length - 1, Number(draft.currentQuestion) || 0));
          }
        } catch { /* Ignore unavailable storage and malformed drafts. */ }
      }
      getSaver().seed({ answers: data.answers ?? (nextPaper.schemaDriven ? {} : loadedAnswers), questionStatuses: data.questionStatuses ?? (nextPaper.schemaDriven ? {} : loadedStatuses),
        currentSection: data.currentSection ?? 0, currentQuestion: data.currentQuestion ?? 0, ...(nextPaper.schemaDriven ? { language: data.language ?? loadedLanguage } : {}) });
      setAnswers(loadedAnswers);
      setQuestionStatuses(loadedStatuses);
      setCurrentSection(data.currentSection ?? 0);
      setCurrentQuestion(loadedQuestion);
      setLanguage(loadedLanguage);
      saveRevisionRef.current = data.revision ?? 0;
      conflictRef.current = false;
      setHasConflict(false);
      autoSubmitAttemptedRef.current = false;
      if (resumeAttemptId) clearStartResponse(`mock:${examSlug}:${testId}`, userId, resumeAttemptId);
    } catch (e) {
      if (signal?.aborted) return;
      console.error('Failed to load test', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load test');
    }
  }, [examSlug, testId, userId, ready, resumeAttemptId, router, getSaver, scope, requestedLanguage]);


  useEffect(() => {
    const controller = new AbortController();
    loadController.current = controller;
    // Fetching the attempt is the external synchronization boundary for this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the route-bound attempt must load immediately for timer and recovery correctness.
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const saveLatestProgress = useEffectEvent(() => {
    if (!attemptId || !token || isSubmitting || loadedScope !== scope) return;
    void saveProgress({ answers, questionStatuses, currentSection, currentQuestion, ...(paper?.schemaDriven ? { language } : {}) }).catch(console.error);
  });

  // Keep a stable interval while reading the latest committed answers.
  useEffect(() => {
    if (!attemptId || !ready) return;
    autosaveTimerRef.current = setInterval(() => {
      saveLatestProgress();
    }, 20000);
    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [attemptId, ready]);

  useEffect(() => {
    if (!paper?.schemaDriven || !ready || loadedScope !== scope || !attemptId || isSubmitting) return;
    const progress = { answers, questionStatuses, currentSection, currentQuestion, language };
    try {
      localStorage.setItem(`mock-attempt:${scope}:${attemptId}`, JSON.stringify({ ...progress, paperId: testId, revision: saveRevisionRef.current }));
    } catch { /* Continue with server autosave if storage is unavailable. */ }
    const timer = setTimeout(() => { void saveProgress(progress).catch(console.error); }, 700);
    return () => clearTimeout(timer);
  }, [answers, questionStatuses, currentSection, currentQuestion, language, paper, ready, loadedScope, scope, attemptId, isSubmitting, saveProgress, testId]);

  useEffect(() => {
    if (!paper?.schemaDriven || loadedScope !== scope) return;
    const id = paper.sections[currentSection]?.questions[currentQuestion]?.id;
    // Record the displayed question, independently of answer and language state.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigation marks the newly displayed question visited.
    if (id) setQuestionStatuses(previous => previous[id] ? previous : { ...previous, [id]: 'not_answered' });
  }, [paper, currentSection, currentQuestion, loadedScope, scope]);

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

  useQuizLeaveGuard(Boolean(paper) && (paper?.schemaDriven === true || deadline > 0) && !isSubmitting,
    `/mock-test/${examSlug}`,
    "Leave this mock test? Saved progress is retained, but the exam timer will continue.");

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting || !attemptId || !token) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      try {
        await saveProgress({ answers, questionStatuses, currentSection, currentQuestion, ...(paper?.schemaDriven ? { language } : {}) });
      } catch (error) {
        // Expired attempts must still submit their last server-saved answers.
        // A retry after a lost submit response must also reach the idempotent endpoint.
        if (!(error instanceof Error && 'submissionAllowed' in error && error.submissionAllowed)) throw error;
      }
      await submitAttempt(attemptId, token);
      sessionStorage.removeItem(mockStartStorageKey(userId, examSlug, testId));
      try { localStorage.removeItem(`mock-attempt:${scope}:${attemptId}`); } catch { /* Storage may be unavailable. */ }
      router.replace(`/mock-test/${examSlug}/${testId}/result/${attemptId}`);
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
    userId,
    token,
    saveProgress,
    paper,
    language,
    scope,
  ]);

  useEffect(() => {
    if (!sectionsExhausted || isSubmitting || autoSubmitAttemptedRef.current) return;
    autoSubmitAttemptedRef.current = true;
    void handleFinalSubmit();
  }, [sectionsExhausted, isSubmitting, handleFinalSubmit]);

  const finishSection = (statuses = questionStatuses) => {
    if (sectionTransitionRef.current) return;
    sectionTransitionRef.current = true;
    setSectionSaving(true);
    setSectionError(null);
    void saveProgress({ answers, questionStatuses: statuses, currentSection, currentQuestion, language, advanceSection: true })
      .catch(error => { setSectionError(error instanceof Error ? error.message : 'Could not save this section. Please retry.'); })
      .finally(() => { sectionTransitionRef.current = false; setSectionSaving(false); });
  };

  const handleExpire = () => {
    if (!paper || isSubmitting || autoSubmitAttemptedRef.current) return;
    if (paper.schemaDriven && !paper.compositeTimer) { if (!sectionError) finishSection(); return; }
    autoSubmitAttemptedRef.current = true;
    void handleFinalSubmit();
  };

  const updateStatus = (qId: string, status: QuestionStatus) => {
    setQuestionStatuses(prev => ({ ...prev, [qId]: status }));
  };

  const handleSelectOption = (qId: string, optId: MockAnswer) => {
    if (sectionSaving || sectionError || sectionsExhausted) return;
    setAnswers(prev => ({ ...prev, [qId]: optId }));
    if (paper?.schemaDriven) setQuestionStatuses(prev => ({ ...prev, [qId]: prev[qId] === 'marked' || prev[qId] === 'answered_marked' ? 'answered_marked' : 'answered' }));
    // Just answering doesn't change status to 'answered' yet until 'Save & Next' according to common engine patterns,
    // but we can mark it immediately if preferred. Let's wait for Save & Next for strict SSC/banking pattern.
  };

  const clearResponse = (qId: string) => {
    if (sectionSaving || sectionError || sectionsExhausted) return;
    if (paper?.schemaDriven) setQuestionStatuses(prev => ({ ...prev, [qId]: prev[qId] === 'marked' || prev[qId] === 'answered_marked' ? 'marked' : 'not_answered' }));
    setAnswers(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleSaveAndNext = () => {
    if (!paper || sectionSaving || sectionError) return;
    const qId = paper.sections[currentSection].questions[currentQuestion].id;
    if (!isUnanswered(answers[qId])) {
      updateStatus(qId, 'answered');
    } else {
      updateStatus(qId, 'not_answered');
    }
    goToNextQuestion({ ...questionStatuses, [qId]: isUnanswered(answers[qId]) ? 'not_answered' : 'answered' });
  };

  const handleMarkForReview = () => {
    if (!paper || sectionSaving || sectionError) return;
    const qId = paper.sections[currentSection].questions[currentQuestion].id;
    if (!isUnanswered(answers[qId])) {
      updateStatus(qId, 'answered_marked');
    } else {
      updateStatus(qId, 'marked');
    }
    goToNextQuestion({ ...questionStatuses, [qId]: isUnanswered(answers[qId]) ? 'marked' : 'answered_marked' });
  };

  const goToNextQuestion = (statuses = questionStatuses) => {
    if (!paper) return;
    const currentSec = paper.sections[currentSection];
    if (currentQuestion < currentSec.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentSection < paper.sections.length - 1) {
      if (paper.schemaDriven && !paper.compositeTimer) { finishSection(statuses); return; }
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
    if (sectionSaving || sectionError) return;
    if (paper?.schemaDriven && !paper.compositeTimer && secIdx !== currentSection) return;
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

  if (loadError) return <div className={styles.container}><p role="alert">{loadError}</p><button data-ui-button="state" onClick={() => void loadData(loadController.current?.signal)}>Retry loading test</button></div>;

  if (!paper || loadedScope !== scope || !ready) return (
    <div className={styles.container} style={{justifyContent: 'center', alignItems: 'center', padding: 20, textAlign: 'center'}}>
      <h1 style={{ fontSize: '24px', color: '#64748b', margin: '0 0 12px 0' }}>Setting up your mock test environment...</h1>
      <p style={{ fontSize: '16px', color: '#94a3b8', margin: 0, maxWidth: 400 }}>Please wait while we initialize the secure testing engine, load your questions, and start the timer.</p>
    </div>
  );

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
    <div className={styles.container}>
      {confidential && <div role="note" style={{ padding: '8px 16px', fontSize: 12 }}>Confidential assessment · One attempt · {paper.compositeTimer ? 'Total exam time' : 'Section timing'} applies · No answer review</div>}
      {paper.schemaDriven && <div className={styles.languageBar} role="group" aria-label="Question language">
        <button data-ui-button="state" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>ENG</button>
        <span aria-hidden="true">|</span>
        <button data-ui-button="state" aria-pressed={language === 'bn'} onClick={() => setLanguage('bn')}>বাংলা</button>
      </div>}
      {saveStatus && <div role="status">{saveStatus}{hasConflict && <button data-ui-button="state" onClick={() => window.location.reload()}>Reload saved attempt</button>}</div>}
      {sectionSaving && <div role="status">Saving section…</div>}
      {sectionError && <div role="alert">{sectionError}<button data-ui-button="state" disabled={hasConflict || sectionSaving} onClick={() => finishSection()}>Retry saving section</button></div>}
      {submitError && <div role="alert">{submitError}<button data-ui-button="state" disabled={isSubmitting} onClick={() => void handleFinalSubmit()}>Retry submission</button></div>}
      {/* Top Bar */}
      {isDesktop ? (
        <div data-ui-chrome="header" className={styles.topBar}>
          <BackButton href={`/mock-test/${examSlug}`} label="Leave mock test" />
          <div className={styles.examName}>{examSlug.toUpperCase()}</div>
          <div className={styles.timer}>{deadline > 0 ? <MockCountdown deadline={deadline} onExpire={handleExpire} /> : 'Untimed'}</div>
          <button data-ui-button="primary" className={styles.submitBtn} onClick={() => setShowSubmitModal(true)}>Submit Test</button>
        </div>
      ) : (
        <div data-ui-chrome="header" className={styles.mobileHeader}>
          <BackButton href={`/mock-test/${examSlug}`} label="Leave mock test" />
          <div className={styles.examName} style={{fontSize: '1rem'}}>{examSlug.toUpperCase()}</div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <div className={styles.timer} style={{fontSize: '1rem'}}>{deadline > 0 ? <MockCountdown deadline={deadline} onExpire={handleExpire} /> : 'Untimed'}</div>
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
                <div key={sec.id ?? sec.key ?? idx} className={`${styles.tab} ${currentSection === idx ? styles.active : ''}`} onClick={() => jumpToQuestion(idx, 0)} aria-disabled={paper.schemaDriven && !paper.compositeTimer && idx !== currentSection} aria-label={`${sec.title ?? sec.label}${lockedSections.includes(sec.key ?? "") ? " (locked)" : ""}`} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
                <div key={sec.id ?? sec.key ?? idx} className={`${styles.mobileTab} ${currentSection === idx ? styles.active : ''}`} onClick={() => jumpToQuestion(idx, 0)} aria-disabled={paper.schemaDriven && !paper.compositeTimer && idx !== currentSection} aria-label={`${sec.title ?? sec.label}${lockedSections.includes(sec.key ?? "") ? " (locked)" : ""}`} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                  {sec.title ?? sec.label}
                </div>
              ))}
            </div>
          )}

          <div className={styles.questionContent}>
            <div className={styles.qNumber}>Question {currentQuestion + 1}</div>
            {translated.pending && <p role="status">Translating…</p>}
            <div className={styles.qText}>{renderMath(translated.texts[0])}</div>
            {(currentQ.image || currentQ.questionImage) && (
              <QuestionImage
                src={(currentQ.image || currentQ.questionImage)!}
                alt="Question figure"
                className={styles.qImage}
                width={currentQ.questionImageWidth}
                height={currentQ.questionImageHeight}
                critical
              />
            )}

            {currentQ.questionType === 'NAT' && <label className={styles.optionLabel}>Numerical answer
              <input type="text" inputMode="decimal" aria-label="Numerical answer" placeholder="Enter a number" value={String(answers[currentQ.id] ?? '')} onChange={event => handleSelectOption(currentQ.id, event.target.value)} />
            </label>}
            {currentQ.questionType === 'MSQ' && <p>Select all correct options. No partial credit.</p>}
            <div className={styles.options}>
              {(currentQ.options ?? []).map((rawOption, optionIndex) => {
                const opt = normalizeOption(rawOption, optionIndex);
                const answer = answers[currentQ.id];
                const selected = Array.isArray(answer) ? answer : [];
                const isSelected = currentQ.questionType === 'MSQ' ? selected.includes(opt.id) : answer === opt.id;
                return (
                  <label key={opt.id} className={`${styles.optionLabel} ${isSelected ? styles.selected : ''}`}>
                    <input
                      type={currentQ.questionType === 'MSQ' ? 'checkbox' : 'radio'}
                      name={`q-${currentQ.id}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(currentQ.id, currentQ.questionType === 'MSQ' ? isSelected ? selected.filter(value => value !== opt.id) : [...selected, opt.id] : opt.id)}
                      aria-label={`Answer ${translated.texts[optionIndex + 1] ?? opt.text}`}
                    />
                    <span>{renderMath(translated.texts[optionIndex + 1] ?? opt.text)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Desktop Actions */}
          {isDesktop && (
            <div data-ui-chrome="footer" className={styles.actionsBar}>
              <div className={styles.btnGroup}>
                <button data-ui-button="secondary" className={styles.btnOutline} onClick={goToPreviousQuestion} disabled={currentQuestion === 0}>Previous</button>
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
      {!isDesktop && showPalette && (
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
            <p><span>Answered & Marked:</span> <strong>{counts.answeredMarked}</strong></p>
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
