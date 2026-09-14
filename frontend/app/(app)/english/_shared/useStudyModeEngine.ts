"use client";
import { useQuestions } from '@/hooks/useQuestions';
import type { Question } from '@/lib/api/questions';
import { useMemo } from 'react';

// One loading/cache/error boundary for all study-mode presentations.
export function useStudyModeEngine<Card>(config: {
  topic: string;
  normalize: (entry: Question, index: number) => Card | null;
  fallback: Card[];
  compare?: (a: Card, b: Card) => number;
}) {
  const { questions: data, isLoading, isError: error } = useQuestions({ subject: 'english', topic: config.topic, questionType: 'study-mode' });
  const { normalize, compare, fallback } = config;
  const cards = useMemo(() => {
    const result = (data ?? []).map(normalize).filter((card): card is Card => card !== null);
    if (compare) result.sort(compare);
    return result.length ? result : fallback;
  }, [data, normalize, compare, fallback]);
  return { cards, loading: isLoading, error };
}
