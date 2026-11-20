import { useMemo } from 'react';
import useSWR from 'swr';
import { fetchQuestionKey, questionKey, type Question, type QuestionParams } from '@/features/quiz/api/questions';
import { useAbortableResource } from '@/lib/use-abortable-resource';

export function useQuestions(params: QuestionParams & { enabled?: boolean }) {
  const key = params.enabled === false ? null : questionKey(params);
  const read = useAbortableResource(key);
  const { data, error, isLoading, mutate } = useSWR<Question[]>(
    key,
    (url: string) => read(signal => fetchQuestionKey(url, { signal })),
    {
      revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false, dedupingInterval: 60000,
    },
  );
  return useMemo(() => ({ questions: data, isLoading, isError: error, mutate }), [data, isLoading, error, mutate]);
}
