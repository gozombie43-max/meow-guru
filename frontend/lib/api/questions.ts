import { fetchWithRetry } from "./http";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
}): Promise<Question[]> {
  const query = new URLSearchParams();
  if (params.topic)      query.set('topic',      params.topic);
  if (params.subject)    query.set('subject',    params.subject);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.quizName)   query.set('quizName',   params.quizName);
  if (params.limit !== undefined)  query.set('limit',  String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const res = await fetchWithRetry(`${API}/api/questions?${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error('Failed to fetch questions');
  const data = await res.json();
  return data.questions;
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