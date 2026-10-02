import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type Confidence, type TrainingSession } from "../../training-types";

import { useTrainingActions } from "./useTrainingActions";
import { useTrainingClock } from "./useTrainingClock";
import { useAuth } from '@/context/AuthContext';
import { offlineTrainingEnabled, saveTrainingSnapshot, readTrainingSnapshot, readPendingTrainingAction, clearPendingTrainingAction } from '../offlineTraining';

export function useTrainingSession(id: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeSync, setTimeSync] = useState({ serverNow: 0, receivedAt: 0 });
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  
  const sendingRef = useRef(false);

  const accept = useCallback((s: TrainingSession, fromServer = true) => {
    if (fromServer && offlineTrainingEnabled() && userId) void saveTrainingSnapshot(userId, s).catch(() => {});
    setTimeSync({ serverNow: s.serverNow, receivedAt: Date.now() });
    setSession(s);
    setChoice(s.answers[s.questions[s.current].id]?.choice ?? null);
    setConfidence(s.answers[s.questions[s.current].id]?.confidence ?? null);
  }, [userId]);

  const fetchSavedSession = useCallback(async () => {
    let recoveryMessage = '';
    if (offlineTrainingEnabled() && userId) {
      const pending = await readPendingTrainingAction(userId, id).catch(() => null);
      if (pending) {
        try {
          await api.post(`/api/training/sessions/${id}/actions?response=delta`, pending.body, { headers: { 'Idempotency-Key': pending.key }, apiPolicy: { retries: 2 } });
        } catch (e) {
          if (!isAxiosError(e) || ![400, 409, 422].includes(e.response?.status ?? 0) || e.response?.data?.code === 'IDEMPOTENCY_PENDING') throw e;
          recoveryMessage = 'The saved action was rejected. Review the latest session before answering again.';
        }
        await clearPendingTrainingAction(userId, id, pending.key);
      }
    }
    const response = await api.get<TrainingSession>(`/api/training/sessions/${id}`);
    return { data: response.data, recoveryMessage };
  }, [id, userId]);

  const reload = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setPendingAction("reload");
    setError("");
    try {
      const { data, recoveryMessage } = await fetchSavedSession();
      accept(data);
      setError(recoveryMessage);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error || "Could not load the session."
          : "Could not load the session.",
      );
    } finally {
      sendingRef.current = false;
      setBusy(false);
      setPendingAction("");
    }
  }, [fetchSavedSession, accept]);

  useEffect(() => {
    let active = true;
    fetchSavedSession()
      .then(({ data, recoveryMessage }) => {
        if (active) { accept(data); setError(recoveryMessage); }
      })
      .catch(async () => {
        const saved = offlineTrainingEnabled() && userId ? await readTrainingSnapshot(userId, id).catch(() => null) : null;
        if (active) {
          if (saved) accept(saved, false);
          setError(
            saved ? 'Showing the last saved session. Reconnect and reload to synchronize.' : "Could not load the session. Check your connection and retry.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [id, userId, accept, fetchSavedSession]);

  useEffect(() => {
    if (!offlineTrainingEnabled()) return;
    const reconnect = () => { void reload(); };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [reload]);

  const { act } = useTrainingActions({
    id,
    userId,
    session,
    sendingRef,
    setBusy,
    setPendingAction,
    setError,
    accept,
    setConfirmFinish
  });

  const { expired } = useTrainingClock(
    session,
    timeSync,
    act,
    busy,
    error
  );

  return {
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
  };
}
