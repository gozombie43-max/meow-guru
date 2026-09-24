"use client";

import { useEffect, useEffectEvent, useRef, type HTMLAttributes, type RefObject } from "react";
import { navigationController } from "@/lib/navigation-controller";
import { activateModalSurface } from "@/lib/modal-surface";

export function useModalSurface(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, options: { busy?: boolean; initialFocus?: string; back?: boolean } = {}) {
  const { busy = false, initialFocus, back = true } = options;
  const close = useEffectEvent(() => {
    if (busy) return false;
    onClose();
  });
  useEffect(() => {
    if (!open || !ref.current) return;
    const release = activateModalSurface(ref.current, initialFocus);
    const removeLayer = back ? navigationController().addLayer(() => close()) : undefined;
    return () => { removeLayer?.(); release(); };
  }, [open, ref, initialFocus, back]);
}

type Props = HTMLAttributes<HTMLDivElement> & {
  onClose: () => void;
  busy?: boolean;
  initialFocus?: string;
};

/** Unstyled modal primitive: feature CSS owns presentation; lifecycle is shared. */
export function Dialog({ onClose, busy, initialFocus, role = "dialog", children, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useModalSurface(ref, true, onClose, { busy, initialFocus });
  return <div {...props} ref={ref} role={role} aria-modal="true" tabIndex={-1} data-ui-dialog>{children}</div>;
}

export function BottomSheet(props: Props) { return <Dialog {...props} data-ui-sheet />; }
export function AlertDialog(props: Props) { return <Dialog {...props} role="alertdialog" />; }

export function useNativeDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean, onClose: () => void, options: { busy?: boolean; initialFocus?: string; back?: boolean } = {}) {
  const { busy = false, initialFocus, back = true } = options;
  const close = useEffectEvent(() => { if (busy) return false; onClose(); });
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const release = activateModalSurface(dialog, initialFocus, opener);
    const removeLayer = back ? navigationController().addLayer(() => close()) : undefined;
    const cancel = (event: Event) => { event.preventDefault(); close(); };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      removeLayer?.();
      dialog.close();
      release();
    };
  }, [open, ref, initialFocus, back]);
}
