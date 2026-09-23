"use client";
import { useRef, useState, useEffect } from "react";
import { LoaderCircle, ArrowRight } from "lucide-react";
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
import { TrainingFinishDialog } from "./session/TrainingFinishDialog";
import "@/app/(app)/play/play.css";
import "./training-session.css";

export default function TrainingSessionView({ id }: { id: string }) {
  const { theme } = useThemeMode();
  const {
    session,
    error,
    busy,
    timeSync,
    expired,
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
  const answered = session ? Object.values(session.answers).filter(a => a.choice != null).length : 0;
  const unsaved = !!q && (choice !== (session?.answers[q.id]?.choice ?? null) || confidence !== (session?.answers[q.id]?.confidence ?? null));

  return (
    <div className={`training-page training-session ${confirmFinish ? "has-finish-dialog" : ""} ${theme === "dark" ? "training-dark" : ""}`}>
      <TrainingSessionHeader 
        session={session} 
        timeSync={timeSync}
        busy={busy} 
        setConfirmFinish={setConfirmFinish}
        showOverview={showOverview}
        setShowOverview={setShowOverview}
        answered={answered}
        canNavigate={canNavigate || false}
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
                expired={expired}
                session={session}
              />

              <div className="training-card-footer">
                <div className="training-card-footer-meta">
                  <TrainingPace q={q} session={session} timeSync={timeSync} />

                  {session.policy.confidence && (
                    <TrainingConfidence 
                      confidence={confidence} 
                      setConfidence={setConfidence} 
                      busy={busy} 
                    />
                  )}
                </div>

                <div className="training-floating-actions">
                  <button
                    data-ui-button="secondary"
                    type="button"
                    className="training-btn-skip"
                    disabled={busy || expired}
                    onClick={() =>
                      act({ type: "answer", choice: null, confidence: null })
                    }
                  >
                    <span>{canNavigate ? "Clear" : "Skip"}</span>
                  </button>
                  <button
                    data-ui-button="primary"
                    type="button"
                    className="training-btn-continue"
                    disabled={choice === null || busy || expired}
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
            </section>
          </div>
        )}
      </main>

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
