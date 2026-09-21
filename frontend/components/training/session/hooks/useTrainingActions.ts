import { useCallback } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import api from "@/shared/api/client";
import { type TrainingSession } from "../../training-types";

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
    async (action: Record<string, unknown>) => {
      if (!session || sendingRef.current) return;
      sendingRef.current = true;
      setBusy(true);
      setPendingAction(String(action.type));
      setError("");
      try {
        const { data } = await api.post<TrainingSession>(
          `/api/training/sessions/${id}/actions`,
          { ...action, revision: session.revision },
        );
        if (data.status === "abandoned") {
          router.replace("/play");
          return;
        }
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
        sendingRef.current = false;
        setBusy(false);
        setPendingAction("");
      }
    },
    [id, session, accept, router, sendingRef, setBusy, setError, setPendingAction, setConfirmFinish],
  );

  return { act };
}
