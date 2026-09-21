import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type Confidence, type TrainingSession } from "../../training-types";

import { useTrainingActions } from "./useTrainingActions";
import { useTrainingClock } from "./useTrainingClock";

export function useTrainingSession(id: string) {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeSync, setTimeSync] = useState({ serverNow: 0, receivedAt: 0 });
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  
  const sendingRef = useRef(false);

  const accept = useCallback((s: TrainingSession) => {
    setTimeSync({ serverNow: s.serverNow, receivedAt: Date.now() });
    setSession(s);
    setChoice(s.answers[s.questions[s.current].id]?.choice ?? null);
    setConfidence(s.answers[s.questions[s.current].id]?.confidence ?? null);
  }, []);

  const reload = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setPendingAction("reload");
    setError("");
    try {
      const { data } = await api.get<TrainingSession>(`/api/training/sessions/${id}`);
      accept(data);
      setError("");
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
  }, [id, accept]);

  useEffect(() => {
    let active = true;
    api
      .get<TrainingSession>(`/api/training/sessions/${id}`)
      .then(({ data }) => {
        if (active) accept(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load the session. Check your connection and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, accept]);

  const { act } = useTrainingActions({
    id,
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
