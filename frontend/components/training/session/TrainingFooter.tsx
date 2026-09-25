import { ArrowRight } from "lucide-react";
import { type TrainingSession, type Confidence, type TrainingAction } from "../training-types";

interface TrainingFooterProps {
  session: TrainingSession;
  q: import("../training-types").TrainingQuestion;
  busy: boolean;
  unsaved: boolean;
  canNavigate: boolean;
  expired: boolean;
  choice: number | null;
  confidence: Confidence | null;
  act: (action: TrainingAction) => Promise<void>;
}

export function TrainingFooter({ session, q, busy, unsaved, canNavigate, expired, choice, confidence, act }: TrainingFooterProps) {
  if (!q) return null;

  return (
    <footer className="training-session-footer" data-ui-chrome="footer">
      <div className="training-footer-inner">
        <div className="training-save-status" role="status">
          <strong>
            {busy
              ? "Saving your answer..."
              : unsaved
                ? "Answer selected"
                : session.answers[q.id]?.choice != null
                  ? "Answer saved"
                  : session.effectiveMode === "survival"
                    ? "Wrong or skip costs 1 life"
                    : "Choose your answer"}
          </strong>
          <span>
            {canNavigate
              ? "Save before changing questions"
              : session.effectiveMode === "survival"
                ? "Consecutive slow answers also reduce life"
                : "Save to continue to the next question"}
          </span>
        </div>
        <span className="training-footer-position" aria-label={`Question ${session.current + 1} of ${session.questions.length}`}>
          {session.current + 1}<span> / {session.questions.length}</span>
        </span>
            <div className="training-session-actions">
              <button
                data-ui-button="secondary"
                type="button"
                aria-label={canNavigate ? "Clear saved answer" : "Skip"}
                disabled={busy || expired}
                onClick={() =>
                  act({ type: "answer", choice: null, confidence: null })
                }
              >
                <span className="training-action-label-full">{canNavigate ? "Clear saved answer" : "Skip"}</span>
                <span className="training-action-label-compact" aria-hidden="true">{canNavigate ? "Clear" : "Skip"}</span>
              </button>
              <button
                data-ui-button="primary"
                type="button"
                aria-label={busy ? "Saving…" : canNavigate ? "Save answer" : "Answer & continue"}
                disabled={choice === null || busy || expired}
                onClick={() => act({ type: "answer", choice, confidence })}
              >
                <span className="training-action-label-full">
                  {busy
                    ? "Saving…"
                    : canNavigate
                      ? "Save answer"
                      : "Answer & continue"}
                </span>
                <span className="training-action-label-compact" aria-hidden="true">{busy ? "Saving…" : canNavigate ? "Save" : "Continue"}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
      </div>
    </footer>
  );
}
