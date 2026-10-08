import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { abortError } from '@/shared/api/policy';
import { type Confidence, type TrainingSession } from "../../training-types";

import { useTrainingActions } from "./useTrainingActions";
import { useTrainingClock } from "./useTrainingClock";
import { useAuth } from '@/context/AuthContext';
import { offlineTrainingEnabled, saveTrainingSnapshot, readTrainingSnapshot, readPendingTrainingAction, clearPendingTrainingAction } from '../offlineTraining';

import { readStartResponse, clearStartResponse } from '@/lib/start-response-cache';
import { useInvalidateTrainingDashboard } from '@/app/(app)/play/hooks/trainingQueries';

export function useTrainingSession(id: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const invalidateDashboard = useInvalidateTrainingDashboard();
  const readController = useRef<AbortController | null>(null);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [acceptedOwner, setAcceptedOwner] = useState(userId);
  const visibleSession = session?.id === id && acceptedOwner === userId ? session : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeSync, setTimeSync] = useState({ serverNow: 0, receivedAt: 0 });
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  
  const sendingRef = useRef(false);

  const accept = useCallback((s: TrainingSession, fromServer = true, receivedAt = Date.now()) => {
    if (fromServer && offlineTrainingEnabled() && userId) void saveTrainingSnapshot(userId, s).catch(() => {});
    setTimeSync({ serverNow: s.serverNow, receivedAt });
    setSession(s);
    setAcceptedOwner(userId);
    setChoice(s.answers[s.questions[s.current].id]?.choice ?? null);
    setConfidence(s.answers[s.questions[s.current].id]?.confidence ?? null);
  }, [userId]);

  const fetchSavedSession = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) throw abortError();
    let recoveryMessage = '';
    if (offlineTrainingEnabled() && userId) {
      const pending = await readPendingTrainingAction(userId, id).catch(() => null);
      if (signal?.aborted) throw abortError();
      if (pending) {
        try {
          await api.post(`/api/training/sessions/${id}/actions?response=delta`, pending.body, { headers: { 'Idempotency-Key': pending.key }, apiPolicy: { retries: 2 } });
        } catch (e) {
          if (!isAxiosError(e) || ![400, 409, 422].includes(e.response?.status ?? 0) || e.response?.data?.code === 'IDEMPOTENCY_PENDING') throw e;
          recoveryMessage = 'The saved action was rejected. Review the latest session before answering again.';
        }
        await clearPendingTrainingAction(userId, id, pending.key);
        invalidateDashboard(userId);
      }
    }
    if (signal?.aborted) throw abortError();
    const response = await api.get<TrainingSession>(`/api/training/sessions/${id}`, { signal });
    if (signal?.aborted) throw abortError();
    return { data: response.data, recoveryMessage };
  }, [id, userId, invalidateDashboard]);

  const reload = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setPendingAction("reload");
    setError("");
    const controller = new AbortController();
    readController.current?.abort();
    readController.current = controller;
    try {
      const { data, recoveryMessage } = await fetchSavedSession(controller.signal);
      accept(data);
      setError(recoveryMessage);
    } catch (e) {
      if (controller.signal.aborted) return;
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
    const controller = new AbortController();
    readController.current = controller;
    const initial = (async () => {
      let created = readStartResponse<TrainingSession>('training', userId, id);
      // Create can return an existing active session. A queued offline action
      // must still replay before accepting authoritative state for that session.
      if (created && offlineTrainingEnabled() && userId) {
        const pending = await readPendingTrainingAction(userId, id).catch(() => null);
        created = pending ? undefined : readStartResponse<TrainingSession>('training', userId, id);
      }
      if (created) return { data: created.data, recoveryMessage: '', receivedAt: created.receivedAt };
      const result = await fetchSavedSession(controller.signal);
      return { ...result, receivedAt: Date.now() };
    })();
    initial
      .then(({ data, recoveryMessage, receivedAt }) => {
        if (active) {
          clearStartResponse('training', userId, id);
          invalidateDashboard(userId);
          accept(data, true, receivedAt);
          setError(recoveryMessage);
        }
      })
      .catch(async () => {
        if (controller.signal.aborted) return;
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
      controller.abort();
      readController.current?.abort();
    };
  }, [id, userId, accept, fetchSavedSession, invalidateDashboard]);

  useEffect(() => {
    if (!offlineTrainingEnabled()) return;
    const reconnect = () => { void reload(); };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [reload]);

  const { act } = useTrainingActions({
    id,
    userId,
    session: visibleSession,
    sendingRef,
    setBusy,
    setPendingAction,
    setError,
    accept,
    setConfirmFinish
  });

  const { expired } = useTrainingClock(
    visibleSession,
    timeSync,
    act,
    busy,
    error
  );

  return {
    session: visibleSession,
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
