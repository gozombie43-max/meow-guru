import { useState, useEffect, useCallback } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type TrainingDashboard } from "@/components/training/training-types";

export function useTrainingDashboard(exam: string) {
  const [dashboard, setDashboard] = useState<TrainingDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [settledExam, setSettledExam] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError("");
    setLoading(true);
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    api
      .get<TrainingDashboard>("/api/training/dashboard", { params: { exam } })
      .then(({ data }) => {
        if (live) { setDashboard(data); setError(""); }
      })
      .catch((e) => {
        if (live)
          setError(
            isAxiosError(e)
              ? e.response?.data?.error || "Could not load your training profile."
              : "Could not load training.",
          );
      })
      .finally(() => {
        if (live) { setLoading(false); setSettledExam(exam); }
      });
    return () => {
      live = false;
    };
  }, [exam, attempt]);

  return { dashboard: settledExam === exam ? dashboard : null, loading: loading || settledExam !== exam, error: settledExam === exam ? error : "", setError, setDashboard, setLoading, retry };
}
