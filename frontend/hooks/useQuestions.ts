import useSWR from 'swr';
import { fetchWithRetry } from '@/lib/api/http';
import { isStudyModeQuestion, type Question } from '@/lib/api/questions';

const API = process.env.NEXT_PUBLIC_API_URL || "";

const fetcher = async (url: string) => {
  const res = await fetchWithRetry(url, { cache: "no-store" });
  if (!res.ok) throw new Error('Failed to fetch questions');
  const data = await res.json();
  let value = (data.questions || []) as Question[];

  const urlObj = new URL(url, "http://localhost");
  const qType = urlObj.searchParams.get("questionType")?.toLowerCase();
  const isStudyMode = qType === "study-mode" || qType === "studymode";
  const isAll = qType === "all";

  if (isStudyMode) {
    value = value.filter(isStudyModeQuestion);
  } else if (!isAll) {
    value = value.filter((q) => !isStudyModeQuestion(q));
  }

  return value;
};

export function useQuestions(params: {
  enabled?: boolean;
  topic?: string;
  subject?: string;
  difficulty?: string;
  quizName?: string;
  questionType?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params.topic) query.set('topic', params.topic);
  if (params.subject) query.set('subject', params.subject);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.quizName) query.set('quizName', params.quizName);
  if (params.questionType) query.set('questionType', params.questionType);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const url = params.enabled === false ? null : `${API}/api/questions?${query.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<Question[]>(url, fetcher, {
    revalidateOnFocus: false, // Questions rarely change while focusing
    dedupingInterval: 60000, // Dedupe calls for 1 min
  });

  return {
    questions: data,
    isLoading,
    isError: error,
    mutate
  };
}
