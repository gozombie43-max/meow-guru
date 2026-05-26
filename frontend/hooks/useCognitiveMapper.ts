// frontend/hooks/useCognitiveMapper.ts
// QuizGuru — React hook for Cognitive Failure Mapper

import { useState, useCallback } from "react";
import axios from "@/lib/axios"; // your existing configured axios instance

export interface FailureTag {
  dimension: "CONCEPTUAL_GAP" | "APPLICATION_ERROR" | "TRAP_CAUGHT" | "SPEED_PANIC" | "BLIND_SPOT";
  reason: string;
  confidence: number;
  source: "rule" | "llm";
}

export interface TaggedAnswer {
  questionId: string;
  concept: string;
  dimension: string;
  reason: string;
  confidence: number;
}

export interface WeakConcept {
  key: string;
  topic: string;
  concept: string;
  totalWrong: number;
  dominantDimension: string;
  lastSeen: string;
  breakdown: Record<string, number>;
}

export interface BrainScanData {
  topWeakConcepts: WeakConcept[];
  globalDistribution: Record<string, number>;
  totalConceptsTracked: number;
  hasSufficientData: boolean;
}

// ─── Hook: tag a single wrong answer in real-time ────────────────────────────

export function useTagFailure() {
  const [loading, setLoading] = useState(false);
  const [lastTag, setLastTag] = useState<FailureTag | null>(null);

  const tagFailure = useCallback(async (params: {
    questionId: string;
    topic: string;
    concept: string;
    question: string;
    options: string[];
    userAnswer: string;
    correctAnswer: string;
    solution: string;
    timeSpent: number;
    changedAnswer?: boolean;
    skipped?: boolean;
  }) => {
    setLoading(true);
    try {
      const userId = localStorage.getItem("userId"); // or from your AuthContext
      const { data } = await axios.post("/api/agent/tag-failure", {
        userId,
        ...params,
      });
      setLastTag(data.tag);
      return data;
    } catch (err) {
      console.error("tagFailure error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { tagFailure, loading, lastTag };
}

// ─── Hook: batch tag after full quiz ─────────────────────────────────────────

export function useTagQuizResults() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TaggedAnswer[]>([]);

  const tagQuizResults = useCallback(async (wrongAnswers: any[]) => {
    if (!wrongAnswers.length) return null;
    setLoading(true);
    try {
      const userId = localStorage.getItem("userId");
      const { data } = await axios.post("/api/agent/tag-quiz-results", {
        userId,
        wrongAnswers,
      });
      setResults(data.tagged);
      return data;
    } catch (err) {
      console.error("tagQuizResults error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { tagQuizResults, loading, results };
}

// ─── Hook: fetch brain scan for dashboard ────────────────────────────────────

export function useBrainScan(userId: string) {
  const [data, setData] = useState<BrainScanData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBrainScan = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: res } = await axios.get(`/api/agent/brain-scan/${userId}`);
      setData(res);
    } catch (err) {
      console.error("brainScan error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, fetchBrainScan };
}

// ─── Hook: seed demo data (for development/testing) ──────────────────────────

export function useSeedDemoData() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const seedDemoData = useCallback(async (userId: string) => {
    setLoading(true);
    setSuccess(false);
    try {
      const { data } = await axios.post("/api/agent/seed-demo-data", { userId });
      setSuccess(data.success);
      return data;
    } catch (err) {
      console.error("seedDemoData error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { seedDemoData, loading, success };
}
