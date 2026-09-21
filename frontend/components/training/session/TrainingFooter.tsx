import { ArrowRight } from "lucide-react";
import { type TrainingSession, type Confidence, type TrainingAction } from "../training-types";

interface TrainingFooterProps {
  session: TrainingSession;
  q: import("../training-types").TrainingQuestion;
  busy: boolean;
  unsaved: boolean;
  canNavigate: boolean;
  remaining: number;
  choice: number | null;
  confidence: Confidence | null;
  act: (action: TrainingAction) => Promise<void>;
}

export function TrainingFooter({ session, q, busy, unsaved, canNavigate, remaining, choice, confidence, act }: TrainingFooterProps) {
  if (!q) return null;

  return (
    <footer className="training-session-footer" data-ui-chrome="footer">
      <div className="training-footer-inner">
        <div className="training-save-status" role="status">
          <strong>{busy ? "Saving your answer..." : unsaved ? "Answer not saved yet" : session.answers[q.id]?.choice != null ? "Answer saved" : "Choose your answer"}</strong>
          <span>{canNavigate ? "Save before changing questions" : "Save to continue to the next question"}</span>
        </div>
        <span className="training-footer-position" aria-label={`Question ${session.current + 1} of ${session.questions.length}`}>
          {session.current + 1}<span> / {session.questions.length}</span>
        </span>
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
  );
}
