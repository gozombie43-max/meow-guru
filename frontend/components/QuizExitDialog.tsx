"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { navigationController, type ExitConfirmation } from "@/lib/navigation-controller";
import styles from "./QuizExitDialog.module.css";

const subscribe = (listener: () => void) => navigationController().subscribe(listener);
const snapshot = () => navigationController().getConfirmation();
const serverSnapshot = () => null;

function ExitModal({ confirmation }: { confirmation: ExitConfirmation }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const cancel = () => navigationController().resolveConfirmation(false);
  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-theme={confirmation.theme}
      aria-labelledby="quiz-exit-title"
      aria-describedby="quiz-exit-description"
      onCancel={event => { event.preventDefault(); cancel(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancel();
      }}
    >
      <div className={styles.icon}><LogOut size={23} aria-hidden="true" /></div>
      <h2 id="quiz-exit-title">Exit quiz?</h2>
      <p id="quiz-exit-description">{confirmation.message}</p>
      <div className={styles.actions}>
        <button ref={cancelRef} type="button" data-ui-button="secondary" onClick={cancel}>Cancel</button>
        <button type="button" data-ui-button="primary" onClick={() => navigationController().resolveConfirmation(true)}>Exit quiz</button>
      </div>
    </dialog>,
    document.body,
  );
}

export default function QuizExitDialog() {
  const confirmation = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return confirmation ? <ExitModal confirmation={confirmation} /> : null;
}
