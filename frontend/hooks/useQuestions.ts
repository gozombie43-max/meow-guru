import { useMemo } from 'react';
import useSWR from 'swr';
import { fetchQuestionKey, questionKey, type Question, type QuestionParams } from '@/features/quiz/api/questions';

export function useQuestions(params: QuestionParams & { enabled?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<Question[]>(
    params.enabled === false ? null : questionKey(params), fetchQuestionKey, {
      revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false, dedupingInterval: 60000,
    },
  );
  return useMemo(() => ({ questions: data, isLoading, isError: error, mutate }), [data, isLoading, error, mutate]);
}
