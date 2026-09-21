import { useState, useEffect } from "react";
import api from "@/shared/api/client";
import { type TrainingCapabilities } from "@/components/training/training-types";

export function useTrainingCapabilities() {
  const [capabilities, setCapabilities] = useState<TrainingCapabilities | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .get<TrainingCapabilities>("/api/training/capabilities")
      .then(({ data }) => {
        if (live) setCapabilities(data);
      })
      .catch(() => {
        if (live) setError("Could not load training capabilities.");
      });
    return () => {
      live = false;
    };
  }, []);

  return { capabilities, error, setError };
}
