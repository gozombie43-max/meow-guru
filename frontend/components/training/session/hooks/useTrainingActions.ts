import type { z } from 'zod';
import type { actionSchema } from '@meow/contracts/training';
import { useCallback } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import api from "@/shared/api/client";
import { type TrainingSession, type TrainingAction } from "../../training-types";
import { mergeTrainingResponse, type TrainingDelta } from '../sessionDelta';
import { offlineTrainingEnabled, savePendingTrainingAction, clearPendingTrainingAction } from '../offlineTraining';

interface UseTrainingActionsProps {
  id: string;
  userId?: string;
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
  userId,
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
      const key = crypto.randomUUID();
      try {
        const body = { ...action, revision: session.revision } satisfies z.input<typeof actionSchema>;
        if (offlineTrainingEnabled() && userId) {
          await savePendingTrainingAction(userId, id, { key, body, expiresAt: Date.now() + 86400000 });
          if (!navigator.onLine) throw new Error('Action saved on this device. Reconnect and reload to synchronize.');
        }
        const { data } = await api.post<TrainingSession | TrainingDelta>(
          `/api/training/sessions/${id}/actions?response=delta`,
          body,
          { headers: { 'Idempotency-Key': key }, apiPolicy: { retries: 2 } },
        );
        if (offlineTrainingEnabled() && userId) await clearPendingTrainingAction(userId, id, key);
        if (data.status === "abandoned") {
          router.replace("/play");
          return;
        }
        accept(mergeTrainingResponse(session, data));
        setConfirmFinish(false);
      } catch (e) {
        if (offlineTrainingEnabled() && userId && isAxiosError(e) && [400, 409, 422].includes(e.response?.status ?? 0) && e.response?.data?.code !== 'IDEMPOTENCY_PENDING') {
          await clearPendingTrainingAction(userId, id, key).catch(() => {});
        }
        setError(
          isAxiosError(e)
            ? e.response?.data?.error ||
                "Save failed. Reload the saved session before retrying."
            : e instanceof Error ? e.message : "Save failed. Reload before retrying.",
        );
      } finally {
        sendingRef.current = false;
        setBusy(false);
        setPendingAction("");
      }
    },
    [id, userId, session, accept, router, sendingRef, setBusy, setError, setPendingAction, setConfirmFinish],
  );

  return { act };
}
