import { useState, useEffect } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { type TrainingDashboard } from "@/components/training/training-types";

export function useTrainingDashboard(exam: string) {
  const [dashboard, setDashboard] = useState<TrainingDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api
      .get<TrainingDashboard>("/api/training/dashboard", { params: { exam } })
      .then(({ data }) => {
        if (live) setDashboard(data);
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
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [exam]);

  return { dashboard, loading, error, setError, setDashboard, setLoading };
}
