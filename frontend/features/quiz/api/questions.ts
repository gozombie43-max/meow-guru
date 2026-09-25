import type { GeometryDiagram } from "@/components/geometry/diagramSchema";
import { API_BASE } from "@/lib/api-base";
import { request,requestResponse } from "@/shared/api/request";
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
  diagram?: GeometryDiagram;
  needs_diagram?: boolean;
  word?: string;
  letter?: string;
  meanings?: Array<{ pos?: string; definition?: string; translation?: string }>;
  synonyms?: Array<{ word?: string; translation?: string }>;
  antonyms?: Array<{ word?: string; translation?: string }>;
}

export function isStudyModeQuestion(q: Partial<Question> | null | undefined): boolean {
  if (!q || typeof q !== "object") return false;
  const qType = String(q.questionType || "").trim().toLowerCase();
  if (qType === "study-mode" || qType === "studymode") return true;
  if (String(q.quizName || "").trim().toLowerCase() === "study mode") return true;
  if (typeof q.word === "string" && q.word.trim() && Array.isArray(q.meanings)) return true;
  return false;
}


export interface QuestionParams {
  topic?: string; subject?: string; difficulty?: string; quizName?: string;
  questionType?: string; limit?: number; offset?: number;
}
export function questionKey(params: QuestionParams): string {
  const query = new URLSearchParams();
  for (const key of ['topic', 'subject', 'difficulty', 'quizName', 'questionType', 'limit', 'offset'] as const) {
    let value = params[key];
    if (key === 'questionType' && typeof value === 'string') value = value.toLowerCase() === 'studymode' ? 'study-mode' : value.toLowerCase();
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return `${API_BASE}/api/questions?${query}`;
}
export async function fetchQuestionKey(url: string): Promise<Question[]> {
  const type = new URL(url, 'http://localhost').searchParams.get('questionType');
  const library = type === 'study-mode' || type === 'studymode';
  const questions: Question[] = [];
  const query = new URL(url, 'http://localhost');
  const requestedLimit = Number(query.searchParams.get('limit'));
  if (!query.searchParams.has('offset') && !query.searchParams.has('search') && !query.searchParams.has('sort')) {
    // Prefer cursor pagination everywhere over heavy offset queries.
    // Transfer in bounded cursor pages without repeating exact count queries.
    query.searchParams.set('pagination', 'cursor');
    query.searchParams.set('includeTotal', 'false');
    query.searchParams.set('limit', String(requestedLimit > 0 ? Math.min(200, requestedLimit) : (library ? 200 : 50)));
  }
  const seen = new Set<string>();
  for (;;) {
    const data = await request<{ questions?: Question[]; nextCursor?: string | null; hasMore?: boolean }>(
      `${url.split('?')[0]}?${query.searchParams}`, { cache: 'no-store' },
    );
    questions.push(...(data.questions ?? []));
    if (query.searchParams.get('pagination') !== 'cursor' || !data.hasMore) break;
    if (requestedLimit > 0 && questions.length >= requestedLimit) break;
    if (!data.nextCursor || seen.has(data.nextCursor)) throw new Error('Invalid question pagination');
    seen.add(data.nextCursor);
    query.searchParams.set('cursor', data.nextCursor);
    if (requestedLimit > 0) query.searchParams.set('limit', String(Math.min(200, requestedLimit - questions.length)));
  }
  if (type === 'study-mode' || type === 'studymode') return questions.filter(isStudyModeQuestion);
  return type === 'all' ? questions : questions.filter(question => !isStudyModeQuestion(question));
}
export function fetchQuestions(params: QuestionParams): Promise<Question[]> {
  return fetchQuestionKey(questionKey(params));
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

  const res = await requestResponse(`${API_BASE}/api/questions/practice-test?${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error('Failed to fetch practice test');
  const data = await res.json();
  return data.questions;
}
