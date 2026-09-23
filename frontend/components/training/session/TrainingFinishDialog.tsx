import { X } from "lucide-react";
import { type TrainingSession, type TrainingAction } from "../training-types";
import { useEffect } from "react";

interface TrainingFinishDialogProps {
  finishRef: React.RefObject<HTMLDialogElement | null>;
  confirmFinish: boolean;
  setConfirmFinish: (v: boolean) => void;
  session: TrainingSession | null;
  answered: number;
  unsaved: boolean;
  error: string;
  busy: boolean;
  act: (action: TrainingAction) => Promise<void>;
}

export function TrainingFinishDialog({
  finishRef,
  confirmFinish,
  setConfirmFinish,
  session,
  answered,
  unsaved,
  error,
  busy,
  act
}: TrainingFinishDialogProps) {
  useEffect(() => {
    if (!confirmFinish) return;
    const dialog = finishRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, [confirmFinish, finishRef]);

  if (!confirmFinish || !session) return null;

  return (
    <dialog ref={finishRef} className="training-finish-dialog" aria-labelledby="training-finish-title" aria-describedby="training-finish-description" onCancel={event => { if (busy) event.preventDefault(); else setConfirmFinish(false); }}>
      <div className="training-panel-heading">
        <span className="training-kicker">SESSION SUMMARY</span>
        <button data-ui-button="icon" aria-label="Close finish dialog" disabled={busy} onClick={() => setConfirmFinish(false)}><X size={20} /></button>
      </div>
      <h2 id="training-finish-title">Finish this session?</h2>
      <p id="training-finish-description">
        {answered} of {session.questions.length} answers saved.
        Unanswered questions earn 0 marks with no negative penalty.
        Incorrect answers receive −{session.marking.wrong} negative marking.
      </p>
      {unsaved && <p className="training-unsaved-note">Your current selection is not saved. Keep training to save it first.</p>}
      {error && <p role="alert" className="training-error">{error}</p>}
      <div className="training-finish-actions">
        <button data-ui-button="primary" disabled={busy} onClick={() => act({ type: "finish" })}>Finish &amp; see results</button>
        <button data-ui-button="secondary" disabled={busy} onClick={() => setConfirmFinish(false)}>Keep training</button>
        <button data-ui-button="danger" disabled={busy} onClick={() => act({ type: "abandon" })}>Abandon session</button>
      </div>
    </dialog>
  );
}
