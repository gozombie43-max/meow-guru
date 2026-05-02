import { fetchWithRetry } from "./http";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const QUESTION_CACHE_TTL_MS = 2 * 60 * 1000;

type CachedQuestionsEntry = {
  expiresAt: number;
  promise?: Promise<Question[]>;
  value?: Question[];
};

const questionsCache = new Map<string, CachedQuestionsEntry>();

export interface Question {
  id: string;
  topic: string;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: string;
  exam: string;
  formula?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  correctLetter?: string;
  solution: string;
  solutionImage?: string;
  quizName?: string;
  questionType?: string;
  questionImage?: string;
  optionRegions?: Record<string, { x: number; y: number; w: number; h: number }>;
}

// Fetch questions with filters
export async function fetchQuestions(params: {
  topic?: string;
  subject?: string;
  difficulty?: string;
  quizName?: string;
  limit?: number;
  offset?: number;
  useCache?: boolean;
}): Promise<Question[]> {
  const query = new URLSearchParams();
  if (params.topic)      query.set('topic',      params.topic);
  if (params.subject)    query.set('subject',    params.subject);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.quizName)   query.set('quizName',   params.quizName);
  if (params.limit !== undefined)  query.set('limit',  String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  const cacheKey = query.toString();
  const useCache = params.useCache !== false;
  const now = Date.now();
  const cached = useCache ? questionsCache.get(cacheKey) : undefined;

  if (cached && cached.value && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const request = (async () => {
    const res = await fetchWithRetry(`${API}/api/questions?${query}`, { cache: "no-store" });
    if (!res.ok) throw new Error('Failed to fetch questions');
    const data = await res.json();
    const value = data.questions as Question[];

    if (useCache) {
      questionsCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + QUESTION_CACHE_TTL_MS,
      });
    }

    return value;
  })();

  if (useCache) {
    questionsCache.set(cacheKey, {
      promise: request,
      expiresAt: now + QUESTION_CACHE_TTL_MS,
    });
  }

  try {
    return await request;
  } catch (error) {
    if (useCache) {
      questionsCache.delete(cacheKey);
    }
    throw error;
  }
}

// Fetch random questions for practice test
export async function fetchPracticeTest(params: {
  topic?: string;
  subject?: string;
  difficulty?: string;
  count?: number;
}): Promise<Question[]> {
  const query = new URLSearchParams();
  if (params.topic)      query.set('topic',      params.topic);
  if (params.subject)    query.set('subject',    params.subject);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  query.set('count', String(params.count ?? 10));

  const res = await fetchWithRetry(`${API}/api/questions/practice-test?${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error('Failed to fetch practice test');
  const data = await res.json();
  return data.questions;
}
