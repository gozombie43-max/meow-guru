import { useMemo } from "react";
import useSWR from "swr";
import { fetchWithRetry } from "@/lib/api/http";
import { API_BASE } from "@/lib/api-base";

interface QuestionCountsResponse {
  concept: number;
  formula: number;
  mixed: number;
  aiChallenge: number;
  easy: number;
  hard: number;
  studyMode: number;
}

export interface ModeQuestionCounts {
  [mode: string]: number;
  concept: number;
  formula: number;
  mixed: number;
  "ai-challenge": number;
  easy: number;
  hard: number;
  "study-mode": number;
}

const EMPTY_COUNTS: ModeQuestionCounts = {
  concept: 0,
  formula: 0,
  mixed: 0,
  "ai-challenge": 0,
  easy: 0,
  hard: 0,
  "study-mode": 0,
};

async function fetchCounts(url: string): Promise<QuestionCountsResponse> {
  const response = await fetchWithRetry(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch question counts");
  return response.json();
}

export function useQuestionCounts(params: {
  enabled?: boolean;
  topic?: string;
  subject?: string;
}) {
  const query = new URLSearchParams();
  if (params.topic) query.set("topic", params.topic);
  if (params.subject) query.set("subject", params.subject);

  const hasFilter = Boolean(params.topic || params.subject);
  const url = params.enabled === false || !hasFilter
    ? null
    : `${API_BASE}/api/questions/counts?${query.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<QuestionCountsResponse>(url, fetchCounts, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: true,
    errorRetryCount: 2,
    errorRetryInterval: 1500,
    dedupingInterval: 60000,
  });

  const counts = useMemo<ModeQuestionCounts>(() => data
    ? {
        concept: data.concept,
        formula: data.formula,
        mixed: data.mixed,
        "ai-challenge": data.aiChallenge,
        easy: data.easy,
        hard: data.hard,
        "study-mode": data.studyMode,
      }
    : EMPTY_COUNTS, [data]);

  return useMemo(() => ({
    counts,
    isLoading,
    isError: error,
    mutate,
  }), [counts, error, isLoading, mutate]);
}
