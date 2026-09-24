import { useState, useEffect, useCallback } from "react";
import api from "@/shared/api/client";
import { type TrainingCapabilities } from "@/components/training/training-types";

export function useTrainingCapabilities() {
  const [capabilities, setCapabilities] = useState<TrainingCapabilities | null>(null);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError("");
    setLoading(true);
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    api
      .get<TrainingCapabilities>("/api/training/capabilities")
      .then(({ data }) => {
        if (live) setCapabilities(data);
      })
      .catch(() => {
        if (live) setError("Could not load training capabilities.");
      })
      .finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
    };
  }, [attempt]);

  return { capabilities, error, setError, loading, retry };
}
