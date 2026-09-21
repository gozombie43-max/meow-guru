"use client";
import { useBackLayer, useQuizLeaveGuard } from "@/hooks/useAppNavigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Clock,
  Flame,
  Heart,
  List,
  X,
  Check,
  Layers,
  RotateCcw,
  Route,
  Shield,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import RichContent from "@/components/RichContent";
import { useThemeMode } from "@/hooks/useTheme";
import { modes, type Confidence, type ModeId, type TrainingSession } from "./training-types";
import { TrainingResults } from "./TrainingResults";
import "@/app/(app)/play/play.css";
import "./training-session.css";

const clock = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${String(Math.max(0, n) % 60).padStart(2, "0")}`;

function ModeIcon({ mode }: { mode?: ModeId | string }) {
  switch (mode) {
    case "adaptive":
      return <Brain size={16} />;
    case "challenge":
      return <Target size={16} />;
    case "sprint":
      return <Zap size={16} />;
    case "pressure":
      return <Timer size={16} />;
    case "section":
      return <Layers size={16} />;
    case "gauntlet":
      return <Route size={16} />;
    case "nightmare":
      return <Flame size={16} />;
    case "survival":
      return <Shield size={16} />;
    case "review":
      return <RotateCcw size={16} />;
    case "mission":
      return <Sparkles size={16} />;
    default:
      return <Brain size={16} />;
  }
}

export default function TrainingSessionView({ id }: { id: string }) {
  const { theme } = useThemeMode();
  const router = useRouter();
  const [session, setSession] = useState<TrainingSession | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(0);
  const [choice, setChoice] = useState<number | null>(null),
    [confidence, setConfidence] = useState<Confidence | null>(null),
    [confirmFinish, setConfirmFinish] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const finishRef = useRef<HTMLDialogElement>(null);
  useQuizLeaveGuard(session?.status === "active", "/play", "Leave this training quiz? Saved answers will remain, but the session timer may continue.");
  useBackLayer(showOverview, () => setShowOverview(false));
  useBackLayer(confirmFinish, () => { if (!busy) setConfirmFinish(false); });
  const offset = useRef(0),
    sending = useRef(false);
  const accept = useCallback((s: TrainingSession) => {
    offset.current = s.serverNow - Date.now();
    setSession(s);
    setNow(s.serverNow);
    setChoice(s.answers[s.questions[s.current].id]?.choice ?? null);
    setConfidence(s.answers[s.questions[s.current].id]?.confidence ?? null);
  }, []);
  const reload = useCallback(async () => {
    try {
      const { data } = await api.get<TrainingSession>(
        `/api/training/sessions/${id}`,
      );
      accept(data);
      setError("");
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error || "Could not load the session."
          : "Could not load the session.",
      );
    }
  }, [id, accept]);
  useEffect(() => {
    let active = true;
    api
      .get<TrainingSession>(`/api/training/sessions/${id}`)
      .then(({ data }) => {
        if (active) accept(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load the session. Check your connection and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, accept]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  const act = useCallback(
    async (action: Record<string, unknown>) => {
      if (!session || sending.current) return;
      sending.current = true;
      setBusy(true);
      setError("");
      try {
        const { data } = await api.post<TrainingSession>(
          `/api/training/sessions/${id}/actions`,
          { ...action, revision: session.revision },
        );
        if (data.status === "abandoned") {
          router.replace("/play");
          return;
        }
        accept(data);
        setConfirmFinish(false);
      } catch (e) {
        setError(
          isAxiosError(e)
            ? e.response?.data?.error ||
                "Save failed. Reload the saved session before retrying."
            : "Save failed. Reload before retrying.",
        );
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [id, session, accept, router],
  );
  const remaining = session
    ? Math.max(
        0,
        Math.ceil((new Date(session.deadline).getTime() - now) / 1000),
      )
    : 0;
  useEffect(() => {
    if (session?.status !== "active" || remaining !== 0 || busy || error)
      return;
    const timeout = setTimeout(() => void act({ type: "finish" }), 0);
    return () => clearTimeout(timeout);
  }, [session, remaining, busy, error, act]);

  const currentQuestionId = session?.questions[session.current]?.id;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentQuestionId]);
  useEffect(() => {
    if (!confirmFinish) return;
    const dialog = finishRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, [confirmFinish]);

  const q = session?.questions[session.current];
  const canNavigate = session?.policy.navigation === "free";
  const seconds = q
    ? Math.round(
        (session?.answers[q.id]?.seconds || 0) +
          Math.max(0, now - (session?.lastEventAt || now)) / 1000,
      )
    : 0;

  const answered = session ? Object.values(session.answers).filter(a => a.choice != null).length : 0;
  const unsaved = !!q && (choice !== (session?.answers[q.id]?.choice ?? null) || confidence !== (session?.answers[q.id]?.confidence ?? null));

  return (
    <div
      className={`training-page training-session ${confirmFinish ? "has-finish-dialog" : ""} ${theme === "dark" ? "training-dark" : ""}`}
    >
      <header className="training-session-header" data-ui-chrome="header">
        <Link replace
          href="/play"
          data-ui-button="icon"
          className="training-header-back"
          aria-label="Back to Play"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="training-session-title-wrap">
          <div className="training-session-title-row">
            <div className="training-session-mode-badge" aria-hidden="true">
              <ModeIcon mode={session?.mode} />
            </div>
            <strong>
              {modes.find((m) => m.id === session?.mode)?.title || "Training"}
            </strong>
          </div>
          <span>
            {session?.exam.replaceAll("-", " ").toUpperCase()} ·{" "}
            {session?.status === "completed"
              ? "Session complete"
              : `Question ${session ? session.current + 1 : 0} of ${session?.questions.length || 0}`}
          </span>
        </div>
        {session?.status === "active" && (
          <div
            className={`training-clock ${remaining < 60 ? "training-clock-urgent" : ""}`}
            role="timer"
            aria-label={`Time remaining: ${clock(remaining)}`}
          >
            <Clock size={16} />
            <span>{clock(remaining)}</span>
          </div>
        )}
        {session?.status === "active" && (
          <button data-ui-button="secondary" className="training-header-finish" aria-label="Finish session" disabled={busy} onClick={() => setConfirmFinish(true)}>
            Finish
          </button>
        )}
      </header>

      <main ref={mainRef} className="training-session-main">
        {error && (
          <div role="alert" className="training-error">
            <span>{error}</span>
            <button data-ui-button="secondary" disabled={busy} onClick={reload}>
              Reload saved session
            </button>
          </div>
        )}

        {!session && !error && (
          <div className="training-session-loading" role="status">
            <div className="training-loading-spinner" />
            <p>Loading your training session…</p>
          </div>
        )}

        {session?.status === "completed" && (
          <TrainingResults session={session} accept={accept} />
        )}

        {session?.status === "active" && q && (
          <>
            <div className="training-question-meta">
              <button className="training-overview-toggle" data-ui-button="secondary" aria-expanded={showOverview} aria-controls="training-overview" onClick={() => setShowOverview(!showOverview)}>
                <List size={18} /> {canNavigate ? "Questions" : "Session info"}
              </button>
              <div className="training-meta-left">
                <span className="training-question-counter">
                  QUESTION {session.current + 1} OF {session.questions.length}
                </span>
              </div>
              {session.effectiveMode === "survival" ? (
                <div
                  className="training-survival-lives"
                  aria-label={`${session.lives} lives remaining`}
                >
                  <span className="training-lives-label">LIVES</span>
                  <div className="training-lives-hearts">
                    {[1, 2, 3].map((lifeIndex) => {
                      const isAlive = lifeIndex <= session.lives;
                      return (
                        <Heart
                          key={lifeIndex}
                          size={16}
                          className={`training-heart-icon ${isAlive ? "is-alive" : "is-lost"}`}
                          fill={isAlive ? "currentColor" : "none"}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="training-answered-meta">
                  <span className="training-answered-pill">
                    {
                      Object.values(session.answers).filter(
                        (a) => a.choice !== null,
                      ).length
                    }{" "}
                    / {session.questions.length} answered
                  </span>
                </div>
              )}
            </div>

            <div className="training-progress-track">
              <progress
                className="training-progress"
                max={session.questions.length}
                value={answered}
                aria-label={`${answered} of ${session.questions.length} answered`}
              />
            </div>

            <div className="training-session-columns">
              <aside id="training-overview" className={`training-session-aside ${showOverview ? "is-open" : ""}`}>
                <section className="training-panel training-sidebar-panel">
                  <h2>
                    {canNavigate ? "Question Navigator" : "Session Brief"}
                  </h2>
                  {canNavigate ? (
                    <>
                      <p className="training-sidebar-desc">
                        Save your answer before moving. Choose any available question below.
                      </p>
                      <div className="training-palette">
                        {session.questions
                          .map((item, i) => ({ item, i }))
                          .filter(({ i }) => session.allowedVisitIndices.includes(i))
                          .map(({ item, i }) => {
                          const isAnswered =
                            session.answers[item.id]?.choice != null;
                          const isCurrent = i === session.current;
                          return (
                            <button
                              key={item.id}
                              data-ui-button="state"
                              aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}`}
                              aria-current={isCurrent ? "step" : undefined}
                              className={`training-palette-btn ${isAnswered ? "answered" : ""} ${isCurrent ? "current" : ""}`}
                              disabled={busy}
                              onClick={() => { setShowOverview(false); void act({ type: "visit", index: i }); }}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="training-sidebar-desc">
                      {modes.find((m) => m.id === session.effectiveMode)?.detail ||
                        "Review due questions. Successful recall extends the next interval."}
                    </p>
                  )}
                  <div className="training-marking-badge">
                    <span className="marking-pos">+{session.marking.correct} correct</span>
                    <span className="marking-neg">−{session.marking.wrong} wrong</span>
                  </div>
                  <p className="training-footnote">
                    The clock continues if you leave this page.
                  </p>
                </section>


              </aside>
              <section className="training-question-panel">
                <div className="training-question-tags">
                  {q.trainingBlock && (
                    <span className="training-tag-block">{q.trainingBlock}</span>
                  )}
                  <span className="training-tag-topic">
                    {q.topic || q.subject}
                  </span>
                  <span className="training-tag-difficulty">
                    <span className={`diff-dot diff-${q.difficulty}`} />
                    Level {q.difficulty}
                  </span>
                  <span className="training-tag-source">
                    {q.sourceType === "pyq" ? "PYQ" : "Question bank"}
                  </span>
                </div>

                <div className="training-question-text" key={q.id} tabIndex={-1}>
                  <RichContent text={q.text} />
                  {q.image && (
                    <div className="training-question-image-wrap">
                      <RichContent
                        text={`![Question illustration](${q.image})`}
                      />
                    </div>
                  )}
                </div>

                <div
                  className="training-answers"
                  role="radiogroup"
                  aria-label="Answer choices"
                >
                  {q.options.map((option, index) => {
                    const isSelected = choice === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        role="radio"
                        data-ui-button="state"
                        className={`training-option-btn ${isSelected ? "selected" : ""}`}
                        aria-checked={isSelected}
                        disabled={busy || remaining === 0}
                        onClick={() => setChoice(index)}
                      >
                        <span className="training-option-letter">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <div className="training-option-content">
                          <RichContent text={option} />
                        </div>
                        <span className="training-option-check" aria-hidden="true">{isSelected && <Check size={16} />}</span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className={`training-pace ${seconds > q.expectedTime ? "is-slower" : "is-faster"}`}
                >
                  <div className="training-pace-pill">
                    <Clock size={14} />
                    <span className="training-pace-times">
                      Target <strong>{q.expectedTime}s</strong> · You{" "}
                      <strong>{seconds}s</strong>
                    </span>
                    <span
                      className={`training-pace-delta ${seconds > q.expectedTime ? "delta-slow" : "delta-fast"}`}
                    >
                      {seconds - q.expectedTime > 0 ? "+" : ""}
                      {seconds - q.expectedTime}s
                    </span>
                  </div>
                  <small className="training-pace-source">
                    {q.targetSource === "baseline"
                      ? "Baseline target"
                      : q.targetSource === "personalized"
                        ? "Personal target"
                        : "Catalog target"}
                  </small>
                </div>

                {session.policy.confidence && (
                  <fieldset className="training-confidence">
                    <legend>
                      Confidence rating{" "}
                      <span className="training-confidence-hint">Optional</span>
                    </legend>
                    <div className="training-confidence-chips">
                      {(["sure", "unsure", "guess"] as Confidence[]).map((c) => {
                        const isSelected = confidence === c;
                        return (
                          <button
                            key={c}
                            data-ui-button="state"
                            type="button"
                            className={`training-conf-chip conf-${c} ${isSelected ? "active" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              setConfidence(confidence === c ? null : c)
                            }
                            disabled={busy}
                          >
                            <span className="training-conf-dot" />
                            {c === "sure"
                              ? "Sure"
                              : c === "unsure"
                                ? "Unsure"
                                : "Guess"}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}


              </section>


            </div>
          </>
        )}
      </main>
      {session?.status === "active" && q && (
        <footer className="training-session-footer" data-ui-chrome="footer">
          <div className="training-footer-inner">
            <div className="training-save-status" role="status">
              <strong>{busy ? "Saving your answer..." : unsaved ? "Answer not saved yet" : session.answers[q.id]?.choice != null ? "Answer saved" : "Choose your answer"}</strong>
              <span>{canNavigate ? "Save before changing questions" : "Save to continue to the next question"}</span>
            </div>
                <div className="training-session-actions">
                  <button
                    data-ui-button="secondary"
                    type="button"
                    disabled={busy || remaining === 0}
                    onClick={() =>
                      act({ type: "answer", choice: null, confidence: null })
                    }
                  >
                    {canNavigate ? "Clear saved answer" : "Skip"}
                  </button>
                  <button
                    data-ui-button="primary"
                    type="button"
                    disabled={choice === null || busy || remaining === 0}
                    onClick={() => act({ type: "answer", choice, confidence })}
                  >
                    <span>
                      {busy
                        ? "Saving…"
                        : canNavigate
                          ? "Save answer"
                          : "Answer & continue"}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </div>
          </div>
        </footer>
      )}
      {confirmFinish && session && (
        <dialog ref={finishRef} className="training-finish-dialog" aria-labelledby="training-finish-title" aria-describedby="training-finish-description" onCancel={event => { if (busy) event.preventDefault(); else setConfirmFinish(false); }}>
          <div className="training-panel-heading">
            <span className="training-kicker">SESSION SUMMARY</span>
            <button data-ui-button="icon" aria-label="Close finish dialog" disabled={busy} onClick={() => setConfirmFinish(false)}><X size={20} /></button>
          </div>
          <h2 id="training-finish-title">Finish this session?</h2>
          <p id="training-finish-description">{answered} of {session.questions.length} answers saved. Unanswered questions earn zero.</p>
          {unsaved && <p className="training-unsaved-note">Your current selection is not saved. Keep training to save it first.</p>}
          {error && <p role="alert" className="training-error">{error}</p>}
          <div className="training-finish-actions">
            <button data-ui-button="primary" disabled={busy} onClick={() => act({ type: "finish" })}>Finish &amp; see results</button>
            <button data-ui-button="secondary" disabled={busy} onClick={() => setConfirmFinish(false)}>Keep training</button>
            <button data-ui-button="danger" disabled={busy} onClick={() => act({ type: "abandon" })}>Abandon session</button>
          </div>
        </dialog>
      )}
    </div>
  );
}
