"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Heart } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import RichContent from "@/components/RichContent";
import { useThemeMode } from "@/hooks/useTheme";
import { modes, type Confidence, type TrainingSession } from "./training-types";
import { TrainingResults } from "./TrainingResults";
import "@/app/(app)/play/play.css";
import "./training-session.css";

const clock = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${String(Math.max(0, n) % 60).padStart(2, "0")}`;
export default function TrainingSessionView({ id }: { id: string }) {
  const { theme } = useThemeMode();
  const [session, setSession] = useState<TrainingSession | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(0);
  const [choice, setChoice] = useState<number | null>(null),
    [confidence, setConfidence] = useState<Confidence | null>(null),
    [confirmFinish, setConfirmFinish] = useState(false);
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
    [id, session, accept],
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
  const q = session?.questions[session.current];
  const canNavigate = session && ["pressure", "section"].includes(session.mode);
  const seconds = q
    ? Math.round(
        (session?.answers[q.id]?.seconds || 0) +
          Math.max(0, now - (session?.lastEventAt || now)) / 1000,
      )
    : 0;
  return (
    <div
      className={`training-page training-session ${theme === "dark" ? "training-dark" : ""}`}
    >
      <header className="training-session-header" data-ui-chrome="header">
        <Link href="/play" data-ui-button="icon" aria-label="Back to Play">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <strong>
            {modes.find((m) => m.id === session?.mode)?.title || "Training"}
          </strong>
          <span>
            {session?.exam.replaceAll("-", " ").toUpperCase()} ·{" "}
            {session?.status === "completed"
              ? "Session complete"
              : "Practice session"}
          </span>
        </div>
        {session?.status === "active" && (
          <div
            className={`training-clock ${remaining < 60 ? "training-clock-urgent" : ""}`}
            role="timer"
          >
            <Clock size={17} />
            {clock(remaining)}
          </div>
        )}
      </header>
      <main className="training-session-main">
        {error && (
          <div role="alert" className="training-error">
            {error}
            <button data-ui-button="secondary" disabled={busy} onClick={reload}>
              Reload saved session
            </button>
          </div>
        )}
        {!session && !error && <p role="status">Loading your session…</p>}
        {session?.status === "completed" && (
          <TrainingResults session={session} accept={accept} />
        )}
        {session?.status === "active" && q && (
          <>
            <div className="training-question-meta">
              <span>
                QUESTION {session.current + 1} / {session.questions.length}
              </span>
              {session.mode === "survival" ? (
                <span>
                  <Heart size={16} />
                  {session.lives} lives
                </span>
              ) : (
                <span>
                  {
                    Object.values(session.answers).filter(
                      (a) => a.choice !== null,
                    ).length
                  }{" "}
                  answered
                </span>
              )}
            </div>
            <progress
              className="training-progress"
              max={session.questions.length}
              value={session.current + 1}
            />
            <div className="training-session-columns">
              <section className="training-question-panel">
                <div className="training-question-tags">
                  <span>{q.trainingBlock || q.topic}</span>
                  <span>Level {q.difficulty}</span>
                  <span>
                    {q.sourceType === "pyq" ? "PYQ" : "Question bank"}
                  </span>
                </div>
                <div className="training-question-text">
                  <RichContent text={q.text} />
                  {q.image && (
                    <RichContent
                      text={`![Question illustration](${q.image})`}
                    />
                  )}
                </div>
                <div
                  className="training-answers"
                  role="group"
                  aria-label="Answer choices"
                >
                  {q.options.map((option, index) => (
                    <button
                      key={index}
                      data-ui-button="state"
                      className={choice === index ? "selected" : ""}
                      aria-pressed={choice === index}
                      disabled={busy || remaining === 0}
                      onClick={() => setChoice(index)}
                    >
                      <span className="training-option-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <RichContent text={option} />
                    </button>
                  ))}
                </div>
                <div className="training-pace">
                  <Clock size={15} />
                  <span>
                    Target {q.expectedTime}s · You {seconds}s ·{" "}
                    {seconds - q.expectedTime > 0 ? "+" : ""}
                    {seconds - q.expectedTime}s
                  </span>
                  <small>
                    {q.targetSource === "baseline"
                      ? "Baseline target"
                      : q.targetSource === "personalized"
                        ? "Personal target"
                        : "Catalog target"}
                  </small>
                </div>
                {!["nightmare", "survival"].includes(session.mode) && (
                  <fieldset className="training-confidence">
                    <legend>
                      How confident are you? <span>Optional</span>
                    </legend>
                    {(["sure", "unsure", "guess"] as Confidence[]).map((c) => (
                      <button
                        key={c}
                        data-ui-button="state"
                        type="button"
                        aria-pressed={confidence === c}
                        onClick={() =>
                          setConfidence(confidence === c ? null : c)
                        }
                        disabled={busy}
                      >
                        {c === "sure"
                          ? "Sure"
                          : c === "unsure"
                            ? "Unsure"
                            : "Guess"}
                      </button>
                    ))}
                  </fieldset>
                )}
                <div className="training-session-actions">
                  <button
                    data-ui-button="secondary"
                    disabled={busy || remaining === 0}
                    onClick={() =>
                      act({ type: "answer", choice: null, confidence: null })
                    }
                  >
                    {canNavigate ? "Clear saved answer" : "Skip"}
                  </button>
                  <button
                    data-ui-button="primary"
                    disabled={choice === null || busy || remaining === 0}
                    onClick={() => act({ type: "answer", choice, confidence })}
                  >
                    {busy
                      ? "Saving…"
                      : canNavigate
                        ? "Save answer"
                        : "Answer & continue"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <aside className="training-session-aside">
                <section className="training-panel">
                  <h2>
                    {canNavigate ? "Question navigator" : "Session brief"}
                  </h2>
                  {canNavigate ? (
                    <>
                      <p>
                        Save your answer before moving. You can return to any
                        question.
                      </p>
                      <div className="training-palette">
                        {session.questions.map((item, i) => (
                          <button
                            key={item.id}
                            data-ui-button="state"
                            aria-label={`Question ${i + 1}${session.answers[item.id]?.choice != null ? ", answered" : ""}`}
                            aria-current={
                              i === session.current ? "step" : undefined
                            }
                            className={
                              session.answers[item.id]?.choice != null
                                ? "answered"
                                : ""
                            }
                            disabled={busy}
                            onClick={() => act({ type: "visit", index: i })}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p>
                      {modes.find((m) => m.id === session.mode)?.detail ||
                        "Review due questions. Successful recall extends the next interval."}
                    </p>
                  )}
                  <p className="training-footnote">
                    +{session.marking.correct} correct · −
                    {session.marking.wrong} wrong
                    <br />
                    The clock continues if you leave.
                  </p>
                </section>
                {confirmFinish ? (
                  <section className="training-panel">
                    <h2>Finish this session?</h2>
                    <p>
                      Unanswered questions earn zero. Your saved answers will be
                      scored.
                    </p>
                    <button
                      data-ui-button="primary"
                      disabled={busy}
                      onClick={() => act({ type: "finish" })}
                    >
                      Finish & see results
                    </button>
                    <button
                      data-ui-button="secondary"
                      disabled={busy}
                      onClick={() => setConfirmFinish(false)}
                    >
                      Keep training
                    </button>
                  </section>
                ) : (
                  <button
                    data-ui-button="secondary"
                    disabled={busy}
                    onClick={() => setConfirmFinish(true)}
                  >
                    Finish session
                  </button>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
