import { useCallback } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import api from "@/shared/api/client";
import { type TrainingSession, type TrainingAction } from "../../training-types";
import { mergeTrainingResponse, type TrainingDelta } from '../sessionDelta';

interface UseTrainingActionsProps {
  id: string;
  session: TrainingSession | null;
  sendingRef: React.MutableRefObject<boolean>;
  setBusy: (busy: boolean) => void;
  setPendingAction: (action: string) => void;
  setError: (error: string) => void;
  accept: (s: TrainingSession) => void;
  setConfirmFinish: (v: boolean) => void;
}

export function useTrainingActions({
  id,
  session,
  sendingRef,
  setBusy,
  setPendingAction,
  setError,
  accept,
  setConfirmFinish
}: UseTrainingActionsProps) {
  const router = useRouter();
  const act = useCallback(
    async (action: TrainingAction) => {
      if (!session || sendingRef.current) return;
      sendingRef.current = true;
      setBusy(true);
      setPendingAction(String(action.type));
      setError("");
      try {
        const { data } = await api.post<TrainingSession | TrainingDelta>(
          `/api/training/sessions/${id}/actions?response=delta`,
          { ...action, revision: session.revision },
        );
        if (data.status === "abandoned") {
          router.replace("/play");
          return;
        }
        accept(mergeTrainingResponse(session, data));
        setConfirmFinish(false);
      } catch (e) {
        setError(
          isAxiosError(e)
            ? e.response?.data?.error ||
                "Save failed. Reload the saved session before retrying."
            : "Save failed. Reload before retrying.",
        );
      } finally {
        sendingRef.current = false;
        setBusy(false);
        setPendingAction("");
      }
    },
    [id, session, accept, router, sendingRef, setBusy, setError, setPendingAction, setConfirmFinish],
  );

  return { act };
}
