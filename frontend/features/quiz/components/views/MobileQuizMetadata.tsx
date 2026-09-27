import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useNativeDialog } from "@/components/ui/Dialog";

export function MobileQuizMetadata({ topic, compactExamLabel, fullExamLabel }: {
  topic: string;
  compactExamLabel: string;
  fullExamLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => setOpen(false);
  useNativeDialog(dialogRef, open, close);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const dismissBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) setOpen(false);
    };
    dialog.addEventListener("click", dismissBackdrop);
    return () => dialog.removeEventListener("click", dismissBackdrop);
  }, [open]);

  return <>
    <button type="button" data-ui-button="state" className="ios-series-metadata-trigger"
      aria-label="Show topic and exam details" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <span>{[topic, compactExamLabel].filter(Boolean).join(" · ")}</span>
    </button>
    <dialog ref={dialogRef} className="ios-series-metadata-dialog" aria-labelledby={titleId}>
      <div className="ios-series-metadata-detail">
        <div className="ios-series-metadata-heading">
          <h2 id={titleId}>Question details</h2>
          <button type="button" data-ui-button="icon" onClick={close} aria-label="Close question details"><X aria-hidden="true" /></button>
        </div>
        <dl>
          <dt>Topic</dt><dd>{topic || "Not specified"}</dd>
          <dt>Exam</dt><dd>{fullExamLabel || compactExamLabel || "Not specified"}</dd>
        </dl>
      </div>
    </dialog>
  </>;
}
