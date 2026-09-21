"use client";
import { useRef, useState, useEffect } from "react";
import { Heart, List, LoaderCircle } from "lucide-react";
import { useBackLayer, useQuizLeaveGuard } from "@/hooks/useAppNavigation";
import { useThemeMode } from "@/hooks/useTheme";
import { TrainingResults } from "./TrainingResults";
import { TrainingLoading } from "./TrainingLoading";
import { useTrainingSession } from "./session/hooks/useTrainingSession";
import { TrainingSessionHeader } from "./session/TrainingSessionHeader";
import { TrainingQuestion } from "./session/TrainingQuestion";
import { TrainingPalette } from "./session/TrainingPalette";
import { TrainingPace } from "./session/TrainingPace";
import { TrainingConfidence } from "./session/TrainingConfidence";
import { TrainingFooter } from "./session/TrainingFooter";
import { TrainingFinishDialog } from "./session/TrainingFinishDialog";
import "@/app/(app)/play/play.css";
import "./training-session.css";

export default function TrainingSessionView({ id }: { id: string }) {
  const { theme } = useThemeMode();
  const {
    session,
    error,
    busy,
    now,
    remaining,
    choice,
    setChoice,
    confidence,
    setConfidence,
    pendingAction,
    confirmFinish,
    setConfirmFinish,
    accept,
    reload,
    act
  } = useTrainingSession(id);

  const [showOverview, setShowOverview] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const finishRef = useRef<HTMLDialogElement>(null);

  useQuizLeaveGuard(session?.status === "active", "/play", "Leave this training quiz? Saved answers will remain, but the session timer may continue.");
  useBackLayer(showOverview, () => setShowOverview(false));
  useBackLayer(confirmFinish, () => { if (!busy) setConfirmFinish(false); });

  const currentQuestionId = session?.questions[session.current]?.id;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentQuestionId]);

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
    <div className={`training-page training-session ${confirmFinish ? "has-finish-dialog" : ""} ${theme === "dark" ? "training-dark" : ""}`}>
      <TrainingSessionHeader 
        session={session} 
        remaining={remaining} 
        busy={busy} 
        setConfirmFinish={setConfirmFinish} 
      />

      <main ref={mainRef} className="training-session-main">
        {session && busy && (
          <div className="training-request-status" role="status">
            <LoaderCircle className="training-loading-icon" size={18} aria-hidden="true" />
            {pendingAction === "visit" ? "Loading question…" : pendingAction === "reload" ? "Reloading saved questions…" : pendingAction === "finish" ? "Preparing your results…" : pendingAction === "abandon" ? "Leaving session…" : "Saving your answer…"}
          </div>
        )}
        
        {error && (
          <div role="alert" className="training-error">
            <span>{error}</span>
            <button data-ui-button="secondary" disabled={busy} onClick={reload}>
              Reload saved session
            </button>
          </div>
        )}

        {!session && !error && <TrainingLoading />}

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
                    {answered} / {session.questions.length} answered
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
              <TrainingPalette 
                session={session}
                showOverview={showOverview}
                setShowOverview={setShowOverview}
                canNavigate={canNavigate || false}
                busy={busy}
                act={act}
              />

              <section className="training-question-panel">
                <TrainingQuestion 
                  q={q} 
                  choice={choice} 
                  setChoice={setChoice} 
                  busy={busy} 
                  remaining={remaining} 
                />

                <TrainingPace q={q} seconds={seconds} />

                {session.policy.confidence && (
                  <TrainingConfidence 
                    confidence={confidence} 
                    setConfidence={setConfidence} 
                    busy={busy} 
                  />
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {session?.status === "active" && q && (
        <TrainingFooter 
          session={session} 
          q={q} 
          busy={busy} 
          unsaved={unsaved} 
          canNavigate={canNavigate || false} 
          remaining={remaining} 
          choice={choice} 
          confidence={confidence} 
          act={act} 
        />
      )}

      <TrainingFinishDialog 
        finishRef={finishRef} 
        confirmFinish={confirmFinish} 
        setConfirmFinish={setConfirmFinish} 
        session={session} 
        answered={answered} 
        unsaved={unsaved} 
        error={error} 
        busy={busy} 
        act={act} 
      />
    </div>
  );
}
