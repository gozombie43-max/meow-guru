import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type ModeId } from "@/components/training/training-types";

export function useTrainingSetup(exam: string) {
  const router = useRouter();
  const [selected, setSelected] = useState<ModeId | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<number | "full">(20);
  const [tier, setTier] = useState("1");
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = useCallback((mode: ModeId, capabilitiesReady: boolean) => {
    if (!capabilitiesReady) {
      setError("Training setup is still loading. Please retry in a moment.");
      return;
    }
    setSelected(mode);
    setCount(mode === "section" ? 25 : 20);
    setError("");
  }, []);

  const start = useCallback(async (override?: ModeId) => {
    const mode = override || selected;
    if (!mode || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/training/sessions", {
        mode,
        exam,
        tier,
        subject: mode === "mission" ? undefined : subject || undefined,
        topic: mode === "mission" ? undefined : topic || undefined,
        count,
        minutes,
      });
      router.push(`/play/session/${data.id}`);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error || "Could not start the session. Please retry."
          : "Could not start training.",
      );
      setBusy(false);
    }
  }, [selected, busy, exam, tier, subject, topic, count, minutes, router]);

  return {
    selected, setSelected,
    subject, setSubject,
    topic, setTopic,
    count, setCount,
    tier, setTier,
    minutes, setMinutes,
    busy, error, setError,
    choose, start
  };
}
