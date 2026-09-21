import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type Confidence, type TrainingSession } from "../../training-types";

export function useTrainingSession(id: string) {
  const router = useRouter();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  
  const offset = useRef(0);
  const sendingRef = useRef(false);

  const accept = useCallback((s: TrainingSession) => {
    offset.current = s.serverNow - Date.now();
    setSession(s);
    setNow(s.serverNow);
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

  return {
    session,
    error,
    busy,
    now,
    setNow,
    offset,
    choice,
    setChoice,
    confidence,
    setConfidence,
    pendingAction,
    setPendingAction,
    sendingRef,
    accept,
    reload,
    router,
    setError,
    setBusy
  };
}
