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

export interface WrongAnswerPayload {
  questionId: string;
  topic: string;
  concept: string;
  question?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  solution?: string;
  timeSpent?: number;
  changedAnswer?: boolean;
  skipped?: boolean;
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
  lastActiveDate?: string;
  source?: "failureMap" | "recentQuizzes" | "none";
  insights?: {
    adaptiveNextDrill?: {
      count: number;
      drillType: string;
      subject: string;
      topic: string;
      concept: string;
      difficulty: string;
      reason: string;
      focus: string;
      dominantDimension: string;
    };
    mistakeCoach?: Array<{
      concept: string;
      topic?: string;
      dimension: string;
      why: string;
      fix: string;
    }>;
    subjectHeatmap?: Array<{
      subject: string;
      totalWrong: number;
      topics: Array<{
        topic: string;
        totalWrong: number;
        concepts: number;
        avgTime: number;
        recentAt?: string;
      }>;
    }>;
    confidenceProfile?: {
      label: string;
      detail: string;
      fastWrongRate: number;
      skipRate: number;
      avgWrongTime: number;
      avgCorrectTime: number;
    };
    revisionPack?: Array<{
      subject: string;
      topic: string;
      concept: string;
      totalWrong: number;
      drillSize: number;
      drillType: string;
    }>;
    trapRadar?: {
      label: string;
      detail: string;
      trapShare: number;
      hotspots: Array<{
        concept: string;
        topic: string;
        hits: number;
      }>;
    };
    progressNarrative?: {
      headline: string;
      detail: string;
    };
    summary?: {
      totalFailures: number;
      trackedConcepts: number;
      weakestSubject: string | null;
    };
  };
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

  const tagQuizResults = useCallback(async (wrongAnswers: WrongAnswerPayload[]) => {
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
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("timeout")) {
        console.error("brainScan error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, fetchBrainScan };
}
